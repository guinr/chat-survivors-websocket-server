import { storekeeperCache } from '../core/storekeeperCache.js';
import { messageBus } from '../server/messageBus.js';

export function handleStorekeeper(ws, message, logger) {
  const userId = message?.user?.id;
  logger.info({ userId }, 'Handler storekeeper chamado');

  const cachedData = storekeeperCache.get();
  
  if (cachedData) {
    logger.info({ userId }, 'Retornando dados do cache');
    ws.send(JSON.stringify(cachedData));
    return;
  }

  logger.info({ userId }, 'Cache vazio - solicitando dados do jogo');
  messageBus.sendToGame(userId, null, 'storekeeper');
  
  logger.info({ userId }, 'Cache vazio - sem vendedores no momento');
  
  const errorResponse = { error: 'Sem vendedores no momento' };
  ws.send(JSON.stringify(errorResponse));
}
