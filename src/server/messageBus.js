import { z } from 'zod';
import { connectionManager } from './connectionManager.js';
import { userCache } from '../core/userCache.js';

const messageSchema = z.object({
  user: z.object({
    id: z.string(),
    display_name: z.string()
  }),
  action: z.string(),
  data: z.any().optional()
});

function getDisplayNameOrDefault(userId, providedDisplayName = null) {
  if (providedDisplayName) {
    return providedDisplayName;
  }
  
  const cachedDisplayName = userCache.get(userId);
  return cachedDisplayName || 'Desconhecido';
}

export const messageBus = {
  send(ws, message) {
    if (ws.readyState === 1) {
      const parsed = messageSchema.parse(message);
      ws.send(JSON.stringify(parsed));
    }
  },

  sendToGame(userId, displayName = null, action, data = null) {
    if (connectionManager.gameSocket) {
      const resolvedDisplayName = getDisplayNameOrDefault(userId, displayName);
      this.send(connectionManager.gameSocket, {
        user: { id: userId, display_name: resolvedDisplayName },
        action,
        data
      });
    }
  },

  sendToUser(userId, displayName = null, action, data = null) {
    const ws = connectionManager.getExtension(userId);
    if (ws) {
      const resolvedDisplayName = getDisplayNameOrDefault(userId, displayName);
      this.send(ws, {
        user: { id: userId, display_name: resolvedDisplayName },
        action,
        data
      });
    }
  },

  broadcastToExtensions(userId, displayName = null, action, data = null) {
    const resolvedDisplayName = getDisplayNameOrDefault(userId, displayName);
    connectionManager.broadcastToExtensions((ws) => {
      this.send(ws, {
        user: { id: userId, display_name: resolvedDisplayName },
        action,
        data
      });
    });
  }
};
