import { rateLimitMiddleware } from '../middlewares/rateLimit.js';
import { handleJoin } from '../handlers/onJoin.js';
import { handleStorekeeper } from '../handlers/onStorekeeper.js';
import { handleExtension } from '../handlers/onExtension.js';
import { authMiddleware } from '../middlewares/auth.js';
import { storekeeperService } from '../core/storekeeperService.js';
import { messageBus } from './messageBus.js';

export function routeMessage(ws, data, logger) {
  let stringData;
  if (Buffer.isBuffer(data)) {
    stringData = data.toString('utf8');
  } else if (typeof data === 'string') {
    stringData = data;
  } else {
    logger.error({ 
      type: typeof data, 
      length: data?.length || 'unknown',
      isBuffer: Buffer.isBuffer(data)
    }, 'Dados recebidos não são string nem Buffer');
    return;
  }

  let message;

  try {
    message = JSON.parse(stringData);
  } catch (err) {
    logger.error({ 
      error: err.message,
      dataLength: stringData.length,
      dataPreview: stringData.substring(0, 100) + (stringData.length > 100 ? '...' : '')
    }, 'Falha ao parsear JSON');
    return;
  }

  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    logger.error({ 
      messageType: typeof message,
      isArray: Array.isArray(message),
      isNull: message === null
    }, 'Estrutura de mensagem inválida');
    return;
  }

  if (message.name && message.phrases && message.common_items) {
    logger.info('Recebida resposta do storekeeper do jogo');
    storekeeperService.handleGameResponse(message);
    return;
  }

  if (message.user?.id && message.action) {
    messageBus.sendToUser(message.user.id, message.user.display_name, message.action, message.data);
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
