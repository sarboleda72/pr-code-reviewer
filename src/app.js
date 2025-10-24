#!/usr/bin/env node

/**
 * 🤖 PR Code Reviewer - GitHub App Server
 * 
 * Este archivo inicia el servidor que maneja webhooks de GitHub
 * y ejecuta revisiones automáticas de Pull Requests.
 */

// Cargar variables de entorno desde .env
require('dotenv').config();

const GitHubWebhookHandler = require('./github-webhook-handler');

// Crear y configurar el handler de webhooks
const webhookHandler = new GitHubWebhookHandler();

// Iniciar servidor
const PORT = process.env.PORT || 3000;
webhookHandler.start(PORT);

// Manejar señales de cierre gracefully
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

module.exports = webhookHandler;