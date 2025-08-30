#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Iniciando simulação completa do Chat Survivors...\n');

const processes = [];

function startProcess(name, script, delay = 0) {
  setTimeout(() => {
    console.log(`▶️  Iniciando ${name}...`);
    
    const child = spawn('node', [script], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      console.log(`🔴 ${name} encerrado com código ${code}`);
    });
    
    child.on('error', (err) => {
      console.error(`❌ Erro no ${name}:`, err);
    });
    
    processes.push({ name, child });
  }, delay);
}

startProcess('Simulador do Jogo', join(__dirname, 'game-simulator.js'), 0);
startProcess('Simulador de Extensões', join(__dirname, 'extension-simulator.js'), 2000);
startProcess('Simulador de Viewers', join(__dirname, 'viewer-simulator.js'), 4000);

console.log(`
📋 Simulação iniciada!

🎮 Game Simulator: Simula o jogo Chat Survivors
🔧 Extension Simulator: Simula 3 extensões Twitch
👥 Viewer Simulator: Simula múltiplos viewers

Para parar todos os simuladores: Ctrl+C

💡 Dicas:
- Monitore os logs do servidor em outro terminal: yarn dev
- Cada simulador mostra as mensagens enviadas/recebidas
- Viewers fazem join automaticamente
- Extensões executam ações aleatórias
- O jogo responde com eventos simulados

🔗 Conecte em: ws://localhost:8080
`);

process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando todos os simuladores...');
  
  processes.forEach(({ name, child }) => {
    console.log(`⏹️  Parando ${name}...`);
    child.kill('SIGINT');
  });
  
  setTimeout(() => {
    console.log('✅ Simulação encerrada!');
    process.exit(0);
  }, 2000);
});
