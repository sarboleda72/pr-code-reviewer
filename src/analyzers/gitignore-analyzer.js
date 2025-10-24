const fs = require('fs');
const path = require('path');

class GitignoreAnalyzer {
  constructor() {
    this.name = 'Gitignore Analyzer';
  }

  /**
   * Analiza si existe .gitignore y verifica su contenido
   * @param {string} projectPath - Ruta del proyecto a analizar
   * @param {Object} rules - Reglas específicas del proyecto
   * @returns {Object} Resultado del análisis
   */
  analyze(projectPath, rules) {
    const results = {
      analyzer: this.name,
      passed: [],
      failed: [],
      warnings: []
    };

    const gitignorePath = path.join(projectPath, '.gitignore');
    
    // Verificar si existe .gitignore
    if (!fs.existsSync(gitignorePath)) {
      results.failed.push({
        rule: 'gitignore-exists',
        message: '❌ Missing .gitignore file',
        suggestion: 'Create a .gitignore file to exclude unnecessary files from version control'
      });
      return results;
    }

    results.passed.push({
      rule: 'gitignore-exists',
      message: '✅ .gitignore file found'
    });

    // Leer contenido del .gitignore
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      const gitignoreLines = gitignoreContent.split('\n').map(line => line.trim());
      
      // Verificar reglas específicas según el tipo de proyecto
      if (rules.nodejs && rules.nodejs.gitignoreRules) {
        this.checkRequiredRules(gitignoreLines, rules.nodejs.gitignoreRules, results);
      } else if (rules.general) {
        this.checkGeneralRules(gitignoreLines, rules.general, results);
      }

    } catch (error) {
      results.failed.push({
        rule: 'gitignore-readable',
        message: '❌ Could not read .gitignore file',
        suggestion: 'Make sure .gitignore file is readable'
      });
    }

    return results;
  }

  /**
   * Verifica reglas específicas de Node.js
   */
  checkRequiredRules(gitignoreLines, requiredRules, results) {
    requiredRules.forEach(rule => {
      const found = gitignoreLines.some(line => 
        line === rule || line.includes(rule.replace('/', ''))
      );
      
      if (found) {
        results.passed.push({
          rule: `gitignore-has-${rule.replace('/', '')}`,
          message: `✅ .gitignore includes: ${rule}`
        });
      } else {
        results.failed.push({
          rule: `gitignore-missing-${rule.replace('/', '')}`,
          message: `❌ .gitignore missing: ${rule}`,
          suggestion: `Add '${rule}' to your .gitignore file`
        });
      }
    });
  }

  /**
   * Verifica reglas generales
   */
  checkGeneralRules(gitignoreLines, generalRules, results) {
    if (generalRules.prohibitedFolders) {
      generalRules.prohibitedFolders.forEach(folder => {
        const found = gitignoreLines.some(line => 
          line.includes(folder)
        );
        
        if (found) {
          results.passed.push({
            rule: `gitignore-excludes-${folder}`,
            message: `✅ .gitignore excludes: ${folder}`
          });
        } else {
          results.warnings.push({
            rule: `gitignore-should-exclude-${folder}`,
            message: `⚠️  Consider adding '${folder}/' to .gitignore`,
            suggestion: `Add '${folder}/' to exclude this folder from version control`
          });
        }
      });
    }
  }
}

module.exports = GitignoreAnalyzer;