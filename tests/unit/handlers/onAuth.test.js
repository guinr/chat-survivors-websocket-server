import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAuth } from '../../../src/handlers/onAuth.js';

vi.mock('../../../src/core/userCache.js', () => ({
  userCache: {
    has: vi.fn(),
    set: vi.fn(),
    get: vi.fn()
  }
}));

vi.mock('../../../src/core/twitchApi.js', () => ({
  getTwitchAccessToken: vi.fn(),
  fetchTwitchUserInfo: vi.fn()
}));

describe('handleAuth', () => {
  let mockWs;
  let mockLogger;
  let userCache;
  let getTwitchAccessToken;
  let fetchTwitchUserInfo;

  beforeEach(async () => {
    vi.clearAllMocks();

    const userCacheModule = await import('../../../src/core/userCache.js');
    const twitchApiModule = await import('../../../src/core/twitchApi.js');

    userCache = userCacheModule.userCache;
    getTwitchAccessToken = twitchApiModule.getTwitchAccessToken;
    fetchTwitchUserInfo = twitchApiModule.fetchTwitchUserInfo;

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

  it('should handle auth message without token', async () => {
    const message = { action: 'auth' };

    await handleAuth(mockWs, message, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith('[AUTH] Mensagem auth recebida sem token');
    expect(userCache.has).not.toHaveBeenCalled();
  });

  it('should handle invalid JWT token', async () => {
    const message = { action: 'auth', token: 'invalid.jwt.token' };

    await handleAuth(mockWs, message, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: expect.any(String) },
      '[AUTH] Falha ao processar autenticação'
    );
    expect(userCache.has).not.toHaveBeenCalled();
  });

  it('should skip if user already in cache', async () => {
    const message = {
      action: 'auth',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDUifQ.signature'
    };

    userCache.has.mockReturnValue(true);

    await handleAuth(mockWs, message, mockLogger);

    expect(userCache.has).toHaveBeenCalledWith('12345');
    expect(mockLogger.info).toHaveBeenCalledWith('[AUTH] Usuário 12345 já está no cache');
    expect(getTwitchAccessToken).not.toHaveBeenCalled();
  });

  it('should fetch and cache user info from Twitch API', async () => {
    const message = {
      action: 'auth',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDUifQ.signature'
    };

    userCache.has.mockReturnValue(false);
    getTwitchAccessToken.mockResolvedValue('access_token_123');
    fetchTwitchUserInfo.mockResolvedValue({
      id: '12345',
      display_name: 'TestUser'
    });

    await handleAuth(mockWs, message, mockLogger);

    expect(userCache.has).toHaveBeenCalledWith('12345');
    expect(getTwitchAccessToken).toHaveBeenCalled();
    expect(fetchTwitchUserInfo).toHaveBeenCalledWith('12345', 'access_token_123');
    expect(userCache.set).toHaveBeenCalledWith('12345', 'TestUser');
    expect(mockLogger.info).toHaveBeenCalledWith('[AUTH] Buscando display_name para usuário 12345');
    expect(mockLogger.info).toHaveBeenCalledWith('[AUTH] Display_name \'TestUser\' armazenado para usuário 12345');
  });

  it('should handle user not found in Twitch API', async () => {
    const message = {
      action: 'auth',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDUifQ.signature'
    };

    userCache.has.mockReturnValue(false);
    getTwitchAccessToken.mockResolvedValue('access_token_123');
    fetchTwitchUserInfo.mockResolvedValue(null);

    await handleAuth(mockWs, message, mockLogger);

    expect(userCache.set).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('[AUTH] Usuário 12345 não encontrado na API do Twitch');
  });

  it('should handle API errors gracefully', async () => {
    const message = {
      action: 'auth',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDUifQ.signature'
    };

    userCache.has.mockReturnValue(false);
    getTwitchAccessToken.mockRejectedValue(new Error('API Error'));

    await handleAuth(mockWs, message, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(
      { error: 'API Error' },
      '[AUTH] Falha ao processar autenticação'
    );
    expect(userCache.set).not.toHaveBeenCalled();
  });

  it('should handle real JWT token from the example', async () => {
    const realToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjExNDI5MDUsIm9wYXF1ZV91c2VyX2lkIjoiVTEwNDIyMDY4MSIsInVzZXJfaWQiOiIxMDQyMjA2ODEiLCJjaGFubmVsX2lkIjoiMTA0MjIwNjgxIiwicm9sZSI6ImJyb2FkY2FzdGVyIiwiaXNfdW5saW5rZWQiOmZhbHNlLCJwdWJzdWJfcGVybXMiOnsibGlzdGVuIjpbImJyb2FkY2FzdCIsIndoaXNwZXItVTEwNDIyMDY4MSIsImdsb2JhbCJdLCJzZW5kIjpbImJyb2FkY2FzdCIsIndoaXNwZXItKiJdfX0.76K9HhIZF0kT5l3k7InjMiFcbo-mTjbLeUIk2FjU5Gk';
    const message = { action: 'auth', token: realToken };

    userCache.has.mockReturnValue(false);
    getTwitchAccessToken.mockResolvedValue('access_token_123');
    fetchTwitchUserInfo.mockResolvedValue({
      id: '104220681',
      display_name: 'RealUser'
    });

    await handleAuth(mockWs, message, mockLogger);

    expect(userCache.has).toHaveBeenCalledWith('104220681');
    expect(userCache.set).toHaveBeenCalledWith('104220681', 'RealUser');
  });
});