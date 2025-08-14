import jwt from 'jsonwebtoken';
import { config } from '../core/config.js';

export function authMiddleware(message) {
  const { role, token, userId } = message;
  
  if (role !== 'extension') return true;

  if (!token || !userId) return false;

  try {
    const decoded = jwt.verify(token, config.twitchClientSecret);
    if (decoded.sub !== userId) return false;

    message.tokenData = decoded;
    return true;
  } catch (err) {
    return false;
  }
}
