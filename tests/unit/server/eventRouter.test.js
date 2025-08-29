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

  beforeEach(async () => {
    vi.clearAllMocks();

    const rateLimitModule = await import('../../../src/middlewares/rateLimit.js');
    const authModule = await import('../../../src/middlewares/auth.js');
    const joinModule = await import('../../../src/handlers/onJoin.js');
    const storekeeperModule = await import('../../../src/handlers/onStorekeeper.js');
    const extensionModule = await import('../../../src/handlers/onExtension.js');
    const storekeeperServiceModule = await import('../../../src/core/storekeeperService.js');
    const messageBusModule = await import('../../../src/server/messageBus.js');

    rateLimitMiddleware = rateLimitModule.rateLimitMiddleware;
    authMiddleware = authModule.authMiddleware;
    handleJoin = joinModule.handleJoin;
    handleStorekeeper = storekeeperModule.handleStorekeeper;
    handleExtension = extensionModule.handleExtension;
    storekeeperService = storekeeperServiceModule.storekeeperService;
    messageBus = messageBusModule.messageBus;

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
      const message = { action: 'join', userId: 'user123' };
      const data = JSON.stringify(message);

      routeMessage(mockWs, data, mockLogger);

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(authMiddleware).toHaveBeenCalledWith(message);
    });

    it('should handle invalid JSON and log error', () => {
      const invalidData = '{ invalid json';

      routeMessage(mockWs, invalidData, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          data: invalidData
        }),
        'Mensagem inválida'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle empty string', () => {
      routeMessage(mockWs, '', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          data: ''
        }),
        'Mensagem inválida'
      );
    });
  });

  describe('authentication middleware', () => {
    it('should proceed when auth passes', () => {
      authMiddleware.mockReturnValue(true);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('não autorizado')
      );
    });

    it('should block and log when auth fails', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário user123 não autorizado');
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message without userId in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });

    it('should handle message with empty string userId in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: '' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });

    it('should handle message with null userId in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: null };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });

    it('should handle message with zero userId in auth failure', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 0 };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });
  });

  describe('rate limit middleware', () => {
    it('should proceed when rate limit passes', () => {
      rateLimitMiddleware.mockReturnValue(true);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleJoin).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('excedeu rate limit')
      );
    });

    it('should block and log when rate limit fails', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário user123 excedeu rate limit');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message without userId in rate limit', () => {
      const message = { action: 'join' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
    });

    it('should handle message with empty string userId in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: '' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido excedeu rate limit');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message with null userId in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: null };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido excedeu rate limit');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message with zero userId in rate limit failure', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 0 };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido excedeu rate limit');
      expect(handleJoin).not.toHaveBeenCalled();
    });
  });

  describe('message routing', () => {
    it('should route join action to handleJoin', () => {
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);
    });

    it('should route storekeeper action to handleStorekeeper', () => {
      const message = { action: 'storekeeper', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(handleStorekeeper).toHaveBeenCalledWith(mockWs, message, mockLogger);
    });

    it('should route extension actions to handleExtension', () => {
      const extensionActions = ['str', 'agi', 'vit', 'luc', 'equip', 'buy', 'sell'];
      
      extensionActions.forEach(action => {
        const message = { action, userId: 'user123', value: 10 };

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
      const message = { action: 'unknown', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { action: 'unknown' },
        'Tipo de mensagem desconhecido'
      );
      expect(handleJoin).not.toHaveBeenCalled();
      expect(handleStorekeeper).not.toHaveBeenCalled();
      expect(handleExtension).not.toHaveBeenCalled();
    });

    it('should handle message without action', () => {
      const message = { userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { action: undefined },
        'Tipo de mensagem desconhecido'
      );
    });
  });

  describe('integration flow', () => {
    it('should complete full flow for valid join message', () => {
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      
      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);

      
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should complete full flow for valid storekeeper message', () => {
      const message = { action: 'storekeeper', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      
      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalledWith(message);
      expect(handleStorekeeper).toHaveBeenCalledWith(mockWs, message, mockLogger);

      
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should stop at auth when auth fails', () => {
      authMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).not.toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário user123 não autorizado');
    });

    it('should stop at rate limit when rate limit fails', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(authMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
      expect(handleJoin).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário user123 excedeu rate limit');
    });
  });

  describe('edge cases', () => {
    it('should handle null data with type validation', () => {
      routeMessage(mockWs, null, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { data: null, type: 'object' },
        'Tipo de dados inválido'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle undefined data with type validation', () => {
      routeMessage(mockWs, undefined, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { data: undefined, type: 'undefined' },
        'Tipo de dados inválido'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle object passed as data with type validation', () => {
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, message, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { data: message, type: 'object' },
        'Tipo de dados inválido'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle message with null action', () => {
      const message = { action: null, userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { action: null },
        'Tipo de mensagem desconhecido'
      );
    });

    it('should handle string null as data with structure validation', () => {
      routeMessage(mockWs, 'null', mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { message: null, type: 'object' },
        'Estrutura de mensagem inválida'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle number as data with type validation', () => {
      routeMessage(mockWs, 123, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { data: 123, type: 'number' },
        'Tipo de dados inválido'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle boolean as data with type validation', () => {
      routeMessage(mockWs, true, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { data: true, type: 'boolean' },
        'Tipo de dados inválido'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });

    it('should handle array as string data with structure validation', () => {
      const message = { action: 'join', userId: 'user123' };
      const arrayData = JSON.stringify([message]);

      routeMessage(mockWs, arrayData, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        { message: [message], type: 'object' },
        'Estrutura de mensagem inválida'
      );
      expect(authMiddleware).not.toHaveBeenCalled();
    });
  });
});
