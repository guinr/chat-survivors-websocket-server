import { rateLimitMiddleware } from '../middlewares/rateLimit.js';
import { handleJoin } from '../handlers/onJoin.js';
import { handleStorekeeper } from '../handlers/onStorekeeper.js';
import { handleExtension } from '../handlers/onExtension.js';
import { authMiddleware } from '../middlewares/auth.js';
import { storekeeperService } from '../core/storekeeperService.js';

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

  if (message.name && message.phrases && message.common_items) {
    logger.info('Recebida resposta do storekeeper do jogo');
    storekeeperService.handleGameResponse(message);
    return;
  }

  if (!authMiddleware(message)) {
    logger.warn(`Usuário ${message?.userId || 'desconhecido'} não autorizado`);
    return;
  }

  if (!rateLimitMiddleware(message)) {
    logger.warn(`Usuário ${message?.userId || 'desconhecido'} excedeu rate limit`);
    return;
  }

  const { action } = message;

  switch (action) {
    case 'join':
      handleJoin(ws, message, logger);
      break;
    case 'storekeeper':
      handleStorekeeper(ws, message, logger);
      break;
    case 'str':
    case 'agi':
    case 'vit':
    case 'luc':
    case 'equip':
    case 'buy':
    case 'sell':
      handleExtension(ws, message, logger);
      break;
    default:
      logger.warn({ action }, 'Tipo de mensagem desconhecido');
  }
}
