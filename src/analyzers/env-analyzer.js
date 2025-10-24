const fs = require('fs');
const path = require('path');

class EnvAnalyzer {
  constructor() {
    this.name = 'Environment Files Analyzer';
  }

  /**
   * Busca archivos .env que no deberían estar committeados
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

    // Obtener lista de archivos .env prohibidos
    const prohibitedEnvFiles = rules.general?.prohibitedFiles || [
      '.env', '.env.local', '.env.production', '.env.development'
    ];

    // Buscar archivos .env en el directorio raíz
    const foundEnvFiles = this.findEnvFiles(projectPath, prohibitedEnvFiles);

    if (foundEnvFiles.length === 0) {
      results.passed.push({
        rule: 'no-env-files-committed',
        message: '✅ No .env files found in repository'
      });
    } else {
      foundEnvFiles.forEach(envFile => {
        results.failed.push({
          rule: 'env-file-committed',
          message: `❌ Environment file found: ${envFile}`,
          suggestion: `Remove '${envFile}' from repository and add it to .gitignore. Use '.env.example' instead to show required variables.`
        });
      });
    }

    // Verificar si existe .env.example (buena práctica)
    const envExamplePath = path.join(projectPath, '.env.example');
    if (fs.existsSync(envExamplePath)) {
      results.passed.push({
        rule: 'env-example-exists',
        message: '✅ .env.example file found (good practice)'
      });
    } else {
      results.warnings.push({
        rule: 'env-example-recommended',
        message: '⚠️  Consider creating .env.example file',
        suggestion: 'Create .env.example with dummy values to show required environment variables'
      });
    }

    return results;
  }

  /**
   * Busca archivos .env en el directorio del proyecto
   */
  findEnvFiles(projectPath, prohibitedFiles) {
    const foundFiles = [];

    try {
      const files = fs.readdirSync(projectPath);
      
      files.forEach(file => {
        if (prohibitedFiles.includes(file)) {
          foundFiles.push(file);
        }
        
        // También buscar variaciones comunes
        if (file.startsWith('.env') && file !== '.env.example') {
          foundFiles.push(file);
        }
      });

    } catch (error) {
      // Si no se puede leer el directorio, no es crítico para este analizador
      console.warn(`Could not read directory: ${projectPath}`);
    }

    return foundFiles;
  }

  /**
   * Busca archivos .env recursivamente (opcional, para casos más complejos)
   */
  findEnvFilesRecursive(dir, prohibitedFiles, depth = 0, maxDepth = 3) {
    const foundFiles = [];
    
    if (depth > maxDepth) return foundFiles;

    try {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          // Buscar recursivamente en subdirectorios
          foundFiles.push(...this.findEnvFilesRecursive(filePath, prohibitedFiles, depth + 1, maxDepth));
        } else if (prohibitedFiles.includes(file) || (file.startsWith('.env') && file !== '.env.example')) {
          foundFiles.push(path.relative(dir, filePath));
        }
      });

    } catch (error) {
      // Ignorar errores de permisos o directorios inaccesibles
    }

    return foundFiles;
  }
}

module.exports = EnvAnalyzer;