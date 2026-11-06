// tests/unit/stream-cli.test.ts
// Unit tests for the CLI stream subcommands (status, start, stop).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as rtmpController from '@/lib/streaming/rtmp-controller';

describe('PromptFM Admin Stream CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates required arguments when starting a stream', () => {
    const invalidConfig = rtmpController.validateStreamConfig({
      platform: 'youtube',
      streamKey: '',
    });
    expect(invalidConfig.valid).toBe(false);
    expect(invalidConfig.error).toMatch(/stream key is required/i);
  });

  it('handles stream status query formatting', async () => {
    vi.spyOn(rtmpController, 'getStreamStatus').mockResolvedValueOnce({
      sessions: {
        youtube: { platform: 'youtube', status: 'live', startedAt: '2026-11-06T12:00:00Z', pid: 1234 },
        tiktok: { platform: 'tiktok', status: 'stopped' },
      },
      controllerVersion: '1.0.0',
      icecastUrl: 'http://icecast:8000/stream.mp3',
    });

    const status = await rtmpController.getStreamStatus();
    expect(status.sessions.youtube.status).toBe('live');
    expect(status.sessions.youtube.pid).toBe(1234);
    expect(status.sessions.tiktok.status).toBe('stopped');
  });

  it('calls startStream with valid platform and key', async () => {
    const spy = vi.spyOn(rtmpController, 'startStream').mockResolvedValueOnce({
      success: true,
      message: 'YouTube stream started',
      session: { platform: 'youtube', status: 'live', pid: 5678 },
    });

    const res = await rtmpController.startStream({
      platform: 'youtube',
      streamKey: 'live_yt_key_123',
    });

    expect(spy).toHaveBeenCalledWith({ platform: 'youtube', streamKey: 'live_yt_key_123' });
    expect(res.success).toBe(true);
    expect(res.session?.pid).toBe(5678);
  });

  it('calls stopStream with targeted platform', async () => {
    const spy = vi.spyOn(rtmpController, 'stopStream').mockResolvedValueOnce({
      success: true,
      message: 'TikTok stream stopped',
    });

    const res = await rtmpController.stopStream('tiktok');
    expect(spy).toHaveBeenCalledWith('tiktok');
    expect(res.success).toBe(true);
  });
});
