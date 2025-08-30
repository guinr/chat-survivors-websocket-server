import { WebSocketServer } from 'ws';
import { setupHeartbeat } from './heartbeat.js';
import { connectionManager } from './connectionManager.js';
import { routeMessage } from './eventRouter.js';

export function createWsServer({ port, logger }) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      routeMessage(ws, data, logger);
    });

    ws.on('close', (code, reason) => {
      if (logger.debug) {
        logger.debug({ code, reason: reason?.toString() }, 'Conexão WebSocket fechada');
      }
      connectionManager.remove(ws);
    });

    ws.on('error', (err) => {
      logger.error({ 
        error: err.message,
        code: err.code,
        errno: err.errno
      }, 'Erro na conexão WebSocket');
      connectionManager.remove(ws);
    });
  });

  setupHeartbeat(wss, logger);

  return wss;
}
