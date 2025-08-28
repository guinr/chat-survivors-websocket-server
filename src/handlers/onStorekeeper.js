import { storekeeperCache } from '../core/storekeeperCache.js';

export function handleStorekeeper(ws, message, logger) {
  logger.info({ userId: message.userId }, 'Handler storekeeper chamado');

  const cachedData = storekeeperCache.get();
  
  if (cachedData) {
    logger.info({ userId: message.userId }, 'Retornando dados do cache');
    ws.send(JSON.stringify(cachedData));
    return;
  }

  logger.info({ userId: message.userId }, 'Cache vazio - sem vendedores no momento');
  
  const errorResponse = { error: 'Sem vendedores no momento' };
  ws.send(JSON.stringify(errorResponse));
}
