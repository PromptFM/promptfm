import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isR2Configured, uploadBufferToR2 } from '../../src/lib/r2';

describe('Cloudflare R2 Client & Media Storage (src/lib/r2.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('isR2Configured', () => {
    it('returns true when valid credentials and bucket name are set', () => {
      const env = {
        R2_ACCOUNT_ID: 'real-account-id',
        R2_ACCESS_KEY_ID: 'real-access-key',
        R2_SECRET_ACCESS_KEY: 'real-secret-key',
        R2_BUCKET_NAME: 'promptfm-audio',
        NEXT_PUBLIC_R2_PUBLIC_URL: 'https://pub-r2.dev',
      };
      expect(isR2Configured(env)).toBe(true);
    });

    it('returns false when account ID is placeholder or missing', () => {
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'your-cloudflare-account-id',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);

      expect(
        isR2Configured({
          R2_ACCOUNT_ID: '',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);
    });

    it('returns false when any required credential is empty or undefined', () => {
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: '',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);

      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: '',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);

      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: '',
        })
      ).toBe(false);
    });

    it('returns false when credentials contain only whitespace', () => {
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: '   ',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: '   ',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: '   ',
          R2_BUCKET_NAME: 'bucket',
        })
      ).toBe(false);
      expect(
        isR2Configured({
          R2_ACCOUNT_ID: 'acc',
          R2_ACCESS_KEY_ID: 'key',
          R2_SECRET_ACCESS_KEY: 'sec',
          R2_BUCKET_NAME: '   ',
        })
      ).toBe(false);
    });
  });

  describe('uploadBufferToR2', () => {
    it('sends PutObjectCommand to R2 and returns formatted public url', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend };

      const key = 'tracks/admin/test-song.mp3';
      const buffer = Buffer.from('fake-mp3-data');

      const url = await uploadBufferToR2(key, buffer, 'audio/mpeg', {
        client: mockClient as any,
        bucket: 'promptfm-audio',
        publicUrlBase: 'https://pub-r2.dev',
      });

      expect(url).toBe('https://pub-r2.dev/tracks/admin/test-song.mp3');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'promptfm-audio',
            Key: key,
            Body: buffer,
            ContentType: 'audio/mpeg',
          }),
        })
      );
    });

    it('uses process.env default public URL when publicUrlBase option is omitted', async () => {
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://default-r2.dev/';
      process.env.R2_BUCKET_NAME = 'default-bucket';

      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend };

      const key = 'tracks/covers/test-cover.jpg';
      const buffer = Buffer.from('fake-jpg-data');

      const url = await uploadBufferToR2(key, buffer, 'image/jpeg', {
        client: mockClient as any,
        bucket: 'default-bucket',
      });

      expect(url).toBe('https://default-r2.dev/tracks/covers/test-cover.jpg');
    });

    it('strips trailing slashes from publicUrlBase', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend };

      const url = await uploadBufferToR2('sample.mp3', Buffer.from('abc'), 'audio/mpeg', {
        client: mockClient as any,
        bucket: 'bucket',
        publicUrlBase: 'https://cdn.example.com///',
      });

      expect(url).toBe('https://cdn.example.com/sample.mp3');
    });
  });
});
