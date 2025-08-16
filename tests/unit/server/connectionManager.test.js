import { describe, it, expect, beforeEach, vi } from 'vitest';
import { connectionManager } from '../../../src/server/connectionManager.js';

describe('ConnectionManager', () => {
  let mockWs1, mockWs2;

  beforeEach(() => {
    mockWs1 = { terminate: vi.fn(), readyState: 1 };
    mockWs2 = { terminate: vi.fn(), readyState: 1 };
    connectionManager.extensions.clear();
    connectionManager.gameSocket = null;
  });

  describe('addExtension', () => {
    it('should add new extension', () => {
      connectionManager.addExtension('user1', mockWs1);
      expect(connectionManager.getExtension('user1')).toBe(mockWs1);
    });

    it('should terminate existing connection when adding same user', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.addExtension('user1', mockWs2);

      expect(mockWs1.terminate).toHaveBeenCalled();
      expect(connectionManager.getExtension('user1')).toBe(mockWs2);
    });
  });

  describe('addGame', () => {
    it('should set game socket', () => {
      connectionManager.addGame(mockWs1);
      expect(connectionManager.gameSocket).toBe(mockWs1);
    });

    it('should replace existing game socket', () => {
      connectionManager.addGame(mockWs1);
      connectionManager.addGame(mockWs2);
      expect(connectionManager.gameSocket).toBe(mockWs2);
    });
  });

  describe('removeGame', () => {
    it('should remove game socket', () => {
      connectionManager.addGame(mockWs1);
      connectionManager.removeGame();
      expect(connectionManager.gameSocket).toBeNull();
    });

    it('should handle removing when no game socket exists', () => {
      expect(connectionManager.gameSocket).toBeNull();
      connectionManager.removeGame();
      expect(connectionManager.gameSocket).toBeNull();
    });
  });

  describe('removeExtension', () => {
    it('should remove extension by userId', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.removeExtension('user1');
      expect(connectionManager.getExtension('user1')).toBeUndefined();
    });

    it('should handle removing non-existent extension', () => {
      connectionManager.removeExtension('nonexistent');
      expect(connectionManager.getExtension('nonexistent')).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove game socket when matching', () => {
      connectionManager.addGame(mockWs1);
      connectionManager.remove(mockWs1);
      expect(connectionManager.gameSocket).toBeNull();
    });

    it('should remove extension when matching', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.remove(mockWs1);
      expect(connectionManager.getExtension('user1')).toBeUndefined();
    });

    it('should not remove anything when socket not found', () => {
      connectionManager.addGame(mockWs1);
      connectionManager.addExtension('user1', mockWs2);
      
      const mockWs3 = { terminate: vi.fn(), readyState: 1 };
      connectionManager.remove(mockWs3);
      
      expect(connectionManager.gameSocket).toBe(mockWs1);
      expect(connectionManager.getExtension('user1')).toBe(mockWs2);
    });

    it('should prioritize game socket removal over extension', () => {
      // Add the same socket as game and extension
      connectionManager.addGame(mockWs1);
      connectionManager.addExtension('user1', mockWs1);
      
      connectionManager.remove(mockWs1);

      // Should remove only the game socket, extension remains
      expect(connectionManager.gameSocket).toBeNull();
      expect(connectionManager.getExtension('user1')).toBe(mockWs1);
    });
  });

  describe('getExtension', () => {
    it('should return undefined for non-existent user', () => {
      expect(connectionManager.getExtension('nonexistent')).toBeUndefined();
    });

    it('should return correct extension for existing user', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.addExtension('user2', mockWs2);
      
      expect(connectionManager.getExtension('user1')).toBe(mockWs1);
      expect(connectionManager.getExtension('user2')).toBe(mockWs2);
    });
  });

  describe('broadcastToExtensions', () => {
    it('should call function for all extensions', () => {
      const mockFn = vi.fn();
      
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.addExtension('user2', mockWs2);
      
      connectionManager.broadcastToExtensions(mockFn);
      
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith(mockWs1);
      expect(mockFn).toHaveBeenCalledWith(mockWs2);
    });

    it('should not call function when no extensions exist', () => {
      const mockFn = vi.fn();
      
      connectionManager.broadcastToExtensions(mockFn);
      
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should call function even for single extension', () => {
      const mockFn = vi.fn();
      
      connectionManager.addExtension('user1', mockWs1);
      
      connectionManager.broadcastToExtensions(mockFn);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(mockWs1);
    });
  });

  describe('addExtension edge cases', () => {
    it('should not terminate when adding same socket for same user', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.addExtension('user1', mockWs1);

      expect(mockWs1.terminate).not.toHaveBeenCalled();
      expect(connectionManager.getExtension('user1')).toBe(mockWs1);
    });

    it('should handle multiple users with different sockets', () => {
      connectionManager.addExtension('user1', mockWs1);
      connectionManager.addExtension('user2', mockWs2);

      expect(connectionManager.getExtension('user1')).toBe(mockWs1);
      expect(connectionManager.getExtension('user2')).toBe(mockWs2);
      expect(mockWs1.terminate).not.toHaveBeenCalled();
      expect(mockWs2.terminate).not.toHaveBeenCalled();
    });
  });
});
