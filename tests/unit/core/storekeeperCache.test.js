import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storekeeperCache } from '../../../src/core/storekeeperCache.js';

describe('StorekeeperCache', () => {
  beforeEach(() => {
    storekeeperCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get', () => {
    it('deve retornar null quando cache está vazio', () => {
      expect(storekeeperCache.get()).toBeNull();
    });

    it('deve retornar dados quando cache é válido para hoje', () => {
      const testData = { name: 'Test', phrases: [] };
      storekeeperCache.set(testData);

      expect(storekeeperCache.get()).toEqual(testData);
    });

    it('deve retornar null quando cache é de outro dia', () => {
      const testData = { name: 'Test', phrases: [] };
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      vi.setSystemTime(yesterday);
      storekeeperCache.set(testData);
      
      vi.useRealTimers();
      
      expect(storekeeperCache.get()).toBeNull();
    });
  });

  describe('set', () => {
    it('deve armazenar dados no cache', () => {
      const testData = { name: 'Test', phrases: [] };
      storekeeperCache.set(testData);

      expect(storekeeperCache.cache).toEqual(testData);
      expect(storekeeperCache.cacheDate).toBeInstanceOf(Date);
    });
  });

  describe('clear', () => {
    it('deve limpar cache e data', () => {
      const testData = { name: 'Test', phrases: [] };
      storekeeperCache.set(testData);

      storekeeperCache.clear();

      expect(storekeeperCache.cache).toBeNull();
      expect(storekeeperCache.cacheDate).toBeNull();
    });
  });

  describe('isValidForToday', () => {
    it('deve retornar false quando cache está vazio', () => {
      expect(storekeeperCache.isValidForToday()).toBe(false);
    });

    it('deve retornar true quando cache é do mesmo dia', () => {
      const testData = { name: 'Test', phrases: [] };
      storekeeperCache.set(testData);

      expect(storekeeperCache.isValidForToday()).toBe(true);
    });

    it('deve retornar false quando cache é de outro dia', () => {
      const testData = { name: 'Test', phrases: [] };
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      vi.setSystemTime(yesterday);
      storekeeperCache.set(testData);
      
      vi.useRealTimers();
      
      expect(storekeeperCache.isValidForToday()).toBe(false);
    });

    it('deve usar timezone de São Paulo para comparação', () => {
      const testData = { name: 'Test', phrases: [] };
      
      const now = new Date();
      const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      
      vi.setSystemTime(spTime);
      storekeeperCache.set(testData);
      
      expect(storekeeperCache.isValidForToday()).toBe(true);
    });
  });
});
