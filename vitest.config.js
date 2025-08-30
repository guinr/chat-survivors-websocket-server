import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      TWITCH_CLIENT_ID: 'test_client_id',
      TWITCH_CLIENT_SECRET: 'test_client_secret',
      PORT: '8080',
      LOG_LEVEL: 'silent'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'coverage/**',
        'scripts/**',
        'simulators/**',
        '*.config.js'
      ]
    }
  }
});
