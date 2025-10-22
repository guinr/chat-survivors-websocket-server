import fetch from 'node-fetch';
import { config } from './config.js';

export async function getTwitchAccessToken() {
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

export async function fetchTwitchUserInfo(userId, accessToken) {
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

  return data.data?.[0] || null;
}