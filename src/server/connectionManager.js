export const connectionManager = {
  gameSocket: null,
  extensions: new Map(),

  addGame(ws) {
    this.gameSocket = ws;
  },

  removeGame() {
    this.gameSocket = null;
  },

  addExtension(userId, ws) {
    const existing = this.extensions.get(userId);
    if (existing && existing !== ws) {
      existing.terminate();
    }
    this.extensions.set(userId, ws);
  },

  removeExtension(userId) {
    this.extensions.delete(userId);
  },

  remove(ws) {
    if (this.gameSocket === ws) {
      this.removeGame();
      return;
    }

    for (const [userId, socket] of this.extensions.entries()) {
      if (socket === ws) {
        this.removeExtension(userId);
        return;
      }
    }
  },

  getExtension(userId) {
    return this.extensions.get(userId);
  },

  broadcastToExtensions(fn) {
    for (const ws of this.extensions.values()) {
      fn(ws);
    }
  },

  getActiveConnections() {
    const connections = [];
    
    if (this.gameSocket) {
      connections.push({ type: 'game', status: 'connected' });
    }
    
    for (const [userId, ws] of this.extensions.entries()) {
      connections.push({ 
        type: 'extension', 
        userId, 
        status: ws.readyState === 1 ? 'connected' : 'disconnected' 
      });
    }
    
    return connections;
  }
};
