import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleJoin } from '../../../src/handlers/onJoin.js';
import { connectionManager } from '../../../src/server/connectionManager.js';
import { messageBus } from '../../../src/server/messageBus.js';
import fetch from 'node-fetch';

vi.mock('../../../src/server/connectionManager.js');
vi.mock('../../../src/server/messageBus.js');
vi.mock('node-fetch');

describe('handleJoin', () => {
  let mockWs, mockLogger;

  beforeEach(() => {
    mockWs = { readyState: 1 };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    vi.clearAllMocks();
  });

  it('should handle valid join message with successful API calls', async () => {
    const message = { userId: 'test123' };

    // Mock successful access token response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    // Mock successful user info response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        data: [{ display_name: 'TestUser' }] 
      })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (TestUser) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'TestUser', 'join');
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should warn on invalid message without userId', async () => {
    const message = {}; // without userId

    await handleJoin(mockWs, message, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith('Join recebido sem userId');
    expect(connectionManager.addExtension).not.toHaveBeenCalled();
    expect(messageBus.sendToGame).not.toHaveBeenCalled();
  });

  it('should handle failed access token request', async () => {
    const message = { userId: 'test123' };

    // Mock failed access token response
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid credentials' })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to get access token: Invalid credentials', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle failed access token request without message', async () => {
    const message = { userId: 'test456' };

    // Mock failed access token response without message
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({}) // no message property
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test456', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to get access token: Bad Request', userId: 'test456' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test456 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test456', 'Desconhecido', 'join');
  });

  it('should handle failed user info request', async () => {
    const message = { userId: 'test123' };

    // Mock successful access token response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    // Mock failed user info response
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({ message: 'User not found' })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to fetch user info: User not found', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle failed user info request without message', async () => {
    const message = { userId: 'test789' };

    // Mock successful access token response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    // Mock failed user info response without message
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({}) // no message property
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test789', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to fetch user info: Forbidden', userId: 'test789' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test789 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test789', 'Desconhecido', 'join');
  });

  it('should handle user info with no display_name', async () => {
    const message = { userId: 'test123' };

    // Mock successful access token response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    // Mock user info response with no display_name
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        data: [{}] // user object without display_name
      })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle user info with empty data array', async () => {
    const message = { userId: 'test123' };

    // Mock successful access token response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    // Mock user info response with empty data
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        data: [] // empty array
      })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle network errors', async () => {
    const message = { userId: 'test123' };

    // Mock network error
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Network error', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });
});
