import { config } from '../core/config.js';

const userMessageCounts = new Map();

export function rateLimitMiddleware(userId) {
  if (!userId) return true;

  const now = Date.now();
  const windowTime = 1000;
  const limit = config.rateLimitPerSecond;

  let record = userMessageCounts.get(userId);

  if (!record) {
    record = { count: 1, start: now };
    userMessageCounts.set(userId, record);
    return true;
  }

  if (now - record.start < windowTime) {
    record.count += 1;
    if (record.count > limit) {
      return false;
    }
  } else {
    record.count = 1;
    record.start = now;
  }

  return true;
}
