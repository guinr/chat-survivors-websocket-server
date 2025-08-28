import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Index', () => {
  let mockCreateWsServer;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    vi.resetModules();
    
    mockCreateWsServer = vi.fn().mockReturnValue({
      close: vi.fn((callback) => callback && callback())
    });
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

  it('should create WebSocket server with correct parameters', async () => {
    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateWsServer).toHaveBeenCalledTimes(1);
    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: mockConfig.port,
      logger: mockLogger
    });
  });

  it('should log server startup message with correct port', async () => {
    await import('../../src/index.js?t=' + Date.now());

    expect(mockLogger.info).toHaveBeenCalledWith(
      `Servidor WebSocket iniciado na porta ${mockConfig.port}`
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

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: 3000,
      logger: mockLogger
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Servidor WebSocket iniciado na porta 3000'
    );
  });

  it('should handle string port from config', async () => {
    mockConfig.port = '9000';

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: '9000',
      logger: mockLogger
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Servidor WebSocket iniciado na porta 9000'
    );
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

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: mockConfig.port,
      logger: customLogger
    });

    expect(customLogger.info).toHaveBeenCalledWith(
      `Servidor WebSocket iniciado na porta ${mockConfig.port}`
    );
  });

  it('should handle edge case with undefined port', async () => {
    mockConfig.port = undefined;

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: undefined,
      logger: mockLogger
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Servidor WebSocket iniciado na porta undefined'
    );
  });

  it('should handle zero port', async () => {
    mockConfig.port = 0;

    await import('../../src/index.js?t=' + Date.now());

    expect(mockCreateWsServer).toHaveBeenCalledWith({
      port: 0,
      logger: mockLogger
    });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Servidor WebSocket iniciado na porta 0'
    );
  });

  it('should handle SIGINT signal', async () => {
    const storekeeperServiceModule = await import('../../src/core/storekeeperService.js');
    const mockWss = mockCreateWsServer();
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
    const storekeeperServiceModule = await import('../../src/core/storekeeperService.js');
    const mockWss = mockCreateWsServer();
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
