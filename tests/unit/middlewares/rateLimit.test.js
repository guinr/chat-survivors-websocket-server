import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../src/core/config.js', () => ({
  config: {
    rateLimitPerSecond: 5
  }
}));

describe('rateLimitMiddleware', () => {
  let rateLimitMiddleware;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    vi.useFakeTimers();
    
    const module = await import('../../../src/middlewares/rateLimit.js');
    rateLimitMiddleware = module.rateLimitMiddleware;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('should block messages when userId is undefined and role is not viewer', () => {
    const data = { role: 'extension' };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(false);
  });

  it('should block messages when userId is null and role is not viewer', () => {
    const data = { user: { id: null }, role: 'extension' };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(false);
  });

  it('should allow viewer messages without userId (for auth)', () => {
    const data = { role: 'viewer' };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(true);
  });

  it('should allow viewer messages with userId', () => {
    const data = { user: { id: 'viewer123' }, role: 'viewer' };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(true);
  });

  it('should allow the first message from a user', () => {
    const data = { user: { id: 'user123' } };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(true);
  });

  it('should allow messages within the per-second limit', () => {
    const data = { user: { id: 'user123' } };

    expect(rateLimitMiddleware(data)).toBe(true);
    expect(rateLimitMiddleware(data)).toBe(true);
    expect(rateLimitMiddleware(data)).toBe(true);
    expect(rateLimitMiddleware(data)).toBe(true);
    expect(rateLimitMiddleware(data)).toBe(true);
  });

  it('should block messages that exceed the per-second limit', () => {
    const data = { user: { id: 'user123' } };

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(data)).toBe(true);
    }

    
    expect(rateLimitMiddleware(data)).toBe(false);

    
    expect(rateLimitMiddleware(data)).toBe(false);
  });

  it('should reset the counter after 1 second', () => {
    const data = { user: { id: 'user123' } };

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(data)).toBe(true);
    }

    
    expect(rateLimitMiddleware(data)).toBe(false);

    
    vi.advanceTimersByTime(1000);

    
    expect(rateLimitMiddleware(data)).toBe(true);
  });

  it('should track different users independently', () => {
    const user1Data = { user: { id: 'user1' } };
    const user2Data = { user: { id: 'user2' } };

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(user1Data)).toBe(true);
    }

    
    expect(rateLimitMiddleware(user1Data)).toBe(false);

    
    expect(rateLimitMiddleware(user2Data)).toBe(true);
    expect(rateLimitMiddleware(user2Data)).toBe(true);
  });

  it('should allow messages after resetting the time window', () => {
    const data = { user: { id: 'user123' } };

    
    expect(rateLimitMiddleware(data)).toBe(true);

    
    vi.advanceTimersByTime(500);

    
    for (let i = 0; i < 4; i++) {
      expect(rateLimitMiddleware(data)).toBe(true);
    }

    
    expect(rateLimitMiddleware(data)).toBe(false);

    
    vi.advanceTimersByTime(600);

    
    expect(rateLimitMiddleware(data)).toBe(true);
  });

  it('should correctly update the counter within the same time window', () => {
    const data = { user: { id: 'user123' } };

    
    const baseTime = 1000000;
    vi.setSystemTime(baseTime);

    
    expect(rateLimitMiddleware(data)).toBe(true);

    
    vi.setSystemTime(baseTime + 100);
    expect(rateLimitMiddleware(data)).toBe(true);

    
    vi.setSystemTime(baseTime + 300);
    expect(rateLimitMiddleware(data)).toBe(true);

    
    expect(rateLimitMiddleware(data)).toBe(true);
    expect(rateLimitMiddleware(data)).toBe(true);

    
    expect(rateLimitMiddleware(data)).toBe(false);
  });

  it('should handle object format with userId', () => {
    const data = { user: { id: 'user456' } };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(true);
  });

  it('should handle object format with game role', () => {
    const data = { user: { id: 'user456' }, role: 'game' };
    const result = rateLimitMiddleware(data);
    expect(result).toBe(true);
  });
});
