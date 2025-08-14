import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupHeartbeat } from '../../../src/server/heartbeat.js';

vi.mock('../../../src/core/config.js', () => ({
  config: {
    heartbeatInterval: 1000
  }
}));

describe('setupHeartbeat', () => {
  let mockWss;
  let mockLogger;
  let mockWs1, mockWs2, mockWs3;
  let originalSetInterval, originalClearInterval;

  beforeEach(() => {
    vi.useFakeTimers();

    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    mockWs1 = {
      isAlive: true,
      terminate: vi.fn(),
      ping: vi.fn()
    };

    mockWs2 = {
      isAlive: true,
      terminate: vi.fn(),
      ping: vi.fn()
    };

    mockWs3 = {
      isAlive: false,
      terminate: vi.fn(),
      ping: vi.fn()
    };

    mockWss = {
      clients: new Set([mockWs1, mockWs2]),
      on: vi.fn(),
      emit: vi.fn()
    };

    mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('heartbeat setup', () => {
    it('should setup heartbeat with correct interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      setupHeartbeat(mockWss, mockLogger);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000
      );
    });

    it('should register close event listener', () => {
      setupHeartbeat(mockWss, mockLogger);

      expect(mockWss.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('heartbeat interval execution', () => {
    it('should ping all alive connections and set isAlive to false', () => {
      setupHeartbeat(mockWss, mockLogger);

      // Advance timer to execute heartbeat
      vi.advanceTimersByTime(1000);

      expect(mockWs1.ping).toHaveBeenCalled();
      expect(mockWs2.ping).toHaveBeenCalled();
      expect(mockWs1.isAlive).toBe(false);
      expect(mockWs2.isAlive).toBe(false);
      expect(mockWs1.terminate).not.toHaveBeenCalled();
      expect(mockWs2.terminate).not.toHaveBeenCalled();
    });

    it('should terminate connections that are not alive', () => {
      // Add a dead connection
      mockWss.clients.add(mockWs3);
      
      setupHeartbeat(mockWss, mockLogger);

      // Advance timer to execute heartbeat
      vi.advanceTimersByTime(1000);

      expect(mockWs3.terminate).toHaveBeenCalled();
      expect(mockWs3.ping).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Conexão WS encerrada por timeout');
    });

    it('should handle mixed alive and dead connections', () => {
      // Set up connections with different states
      mockWs1.isAlive = true;
      mockWs2.isAlive = false;
      mockWs3.isAlive = true;
      
      mockWss.clients = new Set([mockWs1, mockWs2, mockWs3]);
      
      setupHeartbeat(mockWss, mockLogger);

      // Advance timer to execute heartbeat
      vi.advanceTimersByTime(1000);

      // Alive connections should be pinged
      expect(mockWs1.ping).toHaveBeenCalled();
      expect(mockWs3.ping).toHaveBeenCalled();
      expect(mockWs1.isAlive).toBe(false);
      expect(mockWs3.isAlive).toBe(false);
      expect(mockWs1.terminate).not.toHaveBeenCalled();
      expect(mockWs3.terminate).not.toHaveBeenCalled();

      // Dead connection should be terminated
      expect(mockWs2.terminate).toHaveBeenCalled();
      expect(mockWs2.ping).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Conexão WS encerrada por timeout');
    });

    it('should execute heartbeat multiple times', () => {
      setupHeartbeat(mockWss, mockLogger);

      // First execution
      vi.advanceTimersByTime(1000);
      expect(mockWs1.ping).toHaveBeenCalledTimes(1);
      expect(mockWs2.ping).toHaveBeenCalledTimes(1);

      // Reset connections to simulate responding to ping
      mockWs1.isAlive = true;
      mockWs2.isAlive = true;

      // Second execution
      vi.advanceTimersByTime(1000);
      expect(mockWs1.ping).toHaveBeenCalledTimes(2);
      expect(mockWs2.ping).toHaveBeenCalledTimes(2);
    });

    it('should handle empty client list', () => {
      mockWss.clients = new Set();
      
      setupHeartbeat(mockWss, mockLogger);

      // Should not throw errors with empty list
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('connection lifecycle simulation', () => {
    it('should simulate full heartbeat cycle with connection dying', () => {
      setupHeartbeat(mockWss, mockLogger);

      // First execution - connections are alive
      vi.advanceTimersByTime(1000);
      expect(mockWs1.isAlive).toBe(false);
      expect(mockWs2.isAlive).toBe(false);
      expect(mockWs1.ping).toHaveBeenCalledTimes(1);
      expect(mockWs2.ping).toHaveBeenCalledTimes(1);
      expect(mockWs1.terminate).not.toHaveBeenCalled();
      expect(mockWs2.terminate).not.toHaveBeenCalled();

      // ws1 responds to ping, ws2 does not respond
      mockWs1.isAlive = true;
      // mockWs2.isAlive remains false

      // Second execution
      vi.advanceTimersByTime(1000);

      // ws1 should be pinged again
      expect(mockWs1.ping).toHaveBeenCalledTimes(2);
      expect(mockWs1.isAlive).toBe(false);
      expect(mockWs1.terminate).not.toHaveBeenCalled();

      // ws2 should be terminated
      expect(mockWs2.terminate).toHaveBeenCalledTimes(1);
      expect(mockWs2.ping).toHaveBeenCalledTimes(1); // Not pinged the second time
      expect(mockLogger.warn).toHaveBeenCalledWith('Conexão WS encerrada por timeout');
    });
  });

  describe('cleanup on close', () => {
    it('should clear interval when wss closes', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      setupHeartbeat(mockWss, mockLogger);

      // Simulates server closing
      const closeHandler = mockWss.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not execute heartbeat after wss closes', () => {
      setupHeartbeat(mockWss, mockLogger);

      // Simulates server closing
      const closeHandler = mockWss.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      // Reset mocks
      vi.clearAllMocks();

      // Advance timer after closing
      vi.advanceTimersByTime(1000);

      // Should not execute heartbeat
      expect(mockWs1.ping).not.toHaveBeenCalled();
      expect(mockWs2.ping).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle connections without isAlive property', () => {
      const mockWsNoIsAlive = {
        terminate: vi.fn(),
        ping: vi.fn()
        // isAlive not defined
      };

      mockWss.clients = new Set([mockWsNoIsAlive]);
      
      setupHeartbeat(mockWss, mockLogger);

      // Should treat undefined/falsy as dead
      vi.advanceTimersByTime(1000);

      expect(mockWsNoIsAlive.terminate).toHaveBeenCalled();
      expect(mockWsNoIsAlive.ping).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Conexão WS encerrada por timeout');
    });

    it('should handle connections where ping throws error', () => {
      mockWs1.ping.mockImplementation(() => {
        throw new Error('Ping failed');
      });

      setupHeartbeat(mockWss, mockLogger);

      // The error should stop the forEach execution
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).toThrow('Ping failed');

      // mockWs2 will not be processed due to the error
      expect(mockWs2.ping).not.toHaveBeenCalled();
    });

    it('should handle connections where terminate throws error', () => {
      mockWs3.terminate.mockImplementation(() => {
        throw new Error('Terminate failed');
      });

      mockWss.clients = new Set([mockWs3, mockWs1]);
      
      setupHeartbeat(mockWss, mockLogger);

      // The error should stop the forEach execution
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).toThrow('Terminate failed');

      // mockWs1 will not be processed due to the error
      expect(mockWs1.ping).not.toHaveBeenCalled();
    });

    it('should handle large number of connections', () => {
      const manyConnections = Array.from({ length: 100 }, (_, i) => ({
        isAlive: i % 2 === 0, // metade viva, metade morta
        terminate: vi.fn(),
        ping: vi.fn()
      }));

      mockWss.clients = new Set(manyConnections);
      
      setupHeartbeat(mockWss, mockLogger);

      vi.advanceTimersByTime(1000);

      // Check if all connections were processed
      // Since forEach processes in order, we need to verify based on implementation
      let aliveCount = 0;
      let deadCount = 0;

      manyConnections.forEach(ws => {
        if (ws.ping.mock.calls.length > 0) {
          aliveCount++;
        }
        if (ws.terminate.mock.calls.length > 0) {
          deadCount++;
        }
      });

      // Should process all 100 connections
      expect(aliveCount + deadCount).toBe(100);
      expect(aliveCount).toBe(50); // alive connections (isAlive: true)
      expect(deadCount).toBe(50); // dead connections (isAlive: false)
      expect(mockLogger.warn).toHaveBeenCalledTimes(50); // 50 dead connections
    });
  });
});
