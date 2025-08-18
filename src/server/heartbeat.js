import { config } from '../core/config.js';

export function setupHeartbeat(wss, logger) {
  if (wss._heartbeatInitialized) return;
  wss._heartbeatInitialized = true;

  const timer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        logger.warn('Conexão WS encerrada por timeout');
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, config.heartbeatInterval);

  wss.on('close', () => clearInterval(timer));
}
