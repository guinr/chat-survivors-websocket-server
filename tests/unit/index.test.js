import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Index', () => {
  let mockCreateWsServer;
  let mockCreateHealthServer;
  let mockHttpServer;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    vi.resetModules();
    
    mockCreateWsServer = vi.fn().mockReturnValue({
      close: vi.fn((callback) => callback && callback())
    });
    
    mockHttpServer = {
      listen: vi.fn((port, host, callback) => {
        if (typeof callback === 'function') callback();
      }),
      close: vi.fn((callback) => callback && callback())
    };
    
    mockCreateHealthServer = vi.fn().mockReturnValue(mockHttpServer);
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };
    mockConfig = {
      port: 8080
    };

    vi.doMock('../../src/server/wsServer.js', () => ({
      createWsServer: mockCreateWsServer
    }));
    
    vi.doMock('../../src/server/healthServer.js', () => ({
      createHealthServer: mockCreateHealthServer
    }));
    
    vi.doMock('../../src/core/logger.js', () => ({
      logger: mockLogger
    }));
    
    vi.doMock('../../src/core/config.js', () => ({
      config: mockConfig
    }));

    vi.doMock('../../src/core/storekeeperService.js', () => ({
      storekeeperService: {
        init: vi.fn(),
        destroy: vi.fn()
      }
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('should create health server and WebSocket server with correct parameters', async () => {
    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledTimes(1);
    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: mockConfig.port,
      logger: mockLogger
    });

    expect(mockCreateWsServer).toHaveBeenCalledTimes(1);
    expect(mockCreateWsServer).toHaveBeenCalledWith({
      server: mockHttpServer,
      logger: mockLogger
    });
  });

  it('should start HTTP server and log startup messages', async () => {
    await import('../../src/index.js?t=' + Date.now());

    expect(mockHttpServer.listen).toHaveBeenCalledWith(
      mockConfig.port,
      '0.0.0.0',
      expect.any(Function)
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      `Servidor iniciado na porta ${mockConfig.port}`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Health check: http://localhost:${mockConfig.port}/health`
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      `WebSocket: ws://localhost:${mockConfig.port}`
    );
  });

  it('should initialize storekeeper service', async () => {
    const storekeeperServiceModule = await import('../../src/core/storekeeperService.js');
    
    await import('../../src/index.js?t=' + Date.now());

    expect(storekeeperServiceModule.storekeeperService.init).toHaveBeenCalledWith(mockLogger);
  });

  it('should use custom port from config', async () => {
    mockConfig.port = 3000;

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: 3000,
      logger: mockLogger
    });

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      server: mockHttpServer,
      logger: mockLogger
    });

    expect(mockHttpServer.listen).toHaveBeenCalledWith(
      3000,
      '0.0.0.0',
      expect.any(Function)
    );
  });

  it('should handle string port from config', async () => {
    mockConfig.port = '9000';

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: '9000',
      logger: mockLogger
    });

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      server: mockHttpServer,
      logger: mockLogger
    });
  });

  it('should work with different logger implementations', async () => {
    const customLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn()
    };

    vi.doMock('../../src/core/logger.js', () => ({
      logger: customLogger
    }));

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: mockConfig.port,
      logger: customLogger
    });

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      server: mockHttpServer,
      logger: customLogger
    });
  });

  it('should handle edge case with undefined port', async () => {
    mockConfig.port = undefined;

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: undefined,
      logger: mockLogger
    });
  });

  it('should handle zero port', async () => {
    mockConfig.port = 0;

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: 0,
      logger: mockLogger
    });
  });

  it('should handle SIGINT signal', async () => {
    const mockWss = {
      close: vi.fn((callback) => callback && callback())
    };
    mockCreateWsServer.mockReturnValue(mockWss);

    const storekeeperServiceModule = await import('../../src/core/storekeeperService.js');
    const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await import('../../src/index.js?t=' + Date.now());

    process.emit('SIGINT');

    expect(mockLogger.info).toHaveBeenCalledWith('Recebido SIGINT, desligando servidor...');
    expect(storekeeperServiceModule.storekeeperService.destroy).toHaveBeenCalled();
    expect(mockWss.close).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    
    mockProcessExit.mockRestore();
  });

  it('should handle SIGTERM signal', async () => {
    const mockWss = {
      close: vi.fn((callback) => callback && callback())
    };
    mockCreateWsServer.mockReturnValue(mockWss);

    const storekeeperServiceModule = await import('../../src/core/storekeeperService.js');
    const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {});

    await import('../../src/index.js?t=' + Date.now());

    process.emit('SIGTERM');

    expect(mockLogger.info).toHaveBeenCalledWith('Recebido SIGTERM, desligando servidor...');
    expect(storekeeperServiceModule.storekeeperService.destroy).toHaveBeenCalled();
    expect(mockWss.close).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
    
    mockProcessExit.mockRestore();
  });
});
