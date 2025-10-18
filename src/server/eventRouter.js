import { rateLimitMiddleware } from '../middlewares/rateLimit.js';
import { handleJoin } from '../handlers/onJoin.js';
import { handleStorekeeper } from '../handlers/onStorekeeper.js';
import { handleExtension } from '../handlers/onExtension.js';
import { authMiddleware } from '../middlewares/auth.js';
import { storekeeperService } from '../core/storekeeperService.js';
import { messageBus } from './messageBus.js';
import { connectionManager } from './connectionManager.js';

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

  if (message.role === 'game') {
    // Caso 1: Conexão inicial do jogo (sem user)
    if (!message.user) {
      connectionManager.addGame(ws);
      logger.info('\x1b[32m[GAME]\x1b[0m Jogo conectado');
      return;
    }
    
    // Caso 2: Eventos de gameplay (com user e event numérico)
    if (message.user && message.event !== undefined) {
      const gameEvents = {
        0: 'joined',
        1: 'cant_join', 
        2: 'died',
        3: 'experience_up',
        4: 'level_up',
        5: 'health_changed',
        6: 'status_increased',
        7: 'inventory',
        8: 'used',
        9: 'equipped',
        10: 'buyed',
        11: 'sold',
        12: 'shop_opened',
        13: 'cant_buy',
        14: 'cant_sell',
      };
      
      const action = gameEvents[message.event];
      if (action) {
        logger.info(`\x1b[32m[GAME]\x1b[0m Enviando evento ${message.event} (${action}) para ${message.user.display_name || message.user.id}`);
        messageBus.sendToUser(message.user.id, message.user.display_name, action, message.data);
      } else {
        logger.warn(`\x1b[32m[GAME]\x1b[0m \x1b[33mEvento desconhecido ignorado: ${message.event}\x1b[0m`);
      }
      return;
    }
  }

  if (message.name && message.phrases && message.common_items) {
    logger.info('\x1b[32m[GAME]\x1b[0m Recebida resposta do storekeeper do jogo');
    storekeeperService.handleGameResponse(message);
    return;
  }

  if (message.user?.id && message.action && !message.role) {
    messageBus.sendToUser(message.user.id, message.user.display_name, message.action, message.data);
    return;
  }

  if (!authMiddleware(message)) {
    const roleColor = message.role === 'extension' ? '\x1b[34m[EXTENSION]\x1b[0m' : message.role === 'viewer' ? '\x1b[36m[VIEWER]\x1b[0m' : '\x1b[37m[UNKNOWN]\x1b[0m';
    logger.warn(`${roleColor} \x1b[31mUsuário ${message?.user?.id || 'desconhecido'} não autorizado\x1b[0m`);
    return;
  }

  if (!rateLimitMiddleware(message)) {
    const roleColor = message.role === 'extension' ? '\x1b[34m[EXTENSION]\x1b[0m' : message.role === 'viewer' ? '\x1b[36m[VIEWER]\x1b[0m' : '\x1b[37m[UNKNOWN]\x1b[0m';
    logger.warn(`${roleColor} \x1b[33mUsuário ${message?.user?.id || 'desconhecido'} excedeu rate limit\x1b[0m`);
    return;
  }

  const { action } = message;
  const roleColor = message.role === 'extension' ? '\x1b[34m[EXTENSION]\x1b[0m' : message.role === 'viewer' ? '\x1b[36m[VIEWER]\x1b[0m' : '\x1b[37m[UNKNOWN]\x1b[0m';

  switch (action) {
    case 'join':
      logger.info(`${roleColor} Fazendo join: ${message?.user?.id}`);
      handleJoin(ws, message, logger);
      break;
    case 'storekeeper':
      logger.info(`${roleColor} Consultando storekeeper: ${message?.user?.id}`);
      handleStorekeeper(ws, message, logger);
      break;
    case 'str':
    case 'agi':
    case 'vit':
    case 'luc':
    case 'equip':
    case 'buy':
    case 'sell':
    case 'shop':
      logger.info(`${roleColor} Ação ${action}: ${message?.user?.id}`);
      handleExtension(ws, message, logger);
      break;
    default:
      logger.warn(`${roleColor} \x1b[33mTipo de mensagem desconhecido: ${action}\x1b[0m`);
  }
}
