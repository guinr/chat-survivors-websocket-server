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

  it('should allow messages when userId is undefined', () => {
    const result = rateLimitMiddleware(undefined);
    expect(result).toBe(true);
  });

  it('should allow messages when userId is null', () => {
    const result = rateLimitMiddleware(null);
    expect(result).toBe(true);
  });

  it('should allow the first message from a user', () => {
    const userId = 'user123';
    const result = rateLimitMiddleware(userId);
    expect(result).toBe(true);
  });

  it('should allow messages within the per-second limit', () => {
    const userId = 'user123';

    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);
  });

  it('should block messages that exceed the per-second limit', () => {
    const userId = 'user123';

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    
    expect(rateLimitMiddleware(userId)).toBe(false);

    
    expect(rateLimitMiddleware(userId)).toBe(false);
  });

  it('should reset the counter after 1 second', () => {
    const userId = 'user123';

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    
    expect(rateLimitMiddleware(userId)).toBe(false);

    
    vi.advanceTimersByTime(1000);

    
    expect(rateLimitMiddleware(userId)).toBe(true);
  });

  it('should track different users independently', () => {
    const user1 = 'user1';
    const user2 = 'user2';

    
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(user1)).toBe(true);
    }

    
    expect(rateLimitMiddleware(user1)).toBe(false);

    
    expect(rateLimitMiddleware(user2)).toBe(true);
    expect(rateLimitMiddleware(user2)).toBe(true);
  });

  it('should allow messages after resetting the time window', () => {
    const userId = 'user123';

    
    expect(rateLimitMiddleware(userId)).toBe(true);

    
    vi.advanceTimersByTime(500);

    
    for (let i = 0; i < 4; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    
    expect(rateLimitMiddleware(userId)).toBe(false);

    
    vi.advanceTimersByTime(600);

    
    expect(rateLimitMiddleware(userId)).toBe(true);
  });

  it('should correctly update the counter within the same time window', () => {
    const userId = 'user123';

    
    const baseTime = 1000000;
    vi.setSystemTime(baseTime);

    
    expect(rateLimitMiddleware(userId)).toBe(true);

    
    vi.setSystemTime(baseTime + 100);
    expect(rateLimitMiddleware(userId)).toBe(true);

    
    vi.setSystemTime(baseTime + 300);
    expect(rateLimitMiddleware(userId)).toBe(true);

    
    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);

    
    expect(rateLimitMiddleware(userId)).toBe(false);
  });
});
