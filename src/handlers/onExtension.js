import { messageBus } from '../server/messageBus.js';
import { userCache } from '../core/userCache.js';
import { connectionManager } from '../server/connectionManager.js';

function validateExtensionMessage(message) {
  const { action, data } = message;
  const userId = message?.user?.id;
  
  if (!userId) {
    return { valid: false, error: 'Mensagem de extensão recebida sem user.id' };
  }
  
  if (!action) {
    return { valid: false, error: 'Mensagem de extensão recebida sem action' };
  }

  const allowedActions = ['str', 'agi', 'vit', 'luc', 'equip', 'buy', 'sell', 'shop'];
  if (!allowedActions.includes(action)) {
    return { valid: false, error: `Action ${action} não permitida` };
  }

  return { valid: true, userId, action, data };
}

export function handleExtension(ws, message, logger) {
  logger.info({ userId: message?.user?.id, action: message.action, data: message.data }, 'Handler extension chamado');

  const validation = validateExtensionMessage(message);
  if (!validation.valid) {
    logger.warn(validation.error);
    return;
  }

  const { userId, action, data } = validation;

  // Se for ação shop, registrar a extensão para receber a resposta
  if (action === 'shop') {
    connectionManager.addExtension(userId, ws);
    logger.info(`Extensão registrada para usuário ${userId} devido à ação shop`);
  }

  // Prioridade: display_name da mensagem → cache → fallback "Desconhecido"
  const displayName = message?.user?.display_name || userCache.get(userId) || 'Desconhecido';

  // Cache o display_name se foi fornecido na mensagem
  if (message?.user?.display_name) {
    userCache.set(userId, displayName);
  }

  messageBus.sendToGame(userId, displayName, action, data);

  logger.info(`Ação ${action} enviada para jogo: usuário ${userId} (${displayName})`);
}
