import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStorekeeper } from '../../../src/handlers/onStorekeeper.js';

vi.mock('../../../src/core/storekeeperCache.js', () => ({
  storekeeperCache: {
    get: vi.fn()
  }
}));

describe('handleStorekeeper', () => {
  let mockWs;
  let mockMessage;
  let mockLogger;
  let storekeeperCache;

  beforeEach(async () => {
    vi.clearAllMocks();

    const cacheModule = await import('../../../src/core/storekeeperCache.js');
    storekeeperCache = cacheModule.storekeeperCache;

    mockWs = {
      send: vi.fn(),
      readyState: 1
    };

    mockMessage = {
      userId: 'user123',
      action: 'storekeeper'
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };
  });

  it('deve retornar dados do cache quando disponível', () => {
    const cachedData = {
      name: 'Seksal',
      phrases: ['test phrase'],
      common_items: []
    };

    storekeeperCache.get.mockReturnValue(cachedData);

    handleStorekeeper(mockWs, mockMessage, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user123' },
      'Handler storekeeper chamado'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user123' },
      'Retornando dados do cache'
    );
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(cachedData));
  });

  it('deve retornar erro quando cache está vazio', () => {
    storekeeperCache.get.mockReturnValue(null);

    handleStorekeeper(mockWs, mockMessage, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user123' },
      'Handler storekeeper chamado'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      { userId: 'user123' },
      'Cache vazio - sem vendedores no momento'
    );
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ error: 'Sem vendedores no momento' })
    );
  });
});
