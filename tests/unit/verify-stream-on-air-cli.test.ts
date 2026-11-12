import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const {
  runVerifyStreamOnAir,
  containsFallbackMarker,
  extractIcecastSource,
} = require('../../scripts/verify-stream-on-air.cjs');

describe('Verify Stream On-Air CLI (scripts/verify-stream-on-air.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects fallback markers across title, artist, and mount metadata', () => {
    expect(containsFallbackMarker('PromptFM Ambient AI Anthem')).toBe(true);
    expect(containsFallbackMarker('PromptFM Standby')).toBe(true);
    expect(containsFallbackMarker('demo-fallback')).toBe(true);
    expect(containsFallbackMarker('/etc/liquidsoap/fallback.mp3')).toBe(true);
    expect(containsFallbackMarker('A real on-air track')).toBe(false);
  });

  it('extracts the /stream.mp3 mount from status-json arrays before fallback mounts', () => {
    const source = extractIcecastSource({
      icestats: {
        source: [
          {
            mount: '/fallback.mp3',
            title: 'PromptFM Ambient AI Anthem',
          },
          {
            listenurl: 'http://localhost:8000/stream.mp3',
            title: 'Artist - Live Song',
          },
        ],
      },
    });

    expect(source).toMatchObject({
      listenurl: 'http://localhost:8000/stream.mp3',
      title: 'Artist - Live Song',
    });
  });

  it('returns 0 when next track and stream metadata both show a non-fallback track', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'annotate:title="Live Song",artist="Artist",promptfm_id="track-1":https://cdn.example.com/live.mp3',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          icestats: {
            source: {
              listenurl: 'http://localhost:8000/stream.mp3',
              title: 'Artist - Live Song',
              server_name: 'PromptFM — 24/7 AI Generated Music Radio',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          icestats: {
            source: {
              listenurl: 'http://localhost:8000/stream.mp3',
              title: 'Artist - Live Song',
            },
          },
        }),
      });

    const exitCode = await runVerifyStreamOnAir([], { fetchImpl, sleep: async () => {} });
    expect(exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns 1 when /api/radio/next returns the fallback anthem', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'annotate:title="PromptFM Ambient AI Anthem",artist="PromptFM Core",promptfm_id="demo-fallback":https://cdn.example.com/fallback.mp3',
    });

    const exitCode = await runVerifyStreamOnAir([], { fetchImpl, sleep: async () => {} });
    expect(exitCode).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns 1 when stream metadata stays on standby/fallback across repeated polls', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'annotate:title="Live Song",artist="Artist",promptfm_id="track-1":https://cdn.example.com/live.mp3',
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          icestats: {
            source: {
              listenurl: 'http://localhost:8000/stream.mp3',
              title: 'PromptFM Core - PromptFM Ambient AI Anthem',
              server_name: 'PromptFM Standby',
            },
          },
        }),
      });

    const exitCode = await runVerifyStreamOnAir([], { fetchImpl, sleep: async () => {} });
    expect(exitCode).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('uses curl --resolve for status-json when a pinned host mapping is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'annotate:title="Live Song",artist="Artist",promptfm_id="track-1":https://cdn.example.com/live.mp3',
    });
    const execFileImpl = vi.fn().mockResolvedValue({
      stdout: '{"icestats":{"source":{"listenurl":"http://localhost:8000/stream.mp3","title":"Artist - Live Song"}}}',
      stderr: '',
    });

    const exitCode = await runVerifyStreamOnAir([], {
      fetchImpl,
      sleep: async () => {},
      execFileImpl,
      env: {
        ...process.env,
        PROMPTFM_STREAM_STATUS_CURL_RESOLVE: 'stream.promptfm.live:443:129.80.56.27',
      },
    });

    expect(exitCode).toBe(0);
    expect(execFileImpl).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining(['--resolve', 'stream.promptfm.live:443:129.80.56.27'])
    );
  });
});
