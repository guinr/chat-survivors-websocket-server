import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock connectionManager antes do import
const mockConnectionManager = {
  getActiveConnections: vi.fn().mockReturnValue([
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
  ])
};

vi.doMock('../../../src/server/connectionManager.js', () => ({
  connectionManager: mockConnectionManager
}));

// Agora importamos o healthServer após o mock
const { createHealthServer } = await import('../../../src/server/healthServer.js');

describe('HealthServer', () => {
  let mockLogger;
  let server;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockRequest = {
      url: '/',
      method: 'GET',
      headers: {
        host: 'localhost:3000'
      }
    };

    mockResponse = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    };
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    vi.clearAllMocks();
  });

  it('should create HTTP server with correct configuration', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);

    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
    expect(typeof server.close).toBe('function');
  });

  it('should handle root endpoint correctly', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    
    const expectedResponse = JSON.stringify({
      service: 'Chat Survivors WebSocket Server',
      status: 'running',
      websocket: 'ws://localhost:3000',
      health: 'http://localhost:3000/health',
      docs: 'https://github.com/guinr/chat-survivors-websocket-server'
    }, null, 2);
    
    expect(mockResponse.end).toHaveBeenCalledWith(expectedResponse);
  });

  it('should handle health endpoint correctly', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    expect(mockConnectionManager.getActiveConnections).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
    
    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      connections: 5,
      uptime: expect.any(Number),
      memory: expect.any(Object),
      version: expect.any(String)
    });
  });

  it('should handle 404 for unknown endpoints', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/unknown';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(404, { 
      'Content-Type': 'application/json' 
    });
    
    const expectedResponse = JSON.stringify({ error: 'Not Found' });
    expect(mockResponse.end).toHaveBeenCalledWith(expectedResponse);
  });

  it('should handle non-GET methods for health endpoint', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.method = 'POST';
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(404, { 
      'Content-Type': 'application/json' 
    });
    
    const expectedResponse = JSON.stringify({ error: 'Not Found' });
    expect(mockResponse.end).toHaveBeenCalledWith(expectedResponse);
  });

  it('should handle non-GET methods for root endpoint', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.method = 'POST';
    mockRequest.url = '/';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(404, { 
      'Content-Type': 'application/json' 
    });
    
    const expectedResponse = JSON.stringify({ error: 'Not Found' });
    expect(mockResponse.end).toHaveBeenCalledWith(expectedResponse);
  });

  it('should use custom port from config', () => {
    const config = {
      port: 8080,
      logger: mockLogger
    };

    server = createHealthServer(config);

    expect(server).toBeDefined();
  });

  it('should work with different logger implementations', () => {
    const customLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn()
    };

    const config = {
      port: 3000,
      logger: customLogger
    };

    server = createHealthServer(config);

    expect(server).toBeDefined();
  });

  it('should handle undefined port gracefully', () => {
    const config = {
      port: undefined,
      logger: mockLogger
    };

    server = createHealthServer(config);

    expect(server).toBeDefined();
  });

  it('should handle zero connections from connectionManager', () => {
    mockConnectionManager.getActiveConnections.mockReturnValueOnce([]);

    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    expect(mockConnectionManager.getActiveConnections).toHaveBeenCalled();
    
    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.connections).toBe(0);
  });

  it('should include uptime in health response', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.uptime).toBeDefined();
    expect(typeof response.uptime).toBe('number');
  });

  it('should include timestamp in health response', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.timestamp).toBeDefined();
    expect(typeof response.timestamp).toBe('string');
    expect(new Date(response.timestamp)).toBeInstanceOf(Date);
  });

  it('should include memory usage in health response', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.memory).toBeDefined();
    expect(typeof response.memory).toBe('object');
  });

  it('should include version in health response', () => {
    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.version).toBeDefined();
    expect(typeof response.version).toBe('string');
  });

  it('should use default version when npm_package_version is not set', () => {
    const originalVersion = process.env.npm_package_version;
    delete process.env.npm_package_version;

    const config = {
      port: 3000,
      logger: mockLogger
    };

    server = createHealthServer(config);
    
    const requestHandler = server.listeners('request')[0];
    mockRequest.url = '/health';
    
    requestHandler(mockRequest, mockResponse);

    const call = mockResponse.end.mock.calls[0][0];
    const response = JSON.parse(call);
    
    expect(response.version).toBe('1.0.0');
    
    // Restore original value
    if (originalVersion !== undefined) {
      process.env.npm_package_version = originalVersion;
    }
  });
});
