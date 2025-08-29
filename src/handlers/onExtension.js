import { messageBus } from '../server/messageBus.js';
import { userCache } from '../core/userCache.js';

function validateExtensionMessage(message) {
  const { userId, action, value } = message;
  
  if (!userId) {
    return { valid: false, error: 'Mensagem de extensão recebida sem userId' };
  }
  
  if (!action) {
    return { valid: false, error: 'Mensagem de extensão recebida sem action' };
  }

  const allowedActions = ['str', 'agi', 'vit', 'luc', 'equip', 'buy', 'sell'];
  if (!allowedActions.includes(action)) {
    return { valid: false, error: `Action ${action} não permitida` };
  }
  
  return { valid: true, userId, action, value };
}

export function handleExtension(ws, message, logger) {
  logger.info({ userId: message.userId, action: message.action }, 'Handler extension chamado');

  const validation = validateExtensionMessage(message);
  if (!validation.valid) {
    logger.warn(validation.error);
    return;
  }

  const { userId, action, value } = validation;

  const displayName = userCache.get(userId) || 'Desconhecido';

  messageBus.sendToGame(userId, displayName, action, value);

  logger.info(`Ação ${action} enviada para jogo: usuário ${userId} (${displayName})`);
}
