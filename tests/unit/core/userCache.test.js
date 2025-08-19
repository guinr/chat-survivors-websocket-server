import { describe, it, expect, beforeEach, vi } from 'vitest';
import { userCache } from '../../../src/core/userCache.js';

describe('UserCache', () => {
  beforeEach(() => {
    userCache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve display name', () => {
      userCache.set('user123', 'TestUser');
      
      expect(userCache.get('user123')).toBe('TestUser');
    });

    it('should return null for non-existent user', () => {
      expect(userCache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing entry', () => {
      userCache.set('user123', 'OldName');
      userCache.set('user123', 'NewName');
      
      expect(userCache.get('user123')).toBe('NewName');
    });
  });

  describe('has method', () => {
    it('should return true for existing entry', () => {
      userCache.set('user123', 'TestUser');
      
      expect(userCache.has('user123')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(userCache.has('nonexistent')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear all entries', () => {
      userCache.set('user1', 'User1');
      userCache.set('user2', 'User2');
      
      userCache.clear();
      
      expect(userCache.size()).toBe(0);
      expect(userCache.get('user1')).toBeNull();
      expect(userCache.get('user2')).toBeNull();
    });

    it('should return correct size', () => {
      expect(userCache.size()).toBe(0);
      
      userCache.set('user1', 'User1');
      expect(userCache.size()).toBe(1);
      
      userCache.set('user2', 'User2');
      expect(userCache.size()).toBe(2);
    });
  });

  describe('multiple users', () => {
    it('should handle multiple users independently', () => {
      userCache.set('user1', 'DisplayName1');
      userCache.set('user2', 'DisplayName2');
      userCache.set('user3', 'DisplayName3');
      
      expect(userCache.get('user1')).toBe('DisplayName1');
      expect(userCache.get('user2')).toBe('DisplayName2');
      expect(userCache.get('user3')).toBe('DisplayName3');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined userId', () => {
      userCache.set(undefined, 'TestUser');
      
      expect(userCache.get(undefined)).toBe('TestUser');
    });

    it('should handle null userId', () => {
      userCache.set(null, 'TestUser');
      
      expect(userCache.get(null)).toBe('TestUser');
    });

    it('should handle empty string userId', () => {
      userCache.set('', 'TestUser');
      
      expect(userCache.get('')).toBe('TestUser');
    });

    it('should handle numeric userId', () => {
      userCache.set(123, 'TestUser');
      
      expect(userCache.get(123)).toBe('TestUser');
    });
  });
});
