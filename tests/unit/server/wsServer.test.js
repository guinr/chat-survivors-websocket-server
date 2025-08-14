import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockWss = {
  on: vi.fn(),
  close: vi.fn(),
  clients: new Set()
};

vi.mock('ws', () => ({
  WebSocketServer: vi.fn(() => mockWss)
}));

vi.mock('../../../src/server/heartbeat.js', () => ({
  setupHeartbeat: vi.fn()
}));

vi.mock('../../../src/server/connectionManager.js', () => ({
  connectionManager: {
    remove: vi.fn()
  }
}));

vi.mock('../../../src/server/eventRouter.js', () => ({
  routeMessage: vi.fn()
}));

import { createWsServer } from '../../../src/server/wsServer.js';

describe('wsServer', () => {
  let mockLogger;
  let setupHeartbeat;
  let connectionManager;
  let routeMessage;
  let WebSocketServer;

  beforeEach(async () => {
    vi.clearAllMocks();

    const wsModule = await import('ws');
    const heartbeatModule = await import('../../../src/server/heartbeat.js');
    const connectionModule = await import('../../../src/server/connectionManager.js');
    const routerModule = await import('../../../src/server/eventRouter.js');

    WebSocketServer = wsModule.WebSocketServer;
    setupHeartbeat = heartbeatModule.setupHeartbeat;
    connectionManager = connectionModule.connectionManager;
    routeMessage = routerModule.routeMessage;

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };

    mockWss.on.mockClear();
    mockWss.close.mockClear();
    mockWss.clients.clear();
  });

  describe('createWsServer', () => {
    it('should create WebSocketServer with correct port', () => {
      const port = 8080;

      createWsServer({ port, logger: mockLogger });

      expect(WebSocketServer).toHaveBeenCalledWith({ port });
    });

    it('should setup heartbeat', () => {
      createWsServer({ port: 8080, logger: mockLogger });

      expect(setupHeartbeat).toHaveBeenCalledWith(mockWss, mockLogger);
    });

    it('should return WebSocketServer instance', () => {
      const result = createWsServer({ port: 8080, logger: mockLogger });

      expect(result).toBe(mockWss);
    });

    it('should register connection event listener', () => {
      createWsServer({ port: 8080, logger: mockLogger });

      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('connection handling', () => {
    let connectionHandler;
    let mockWs;

    beforeEach(() => {
      mockWs = {
        on: vi.fn(),
        isAlive: undefined,
        send: vi.fn(),
        terminate: vi.fn()
      };

      createWsServer({ port: 8080, logger: mockLogger });

      // Get the registered connection handler
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      connectionHandler = connectionCall[1];
    });

    it('should set isAlive to true on new connection', () => {
      connectionHandler(mockWs);

      expect(mockWs.isAlive).toBe(true);
    });

    it('should register pong event listener', () => {
      connectionHandler(mockWs);

      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('should register message event listener', () => {
      connectionHandler(mockWs);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should register close event listener', () => {
      connectionHandler(mockWs);

      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should register error event listener', () => {
      connectionHandler(mockWs);

      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    describe('pong handler', () => {
      it('should set isAlive to true on pong', () => {
        connectionHandler(mockWs);

        // Get the registered pong handler
        const pongCall = mockWs.on.mock.calls.find(call => call[0] === 'pong');
        const pongHandler = pongCall[1];

        // Simulate receiving pong
        mockWs.isAlive = false;
        pongHandler();

        expect(mockWs.isAlive).toBe(true);
      });
    });

    describe('message handler', () => {
      it('should route message through eventRouter', () => {
        connectionHandler(mockWs);

        // Get the registered message handler
        const messageCall = mockWs.on.mock.calls.find(call => call[0] === 'message');
        const messageHandler = messageCall[1];

        const testData = Buffer.from('{"action":"join","userId":"user123"}');
        messageHandler(testData);

        expect(routeMessage).toHaveBeenCalledWith(mockWs, testData, mockLogger);
      });

      it('should handle multiple messages', () => {
        connectionHandler(mockWs);

        const messageCall = mockWs.on.mock.calls.find(call => call[0] === 'message');
        const messageHandler = messageCall[1];

        const message1 = Buffer.from('{"action":"join","userId":"user1"}');
        const message2 = Buffer.from('{"action":"leave","userId":"user2"}');

        messageHandler(message1);
        messageHandler(message2);

        expect(routeMessage).toHaveBeenCalledTimes(2);
        expect(routeMessage).toHaveBeenNthCalledWith(1, mockWs, message1, mockLogger);
        expect(routeMessage).toHaveBeenNthCalledWith(2, mockWs, message2, mockLogger);
      });
    });

    describe('close handler', () => {
      it('should remove connection from connectionManager on close', () => {
        connectionHandler(mockWs);

        // Get the registered close handler
        const closeCall = mockWs.on.mock.calls.find(call => call[0] === 'close');
        const closeHandler = closeCall[1];

        closeHandler();

        expect(connectionManager.remove).toHaveBeenCalledWith(mockWs);
      });

      it('should handle close event multiple times', () => {
        connectionHandler(mockWs);

        const closeCall = mockWs.on.mock.calls.find(call => call[0] === 'close');
        const closeHandler = closeCall[1];

        // Simulate multiple close events (edge case)
        closeHandler();
        closeHandler();

        expect(connectionManager.remove).toHaveBeenCalledTimes(2);
      });
    });

    describe('error handler', () => {
      it('should log error and remove connection on error', () => {
        connectionHandler(mockWs);

        // Get the registered error handler
        const errorCall = mockWs.on.mock.calls.find(call => call[0] === 'error');
        const errorHandler = errorCall[1];

        const testError = new Error('Connection error');
        errorHandler(testError);

        expect(mockLogger.error).toHaveBeenCalledWith(
          { err: testError },
          'WS error'
        );
        expect(connectionManager.remove).toHaveBeenCalledWith(mockWs);
      });

      it('should handle different types of errors', () => {
        connectionHandler(mockWs);

        const errorCall = mockWs.on.mock.calls.find(call => call[0] === 'error');
        const errorHandler = errorCall[1];

        // Test different types of errors
        const errors = [
          new Error('Network error'),
          new Error('Protocol error'),
          new Error('Timeout error')
        ];

        errors.forEach(error => {
          errorHandler(error);
        });

        expect(mockLogger.error).toHaveBeenCalledTimes(3);
        expect(connectionManager.remove).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('multiple connections', () => {
    let connectionHandler;

    beforeEach(() => {
      createWsServer({ port: 8080, logger: mockLogger });
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      connectionHandler = connectionCall[1];
    });

    it('should handle multiple simultaneous connections', () => {
      const mockWs1 = { on: vi.fn(), isAlive: undefined };
      const mockWs2 = { on: vi.fn(), isAlive: undefined };
      const mockWs3 = { on: vi.fn(), isAlive: undefined };

      connectionHandler(mockWs1);
      connectionHandler(mockWs2);
      connectionHandler(mockWs3);

      expect(mockWs1.isAlive).toBe(true);
      expect(mockWs2.isAlive).toBe(true);
      expect(mockWs3.isAlive).toBe(true);

      // Each connection should have its own event listeners
      expect(mockWs1.on).toHaveBeenCalledTimes(4); // pong, message, close, error
      expect(mockWs2.on).toHaveBeenCalledTimes(4);
      expect(mockWs3.on).toHaveBeenCalledTimes(4);
    });

    it('should handle connection lifecycle independently', () => {
      const mockWs1 = { on: vi.fn(), isAlive: undefined };
      const mockWs2 = { on: vi.fn(), isAlive: undefined };

      connectionHandler(mockWs1);
      connectionHandler(mockWs2);

      // Simulate closing a connection
      const closeCall1 = mockWs1.on.mock.calls.find(call => call[0] === 'close');
      closeCall1[1](); // Call close handler

      expect(connectionManager.remove).toHaveBeenCalledWith(mockWs1);
      expect(connectionManager.remove).not.toHaveBeenCalledWith(mockWs2);
    });
  });

  describe('integration with dependencies', () => {
    it('should integrate with heartbeat system', () => {
      createWsServer({ port: 8080, logger: mockLogger });

      expect(setupHeartbeat).toHaveBeenCalledWith(mockWss, mockLogger);
    });

    it('should integrate with connection manager', () => {
      const mockWs = { on: vi.fn(), isAlive: undefined };
      
      createWsServer({ port: 8080, logger: mockLogger });
      
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = connectionCall[1];
      
      connectionHandler(mockWs);

      // Simulate closing
      const closeCall = mockWs.on.mock.calls.find(call => call[0] === 'close');
      closeCall[1]();

      expect(connectionManager.remove).toHaveBeenCalledWith(mockWs);
    });

    it('should integrate with event router', () => {
      const mockWs = { on: vi.fn(), isAlive: undefined };
      
      createWsServer({ port: 8080, logger: mockLogger });
      
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = connectionCall[1];
      
      connectionHandler(mockWs);

      // Simulate receiving a message
      const messageCall = mockWs.on.mock.calls.find(call => call[0] === 'message');
      const testData = Buffer.from('test message');
      messageCall[1](testData);

      expect(routeMessage).toHaveBeenCalledWith(mockWs, testData, mockLogger);
    });
  });

  describe('edge cases', () => {
    it('should handle connection with missing logger', () => {
      expect(() => {
        createWsServer({ port: 8080, logger: null });
      }).not.toThrow();
    });

    it('should handle connection without port', () => {
      expect(() => {
        createWsServer({ logger: mockLogger });
      }).not.toThrow();

      expect(WebSocketServer).toHaveBeenCalledWith({});
    });

    it('should handle empty configuration', () => {
      expect(() => {
        createWsServer({});
      }).not.toThrow();
    });

    it('should handle WebSocket with pre-existing isAlive property', () => {
      const mockWs = { 
        on: vi.fn(), 
        isAlive: false // Pre-existing value
      };
      
      createWsServer({ port: 8080, logger: mockLogger });
      
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = connectionCall[1];
      
      connectionHandler(mockWs);

      // Should overwrite pre-existing value
      expect(mockWs.isAlive).toBe(true);
    });

    it('should handle event listener registration failures gracefully', () => {
      const mockWs = { 
        on: vi.fn(() => {
          throw new Error('Event registration failed');
        }),
        isAlive: undefined
      };
      
      createWsServer({ port: 8080, logger: mockLogger });
      
      const connectionCall = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      const connectionHandler = connectionCall[1];
      
      expect(() => {
        connectionHandler(mockWs);
      }).toThrow('Event registration failed');
    });
  });

  describe('server configuration', () => {
    it('should handle different port configurations', () => {
      const ports = [3000, 8080, 9999];
      
      ports.forEach(port => {
        createWsServer({ port, logger: mockLogger });
        expect(WebSocketServer).toHaveBeenCalledWith({ port });
      });
    });

    it('should handle server creation with additional options', () => {
      const options = { 
        port: 8080, 
        logger: mockLogger,
        extraOption: 'test' 
      };
      
      createWsServer(options);
      
      expect(WebSocketServer).toHaveBeenCalledWith({ port: 8080 });
    });
  });
});
