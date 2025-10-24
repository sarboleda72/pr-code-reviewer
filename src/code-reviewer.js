const fs = require('fs');
const path = require('path');

// Importar analizadores
const GitignoreAnalyzer = require('./analyzers/gitignore-analyzer');
const EnvAnalyzer = require('./analyzers/env-analyzer');
const DependencyAnalyzer = require('./analyzers/dependency-analyzer');

class CodeReviewer {
  constructor() {
    this.analyzers = [
      new GitignoreAnalyzer(),
      new EnvAnalyzer(),
      new DependencyAnalyzer()
    ];
  }

  /**
   * Carga las reglas desde los archivos JSON
   * @param {string} projectType - Tipo de proyecto (nodejs, python, general)
   * @returns {Object} Reglas cargadas
   */
  loadRules(projectType = 'general') {
    try {
      const rulesPath = path.join(__dirname, '..', 'rules', `${projectType}-rules.json`);
      const generalRulesPath = path.join(__dirname, '..', 'rules', 'general-rules.json');
      
      let rules = {};
      
      // Cargar reglas generales primero
      if (fs.existsSync(generalRulesPath)) {
        const generalRules = JSON.parse(fs.readFileSync(generalRulesPath, 'utf8'));
        rules = { ...generalRules };
      }
      
      // Cargar reglas específicas del proyecto
      if (fs.existsSync(rulesPath)) {
        const projectRules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        rules = { ...rules, ...projectRules };
      }
      
      return rules;
    } catch (error) {
      console.error('Error loading rules:', error.message);
      return { general: {} }; // Reglas por defecto
    }
  }

  /**
   * Detecta el tipo de proyecto basándose en los archivos presentes
   * @param {string} projectPath - Ruta del proyecto
   * @returns {string} Tipo de proyecto detectado
   */
  detectProjectType(projectPath) {
    try {
      const files = fs.readdirSync(projectPath);
      
      // Detectar Node.js
      if (files.includes('package.json')) {
        return 'nodejs';
      }
      
      // Detectar Python
      if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
        return 'python';
      }
      
      // Por defecto
      return 'general';
    } catch (error) {
      console.error('Error detecting project type:', error.message);
      return 'general';
    }
  }

  /**
   * Ejecuta todos los analizadores en un proyecto
   * @param {string} projectPath - Ruta del proyecto a analizar
   * @param {string} projectType - Tipo de proyecto (opcional, se detecta automáticamente)
   * @returns {Object} Resultado completo del análisis
   */
  async analyzeProject(projectPath, projectType = null) {
    console.log(`🔍 Analyzing project: ${projectPath}`);
    
    // Verificar que el directorio existe
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project directory does not exist: ${projectPath}`);
    }

    // Detectar tipo de proyecto si no se especifica
    if (!projectType) {
      projectType = this.detectProjectType(projectPath);
    }
    
    console.log(`📁 Project type detected: ${projectType}`);
    
    // Cargar reglas
    const rules = this.loadRules(projectType);
    
    // Ejecutar todos los analizadores
    const results = {
      projectPath,
      projectType,
      timestamp: new Date().toISOString(),
      summary: {
        totalAnalyzers: this.analyzers.length,
        passed: 0,
        failed: 0,
        warnings: 0
      },
      analyzers: []
    };

    for (const analyzer of this.analyzers) {
      console.log(`  Running ${analyzer.name}...`);
      
      try {
        const analyzerResult = analyzer.analyze(projectPath, rules);
        results.analyzers.push(analyzerResult);
        
        // Actualizar resumen
        results.summary.passed += analyzerResult.passed.length;
        results.summary.failed += analyzerResult.failed.length;
        results.summary.warnings += analyzerResult.warnings.length;
        
      } catch (error) {
        console.error(`Error in ${analyzer.name}:`, error.message);
        results.analyzers.push({
          analyzer: analyzer.name,
          error: error.message,
          passed: [],
          failed: [],
          warnings: []
        });
      }
    }

    return results;
  }

  /**
   * Genera un reporte legible del análisis
   * @param {Object} results - Resultados del análisis
   * @returns {string} Reporte formateado
   */
  generateReport(results) {
    let report = '';
    
    report += `🤖 **Code Structure Review**\n\n`;
    report += `📁 Project: ${path.basename(results.projectPath)}\n`;
    report += `🔧 Type: ${results.projectType}\n`;
    report += `📊 Summary: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings\n\n`;

    // Mostrar errores críticos primero
    const criticalIssues = [];
    const warnings = [];
    const successes = [];

    results.analyzers.forEach(analyzer => {
      if (analyzer.error) {
        criticalIssues.push(`❌ **${analyzer.analyzer}**: ${analyzer.error}`);
        return;
      }

      analyzer.failed.forEach(failure => {
        criticalIssues.push(`❌ **${failure.message}**`);
        if (failure.suggestion) {
          criticalIssues.push(`   💡 *${failure.suggestion}*`);
        }
      });

      analyzer.warnings.forEach(warning => {
        warnings.push(`⚠️  **${warning.message}**`);
        if (warning.suggestion) {
          warnings.push(`   💡 *${warning.suggestion}*`);
        }
      });

      analyzer.passed.forEach(success => {
        successes.push(`✅ ${success.message}`);
      });
    });

    // Mostrar secciones
    if (criticalIssues.length > 0) {
      report += `## ❌ Issues Found\n`;
      report += criticalIssues.join('\n') + '\n\n';
    }

    if (warnings.length > 0) {
      report += `## ⚠️  Warnings\n`;
      report += warnings.join('\n') + '\n\n';
    }

    if (successes.length > 0) {
      report += `## ✅ Good Practices Found\n`;
      report += successes.join('\n') + '\n\n';
    }

    // Agregar sugerencias generales
    if (criticalIssues.length > 0 || warnings.length > 0) {
      report += `## 📚 General Recommendations\n`;
      report += `- Keep your .gitignore file updated\n`;
      report += `- Never commit environment files (.env)\n`;
      report += `- Exclude dependency folders (node_modules, .venv)\n`;
      report += `- Use .env.example to document required environment variables\n`;
    }

    return report;
  }
}

module.exports = CodeReviewer;