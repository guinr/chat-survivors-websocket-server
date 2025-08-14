import { rateLimitMiddleware } from '../middlewares/rateLimit.js';
import { handleJoin } from '../handlers/onJoin.js';
import { authMiddleware } from '../middlewares/auth.js';

export function routeMessage(ws, data, logger) {
  let message;

  try {
    message = JSON.parse(data);
  } catch (err) {
    logger.error({ err, data }, 'Mensagem inválida');
    return;
  }

  if (!authMiddleware(message)) {
    logger.warn(`Usuário ${message.userId || 'desconhecido'} não autorizado`);
    return;
  }

  if (!rateLimitMiddleware(message.userId)) {
    logger.warn(`Usuário ${message.userId} excedeu rate limit`);
    return;
  }

  const { action } = message;

  switch (action) {
    case 'join':
      handleJoin(ws, message, logger);
      break;
    default:
      logger.warn({ action }, 'Tipo de mensagem desconhecido');
  }
}
