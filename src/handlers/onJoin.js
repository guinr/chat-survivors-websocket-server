import { connectionManager } from '../server/connectionManager.js';
import { messageBus } from '../server/messageBus.js';
import { userCache } from '../core/userCache.js';
import { getTwitchAccessToken, fetchTwitchUserInfo } from '../core/twitchApi.js';
import { config } from '../core/config.js';

async function getUserDisplayName(userId, logger) {
  const cachedDisplayName = userCache.get(userId);
  
  if (cachedDisplayName) {
    logger.debug({ userId, displayName: cachedDisplayName }, 'Display name encontrado no cache');
    return cachedDisplayName;
  }

  try {
    const accessToken = await getTwitchAccessToken();
    const userInfo = await fetchTwitchUserInfo(userId, accessToken);
    const displayName = userInfo?.display_name || 'Desconhecido';
    
    userCache.set(userId, displayName);
    logger.debug({ userId, displayName }, 'Display name salvo no cache');
    
    return displayName;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Falha ao buscar display_name');
    return 'Desconhecido';
  }
}

export { getUserDisplayName };

function validateJoinMessage(message) {
  const userId = message?.user?.id;
  
  if (!userId) {
    return { valid: false, error: 'Join recebido sem user.id' };
  }
  
  return { valid: true, userId };
}

function notifyGameUserJoined(userId, displayName) {
  messageBus.sendToGame(userId, displayName, 'join');
}

export async function handleJoin(ws, message, logger) {
  const validation = validateJoinMessage(message);
  if (!validation.valid) {
    logger.warn(validation.error);
    return;
  }

  const { userId } = validation;

  connectionManager.addExtension(userId, ws);

  // Use display_name from message if available, otherwise fetch from cache/API
  let displayName = message?.user?.display_name;
  
  if (!displayName) {
    displayName = await getUserDisplayName(userId, logger);
  } else {
    // Cache the display_name from the message for future use
    userCache.set(userId, displayName);
    logger.debug({ userId, displayName }, 'Display name recebido da extensão e salvo no cache');
  }

  logger.info(`Usuário ${userId} (${displayName}) entrou`);

  notifyGameUserJoined(userId, displayName);
}
