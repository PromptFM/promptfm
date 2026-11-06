// tests/unit/rtmp-controller.test.ts
// Unit tests for RTMP stream controller client library.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateStreamConfig,
  getStreamStatus,
  startStream,
  stopStream,
  getControllerBaseUrl,
  getControllerSecret,
  YOUTUBE_RTMP_URL,
  TIKTOK_RTMP_URL_DEFAULT,
  type StreamConfig,
} from '@/lib/streaming/rtmp-controller';

describe('RTMP Stream Controller Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── validateStreamConfig ─────────────────────────────────────────────────

  describe('validateStreamConfig', () => {
    it('accepts a valid YouTube stream config with key', () => {
      const result = validateStreamConfig({ platform: 'youtube', streamKey: 'xxxx-yyyy-zzzz-aaaa' });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts a valid TikTok stream config with key and rtmpUrl', () => {
      const result = validateStreamConfig({
        platform: 'tiktok',
        streamKey: 'tiktok-key-abc',
        rtmpUrl: 'rtmp://push-rtmp-f.tiktok.com/app',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects an empty stream key', () => {
      const result = validateStreamConfig({ platform: 'youtube', streamKey: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it('rejects a stream key shorter than 4 chars', () => {
      const result = validateStreamConfig({ platform: 'youtube', streamKey: 'ab' });
      expect(result.valid).toBe(false);
    });

    it('rejects TikTok RTMP URL not starting with rtmp://', () => {
      const result = validateStreamConfig({
        platform: 'tiktok',
        streamKey: 'valid-key-here',
        rtmpUrl: 'http://push-rtmp-f.tiktok.com/app',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/rtmp:\/\//i);
    });

    it('accepts TikTok config with default rtmpUrl when none provided', () => {
      const result = validateStreamConfig({ platform: 'tiktok', streamKey: 'valid-key-here' });
      expect(result.valid).toBe(true);
    });
  });

  // ── getControllerBaseUrl / getControllerSecret ───────────────────────────

  describe('controller config helpers', () => {
    it('returns STREAM_CONTROLLER_URL env var or localhost default', () => {
      const url = getControllerBaseUrl();
      expect(url).toMatch(/^http/);
    });

    it('returns STREAM_CONTROLLER_SECRET env var or empty string', () => {
      const secret = getControllerSecret();
      expect(typeof secret).toBe('string');
    });
  });

  // ── getStreamStatus ──────────────────────────────────────────────────────

  describe('getStreamStatus', () => {
    it('returns stream sessions from controller when healthy', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sessions: {
            youtube: { platform: 'youtube', status: 'live', startedAt: '2026-11-04T16:00:00Z' },
            tiktok: { platform: 'tiktok', status: 'stopped' },
          },
          controllerVersion: '1.0.0',
          icecastUrl: 'http://icecast:8000/stream.mp3',
        }),
      } as unknown as Response);

      const status = await getStreamStatus();
      expect(status.sessions.youtube.status).toBe('live');
      expect(status.sessions.tiktok.status).toBe('stopped');
      expect(status.controllerVersion).toBe('1.0.0');
    });

    it('throws an error when controller returns non-200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      } as unknown as Response);

      await expect(getStreamStatus()).rejects.toThrow('HTTP 503');
    });
  });

  // ── startStream ──────────────────────────────────────────────────────────

  describe('startStream', () => {
    it('calls /stream/start with correct body and returns success response', async () => {
      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'YouTube stream started',
            session: { platform: 'youtube', status: 'connecting', startedAt: '2026-11-04T16:05:00Z' },
          }),
        } as unknown as Response;
      });

      const result = await startStream({ platform: 'youtube', streamKey: 'my-yt-key' });
      expect(result.success).toBe(true);
      expect(result.session?.platform).toBe('youtube');

      const body = JSON.parse(capturedBody);
      expect(body.platform).toBe('youtube');
      expect(body.streamKey).toBe('my-yt-key');
      expect(body.rtmpUrl).toBe(YOUTUBE_RTMP_URL);
    });

    it('uses provided rtmpUrl for TikTok instead of default', async () => {
      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, session: { platform: 'tiktok', status: 'connecting' } }),
        } as unknown as Response;
      });

      await startStream({
        platform: 'tiktok',
        streamKey: 'tiktok-key-123',
        rtmpUrl: 'rtmp://push-rtmp-g.tiktok.com/app',
      });

      const body = JSON.parse(capturedBody);
      expect(body.rtmpUrl).toBe('rtmp://push-rtmp-g.tiktok.com/app');
    });

    it('returns error response when controller returns non-200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Platform already streaming' }),
      } as unknown as Response);

      const result = await startStream({ platform: 'youtube', streamKey: 'yt-key' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already streaming/i);
    });
  });

  // ── stopStream ───────────────────────────────────────────────────────────

  describe('stopStream', () => {
    it('calls /stream/stop and returns success', async () => {
      let capturedBody = '';
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'YouTube stream stopped',
            session: { platform: 'youtube', status: 'stopped', stoppedAt: '2026-11-04T17:00:00Z' },
          }),
        } as unknown as Response;
      });

      const result = await stopStream('youtube');
      expect(result.success).toBe(true);
      expect(JSON.parse(capturedBody).platform).toBe('youtube');
    });

    it('returns error when no active stream to stop', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No active stream found for tiktok' }),
      } as unknown as Response);

      const result = await stopStream('tiktok');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/tiktok/i);
    });
  });
});

