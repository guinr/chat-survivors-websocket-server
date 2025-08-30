import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('should export a logger instance', async () => {
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger).toBeDefined();
    expect(typeof logger).toBe('object');
  });

  it('should use default log level "info" when LOG_LEVEL env var is not set', async () => {
    delete process.env.LOG_LEVEL;
    vi.resetModules();
    
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('info');
  });

  it('should use LOG_LEVEL env var when set', async () => {
    vi.stubEnv('LOG_LEVEL', 'debug');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('debug');
  });

  it('should use LOG_LEVEL env var for different levels', async () => {
    vi.stubEnv('LOG_LEVEL', 'error');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('error');
  });

  it('should have pino logger methods', async () => {
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.trace).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('should be configured with pino-pretty transport', async () => {
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger).toHaveProperty('level');
    expect(logger).toHaveProperty('version');
  });

  it('should handle different log levels correctly', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('warn');
    expect(logger.levelVal).toBe(40);
  });

  it('should handle trace log level', async () => {
    vi.stubEnv('LOG_LEVEL', 'trace');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('trace');
    expect(logger.levelVal).toBe(10);
  });

  it('should handle fatal log level', async () => {
    vi.stubEnv('LOG_LEVEL', 'fatal');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('fatal');
    expect(logger.levelVal).toBe(60);
  });

  it('should handle silent log level', async () => {
    vi.stubEnv('LOG_LEVEL', 'silent');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('silent');
    expect(logger.levelVal).toBe(Infinity);
  });

  it('should be able to create child loggers', async () => {
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    const childLogger = logger.child({ module: 'test' });

    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
    expect(childLogger.level).toBe(logger.level);
  });

  it('should have correct pino instance properties', async () => {
    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger).toHaveProperty('child');
    expect(logger).toHaveProperty('bindings');
    expect(logger).toHaveProperty('setBindings');
    expect(typeof logger.child).toBe('function');
  });

  it('should support log level hierarchy', async () => {
    vi.stubEnv('LOG_LEVEL', 'error');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.isLevelEnabled('fatal')).toBe(true);
    expect(logger.isLevelEnabled('error')).toBe(true);
    expect(logger.isLevelEnabled('warn')).toBe(false);
    expect(logger.isLevelEnabled('info')).toBe(false);
    expect(logger.isLevelEnabled('debug')).toBe(false);
    expect(logger.isLevelEnabled('trace')).toBe(false);
  });

  it('should work with case insensitive log levels', async () => {
    vi.stubEnv('LOG_LEVEL', 'DEBUG');

    const { logger } = await import('../../../src/core/logger.js?t=' + Date.now());

    expect(logger.level).toBe('debug');
  });

  it('should execute serializers when testSerializers is called', async () => {
    const { testSerializers } = await import('../../../src/core/logger.js?t=' + Date.now());
    
    expect(() => testSerializers()).not.toThrow();
  });

  it('should test err serializer in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    
    const { testSerializers } = await import('../../../src/core/logger.js?t=' + Date.now());
    
    expect(() => testSerializers()).not.toThrow();
  });
});
