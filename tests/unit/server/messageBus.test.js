import { describe, it, expect, beforeEach, vi } from 'vitest';
import { messageBus } from '../../../src/server/messageBus.js';
import { connectionManager } from '../../../src/server/connectionManager.js';
import { userCache } from '../../../src/core/userCache.js';

vi.mock('zod', () => ({
  z: {
    object: vi.fn(() => ({
      parse: vi.fn((data) => data)
    })),
    string: vi.fn(),
    any: vi.fn(() => ({ optional: vi.fn() }))
  }
}));

vi.mock('../../../src/server/connectionManager.js', () => ({
  connectionManager: {
    gameSocket: null,
    getExtension: vi.fn(),
    broadcastToExtensions: vi.fn()
  }
}));

vi.mock('../../../src/core/userCache.js', () => ({
  userCache: {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    clear: vi.fn(),
    size: vi.fn()
  }
}));

describe('MessageBus', () => {
  let mockWs1, mockWs2, mockWs3;

  beforeEach(() => {
    mockWs1 = {
      readyState: 1, 
      send: vi.fn()
    };

    mockWs2 = {
      readyState: 1,
      send: vi.fn()
    };

    mockWs3 = {
      readyState: 3, 
      send: vi.fn()
    };

    vi.clearAllMocks();
    connectionManager.gameSocket = null;
    connectionManager.getExtension.mockReturnValue(null);
    connectionManager.broadcastToExtensions.mockImplementation(() => {});
    userCache.get.mockReturnValue(null);
  });

  describe('send', () => {
    it('should send message when websocket is open', () => {
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'join',
        data: null
      };

      messageBus.send(mockWs1, message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send message when websocket is not open', () => {
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'join',
        data: null
      };

      messageBus.send(mockWs3, message); 

      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should handle different readyState values', () => {
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'join',
        data: null
      };

      
      const states = [
        { readyState: 0, shouldSend: false }, 
        { readyState: 1, shouldSend: true },  
        { readyState: 2, shouldSend: false }, 
        { readyState: 3, shouldSend: false }  
      ];

      states.forEach(({ readyState, shouldSend }) => {
        const ws = { readyState, send: vi.fn() };
        messageBus.send(ws, message);

        if (shouldSend) {
          expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
        } else {
          expect(ws.send).not.toHaveBeenCalled();
        }
      });
    });

    it('should handle message with data', () => {
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'update',
        data: { score: 100, level: 5 }
      };

      messageBus.send(mockWs1, message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('sendToGame', () => {
    it('should send message to game socket when available', () => {
      connectionManager.gameSocket = mockWs1;

      messageBus.sendToGame('user1', 'TestUser', 'join');

      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'join',
          data: null
        })
      );
    });

    it('should send message with custom data to game socket', () => {
      connectionManager.gameSocket = mockWs1;
      const customData = { score: 150, achievements: ['first_kill'] };

      messageBus.sendToGame('user1', 'TestUser', 'score_update', customData);

      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'score_update',
          data: customData
        })
      );
    });

    it('should not send message when no game socket', () => {
      connectionManager.gameSocket = null;

      messageBus.sendToGame('user1', 'TestUser', 'join');

      
      expect(mockWs1.send).not.toHaveBeenCalled();
    });

    it('should not send message when game socket is closed', () => {
      connectionManager.gameSocket = mockWs3; 

      messageBus.sendToGame('user1', 'TestUser', 'join');

      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should use cached display name when none provided', () => {
      connectionManager.gameSocket = mockWs1;
      userCache.get.mockReturnValue('CachedUser');

      messageBus.sendToGame('user1', null, 'join');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'CachedUser' },
          action: 'join',
          data: null
        })
      );
    });

    it('should use default display name when none provided and not cached', () => {
      connectionManager.gameSocket = mockWs1;
      userCache.get.mockReturnValue(null);

      messageBus.sendToGame('user1', null, 'join');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'Desconhecido' },
          action: 'join',
          data: null
        })
      );
    });

    it('should prefer provided display name over cache', () => {
      connectionManager.gameSocket = mockWs1;
      userCache.get.mockReturnValue('CachedUser');

      messageBus.sendToGame('user1', 'ProvidedUser', 'join');

      expect(userCache.get).not.toHaveBeenCalled();
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'ProvidedUser' },
          action: 'join',
          data: null
        })
      );
    });
  });

  describe('sendToUser', () => {
    it('should send message to specific user when extension exists', () => {
      connectionManager.getExtension.mockReturnValue(mockWs1);

      messageBus.sendToUser('user1', 'TestUser', 'notification');

      expect(connectionManager.getExtension).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'notification',
          data: null
        })
      );
    });

    it('should send message with data to specific user', () => {
      connectionManager.getExtension.mockReturnValue(mockWs1);
      const notificationData = { message: 'You have a new achievement!', type: 'success' };

      messageBus.sendToUser('user1', 'TestUser', 'notification', notificationData);

      expect(connectionManager.getExtension).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'notification',
          data: notificationData
        })
      );
    });

    it('should not send message when user extension does not exist', () => {
      connectionManager.getExtension.mockReturnValue(null);

      messageBus.sendToUser('user1', 'TestUser', 'notification');

      expect(connectionManager.getExtension).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).not.toHaveBeenCalled();
    });

    it('should not send message when user extension is closed', () => {
      connectionManager.getExtension.mockReturnValue(mockWs3); 

      messageBus.sendToUser('user1', 'TestUser', 'notification');

      expect(connectionManager.getExtension).toHaveBeenCalledWith('user1');
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should use cached display name when none provided', () => {
      connectionManager.getExtension.mockReturnValue(mockWs1);
      userCache.get.mockReturnValue('CachedUser');

      messageBus.sendToUser('user1', null, 'notification');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'CachedUser' },
          action: 'notification',
          data: null
        })
      );
    });

    it('should use default display name when none provided and not cached', () => {
      connectionManager.getExtension.mockReturnValue(mockWs1);
      userCache.get.mockReturnValue(null);

      messageBus.sendToUser('user1', null, 'notification');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'Desconhecido' },
          action: 'notification',
          data: null
        })
      );
    });

    it('should prefer provided display name over cache', () => {
      connectionManager.getExtension.mockReturnValue(mockWs1);
      userCache.get.mockReturnValue('CachedUser');

      messageBus.sendToUser('user1', 'ProvidedUser', 'notification');

      expect(userCache.get).not.toHaveBeenCalled();
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'ProvidedUser' },
          action: 'notification',
          data: null
        })
      );
    });
  });

  describe('broadcastToExtensions', () => {
    it('should broadcast message to all extensions', () => {
      const mockBroadcastFn = vi.fn();
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        
        fn(mockWs1);
        fn(mockWs2);
      });

      messageBus.broadcastToExtensions('user1', 'TestUser', 'global_event');

      expect(connectionManager.broadcastToExtensions).toHaveBeenCalledWith(expect.any(Function));
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'global_event',
          data: null
        })
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'TestUser' },
          action: 'global_event',
          data: null
        })
      );
    });

    it('should broadcast message with data to all extensions', () => {
      const eventData = { announcement: 'Server maintenance in 5 minutes', priority: 'high' };
      
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1);
        fn(mockWs2);
      });

      messageBus.broadcastToExtensions('user123', 'TestUser', 'server_announcement', eventData);

      expect(connectionManager.broadcastToExtensions).toHaveBeenCalledWith(expect.any(Function));
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user123', display_name: 'TestUser' },
          action: 'server_announcement',
          data: eventData
        })
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user123', display_name: 'TestUser' },
          action: 'server_announcement',
          data: eventData
        })
      );
    });

    it('should skip closed connections during broadcast', () => {
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1); 
        fn(mockWs3); 
        fn(mockWs2); 
      });

      messageBus.broadcastToExtensions('user1', 'TestUser', 'global_event');

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockWs3.send).not.toHaveBeenCalled(); 
    });

    it('should handle empty extensions list', () => {
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        
      });

      expect(() => {
        messageBus.broadcastToExtensions('user1', 'TestUser', 'global_event');
      }).not.toThrow();

      expect(connectionManager.broadcastToExtensions).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should use cached display name when none provided', () => {
      userCache.get.mockReturnValue('CachedUser');
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1);
        fn(mockWs2);
      });

      messageBus.broadcastToExtensions('user1', null, 'global_event');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'CachedUser' },
          action: 'global_event',
          data: null
        })
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'CachedUser' },
          action: 'global_event',
          data: null
        })
      );
    });

    it('should use default display name when none provided and not cached', () => {
      userCache.get.mockReturnValue(null);
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1);
      });

      messageBus.broadcastToExtensions('user1', null, 'global_event');

      expect(userCache.get).toHaveBeenCalledWith('user1');
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'Desconhecido' },
          action: 'global_event',
          data: null
        })
      );
    });

    it('should prefer provided display name over cache', () => {
      userCache.get.mockReturnValue('CachedUser');
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1);
      });

      messageBus.broadcastToExtensions('user1', 'ProvidedUser', 'global_event');

      expect(userCache.get).not.toHaveBeenCalled();
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'user1', display_name: 'ProvidedUser' },
          action: 'global_event',
          data: null
        })
      );
    });
  });

  describe('message schema validation', () => {
    it('should handle schema validation', () => {
      
      
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'test',
        data: { custom: 'data' }
      };

      messageBus.send(mockWs1, message);

      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('error handling', () => {
    it('should handle JSON.stringify errors gracefully', () => {
      const circularRef = {};
      circularRef.self = circularRef;
      
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'test',
        data: circularRef
      };

      expect(() => {
        messageBus.send(mockWs1, message);
      }).toThrow();
    });

    it('should handle websocket send errors', () => {
      mockWs1.send.mockImplementation(() => {
        throw new Error('WebSocket send failed');
      });

      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'test',
        data: null
      };

      expect(() => {
        messageBus.send(mockWs1, message);
      }).toThrow('WebSocket send failed');
    });
  });
});
