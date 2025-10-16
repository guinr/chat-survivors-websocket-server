import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleJoin } from '../../../src/handlers/onJoin.js';
import { connectionManager } from '../../../src/server/connectionManager.js';
import { messageBus } from '../../../src/server/messageBus.js';
import { userCache } from '../../../src/core/userCache.js';
import fetch from 'node-fetch';

vi.mock('../../../src/server/connectionManager.js');
vi.mock('../../../src/server/messageBus.js');
vi.mock('../../../src/core/userCache.js');
vi.mock('node-fetch');

describe('handleJoin', () => {
  let mockWs, mockLogger;

  beforeEach(() => {
    mockWs = { readyState: 1 };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    vi.clearAllMocks();
  });

  it('should use cached display name when available', async () => {
    const message = { user: { id: 'test123' } };
    
    userCache.get.mockReturnValue('CachedUser');

    await handleJoin(mockWs, message, mockLogger);

    expect(userCache.get).toHaveBeenCalledWith('test123');
    expect(fetch).not.toHaveBeenCalled();
    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (CachedUser) entrou');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { userId: 'test123', displayName: 'CachedUser' },
      'Display name encontrado no cache'
    );
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'CachedUser', 'join');
  });

  it('should fetch and cache display name when not in cache', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        data: [{ display_name: 'FetchedUser' }] 
      })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(userCache.get).toHaveBeenCalledWith('test123');
    expect(userCache.set).toHaveBeenCalledWith('test123', 'FetchedUser');
    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (FetchedUser) entrou');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { userId: 'test123', displayName: 'FetchedUser' },
      'Display name salvo no cache'
    );
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'FetchedUser', 'join');
  });

  it('should handle cache miss and API failure gracefully', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await handleJoin(mockWs, message, mockLogger);

    expect(userCache.get).toHaveBeenCalledWith('test123');
    expect(userCache.set).not.toHaveBeenCalled();
    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Network error', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should warn on invalid message without userId', async () => {
    const message = {};

    await handleJoin(mockWs, message, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith('Join recebido sem user.id');
    expect(userCache.get).not.toHaveBeenCalled();
    expect(connectionManager.addExtension).not.toHaveBeenCalled();
    expect(messageBus.sendToGame).not.toHaveBeenCalled();
  });

  it('should handle failed access token request', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);

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

  it('should handle network errors', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);
    
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

  it('should handle failed user info request without message property', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: async () => ({})
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to fetch user info: Not Found', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle user data without display_name property', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock_token' })
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        data: [{ id: 'test123' }] // Sem display_name
      })
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(userCache.set).toHaveBeenCalledWith('test123', 'Desconhecido');
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should handle failed access token request using statusText when no message', async () => {
    const message = { user: { id: 'test123' } };

    userCache.get.mockReturnValue(null);

    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({}) // Sem message
    });

    await handleJoin(mockWs, message, mockLogger);

    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'Failed to get access token: Bad Request', userId: 'test123' },
      'Falha ao buscar display_name'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (Desconhecido) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'Desconhecido', 'join');
  });

  it('should use display_name from message when provided', async () => {
    const message = { user: { id: 'test123', display_name: 'ProvidedName' } };
    
    userCache.get.mockReturnValue(null);

    await handleJoin(mockWs, message, mockLogger);

    expect(userCache.get).not.toHaveBeenCalled(); // Não deve buscar no cache
    expect(fetch).not.toHaveBeenCalled(); // Não deve fazer fetch da API
    expect(userCache.set).toHaveBeenCalledWith('test123', 'ProvidedName'); // Deve cachear o nome fornecido
    expect(connectionManager.addExtension).toHaveBeenCalledWith('test123', mockWs);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      { userId: 'test123', displayName: 'ProvidedName' },
      'Display name recebido da extensão e salvo no cache'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Usuário test123 (ProvidedName) entrou');
    expect(messageBus.sendToGame).toHaveBeenCalledWith('test123', 'ProvidedName', 'join');
  });
});