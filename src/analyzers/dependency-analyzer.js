const fs = require('fs');
const path = require('path');

class DependencyAnalyzer {
  constructor() {
    this.name = 'Dependency Folders Analyzer';
  }

  /**
   * Verifica que carpetas como node_modules, .venv no estén committeadas
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

    // Obtener carpetas prohibidas según las reglas
    const prohibitedFolders = rules.general?.prohibitedFolders || [
      'node_modules', '.venv', '__pycache__', 'venv', 'env'
    ];

    // Verificar cada carpeta prohibida
    prohibitedFolders.forEach(folder => {
      const folderPath = path.join(projectPath, folder);
      
      if (fs.existsSync(folderPath)) {
        const stat = fs.statSync(folderPath);
        
        if (stat.isDirectory()) {
          results.failed.push({
            rule: `no-${folder}-committed`,
            message: `❌ Dependency folder found: ${folder}/`,
            suggestion: `Remove '${folder}/' from repository and add it to .gitignore`
          });
        }
      } else {
        results.passed.push({
          rule: `no-${folder}-committed`,
          message: `✅ No ${folder}/ folder found in repository`
        });
      }
    });

    // Verificaciones específicas adicionales
    this.checkPackageManagerFiles(projectPath, results);
    
    return results;
  }

  /**
   * Verifica archivos relacionados con gestores de paquetes
   */
  checkPackageManagerFiles(projectPath, results) {
    // Verificar package.json (Node.js)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      results.passed.push({
        rule: 'package-json-exists',
        message: '✅ package.json found'
      });

      // Si existe package.json, verificar que no haya node_modules
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        results.passed.push({
          rule: 'node-modules-not-committed',
          message: '✅ node_modules/ not in repository (good!)'
        });
      }

      // Verificar package-lock.json o yarn.lock
      const packageLockPath = path.join(projectPath, 'package-lock.json');
      const yarnLockPath = path.join(projectPath, 'yarn.lock');
      
      if (fs.existsSync(packageLockPath)) {
        results.passed.push({
          rule: 'lockfile-exists',
          message: '✅ package-lock.json found (dependency versions locked)'
        });
      } else if (fs.existsSync(yarnLockPath)) {
        results.passed.push({
          rule: 'lockfile-exists',
          message: '✅ yarn.lock found (dependency versions locked)'
        });
      } else {
        results.warnings.push({
          rule: 'lockfile-recommended',
          message: '⚠️  No lockfile found (package-lock.json or yarn.lock)',
          suggestion: 'Consider committing your lockfile to ensure consistent dependency versions'
        });
      }
    }

    // Verificar requirements.txt (Python)
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      results.passed.push({
        rule: 'requirements-exists',
        message: '✅ requirements.txt found'
      });

      // Si es Python, verificar que no haya .venv
      const venvPath = path.join(projectPath, '.venv');
      const venvPath2 = path.join(projectPath, 'venv');
      
      if (!fs.existsSync(venvPath) && !fs.existsSync(venvPath2)) {
        results.passed.push({
          rule: 'venv-not-committed',
          message: '✅ Virtual environment not in repository (good!)'
        });
      }
    }
  }

  /**
   * Busca carpetas de dependencias recursivamente (para casos complejos)
   */
  findDependencyFoldersRecursive(dir, prohibitedFolders, depth = 0, maxDepth = 2) {
    const foundFolders = [];
    
    if (depth > maxDepth) return foundFolders;

    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const itemPath = path.join(dir, item);
        
        try {
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            if (prohibitedFolders.includes(item)) {
              foundFolders.push(path.relative(process.cwd(), itemPath));
            } else if (!item.startsWith('.') && item !== 'src' && item !== 'test') {
              // Buscar recursivamente solo en algunas carpetas
              foundFolders.push(...this.findDependencyFoldersRecursive(itemPath, prohibitedFolders, depth + 1, maxDepth));
            }
          }
        } catch (error) {
          // Ignorar errores de permisos
        }
      });

    } catch (error) {
      // Ignorar errores de lectura de directorio
    }

    return foundFolders;
  }
}

module.exports = DependencyAnalyzer;