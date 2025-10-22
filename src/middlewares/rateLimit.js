import { config } from '../core/config.js';

const userMessageCounts = new Map();

function checkRateLimit(userId) {
  if (!userId) return false;

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

export function rateLimitMiddleware(data) {
  const { role } = data || {};
  const userId = data?.user?.id;
  
  // Permitir sem rate limit para game e viewer sem userId (ex: auth)
  if (role === 'game' || (role === 'viewer' && !userId)) return true;
  
  // Aplicar rate limit para outros casos
  return checkRateLimit(userId);
}
