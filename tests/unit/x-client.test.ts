// tests/unit/x-client.test.ts
// Unit tests for X (Twitter) posting integration, OAuth 1.0a signing, and dev simulation

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { postTweetToX, isXConfigured, generateOAuth1Header } from '@/lib/social/x-client';

describe('X (Twitter) Admin Broadcast Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Validation & Limits', () => {
    it('throws error when tweet text is empty or whitespace-only', async () => {
      await expect(postTweetToX('')).rejects.toThrow('Tweet text cannot be empty');
      await expect(postTweetToX('   ')).rejects.toThrow('Tweet text cannot be empty');
    });

    it('throws error when tweet text exceeds 280 characters', async () => {
      const longText = 'A'.repeat(281);
      await expect(postTweetToX(longText)).rejects.toThrow('exceeds 280 characters');
    });

    it('reports isXConfigured false when no Twitter/X credentials are set in env', () => {
      delete process.env.X_API_KEY;
      delete process.env.TWITTER_API_KEY;
      delete process.env.X_ACCESS_TOKEN;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.X_BEARER_TOKEN;

      expect(isXConfigured()).toBe(false);
    });

    it('reports isXConfigured true when OAuth 1.0a or Bearer token is provided', () => {
      process.env.X_API_KEY = 'test_key';
      process.env.X_API_SECRET = 'test_secret';
      process.env.X_ACCESS_TOKEN = 'test_tok';
      process.env.X_ACCESS_TOKEN_SECRET = 'test_tok_secret';

      expect(isXConfigured()).toBe(true);
    });
  });

  describe('Dev Fallback & Simulation', () => {
    it('falls back gracefully to dev simulation when credentials are not configured', async () => {
      delete process.env.X_API_KEY;
      delete process.env.TWITTER_API_KEY;
      delete process.env.X_BEARER_TOKEN;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await postTweetToX('Now spinning on PromptFM: DJ Neon live on air! https://promptfm.live');

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.tweetId).toBeDefined();
      expect(result.text).toContain('DJ Neon');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[X:DevFallback]')
      );
    });
  });

  describe('Live API Dispatch with OAuth 1.0a and Bearer Token', () => {
    it('generates a valid OAuth 1.0a Authorization header with HMAC-SHA1 signature', () => {
      const header = generateOAuth1Header({
        method: 'POST',
        url: 'https://api.twitter.com/2/tweets',
        apiKey: 'consumer_key_123',
        apiSecret: 'consumer_secret_456',
        accessToken: 'access_tok_789',
        accessTokenSecret: 'access_sec_012',
        nonce: 'fixed_nonce_abc',
        timestamp: 1700000000,
      });

      expect(header).toContain('OAuth oauth_consumer_key="consumer_key_123"');
      expect(header).toContain('oauth_nonce="fixed_nonce_abc"');
      expect(header).toContain('oauth_signature="');
      expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(header).toContain('oauth_timestamp="1700000000"');
      expect(header).toContain('oauth_token="access_tok_789"');
      expect(header).toContain('oauth_version="1.0"');
    });

    it('sends tweet to Twitter v2 API using OAuth 1.0a when credentials exist', async () => {
      process.env.X_API_KEY = 'valid_api_key';
      process.env.X_API_SECRET = 'valid_api_secret';
      process.env.X_ACCESS_TOKEN = 'valid_access_token';
      process.env.X_ACCESS_TOKEN_SECRET = 'valid_token_secret';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'tweet_123456789', text: 'PromptFM on air' } }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await postTweetToX('Tune into PromptFM Main Stage live! https://promptfm.live');

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(false);
      expect(res.tweetId).toBe('tweet_123456789');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('OAuth oauth_consumer_key="valid_api_key"'),
          }),
          body: JSON.stringify({
            text: 'Tune into PromptFM Main Stage live! https://promptfm.live',
          }),
        })
      );
    });

    it('sends tweet using Bearer token when X_BEARER_TOKEN is configured', async () => {
      delete process.env.X_API_KEY;
      process.env.X_BEARER_TOKEN = 'bearer_token_xyz';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'tweet_987654321', text: 'Bearer tweet' } }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await postTweetToX('Announcement via bearer token');

      expect(res.success).toBe(true);
      expect(res.tweetId).toBe('tweet_987654321');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer bearer_token_xyz',
          }),
        })
      );
    });

    it('handles Twitter API error response gracefully', async () => {
      process.env.X_BEARER_TOKEN = 'bearer_token_xyz';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'You are not allowed to create a Tweet with duplicate content.' }),
      });

      const res = await postTweetToX('Duplicate tweet');
      expect(res.success).toBe(false);
      expect(res.error).toContain('duplicate content');
    });
  });
});
