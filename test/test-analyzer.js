const CodeReviewer = require('../src/code-reviewer');

/**
 * Script simple para probar el analizador localmente
 * Uso: node test-analyzer.js <ruta-del-proyecto>
 */

async function testAnalyzer() {
  const projectPath = process.argv[2] || process.cwd();
  
  console.log('🚀 Testing PR Code Reviewer');
  console.log('==========================');
  
  try {
    const reviewer = new CodeReviewer();
    const results = await reviewer.analyzeProject(projectPath);
    
    console.log('\n📋 RESULTS:');
    console.log('============');
    
    // Mostrar reporte
    const report = reviewer.generateReport(results);
    console.log(report);
    
    // Mostrar JSON completo si se requiere debug
    if (process.argv.includes('--debug')) {
      console.log('\n🔍 DEBUG - Full Results:');
      console.log(JSON.stringify(results, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testAnalyzer();
}

module.exports = { testAnalyzer };