import { describe, it, expect, beforeEach, vi } from 'vitest';
import { messageBus } from '../../../src/server/messageBus.js';
import { connectionManager } from '../../../src/server/connectionManager.js';

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

describe('MessageBus', () => {
  let mockWs1, mockWs2, mockWs3;

  beforeEach(() => {
    mockWs1 = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn()
    };

    mockWs2 = {
      readyState: 1,
      send: vi.fn()
    };

    mockWs3 = {
      readyState: 3, // WebSocket.CLOSED
      send: vi.fn()
    };

    vi.clearAllMocks();
    connectionManager.gameSocket = null;
    connectionManager.getExtension.mockReturnValue(null);
    connectionManager.broadcastToExtensions.mockImplementation(() => {});
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

      messageBus.send(mockWs3, message); // readyState = 3 (CLOSED)

      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should handle different readyState values', () => {
      const message = {
        user: { id: 'user1', display_name: 'TestUser' },
        action: 'join',
        data: null
      };

      // Test different WebSocket states
      const states = [
        { readyState: 0, shouldSend: false }, // CONNECTING
        { readyState: 1, shouldSend: true },  // OPEN
        { readyState: 2, shouldSend: false }, // CLOSING
        { readyState: 3, shouldSend: false }  // CLOSED
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

      // Should not call send on any socket
      expect(mockWs1.send).not.toHaveBeenCalled();
    });

    it('should not send message when game socket is closed', () => {
      connectionManager.gameSocket = mockWs3; // readyState = 3 (CLOSED)

      messageBus.sendToGame('user1', 'TestUser', 'join');

      expect(mockWs3.send).not.toHaveBeenCalled();
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
      connectionManager.getExtension.mockReturnValue(mockWs3); // readyState = 3 (CLOSED)

      messageBus.sendToUser('user1', 'TestUser', 'notification');

      expect(connectionManager.getExtension).toHaveBeenCalledWith('user1');
      expect(mockWs3.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToExtensions', () => {
    it('should broadcast message to all extensions', () => {
      const mockBroadcastFn = vi.fn();
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        // Simulate calling the function for each extension
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

      messageBus.broadcastToExtensions('admin', 'AdminUser', 'server_announcement', eventData);

      expect(connectionManager.broadcastToExtensions).toHaveBeenCalledWith(expect.any(Function));
      expect(mockWs1.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'admin', display_name: 'AdminUser' },
          action: 'server_announcement',
          data: eventData
        })
      );
      expect(mockWs2.send).toHaveBeenCalledWith(
        JSON.stringify({
          user: { id: 'admin', display_name: 'AdminUser' },
          action: 'server_announcement',
          data: eventData
        })
      );
    });

    it('should skip closed connections during broadcast', () => {
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        fn(mockWs1); // OPEN
        fn(mockWs3); // CLOSED
        fn(mockWs2); // OPEN
      });

      messageBus.broadcastToExtensions('user1', 'TestUser', 'global_event');

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockWs3.send).not.toHaveBeenCalled(); // Closed connection should be skipped
    });

    it('should handle empty extensions list', () => {
      connectionManager.broadcastToExtensions.mockImplementation((fn) => {
        // Does not call the function for any extension (empty list)
      });

      expect(() => {
        messageBus.broadcastToExtensions('user1', 'TestUser', 'global_event');
      }).not.toThrow();

      expect(connectionManager.broadcastToExtensions).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('message schema validation', () => {
    it('should handle schema validation', () => {
      // The current test uses a simple zod mock that just returns the data
      // In a more robust test, you could test real validation scenarios
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
