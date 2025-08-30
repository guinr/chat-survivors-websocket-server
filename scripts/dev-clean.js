#!/usr/bin/env node

/**
 * Script de desenvolvimento com configurações otimizadas para debugging
 * Uso: yarn dev:clean
 */

import { spawn } from 'child_process';

const env = {
  ...process.env,
  LOG_LEVEL: 'info',
  NODE_ENV: 'development'
};

console.log('🚀 Iniciando servidor em modo desenvolvimento limpo...\n');

const server = spawn('nodemon', ['src/index.js'], {
  stdio: 'inherit',
  env
});

server.on('close', (code) => {
  console.log(`\n🔴 Servidor encerrado com código ${code}`);
  process.exit(code);
});

server.on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  server.kill('SIGINT');
});
