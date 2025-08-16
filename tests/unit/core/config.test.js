import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('should use default port when PORT env var is not set', async () => {
    vi.stubEnv('PORT', '');
    vi.resetModules();
    
    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.port).toBe(8080);
  });

  it('should use PORT env var when set', async () => {
    vi.stubEnv('PORT', '3000');

    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.port).toBe(3000);
  });

  it('should have correct static configuration values', async () => {
    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.heartbeatInterval).toBe(30000);
    expect(config.maxMessageSize).toBe(1024 * 10);
    expect(config.rateLimitPerSecond).toBe(5);
  });

  it('should use TWITCH_CLIENT_ID from environment', async () => {
    vi.stubEnv('TWITCH_CLIENT_ID', 'test-client-id');

    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.twitchClientId).toBe('test-client-id');
  });

  it('should use TWITCH_CLIENT_SECRET from environment', async () => {
    vi.stubEnv('TWITCH_CLIENT_SECRET', 'test-client-secret');

    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.twitchClientSecret).toBe('test-client-secret');
  });

  it('should have undefined twitch credentials when env vars are not set', async () => {
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    vi.resetModules();
    
    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config.twitchClientId).toBeUndefined();
    expect(config.twitchClientSecret).toBeUndefined();
  });

  it('should have all required configuration properties', async () => {
    const { config } = await import('../../../src/core/config.js?t=' + Date.now());

    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('heartbeatInterval');
    expect(config).toHaveProperty('maxMessageSize');
    expect(config).toHaveProperty('rateLimitPerSecond');
    expect(config).toHaveProperty('twitchClientId');
    expect(config).toHaveProperty('twitchClientSecret');
  });
});
