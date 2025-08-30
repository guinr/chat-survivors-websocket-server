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

process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, desligando servidor...');
  storekeeperService.destroy();
  wss.close(() => {
    httpServer.close(() => {
      logger.info('Servidor fechado');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, desligando servidor...');
  storekeeperService.destroy();
  wss.close(() => {
    httpServer.close(() => {
      logger.info('Servidor fechado');
      process.exit(0);
    });
  });
});
