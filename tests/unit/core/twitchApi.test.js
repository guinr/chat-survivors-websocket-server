import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTwitchAccessToken, fetchTwitchUserInfo } from '../../../src/core/twitchApi.js';

vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

vi.mock('../../../src/core/config.js', () => ({
  config: {
    twitchClientId: 'test_client_id',
    twitchClientSecret: 'test_client_secret'
  }
}));

describe('twitchApi', () => {
  let fetch;

  beforeEach(async () => {
    vi.clearAllMocks();

    const fetchModule = await import('node-fetch');
    fetch = fetchModule.default;
  });

  describe('getTwitchAccessToken', () => {
    it('should get access token successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: 'test_token' })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await getTwitchAccessToken();

      expect(fetch).toHaveBeenCalledWith('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        body: expect.any(URLSearchParams)
      });
      expect(result).toBe('test_token');
    });

    it('should throw error on failed response', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({ message: 'Invalid credentials' })
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(getTwitchAccessToken()).rejects.toThrow('Failed to get access token: Invalid credentials');
    });
  });

  describe('fetchTwitchUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUserData = {
        id: '12345',
        display_name: 'TestUser',
        login: 'testuser'
      };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [mockUserData] })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchTwitchUserInfo('12345', 'test_token');

      expect(fetch).toHaveBeenCalledWith('https://api.twitch.tv/helix/users?id=12345', {
        headers: {
          'Client-ID': 'test_client_id',
          'Authorization': 'Bearer test_token'
        }
      });
      expect(result).toEqual(mockUserData);
    });

    it('should return null when no user data found', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] })
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await fetchTwitchUserInfo('99999', 'test_token');

      expect(result).toBeNull();
    });

    it('should throw error on failed response', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({ message: 'User not found' })
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(fetchTwitchUserInfo('99999', 'test_token')).rejects.toThrow('Failed to fetch user info: User not found');
    });
  });
});