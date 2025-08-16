import { config } from './core/config.js';
import { logger } from './core/logger.js';
import { createWsServer } from './server/wsServer.js';

createWsServer({ port: config.port, logger });

logger.info(`Servidor WebSocket iniciado na porta ${config.port}`);
