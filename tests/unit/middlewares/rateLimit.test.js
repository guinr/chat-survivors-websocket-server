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

    // Send 5 messages (limit)
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    // Sixth message should be blocked
    expect(rateLimitMiddleware(userId)).toBe(false);

    // Seventh message should also be blocked
    expect(rateLimitMiddleware(userId)).toBe(false);
  });

  it('should reset the counter after 1 second', () => {
    const userId = 'user123';

    // Send 5 messages (limit)
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    // Sixth message should be blocked
    expect(rateLimitMiddleware(userId)).toBe(false);

    // Advance time by 1 second
    vi.advanceTimersByTime(1000);

    // Now it should allow again
    expect(rateLimitMiddleware(userId)).toBe(true);
  });

  it('should track different users independently', () => {
    const user1 = 'user1';
    const user2 = 'user2';

    // User1 sends 5 messages (limit)
    for (let i = 0; i < 5; i++) {
      expect(rateLimitMiddleware(user1)).toBe(true);
    }

    // User1 sixth message should be blocked
    expect(rateLimitMiddleware(user1)).toBe(false);

    // User2 should still be able to send messages
    expect(rateLimitMiddleware(user2)).toBe(true);
    expect(rateLimitMiddleware(user2)).toBe(true);
  });

  it('should allow messages after resetting the time window', () => {
    const userId = 'user123';

    // First message
    expect(rateLimitMiddleware(userId)).toBe(true);

    // Advance time by 500ms (still within the window)
    vi.advanceTimersByTime(500);

    // Send 4 more messages (total of 5)
    for (let i = 0; i < 4; i++) {
      expect(rateLimitMiddleware(userId)).toBe(true);
    }

    // Sixth message should be blocked
    expect(rateLimitMiddleware(userId)).toBe(false);

    // Advance time by 600ms (total 1100ms since the first message)
    vi.advanceTimersByTime(600);

    // Now it should allow again (new window)
    expect(rateLimitMiddleware(userId)).toBe(true);
  });

  it('should correctly update the counter within the same time window', () => {
    const userId = 'user123';

    // Define a base time
    const baseTime = 1000000;
    vi.setSystemTime(baseTime);

    // First message
    expect(rateLimitMiddleware(userId)).toBe(true);

    // Advance 100ms (still within the same window)
    vi.setSystemTime(baseTime + 100);
    expect(rateLimitMiddleware(userId)).toBe(true);

    // Advance 200ms more (still within the same window)
    vi.setSystemTime(baseTime + 300);
    expect(rateLimitMiddleware(userId)).toBe(true);

    // Two more messages to reach the limit
    expect(rateLimitMiddleware(userId)).toBe(true);
    expect(rateLimitMiddleware(userId)).toBe(true);

    // Sixth message should be blocked
    expect(rateLimitMiddleware(userId)).toBe(false);
  });
});
