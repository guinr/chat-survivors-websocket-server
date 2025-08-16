import { connectionManager } from '../server/connectionManager.js';
import { messageBus } from '../server/messageBus.js';
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
  try {
    const accessToken = await getTwitchAccessToken();
    const displayName = await fetchTwitchUserInfo(userId, accessToken);
    
    return displayName;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Falha ao buscar display_name');
    return 'Desconhecido';
  }
}

function validateJoinMessage(message) {
  const { userId } = message;
  
  if (!userId) {
    return { valid: false, error: 'Join recebido sem userId' };
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

  const displayName = await getUserDisplayName(userId, logger);

  logger.info(`Usuário ${userId} (${displayName}) entrou`);

  notifyGameUserJoined(userId, displayName);
}
