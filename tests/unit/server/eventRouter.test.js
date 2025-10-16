import { describe, it, expect, beforeEach, vi } from 'vitest';
import { routeMessage } from '../../../src/server/eventRouter.js';

vi.mock('../../../src/middlewares/rateLimit.js', () => ({
  rateLimitMiddleware: vi.fn()
}));

vi.mock('../../../src/middlewares/auth.js', () => ({
  authMiddleware: vi.fn()
}));

vi.mock('../../../src/handlers/onJoin.js', () => ({
  handleJoin: vi.fn()
}));

vi.mock('../../../src/handlers/onStorekeeper.js', () => ({
  handleStorekeeper: vi.fn()
}));

vi.mock('../../../src/handlers/onExtension.js', () => ({
  handleExtension: vi.fn()
}));

vi.mock('../../../src/core/storekeeperService.js', () => ({
  storekeeperService: {
    handleGameResponse: vi.fn()
  }
}));

vi.mock('../../../src/server/messageBus.js', () => ({
  messageBus: {
    sendToUser: vi.fn()
  }
}));

vi.mock('../../../src/server/connectionManager.js', () => ({
  connectionManager: {
    addGame: vi.fn(),
    remove: vi.fn()
  }
}));

describe('eventRouter', () => {
  let mockWs;
  let mockLogger;
  let rateLimitMiddleware;
  let authMiddleware;
  let handleJoin;
  let handleStorekeeper;
  let handleExtension;
  let storekeeperService;
  let messageBus;
  let connectionManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    const rateLimitModule = await import('../../../src/middlewares/rateLimit.js');
    const authModule = await import('../../../src/middlewares/auth.js');
    const joinModule = await import('../../../src/handlers/onJoin.js');
    const storekeeperModule = await import('../../../src/handlers/onStorekeeper.js');
    const extensionModule = await import('../../../src/handlers/onExtension.js');
    const storekeeperServiceModule = await import('../../../src/core/storekeeperService.js');
    const messageBusModule = await import('../../../src/server/messageBus.js');
    const connectionManagerModule = await import('../../../src/server/connectionManager.js');

    rateLimitMiddleware = rateLimitModule.rateLimitMiddleware;
    authMiddleware = authModule.authMiddleware;
    handleJoin = joinModule.handleJoin;
    handleStorekeeper = storekeeperModule.handleStorekeeper;
    handleExtension = extensionModule.handleExtension;
    storekeeperService = storekeeperServiceModule.storekeeperService;
    messageBus = messageBusModule.messageBus;
    connectionManager = connectionManagerModule.connectionManager;

    authMiddleware.mockReturnValue(true);
    rateLimitMiddleware.mockReturnValue(true);

    mockWs = {
      send: vi.fn(),
      terminate: vi.fn(),
      readyState: 1
    };

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn()
    };
  });

  describe('JSON parsing', () => {
    it('should handle valid JSON message', () => {
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };
      const data = JSON.stringify(message);

      routeMessage(mockWs, data, mockLogger);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(authMiddleware).toHaveBeenCalledWith(message);
    });

    it('should handle Buffer data by converting to string', () => {
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };
      const bufferData = Buffer.from(JSON.stringify(message), 'utf8');

      routeMessage(mockWs, bufferData, mockLogger);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(authMiddleware).toHaveBeenCalledWith(message);
    });

    it('should handle invalid JSON with long data and truncate preview', () => {
      const longInvalidData = '{ invalid json: ' + 'a'.repeat(200) + ' }';

      routeMessage(mockWs, longInvalidData, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          dataLength: longInvalidData.length,
          dataPreview: expect.stringMatching(/\.\.\.$/),
        }),
        'Falha ao parsear JSON'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON and log error', () => {
      const invalidData = '{ invalid json';

      routeMessage(mockWs, invalidData, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          dataLength: 14,
          dataPreview: invalidData
        }),
        'Falha ao parsear JSON'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle empty string', () => {
      routeMessage(mockWs, '', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          dataLength: 0,
          dataPreview: ''
        }),
        'Falha ao parsear JSON'
      );
    });
  });

  describe('authentication middleware', () => {
    it('should proceed when auth passes', () => {
      authMiddleware.mockReturnValue(true);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('não autorizado')
      );
    });

    it('should block and log when auth fails', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(message);
        expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[34m[EXTENSION]\x1b[0m \x1b[31mUsuário user123 não autorizado\x1b[0m');
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message without user.id in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

        expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[31mUsuário desconhecido não autorizado\x1b[0m');
    });

    it('should handle message with empty string user.id in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: '' } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

        expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[31mUsuário desconhecido não autorizado\x1b[0m');
    });

    it('should handle message with null user.id in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: null } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[31mUsuário desconhecido não autorizado\x1b[0m');
    });

    it('should handle message with zero user.id in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 0 } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[31mUsuário desconhecido não autorizado\x1b[0m');
    });
  });

  describe('rate limit middleware', () => {
    it('should proceed when rate limit passes', () => {
      rateLimitMiddleware.mockReturnValue(true);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleJoin).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('excedeu rate limit')
      );
    });

    it('should block and log when rate limit fails', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
        expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[34m[EXTENSION]\x1b[0m \x1b[33mUsuário user123 excedeu rate limit\x1b[0m');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message without user.id in rate limit', () => {
      const message = { action: 'join' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
    });

    it('should handle message with empty string user.id in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: '' } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[33mUsuário desconhecido excedeu rate limit\x1b[0m');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message with null user.id in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: null } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[33mUsuário desconhecido excedeu rate limit\x1b[0m');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message with zero user.id in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 0 } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[33mUsuário desconhecido excedeu rate limit\x1b[0m');
      expect(handleJoin).not.toHaveBeenCalled();
    });
  });

  describe('message routing', () => {
    it('should route join action to handleJoin', () => {
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);
    });

    it('should route storekeeper action to handleStorekeeper', () => {
      const message = { action: 'storekeeper', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(handleStorekeeper).toHaveBeenCalledWith(mockWs, message, mockLogger);
    });

    it('should route extension actions to handleExtension', () => {
      const extensionActions = ['str', 'agi', 'vit', 'luc', 'equip', 'buy', 'sell'];
      
      extensionActions.forEach(action => {
        const message = { action, user: { id: 'user123' }, value: 10, role: 'extension', token: 'valid-token' };

        routeMessage(mockWs, JSON.stringify(message), mockLogger);

        expect(handleExtension).toHaveBeenCalledWith(mockWs, message, mockLogger);
      });
    });

    it('should handle storekeeper game response', () => {
      const gameResponse = {
        name: 'Seksal',
        phrases: ['test phrase'],
        common_items: []
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(storekeeperService.handleGameResponse).toHaveBeenCalledWith(gameResponse);
      expect(authMiddleware).not.toHaveBeenCalled();
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
    });

    it('should register game connection when role is game', () => {
      const message = { role: 'game', action: 'ready' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(connectionManager.addGame).toHaveBeenCalledWith(mockWs);
      expect(mockLogger.info).toHaveBeenCalledWith('\x1b[32m[GAME]\x1b[0m Jogo conectado');
      expect(authMiddleware).not.toHaveBeenCalled();
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
    });

    it('should route game response to extension user', () => {
      const gameResponse = {
        user: { id: 'user123', display_name: 'TestUser' },
        action: 'level_up',
        data: { level: 15, exp: 2500 }
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(messageBus.sendToUser).toHaveBeenCalledWith('user123', 'TestUser', 'level_up', { level: 15, exp: 2500 });
      expect(authMiddleware).not.toHaveBeenCalled();
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
    });

    it('should handle all game response actions', () => {
      const gameActions = [
        'joined', 'cant_join', 'died', 'experience_up', 'level_up', 
        'health_changed', 'status_increased', 'inventory', 'used', 
        'equipped', 'buyed', 'sold'
      ];

      gameActions.forEach(action => {
        const gameResponse = {
          user: { id: 'user456', display_name: 'GameUser' },
          action,
          data: { test: 'data' }
        };

        routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

        expect(messageBus.sendToUser).toHaveBeenCalledWith('user456', 'GameUser', action, { test: 'data' });
      });
    });

    it('should handle game response without data', () => {
      const gameResponse = {
        user: { id: 'user789', display_name: 'SimpleUser' },
        action: 'died'
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(messageBus.sendToUser).toHaveBeenCalledWith('user789', 'SimpleUser', 'died', undefined);
    });

    it('should handle game response without display_name', () => {
      const gameResponse = {
        user: { id: 'user999' },
        action: 'health_changed',
        data: { health: 80 }
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(messageBus.sendToUser).toHaveBeenCalledWith('user999', undefined, 'health_changed', { health: 80 });
    });

    it('should not route when user.id is missing', () => {
      const gameResponse = {
        user: { display_name: 'NoIdUser' },
        action: 'level_up'
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(messageBus.sendToUser).not.toHaveBeenCalled();
      expect(authMiddleware).toHaveBeenCalled();
    });

    it('should not route when action is missing', () => {
      const gameResponse = {
        user: { id: 'user123', display_name: 'TestUser' },
        data: { some: 'data' }
      };

      routeMessage(mockWs, JSON.stringify(gameResponse), mockLogger);

      expect(messageBus.sendToUser).not.toHaveBeenCalled();
      expect(authMiddleware).toHaveBeenCalled();
    });

    it('should handle unknown action', () => {
      const message = { action: 'unknown', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[34m[EXTENSION]\x1b[0m \x1b[33mTipo de mensagem desconhecido: unknown\x1b[0m');
      expect(handleJoin).not.toHaveBeenCalled();
      expect(handleStorekeeper).not.toHaveBeenCalled();
      expect(handleExtension).not.toHaveBeenCalled();
    });

    it('should handle message without action', () => {
      const message = { user: { id: 'user123' } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[33mTipo de mensagem desconhecido: undefined\x1b[0m');
    });
  });

  describe('integration flow', () => {
    it('should complete full flow for valid join message', () => {
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      
      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);

      
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should complete full flow for valid storekeeper message', () => {
      const message = { action: 'storekeeper', user: { id: 'user123' }, role: 'extension', token: 'valid-token' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      
      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleStorekeeper).toHaveBeenCalledWith(mockWs, message, mockLogger);

      
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should stop at auth when auth fails', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[34m[EXTENSION]\x1b[0m \x1b[31mUsuário user123 não autorizado\x1b[0m');
    });

    it('should stop at rate limit when rate limit fails', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', user: { id: 'user123' }, role: 'extension' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[34m[EXTENSION]\x1b[0m \x1b[33mUsuário user123 excedeu rate limit\x1b[0m');
    });
  });

  describe('edge cases', () => {
    it('should handle null data with type validation', () => {
      routeMessage(mockWs, null, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'object',
          isBuffer: false,
          length: 'unknown'
        }),
        'Dados recebidos não são string nem Buffer'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle undefined data with type validation', () => {
      routeMessage(mockWs, undefined, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'undefined',
          isBuffer: false,
          length: 'unknown'
        }),
        'Dados recebidos não são string nem Buffer'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle object passed as data with type validation', () => {
      const message = { action: 'join', user: { id: 'user123' } };

      routeMessage(mockWs, message, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'object',
          isBuffer: false,
          length: 'unknown'
        }),
        'Dados recebidos não são string nem Buffer'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle message with null action', () => {
      const message = { action: null, user: { id: 'user123' } };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('\x1b[37m[UNKNOWN]\x1b[0m \x1b[33mTipo de mensagem desconhecido: null\x1b[0m');
    });

    it('should handle string null as data with structure validation', () => {
      routeMessage(mockWs, 'null', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'object',
          isArray: false,
          isNull: true
        }),
        'Estrutura de mensagem inválida'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle number as data with type validation', () => {
      routeMessage(mockWs, 123, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'number',
          isBuffer: false,
          length: 'unknown'
        }),
        'Dados recebidos não são string nem Buffer'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle boolean as data with type validation', () => {
      routeMessage(mockWs, true, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'boolean',
          isBuffer: false,
          length: 'unknown'
        }),
        'Dados recebidos não são string nem Buffer'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle array as string data with structure validation', () => {
      const message = { action: 'join', user: { id: 'user123' } };
      const arrayData = JSON.stringify([message]);

      routeMessage(mockWs, arrayData, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'object',
          isArray: true,
          isNull: false
        }),
        'Estrutura de mensagem inválida'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });
  });
});
