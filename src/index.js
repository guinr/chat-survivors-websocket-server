import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { createWsServer } from './server/wsServer.js';
import { storekeeperService } from './core/storekeeperService.js';

const wss = createWsServer({ port: config.port, logger });

storekeeperService.init(logger);

process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, desligando servidor...');
  storekeeperService.destroy();
  wss.close(() => {
    logger.info('Servidor WebSocket fechado');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, desligando servidor...');
  storekeeperService.destroy();
  wss.close(() => {
    logger.info('Servidor WebSocket fechado');
    process.exit(0);
  });
});

logger.info(`Servidor WebSocket iniciado na porta ${config.port}`);
