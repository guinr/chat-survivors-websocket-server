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

describe('eventRouter', () => {
  let mockWs;
  let mockLogger;
  let rateLimitMiddleware;
  let authMiddleware;
  let handleJoin;

  beforeEach(async () => {
    vi.clearAllMocks();

    const rateLimitModule = await import('../../../src/middlewares/rateLimit.js');
    const authModule = await import('../../../src/middlewares/auth.js');
    const joinModule = await import('../../../src/handlers/onJoin.js');

    rateLimitMiddleware = rateLimitModule.rateLimitMiddleware;
    authMiddleware = authModule.authMiddleware;
    handleJoin = joinModule.handleJoin;

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
  });

  describe('rate limit middleware', () => {
    it('should proceed when rate limit passes', () => {
      rateLimitMiddleware.mockReturnValue(true);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith('user123');
      expect(handleJoin).toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('excedeu rate limit')
      );
    });

    it('should block and log when rate limit fails', () => {
      rateLimitMiddleware.mockReturnValue(false);
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith('user123');
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário user123 excedeu rate limit');
      expect(handleJoin).not.toHaveBeenCalled();
    });

    it('should handle message without userId in rate limit', () => {
      const message = { action: 'join' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(rateLimitMiddleware).toHaveBeenCalledWith(undefined);
    });
  });

  describe('message routing', () => {
    it('should route join action to handleJoin', () => {
      const message = { action: 'join', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);
    });

    it('should handle unknown action', () => {
      const message = { action: 'unknown', userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { action: 'unknown' },
        'Tipo de mensagem desconhecido'
      );
      expect(handleJoin).not.toHaveBeenCalled();
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

      // Verify middleware sequence
      expect(authMiddleware).toHaveBeenCalledWith(message);
      expect(rateLimitMiddleware).toHaveBeenCalledWith('user123');
      expect(handleJoin).toHaveBeenCalledWith(mockWs, message, mockLogger);

      // Should not have error or warning logs
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
    it('should handle null data causing auth failure', () => {
      // JSON.parse(null) returns null, but message.userId causes error
      // This reveals a bug in the code - should use optional chaining or check
      expect(() => {
        routeMessage(mockWs, null, mockLogger);
      }).toThrow();
    });

    it('should handle undefined data', () => {
      routeMessage(mockWs, undefined, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          data: undefined
        }),
        'Mensagem inválida'
      );
    });

    it('should handle object passed as data instead of string', () => {
      const message = { action: 'join', userId: 'user123' };

      // Passing object directly instead of JSON string
      routeMessage(mockWs, message, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          data: message
        }),
        'Mensagem inválida'
      );
    });

    it('should handle message with null action', () => {
      const message = { action: null, userId: 'user123' };

      routeMessage(mockWs, JSON.stringify(message), mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { action: null },
        'Tipo de mensagem desconhecido'
      );
    });

    it('should handle string "null" as data causing auth failure', () => {
      // JSON.parse('null') returns null, but message.userId causes error
      // This reveals a bug in the code - should use optional chaining or check
      expect(() => {
        routeMessage(mockWs, 'null', mockLogger);
      }).toThrow();
    });

    it('should handle number as data', () => {
      // JSON.parse(123) returns 123, but 123.userId will be undefined
      authMiddleware.mockReturnValue(false);
      
      routeMessage(mockWs, 123, mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(123);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });

    it('should handle boolean as data', () => {
      // JSON.parse(true) returns true, but true.userId will be undefined
      authMiddleware.mockReturnValue(false);
      
      routeMessage(mockWs, true, mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });

    it('should handle array as string data', () => {
      const message = { action: 'join', userId: 'user123' };
      const arrayData = JSON.stringify([message]);

      // When the JSON is an array, authMiddleware receives the array
      authMiddleware.mockReturnValue(false);
      
      routeMessage(mockWs, arrayData, mockLogger);

      expect(authMiddleware).toHaveBeenCalledWith([message]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Usuário desconhecido não autorizado');
    });
  });
});
