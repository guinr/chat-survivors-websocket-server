import 'dotenv/config';

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  heartbeatInterval: 30000,
  maxMessageSize: 1024 * 10,
  rateLimitPerSecond: 5,
  twitchClientId: process.env.TWITCH_CLIENT_ID,
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET
};
