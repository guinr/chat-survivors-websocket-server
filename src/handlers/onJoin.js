import { connectionManager } from '../server/connectionManager.js';
import { messageBus } from '../server/messageBus.js';
import { userCache } from '../core/userCache.js';
import fetch from 'node-fetch';
import { config } from '../core/config.js';

async function getTwitchAccessToken() {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: config.twitchClientId,
      client_secret: config.twitchClientSecret,
      grant_type: 'client_credentials'
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.message || response.statusText}`);
  }

  return data.access_token;
}

async function fetchTwitchUserInfo(userId, accessToken) {
  const response = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
    headers: {
      'Client-ID': config.twitchClientId,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${data.message || response.statusText}`);
  }

  return data.data?.[0]?.display_name || 'Desconhecido';
}

async function getUserDisplayName(userId, logger) {
  const cachedDisplayName = userCache.get(userId);
  
  if (cachedDisplayName) {
    logger.debug({ userId, displayName: cachedDisplayName }, 'Display name encontrado no cache');
    return cachedDisplayName;
  }

  try {
    const accessToken = await getTwitchAccessToken();
    const displayName = await fetchTwitchUserInfo(userId, accessToken);
    
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
