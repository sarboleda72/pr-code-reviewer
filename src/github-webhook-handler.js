const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const { Octokit } = require('@octokit/rest');
const CodeReviewer = require('./code-reviewer');
const crypto = require('crypto');

class GitHubWebhookHandler {
  constructor() {
    this.app = express();
    this.codeReviewer = new CodeReviewer();
    
    // Configuración de webhook
    this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
    this.githubToken = process.env.GITHUB_TOKEN; // Personal Access Token o App Token
    
    // Cliente de GitHub
    this.octokit = new Octokit({
      auth: this.githubToken,
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Middleware para recibir raw body (necesario para verificar webhooks)
    this.app.use('/webhook', express.raw({ type: 'application/json' }));
    this.app.use(express.json());
  }

  setupRoutes() {
    // Endpoint principal
    this.app.get('/', (req, res) => {
      res.json({
        name: '🤖 PR Code Reviewer GitHub App',
        version: '2.0.0',
        status: 'active',
        endpoints: {
          'POST /webhook': 'GitHub webhook handler',
          'GET /health': 'Health check',
          'POST /analyze': 'Manual analysis (for testing)'
        }
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        webhook: this.webhookSecret ? 'configured' : 'not configured',
        github: this.githubToken ? 'authenticated' : 'not authenticated'
      });
    });

    // Webhook endpoint
    this.app.post('/webhook', (req, res) => {
      this.handleWebhook(req, res);
    });

    // Manual analysis endpoint (para testing)
    this.app.post('/analyze', async (req, res) => {
      try {
        const { owner, repo, pr_number } = req.body;
        
        if (!owner || !repo || !pr_number) {
          return res.status(400).json({
            error: 'Missing required fields: owner, repo, pr_number'
          });
        }

        const result = await this.analyzePR(owner, repo, pr_number);
        res.json(result);
        
      } catch (error) {
        console.error('Manual analysis error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Verifica la firma del webhook de GitHub
   */
  verifyWebhookSignature(payload, signature) {
    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    const expectedSignature = `sha256=${computedSignature}`;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Maneja los webhooks de GitHub
   */
  async handleWebhook(req, res) {
    try {
      // Verificar firma del webhook
      const signature = req.headers['x-hub-signature-256'];
      if (this.webhookSecret && signature) {
        if (!this.verifyWebhookSignature(req.body, signature)) {
          console.warn('❌ Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Parse del payload
      const payload = JSON.parse(req.body.toString());
      const event = req.headers['x-github-event'];

      console.log(`📨 Webhook received: ${event}`);
      
      // Solo procesar eventos de Pull Requests
      if (event === 'pull_request') {
        await this.handlePullRequestEvent(payload);
      }

      res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Maneja eventos específicos de Pull Requests
   */
  async handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;
    
    // Solo actuar en ciertos eventos
    const relevantActions = ['opened', 'synchronize', 'reopened'];
    if (!relevantActions.includes(action)) {
      console.log(`⏭️  Skipping PR action: ${action}`);
      return;
    }

    console.log(`🔍 Analyzing PR #${pull_request.number} in ${repository.full_name}`);
    
    try {
      // Intentar análisis completo primero
      await this.analyzeFullPR(
        repository.owner.login,
        repository.name,
        pull_request.number
      );
    } catch (error) {
      console.error('❌ Full analysis failed, using fallback:', error.message);
      
      // Análisis de fallback usando webhook data
      const fallbackAnalysis = this.analyzePRWebhookData(pull_request, repository);
      const fallbackReport = this.generateFallbackSpanishReport(fallbackAnalysis, pull_request);
      
      await this.commentOnPR(
        repository.owner.login,
        repository.name,
        pull_request.number,
        fallbackReport
      );
    }
  }

  /**
   * Análisis completo usando CodeReviewer y analyzers
   */
  async analyzeFullPR(owner, repo, prNumber) {
    console.log(`📊 Starting complete analysis: ${owner}/${repo}#${prNumber}`);

    // Obtener archivos del PR
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_request_number: prNumber,
    });

    console.log(`📁 PR contains ${files.length} files`);

    // Usar CodeReviewer para análisis completo
    const CodeReviewer = require('./code-reviewer');
    const reviewer = new CodeReviewer();

    // Simular análisis en archivos del PR
    const analysisResult = this.analyzeFileStructure(files, repo);
    
    // Generar reporte en español
    const report = this.generateSpanishReport(analysisResult, files);

    // Comentar en el PR
    await this.commentOnPR(owner, repo, prNumber, report);

    return { success: true, analysis: analysisResult, filesAnalyzed: files.length };
  }

  /**
   * Analiza la estructura de archivos del PR
   */
  analyzeFileStructure(files, repoName) {
    const results = {
      projectType: 'nodejs', // Detectar automáticamente
      summary: { passed: 0, failed: 0, warnings: 0 },
      issues: [],
      warnings: [],
      successes: []
    };

    // Buscar archivos problemáticos
    const problematicFiles = [];
    const filesOutsideSrc = [];
    const srcStructure = {
      controllers: false,
      services: false,
      routes: false,
      models: false,
      utils: false,
      gateways: false
    };

    let hasGitignore = false;
    let hasPackageJson = false;

    files.forEach(file => {
      const filename = file.filename;
      
      // Verificar archivos prohibidos
      if (filename.match(/^\.env/) && filename !== '.env.example') {
        results.issues.push({
          type: 'env-file',
          file: filename,
          message: `❌ Archivo de entorno detectado: ${filename}`,
          suggestion: `Eliminar '${filename}' del repositorio y agregarlo a .gitignore. Usar '.env.example' para mostrar variables requeridas.`
        });
        results.summary.failed++;
      }

      // node_modules
      if (filename.startsWith('node_modules/')) {
        results.issues.push({
          type: 'dependency-folder',
          file: 'node_modules/',
          message: '❌ Carpeta node_modules/ no debe estar en el repositorio',
          suggestion: 'Agregar node_modules/ a .gitignore y eliminar del repositorio'
        });
        results.summary.failed++;
      }

      // .venv o venv
      if (filename.startsWith('.venv/') || filename.startsWith('venv/')) {
        results.issues.push({
          type: 'venv-folder',
          file: filename.split('/')[0] + '/',
          message: `❌ Entorno virtual ${filename.split('/')[0]}/ no debe estar en el repositorio`,
          suggestion: `Agregar ${filename.split('/')[0]}/ a .gitignore y eliminar del repositorio`
        });
        results.summary.failed++;
      }

      // Verificar .gitignore
      if (filename === '.gitignore') {
        hasGitignore = true;
        results.successes.push({
          type: 'gitignore',
          message: '✅ Archivo .gitignore encontrado'
        });
        results.summary.passed++;
      }

      // Verificar package.json
      if (filename === 'package.json') {
        hasPackageJson = true;
        results.successes.push({
          type: 'package-json',
          message: '✅ Archivo package.json encontrado'
        });
        results.summary.passed++;
      }

      // Verificar estructura src/
      if (filename.startsWith('src/')) {
        // Detectar subcarpetas de src
        const parts = filename.split('/');
        if (parts.length > 1) {
          const folder = parts[1];
          if (srcStructure.hasOwnProperty(folder)) {
            srcStructure[folder] = true;
          }
        }
      } else {
        // Archivos fuera de src que podrían estar dentro
        if (filename.match(/\.(js|ts|jsx|tsx)$/) && !filename.match(/^(test|spec|\.)/)) {
          const parts = filename.split('/');
          if (parts.length === 1 || !parts[0].match(/^(node_modules|dist|build|coverage)/)) {
            filesOutsideSrc.push(filename);
          }
        }
      }
    });

    // Verificar archivos faltantes
    if (!hasGitignore) {
      results.issues.push({
        type: 'missing-gitignore',
        message: '❌ Archivo .gitignore faltante',
        suggestion: 'Crear archivo .gitignore para excluir archivos innecesarios del control de versiones'
      });
      results.summary.failed++;
    }

    // Verificar estructura recomendada
    const recommendedFolders = ['controllers', 'services', 'routes'];
    const missingSrcFolders = recommendedFolders.filter(folder => !srcStructure[folder]);
    
    if (Object.values(srcStructure).some(exists => exists)) {
      results.successes.push({
        type: 'src-structure',
        message: '✅ Estructura src/ encontrada'
      });
      results.summary.passed++;

      // Recomendar carpetas faltantes
      if (missingSrcFolders.length > 0) {
        results.warnings.push({
          type: 'missing-folders',
          message: `⚠️  Considerar agregar: src/${missingSrcFolders.join('/, src/')}/ para mejor organización`,
          suggestion: 'Organizar el código en carpetas específicas (controllers, services, routes) mejora la mantenibilidad'
        });
        results.summary.warnings++;
      }
    }

    // Archivos fuera de src/
    if (filesOutsideSrc.length > 0) {
      results.warnings.push({
        type: 'files-outside-src',
        message: `⚠️  Archivos fuera de src/: ${filesOutsideSrc.slice(0, 3).join(', ')}${filesOutsideSrc.length > 3 ? '...' : ''}`,
        suggestion: 'Considerar mover archivos de código a la carpeta src/ para mejor organización'
      });
      results.summary.warnings++;
    }

    return results;
  }

  /**
   * Análisis mejorado usando datos del webhook (fallback)
   */
  analyzePRWebhookData(pull_request, repository) {
    const results = {
      projectType: 'nodejs',
      summary: { passed: 0, failed: 0, warnings: 0 },
      issues: [],
      warnings: [],
      successes: []
    };

    const prTitle = pull_request.title || '';
    const prBody = pull_request.body || '';
    const prText = (prTitle + ' ' + prBody).toLowerCase();

    // Detectar problemas por menciones en título/descripción
    if (prText.includes('.env') || prText.includes('environment')) {
      results.issues.push({
        type: 'env-mentioned',
        message: '❌ Se mencionan archivos .env en el PR',
        suggestion: 'Verificar que no se hayan committeado archivos .env con credenciales'
      });
      results.summary.failed++;
    }

    if (prText.includes('node_modules')) {
      results.issues.push({
        type: 'nodemodules-mentioned',
        message: '❌ Se menciona node_modules en el PR',
        suggestion: 'Verificar que la carpeta node_modules/ esté en .gitignore'
      });
      results.summary.failed++;
    }

    if (prText.includes('.venv') || prText.includes('venv')) {
      results.issues.push({
        type: 'venv-mentioned',
        message: '❌ Se mencionan entornos virtuales Python',
        suggestion: 'Verificar que carpetas .venv/ o venv/ estén en .gitignore'
      });
      results.summary.failed++;
    }

    // Detectar buenas prácticas
    if (prText.includes('gitignore')) {
      results.successes.push({
        type: 'gitignore-mentioned',
        message: '✅ Se menciona .gitignore (buena práctica)'
      });
      results.summary.passed++;
    }

    if (prText.includes('src/') || prText.includes('estructura') || prText.includes('organiz')) {
      results.successes.push({
        type: 'structure-mentioned',
        message: '✅ Se menciona organización de código'
      });
      results.summary.passed++;
    }

    if (prText.includes('test') || prText.includes('prueba')) {
      results.successes.push({
        type: 'testing-mentioned',
        message: '✅ Se mencionan pruebas (excelente práctica)'
      });
      results.summary.passed++;
    }

    // Si no hay problemas detectados, dar recomendaciones generales
    if (results.issues.length === 0) {
      results.warnings.push({
        type: 'general-reminder',
        message: '⚠️  Recordatorio: Verificar estructura general del proyecto',
        suggestion: 'Revisar que archivos sensibles (.env) no estén committeados y código esté organizado en src/'
      });
      results.summary.warnings++;
    }

    return results;
  }

  /**
   * Genera reporte de fallback en español
   */
  generateFallbackSpanishReport(analysis, pr) {
    let report = `🤖 **Revisión de Estructura de Código** (Análisis Básico)

📋 **PR:** ${pr.title}
🔧 **Repositorio:** ${pr.base.repo.name}
📊 **Análisis básico:** ${analysis.summary.passed} ✅ | ${analysis.summary.failed} ❌ | ${analysis.summary.warnings} ⚠️

> ℹ️ *Análisis limitado por permisos. Para análisis completo de archivos, verificar configuración de la GitHub App.*

`;

    // Problemas detectados
    if (analysis.issues.length > 0) {
      report += `## ❌ Posibles Problemas Detectados\n\n`;
      analysis.issues.forEach(issue => {
        report += `**${issue.message}**\n`;
        if (issue.suggestion) {
          report += `💡 *${issue.suggestion}*\n\n`;
        }
      });
    }

    // Advertencias
    if (analysis.warnings.length > 0) {
      report += `## ⚠️  Recomendaciones Generales\n\n`;
      analysis.warnings.forEach(warning => {
        report += `**${warning.message}**\n`;
        if (warning.suggestion) {
          report += `💡 *${warning.suggestion}*\n\n`;
        }
      });
    }

    // Buenas prácticas
    if (analysis.successes.length > 0) {
      report += `## ✅ Buenas Prácticas Identificadas\n\n`;
      analysis.successes.forEach(success => {
        report += `${success.message}\n`;
      });
      report += `\n`;
    }

    // Lista de verificación
    report += `## 📋 Lista de Verificación Manual

**Archivos que NO deben estar en el repositorio:**
- [ ] ❌ Archivos \`.env\`, \`.env.local\`, \`.env.production\`
- [ ] ❌ Carpeta \`node_modules/\`
- [ ] ❌ Carpetas \`.venv/\` o \`venv/\` (Python)
- [ ] ❌ Archivos de configuración de IDE (.vscode/, .idea/)

**Estructura recomendada:**
- [ ] ✅ Archivo \`.gitignore\` presente y configurado
- [ ] ✅ Código organizado dentro de \`src/\`
- [ ] ✅ Carpetas específicas: \`src/controllers/\`, \`src/services/\`, \`src/routes/\`
- [ ] ✅ Archivo \`README.md\` con documentación

**Mejores prácticas:**
- [ ] ✅ Usar \`.env.example\` para mostrar variables requeridas
- [ ] ✅ Nombres descriptivos para carpetas y archivos
- [ ] ✅ Separar lógica por responsabilidades

`;

    report += `\n---
🤖 *Revisión automatizada por [PR Code Reviewer](https://github.com/sarboleda72/pr-code-reviewer)*  
📊 Analizado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}  
🔧 Para análisis completo, verificar permisos de la GitHub App`;

    return report;
  }

  /**
   * Análisis simplificado usando datos del webhook (sin API calls)
   */
  analyzeWebhookData(pull_request, repository) {
    const results = {
      projectType: 'unknown',
      summary: { passed: 0, failed: 0, warnings: 0 },
      issues: [],
      warnings: [],
      successes: []
    };

    // Detectar tipo de proyecto por nombre de repo y título
    if (repository.name.includes('node') || pull_request.title.toLowerCase().includes('npm')) {
      results.projectType = 'nodejs';
    } else if (repository.name.includes('python') || pull_request.title.toLowerCase().includes('pip')) {
      results.projectType = 'python';
    } else {
      results.projectType = 'general';
    }

    // Análisis básico basado en el contenido del PR
    const prBody = pull_request.body || '';
    const prTitle = pull_request.title || '';
    
    // Buscar indicadores de problemas en el título/descripción
    if (prTitle.toLowerCase().includes('.env') || prBody.includes('.env')) {
      results.issues.push({
        type: 'env-file-mentioned',
        message: '⚠️  PR mentions .env files - verify no sensitive data is committed',
        suggestion: 'Ensure .env files are in .gitignore and not committed to the repository'
      });
      results.summary.failed++;
    }

    // Buenas prácticas encontradas
    if (prBody.includes('test') || prTitle.toLowerCase().includes('test')) {
      results.successes.push({
        type: 'testing-mentioned',
        message: '✅ PR mentions testing - good practice'
      });
      results.summary.passed++;
    }

    if (prBody.length > 20) {
      results.successes.push({
        type: 'good-description',
        message: '✅ PR has a detailed description'
      });
      results.summary.passed++;
    }

    return results;
  }

  /**
   * Genera reporte completo en español
   */
  generateSpanishReport(analysis, files) {
    let report = `🤖 **Revisión de Estructura de Código**

📁 **Archivos analizados:** ${files.length}
🔧 **Tipo de proyecto:** ${analysis.projectType}
📊 **Resultados:** ${analysis.summary.passed} ✅ | ${analysis.summary.failed} ❌ | ${analysis.summary.warnings} ⚠️

`;

    // Problemas críticos
    if (analysis.issues.length > 0) {
      report += `## ❌ Problemas Encontrados\n\n`;
      analysis.issues.forEach(issue => {
        report += `**${issue.message}**\n`;
        if (issue.suggestion) {
          report += `💡 *${issue.suggestion}*\n\n`;
        }
      });
    }

    // Advertencias
    if (analysis.warnings.length > 0) {
      report += `## ⚠️  Recomendaciones\n\n`;
      analysis.warnings.forEach(warning => {
        report += `**${warning.message}**\n`;
        if (warning.suggestion) {
          report += `💡 *${warning.suggestion}*\n\n`;
        }
      });
    }

    // Buenas prácticas encontradas
    if (analysis.successes.length > 0) {
      report += `## ✅ Buenas Prácticas Encontradas\n\n`;
      analysis.successes.forEach(success => {
        report += `${success.message}\n`;
      });
      report += `\n`;
    }

    // Estructura recomendada
    report += `## 📁 Estructura Recomendada

Para proyectos Node.js, se recomienda la siguiente organización:

\`\`\`
src/
├── controllers/     # Controladores de rutas
├── services/        # Lógica de negocio  
├── routes/          # Definición de rutas
├── models/          # Modelos de datos
├── utils/           # Utilidades y helpers
└── gateways/        # Conexiones externas
\`\`\`

## 🔧 Mejores Prácticas

- ✅ **Nunca commitear** archivos .env (usar .env.example)
- ✅ **Excluir** node_modules/ y .venv/ en .gitignore
- ✅ **Organizar código** dentro de src/ por responsabilidades
- ✅ **Usar nombres descriptivos** para carpetas y archivos
- ✅ **Mantener** estructura consistente en el proyecto

`;

    report += `\n---
🤖 *Revisión automatizada por [PR Code Reviewer](https://github.com/sarboleda72/pr-code-reviewer)*  
📊 Analizado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}  
📝 Archivos revisados: ${files.map(f => f.filename).slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`;

    return report;
  }

  /**
   * Genera reporte simplificado
   */
  generateSimpleReport(analysis, pr) {
    let report = `🤖 **Code Structure Review** (Basic Analysis)

📋 **PR:** ${pr.title}
🔧 **Project type:** ${analysis.projectType}
📊 **Analysis:** ${analysis.summary.passed} passed, ${analysis.summary.failed} failed, ${analysis.summary.warnings} warnings

`;

    // Issues
    if (analysis.issues.length > 0) {
      report += `## ⚠️  Potential Issues\n\n`;
      analysis.issues.forEach(issue => {
        report += `${issue.message}\n`;
        if (issue.suggestion) {
          report += `💡 *${issue.suggestion}*\n\n`;
        }
      });
    }

    // Successes  
    if (analysis.successes.length > 0) {
      report += `## ✅ Good Practices\n\n`;
      analysis.successes.forEach(success => {
        report += `${success.message}\n`;
      });
    }

    // Nota sobre análisis básico
    report += `\n## 📝 Note
This is a basic analysis using PR metadata. For detailed file analysis, please ensure the GitHub App has proper permissions to read repository contents.

### 🔧 Common Checks:
- ✅ Avoid committing .env files
- ✅ Use meaningful PR titles and descriptions  
- ✅ Include tests when possible
- ✅ Follow project structure conventions

`;

    report += `\n---
🤖 *Automated review by [PR Code Reviewer](https://github.com/sarboleda72/pr-code-reviewer)*
📊 Reviewed at: ${new Date().toISOString()}
🔄 Commit: \`${pr.head.sha.substring(0, 7)}\``;

    return report;
  }

  /**
   * Analiza un Pull Request específico
   */
  async analyzePR(owner, repo, prNumber) {
    console.log(`📊 Starting analysis: ${owner}/${repo}#${prNumber}`);

    // 1. Obtener información del PR
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_request_number: prNumber,
    });

    // 2. Obtener archivos del PR
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_request_number: prNumber,
    });

    console.log(`📁 PR contains ${files.length} files`);

    // 3. Descargar y analizar archivos relevantes
    const analysisResult = await this.analyzeFiles(owner, repo, pr.head.sha, files);

    // 4. Generar reporte
    const report = this.generatePRReport(analysisResult, pr, files);

    // 5. Comentar en el PR
    await this.commentOnPR(owner, repo, prNumber, report);

    return {
      success: true,
      pr: `${owner}/${repo}#${prNumber}`,
      analysis: analysisResult,
      filesAnalyzed: files.length
    };
  }

  /**
   * Analiza archivos específicos del PR
   */
  async analyzeFiles(owner, repo, sha, files) {
    // Por ahora, análisis básico basado en nombres de archivos
    // TODO: Descargar archivos específicos para análisis más profundo
    
    const results = {
      projectType: 'unknown',
      summary: { passed: 0, failed: 0, warnings: 0 },
      issues: [],
      warnings: [],
      successes: []
    };

    // Detectar tipo de proyecto
    const hasPackageJson = files.some(f => f.filename === 'package.json');
    const hasRequirements = files.some(f => f.filename === 'requirements.txt');
    
    if (hasPackageJson) results.projectType = 'nodejs';
    else if (hasRequirements) results.projectType = 'python';

    // Verificar archivos problemáticos
    files.forEach(file => {
      const filename = file.filename;
      
      // Archivos .env
      if (filename.match(/^\.env/) && filename !== '.env.example') {
        results.issues.push({
          type: 'env-file',
          file: filename,
          message: `❌ Environment file should not be committed: ${filename}`,
          suggestion: `Remove ${filename} and add it to .gitignore`
        });
        results.summary.failed++;
      }

      // Carpetas de dependencias
      if (filename.startsWith('node_modules/')) {
        results.issues.push({
          type: 'dependency-folder',
          file: 'node_modules/',
          message: '❌ node_modules/ folder should not be committed',
          suggestion: 'Add node_modules/ to .gitignore and remove from repository'
        });
        results.summary.failed++;
      }

      // Verificar .gitignore
      if (filename === '.gitignore') {
        results.successes.push({
          type: 'gitignore',
          message: '✅ .gitignore file found'
        });
        results.summary.passed++;
      }
    });

    return results;
  }

  /**
   * Genera reporte específico para PR
   */
  generatePRReport(analysis, pr, files) {
    let report = `🤖 **Code Structure Review**

📋 **PR Summary:** ${pr.title}
📁 **Files changed:** ${files.length}
🔧 **Project type:** ${analysis.projectType}
📊 **Analysis:** ${analysis.summary.passed} passed, ${analysis.summary.failed} failed, ${analysis.summary.warnings} warnings

`;

    // Issues críticos
    if (analysis.issues.length > 0) {
      report += `## ❌ Issues Found\n\n`;
      analysis.issues.forEach(issue => {
        report += `${issue.message}\n`;
        if (issue.suggestion) {
          report += `💡 *${issue.suggestion}*\n\n`;
        }
      });
    }

    // Warnings
    if (analysis.warnings.length > 0) {
      report += `## ⚠️  Warnings\n\n`;
      analysis.warnings.forEach(warning => {
        report += `${warning.message}\n\n`;
      });
    }

    // Successes
    if (analysis.successes.length > 0) {
      report += `## ✅ Good Practices\n\n`;
      analysis.successes.forEach(success => {
        report += `${success.message}\n`;
      });
    }

    report += `\n---
🤖 *Automated review by [PR Code Reviewer](https://github.com/sarboleda72/pr-code-reviewer)*
📊 Reviewed at: ${new Date().toISOString()}
🔄 Commit: \`${pr.head.sha.substring(0, 7)}\``;

    return report;
  }

  /**
   * Comenta en un Pull Request
   */
  async commentOnPR(owner, repo, prNumber, message) {
    try {
      // Buscar comentarios existentes del bot
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      });

      const botComment = comments.find(comment => 
        comment.body.includes('🤖 **Code Structure Review**')
      );

      if (botComment) {
        // Actualizar comentario existente
        await this.octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: botComment.id,
          body: message
        });
        console.log('✅ Updated existing comment');
      } else {
        // Crear nuevo comentario
        await this.octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: message
        });
        console.log('✅ Created new comment');
      }

    } catch (error) {
      console.error('❌ Failed to comment on PR:', error);
      throw error;
    }
  }

  /**
   * Inicia el servidor
   */
  start(port = 3000) {
    this.app.listen(port, () => {
      console.log('🚀 PR Code Reviewer GitHub App Server');
      console.log('=====================================');
      console.log(`📡 Server running on port ${port}`);
      console.log(`🔗 Webhook URL: http://your-domain.com/webhook`);
      console.log(`🔑 Webhook secret: ${this.webhookSecret ? 'configured' : 'NOT CONFIGURED'}`);
      console.log(`🔐 GitHub token: ${this.githubToken ? 'configured' : 'NOT CONFIGURED'}`);
      console.log('📋 Ready to receive GitHub webhooks!');
    });
  }
}

module.exports = GitHubWebhookHandler;