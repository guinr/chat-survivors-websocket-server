import { z } from 'zod';
import { connectionManager } from './connectionManager.js';

const messageSchema = z.object({
  user: z.object({
    id: z.string(),
    display_name: z.string()
  }),
  action: z.string(),
  data: z.any().optional()
});

export const messageBus = {
  send(ws, message) {
    if (ws.readyState === 1) {
      const parsed = messageSchema.parse(message);
      ws.send(JSON.stringify(parsed));
    }
  },

  sendToGame(userId, displayName, action, data = null) {
    if (connectionManager.gameSocket) {
      this.send(connectionManager.gameSocket, {
        user: { id: userId, display_name: displayName },
        action,
        data
      });
    }
  },

  sendToUser(userId, displayName, action, data = null) {
    const ws = connectionManager.getExtension(userId);
    if (ws) {
      this.send(ws, {
        user: { id: userId, display_name: displayName },
        action,
        data
      });
    }
  },

  broadcastToExtensions(userId, displayName, action, data = null) {
    connectionManager.broadcastToExtensions((ws) => {
      this.send(ws, {
        user: { id: userId, display_name: displayName },
        action,
        data
      });
    });
  }
};
