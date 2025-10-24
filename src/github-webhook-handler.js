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
      await this.analyzePR(
        repository.owner.login,
        repository.name,
        pull_request.number
      );
    } catch (error) {
      console.error('❌ PR Analysis failed:', error);
      
      // Comentar error en el PR
      await this.commentOnPR(
        repository.owner.login,
        repository.name,
        pull_request.number,
        `🤖 **Code Review Failed**

❌ **Error during analysis:** ${error.message}

Please check the server logs or contact support.

---
🔧 *Automated review by PR Code Reviewer*`
      );
    }
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