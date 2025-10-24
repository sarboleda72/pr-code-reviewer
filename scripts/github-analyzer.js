#!/usr/bin/env node

/**
 * Script optimizado para GitHub Actions
 * Ejecuta el análisis y maneja errores de forma robusta
 */

const CodeReviewer = require('../src/code-reviewer');
const fs = require('fs');
const path = require('path');

async function runGitHubAnalysis() {
  const projectPath = process.argv[2] || process.cwd();
  
  console.log('🤖 PR Code Reviewer - GitHub Actions');
  console.log('====================================');
  console.log(`📁 Analyzing: ${projectPath}`);
  
  try {
    // Verificar que existe el proyecto
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project directory not found: ${projectPath}`);
    }

    // Crear instancia del revisor
    const reviewer = new CodeReviewer();
    
    // Ejecutar análisis
    console.log('🔍 Running analysis...');
    const results = await reviewer.analyzeProject(projectPath);
    
    // Generar reporte
    const report = reviewer.generateReport(results);
    
    // Guardar reporte para GitHub Actions
    const reportPath = '/tmp/analysis-report.md';
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Report saved to: ${reportPath}`);
    
    // Mostrar resumen
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`⚠️  Warnings: ${results.summary.warnings}`);
    
    // Exportar variables para GitHub Actions
    console.log(`\n::set-output name=passed::${results.summary.passed}`);
    console.log(`::set-output name=failed::${results.summary.failed}`);
    console.log(`::set-output name=warnings::${results.summary.warnings}`);
    console.log(`::set-output name=total::${results.summary.totalAnalyzers}`);
    
    // Mostrar preview del reporte
    console.log('\n📋 REPORT PREVIEW:');
    console.log('==================');
    console.log(report.substring(0, 500) + '...');
    
    // Exit code basado en resultados
    if (results.summary.failed > 0) {
      console.log('\n⚠️  Critical issues found, but not failing the build');
      process.exit(0); // No fallar por defecto, solo avisar
    } else {
      console.log('\n✅ All checks passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    
    // Crear reporte de error
    const errorReport = `🤖 **Code Structure Review**

❌ **Analysis Failed**

\`\`\`
${error.message}
\`\`\`

Please check the GitHub Actions logs for more details.

---
🔧 *This is likely a configuration issue. Please check:*
- Repository structure
- File permissions
- Dependencies installation`;

    try {
      fs.writeFileSync('/tmp/analysis-report.md', errorReport);
    } catch (writeError) {
      console.error('Could not write error report:', writeError.message);
    }
    
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runGitHubAnalysis();
}

module.exports = { runGitHubAnalysis };