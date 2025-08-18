import { rateLimitMiddleware } from '../middlewares/rateLimit.js';
import { handleJoin } from '../handlers/onJoin.js';
import { authMiddleware } from '../middlewares/auth.js';

export function routeMessage(ws, data, logger) {
  if (typeof data !== 'string') {
    logger.error({ data, type: typeof data }, 'Tipo de dados inválido');
    return;
  }

  let message;

  try {
    message = JSON.parse(data);
  } catch (err) {
    logger.error({ err, data }, 'Mensagem inválida');
    return;
  }

  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    logger.error({ message, type: typeof message }, 'Estrutura de mensagem inválida');
    return;
  }

  if (!authMiddleware(message)) {
    logger.warn(`Usuário ${message?.userId || 'desconhecido'} não autorizado`);
    return;
  }

  if (!rateLimitMiddleware(message?.userId)) {
    logger.warn(`Usuário ${message?.userId || 'desconhecido'} excedeu rate limit`);
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
