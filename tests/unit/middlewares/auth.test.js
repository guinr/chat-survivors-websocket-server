import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/middlewares/auth.js';
import { config } from '../../../src/core/config.js';

vi.mock('../../../src/core/config.js', () => ({
  config: {
    twitchClientSecret: 'test-secret'
  }
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when role is allowed without authentication', () => {
    it('should return true for role "game"', () => {
      const message = { role: 'game' };
      const result = authMiddleware(message);
      expect(result).toBe(true);
    });

    it('should return true for role "viewer"', () => {
      const message = { role: 'viewer' };
      const result = authMiddleware(message);
      expect(result).toBe(true);
    });
  });

  describe('when role requires authentication', () => {
    it('should return false for undefined role', () => {
      const message = {};
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false for random role without token', () => {
      const message = { role: 'qualquer_coisa' };
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });
  });

  describe('when role requires authentication', () => {
    it('should return false when token is missing for extension role', () => {
      const message = { role: 'extension', user: { id: 'user123' } };
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when userId is missing for extension role', () => {
      const message = { role: 'extension', token: 'valid-token' };
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when both token and userId are missing for extension role', () => {
      const message = { role: 'extension' };
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when token is invalid for extension role', () => {
      const message = { 
        role: 'extension', 
        token: 'invalid-token', 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when token userId does not match message userId for extension role', () => {
      const tokenPayload = { sub: 'different-user' };
      const validToken = jwt.sign(tokenPayload, config.twitchClientSecret);
      
      const message = { 
        role: 'extension', 
        token: validToken, 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return true and add tokenData when token is valid and userId matches for extension role', () => {
      const tokenPayload = { 
        sub: 'user123', 
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      const validToken = jwt.sign(tokenPayload, config.twitchClientSecret);
      
      const message = { 
        role: 'extension', 
        token: validToken, 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      
      expect(result).toBe(true);
      expect(message.tokenData).toBeDefined();
      expect(message.tokenData.sub).toBe('user123');
    });

    it('should return false when token is expired for extension role', () => {
      const expiredTokenPayload = { 
        sub: 'user123', 
        iat: Math.floor(Date.now() / 1000) - 7200, 
        exp: Math.floor(Date.now() / 1000) - 3600  
      };
      const expiredToken = jwt.sign(expiredTokenPayload, config.twitchClientSecret);
      
      const message = { 
        role: 'extension', 
        token: expiredToken, 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when token is signed with different secret for extension role', () => {
      const tokenPayload = { sub: 'user123' };
      const tokenWithWrongSecret = jwt.sign(tokenPayload, 'wrong-secret');
      
      const message = { 
        role: 'extension', 
        token: tokenWithWrongSecret, 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });

    it('should return false when token is malformed for extension role', () => {
      const message = { 
        role: 'extension', 
        token: 'malformed.token.here', 
        user: { id: 'user123' }
      };
      
      const result = authMiddleware(message);
      expect(result).toBe(false);
    });
  });
});
