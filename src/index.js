import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { createWsServer } from './server/wsServer.js';
import { createHealthServer } from './server/healthServer.js';
import { storekeeperService } from './core/storekeeperService.js';

const httpServer = createHealthServer({ port: config.port, logger });
const wss = createWsServer({ server: httpServer, logger });

storekeeperService.init(logger);

httpServer.listen(config.port, '0.0.0.0', () => {
  logger.info(`Servidor iniciado na porta ${config.port}`);
  logger.info(`Health check: http://localhost:${config.port}/health`);
  logger.info(`WebSocket: ws://localhost:${config.port}`);
});

function gracefulShutdown(signal) {
  logger.info(`Recebido ${signal}, desligando servidor...`);
  
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout - forçando encerramento');
    process.exit(1);
  }, 5000);

  storekeeperService.destroy();
  
  // Limpar timer do heartbeat manualmente se necessário
  if (wss._heartbeatTimer) {
    clearInterval(wss._heartbeatTimer);
    wss._heartbeatTimer = null;
  }
  
  // Encerrar todas as conexões WebSocket
  if (wss.clients) {
    wss.clients.forEach(ws => {
      ws.terminate();
    });
  }
  
  wss.close(() => {
    httpServer.close(() => {
      clearTimeout(shutdownTimeout);
      logger.info('Servidor fechado');
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
