const express = require('express');
const CodeReviewer = require('./code-reviewer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Instancia del revisor
const codeReviewer = new CodeReviewer();

/**
 * Endpoint para probar el analizador via API
 * POST /analyze
 * Body: { "projectPath": "/ruta/al/proyecto" }
 */
app.post('/analyze', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath is required'
      });
    }

    console.log(`📥 Received analysis request for: ${projectPath}`);
    
    const results = await codeReviewer.analyzeProject(projectPath);
    const report = codeReviewer.generateReport(results);
    
    res.json({
      success: true,
      results,
      report
    });
    
  } catch (error) {
    console.error('Error during analysis:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * Endpoint para webhook de GitHub (futuro)
 * POST /webhook
 */
app.post('/webhook', (req, res) => {
  console.log('📨 GitHub webhook received');
  
  // TODO: Implementar lógica de webhook
  // 1. Verificar firma del webhook
  // 2. Extraer información del PR
  // 3. Clonar/descargar archivos del PR
  // 4. Ejecutar análisis
  // 5. Comentar en el PR
  
  res.json({
    message: 'Webhook received (not implemented yet)'
  });
});

/**
 * Endpoint de salud
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PR Code Reviewer',
    timestamp: new Date().toISOString(),
    analyzers: codeReviewer.analyzers.length
  });
});

/**
 * Página principal con información
 */
app.get('/', (req, res) => {
  res.json({
    name: 'PR Code Reviewer API',
    version: '1.0.0',
    endpoints: {
      'POST /analyze': 'Analyze a project directory',
      'POST /webhook': 'GitHub webhook handler (coming soon)',
      'GET /health': 'Health check'
    },
    usage: {
      analyze: {
        method: 'POST',
        url: '/analyze',
        body: { projectPath: '/path/to/project' }
      }
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 PR Code Reviewer API started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Available analyzers: ${codeReviewer.analyzers.length}`);
  console.log('📋 Ready to analyze projects!');
});

module.exports = app;