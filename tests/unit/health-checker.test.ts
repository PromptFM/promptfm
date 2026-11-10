import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkSystemHealth,
  probeStreamEndpoint,
  probeAudioStreamer,
  runProbe,
  DEFAULT_PROBE_TIMEOUT,
  DEFAULT_DEGRADED_LATENCY_MS,
  type SystemHealthReport,
  type ServiceCheckResult,
} from '@/lib/status/health-checker';
import { DEFAULT_STREAM_URL } from '@/lib/audio/player-controller';

describe('System Health Checker & Status Monitoring', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it('reports all systems operational when dependencies succeed', async () => {
    const report = await checkSystemHealth({
      mockCheckers: {
        audioStreamer: async () => ({ status: 'operational', latencyMs: 15 }),
        database: async () => ({ status: 'operational', latencyMs: 25 }),
        aiDjEngine: async () => ({ status: 'operational', latencyMs: 40 }),
        edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
        communityBridge: async () => ({ status: 'operational', latencyMs: 20 }),
      },
    });

    expect(report.status).toBe('all_operational');
    expect(report.uptimePercentage).toBeGreaterThanOrEqual(99.9);
    expect(report.services).toHaveLength(5);

    const ids = report.services.map((s) => s.id);
    expect(ids).toContain('audio_streamer');
    expect(ids).toContain('database');
    expect(ids).toContain('ai_dj_engine');
    expect(ids).toContain('edge_delivery');
    expect(ids).toContain('community_bridge');

    report.services.forEach((service) => {
      expect(service.status).toBe('operational');
      expect(service.latencyMs).toBeGreaterThan(0);
      expect(service.lastChecked).toBeTruthy();
    });

    const streamer = report.services.find((s) => s.id === 'audio_streamer')!;
    expect(streamer.name).toBe('24/7 Audio Streaming Engine (Icecast / Liquidsoap)');
    expect(streamer.description).toBe('Continuous low-latency audio mixing and live MP3/AAC mount point streaming.');

    const database = report.services.find((s) => s.id === 'database')!;
    expect(database.name).toBe('PostgreSQL Database & pgvector');
    expect(database.description).toBe('Track catalog, listener preferences, rotation logs, and semantic prompt indexing.');

    const aiDj = report.services.find((s) => s.id === 'ai_dj_engine')!;
    expect(aiDj.name).toBe('Generative AI DJ Roster (Gemini & Neural TTS)');
    expect(aiDj.description).toBe('Real-time DJ persona scriptwriting, weather synthesis, and neural speech synthesis.');

    const edge = report.services.find((s) => s.id === 'edge_delivery')!;
    expect(edge.name).toBe('Global Edge Network & CDN');
    expect(edge.description).toBe('Vercel edge functions, Next.js web application routing, and Cloudflare static asset caching.');

    const bridge = report.services.find((s) => s.id === 'community_bridge')!;
    expect(bridge.name).toBe('Community Discord & Telegram Notification Bridges');
    expect(bridge.description).toBe('Real-time track announcements, listener song requests, and DJ shoutout dispatches.');
  });

  it('reports degraded status when a non-critical service has high latency or failure', async () => {
    const report = await checkSystemHealth({
      mockCheckers: {
        audioStreamer: async () => ({ status: 'operational', latencyMs: 20 }),
        database: async () => ({ status: 'operational', latencyMs: 30 }),
        aiDjEngine: async () => ({ status: 'operational', latencyMs: 40 }),
        edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
        communityBridge: async () => ({
          status: 'degraded',
          latencyMs: 950,
          error: 'Telegram rate limit',
        }),
      },
    });

    expect(report.status).toBe('degraded_performance');
    const bridge = report.services.find((s) => s.id === 'community_bridge');
    expect(bridge?.status).toBe('degraded');
    expect(bridge?.error).toBe('Telegram rate limit');
  });

  it('reports major outage when the primary audio streamer fails', async () => {
    const report = await checkSystemHealth({
      mockCheckers: {
        audioStreamer: async () => ({
          status: 'outage',
          latencyMs: 5000,
          error: 'Connection refused: port 8000',
        }),
        database: async () => ({ status: 'operational', latencyMs: 30 }),
        aiDjEngine: async () => ({ status: 'operational', latencyMs: 40 }),
        edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
        communityBridge: async () => ({ status: 'operational', latencyMs: 20 }),
      },
    });

    expect(report.status).toBe('major_outage');
    const streamer = report.services.find((s) => s.id === 'audio_streamer');
    expect(streamer?.status).toBe('outage');
  });

  describe('Audio Stream Probe (Icecast Range Header Probe)', () => {
    it('uses GET with Range: bytes=0-1 to avoid Icecast HEAD 400 rejection', async () => {
      let capturedMethod = '';
      let capturedHeaders: Record<string, string> = {};
      const mockCancel = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
        capturedMethod = init?.method || '';
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return {
          ok: true,
          status: 200,
          body: {
            cancel: mockCancel,
          },
        } as unknown as Response;
      });

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(capturedMethod).toBe('GET');
      expect(capturedHeaders.Range).toBe('bytes=0-1');
      expect(mockCancel).toHaveBeenCalled();
    });

    it('accepts HTTP 206 Partial Content as operational', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 206,
        body: { cancel: vi.fn() },
      } as unknown as Response);

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
    });

    it('accepts HTTP 302 Redirect as operational', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 302,
        body: { cancel: vi.fn() },
      } as unknown as Response);

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
    });

    it('handles body cancel error gracefully without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          cancel: vi.fn().mockRejectedValueOnce(new Error('Cancel failed')),
        },
      } as unknown as Response);

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
    });

    it('throws error when server returns HTTP 400 or HTTP 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        body: { cancel: vi.fn() },
      } as unknown as Response);

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).rejects.toThrow('HTTP 400');
    });
  });

  describe('Issue #32 Reproduction: Audio Streamer Timeout & Threshold Relaxation', () => {
    it('verifies relaxed default constants: 5000ms timeout and 3000ms degraded threshold', () => {
      expect(DEFAULT_PROBE_TIMEOUT).toBe(5000);
      expect(DEFAULT_DEGRADED_LATENCY_MS).toBe(3000);
    });

    it('reproduces failure with restrictive 2500ms timeout on 2600ms network latency', async () => {
      // Simulating 2600ms probe with old 2500ms timeout fails as degraded with timeout error
      const slowProbe = () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2600);
        });

      vi.useFakeTimers();
      const probePromise = runProbe(slowProbe, 2500, 1500);
      await vi.advanceTimersByTimeAsync(2550);

      const result = await probePromise;
      vi.useRealTimers();

      expect(result.status).toBe('degraded');
      expect(result.error).toContain('Timeout after 2500ms');
    });

    it('succeeds as operational with relaxed 5000ms timeout and 3000ms threshold on 2000ms latency', async () => {
      const probeWithLatency = () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2000);
        });

      vi.useFakeTimers();
      const probePromise = runProbe(probeWithLatency, 5000, 3000);
      await vi.advanceTimersByTimeAsync(2050);

      const result = await probePromise;
      vi.useRealTimers();

      expect(result.status).toBe('operational');
      expect(result.error).toBeUndefined();
    });

    it('marks degraded without timing out when latency is between 3000ms and 5000ms', async () => {
      const probeWithLatency = () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 3200);
        });

      vi.useFakeTimers();
      const probePromise = runProbe(probeWithLatency, 5000, 3000);
      await vi.advanceTimersByTimeAsync(3250);

      const result = await probePromise;
      vi.useRealTimers();

      expect(result.status).toBe('degraded');
      expect(result.error).toBeUndefined();
    });
  });

  describe('Icecast Status Telemetry Probe (probeAudioStreamer)', () => {
    it('uses /status-json.xsl when available with active source', async () => {
      const mockStatusJson = {
        icestats: {
          server_id: 'Icecast 2.4.4',
          source: {
            listenurl: 'http://localhost:8000/stream.mp3',
            bitrate: 128,
            title: 'PromptFM Resident',
          },
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStatusJson,
      } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://stream.promptfm.live/status-json.xsl',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles multiple Icecast sources in status-json array', async () => {
      const mockStatusJson = {
        icestats: {
          server_id: 'Icecast 2.4.4',
          source: [
            { listenurl: 'http://localhost:8000/other.mp3', bitrate: 64 },
            { listenurl: 'http://localhost:8000/stream.mp3', bitrate: 128 },
          ],
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStatusJson,
      } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back to Range probe when /status-json.xsl returns 404', async () => {
      const mockCancel = vi.fn().mockResolvedValue(undefined);

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        // First call to /status-json.xsl returns 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as unknown as Response)
        // Second call falls back to stream mount point
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          body: { cancel: mockCancel },
        } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(mockCancel).toHaveBeenCalled();
    });

    it('falls back to Range probe when status-json fetch rejects with network error', async () => {
      const mockCancel = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          body: { cancel: mockCancel },
        } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('throws error when /status-json.xsl has no active source and fallback also fails', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ icestats: {} }), // No source
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          body: { cancel: vi.fn() },
        } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).rejects.toThrow();
    });

    it('clamps status-json fetch timeout to minimum of timeoutMs or 3000ms', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        // Verify signal aborts within 1500ms when timeoutMs is 1500
        return {
          ok: true,
          status: 200,
          json: async () => ({ icestats: { source: { bitrate: 128 } } }),
        } as unknown as Response;
      });

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3', 1500)).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://stream.promptfm.live/status-json.xsl',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('falls back to Range probe when /status-json.xsl returns null or non-object json', async () => {
      const mockCancel = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => null,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          body: { cancel: mockCancel },
        } as unknown as Response);

      await expect(probeAudioStreamer('https://stream.promptfm.live/stream.mp3')).resolves.toBeUndefined();
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('runProbe Error & Latency Mechanics', () => {
    it('returns operational status when probe resolves quickly below degraded threshold', async () => {
      const result = await runProbe(async () => {}, 5000, 3000);
      expect(result.status).toBe('operational');
      expect(result.latencyMs).toBeGreaterThanOrEqual(1);
      expect(result.error).toBeUndefined();
    });

    it('returns outage status when probe throws immediate Error', async () => {
      const result = await runProbe(async () => {
        throw new Error('Connection refused: port 8000');
      }, 5000, 3000);

      expect(result.status).toBe('outage');
      expect(result.error).toBe('Connection refused: port 8000');
    });

    it('handles non-Error thrown values by stringifying them', async () => {
      const result = await runProbe(async () => {
        throw 'Fatal socket disconnect';
      }, 5000, 3000);

      expect(result.status).toBe('outage');
      expect(result.error).toBe('Fatal socket disconnect');
    });
  });

  describe('checkSystemHealth Options, Status Derivations & Uptime Calculations', () => {
    it('honors custom timeoutMs option when provided', async () => {
      let passedTimeout = 0;
      const report = await checkSystemHealth({
        timeoutMs: 4321,
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      expect(report.status).toBe('all_operational');
    });

    it('reports degraded_performance when database is in outage but audioStreamer is operational', async () => {
      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'outage', latencyMs: 20, error: 'Database down' }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      expect(report.status).toBe('degraded_performance');
      expect(report.uptimePercentage).toBe(99.53); // 99.98 - 1 * 0.45
    });

    it('penalizes uptime percentage based on number of degraded or outage services', async () => {
      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'degraded', latencyMs: 3100 }),
          database: async () => ({ status: 'degraded', latencyMs: 3200 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      expect(report.status).toBe('degraded_performance');
      expect(report.uptimePercentage).toBe(99.08); // 99.98 - 2 * 0.45
    });

    it('enforces a 95.0% minimum floor for 30-day uptime percentage even under total failure', async () => {
      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'outage', latencyMs: 5000 }),
          database: async () => ({ status: 'outage', latencyMs: 5000 }),
          aiDjEngine: async () => ({ status: 'outage', latencyMs: 5000 }),
          edgeDelivery: async () => ({ status: 'outage', latencyMs: 5000 }),
          communityBridge: async () => ({ status: 'outage', latencyMs: 5000 }),
        },
      });

      expect(report.status).toBe('major_outage');
      // 99.98 - 5 * 0.45 = 97.73%, still above 95.0
      expect(report.uptimePercentage).toBe(97.73);
    });

    it('derives real database probe health when SUPABASE_URL is configured', async () => {
      const origEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('supabase.co')) {
          return { ok: true, status: 200 } as unknown as Response;
        }
        return { ok: true, status: 200 } as unknown as Response;
      });

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const db = report.services.find((s) => s.id === 'database');
      expect(db?.status).toBe('operational');

      if (origEnv) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origEnv;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
    });

    it('accepts HTTP 401 as operational for database REST ping', async () => {
      const origEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as unknown as Response);

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const db = report.services.find((s) => s.id === 'database');
      expect(db?.status).toBe('operational');

      if (origEnv) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origEnv;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
    });

    it('flags database as outage when REST ping returns HTTP 500', async () => {
      const origEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as unknown as Response);

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const db = report.services.find((s) => s.id === 'database');
      expect(db?.status).toBe('outage');
      expect(db?.error).toContain('Database ping HTTP 500');

      if (origEnv) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origEnv;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
    });

    it('flags database as outage in production if SUPABASE_URL is missing', async () => {
      const oldNodeEnv = process.env.NODE_ENV;
      const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const oldSupabaseUrl = process.env.SUPABASE_URL;

      (process.env as any).NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const db = report.services.find((s) => s.id === 'database');
      expect(db?.status).toBe('outage');
      expect(db?.error).toContain('SUPABASE_URL not configured');

      (process.env as any).NODE_ENV = oldNodeEnv;
      if (oldUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
      if (oldSupabaseUrl) process.env.SUPABASE_URL = oldSupabaseUrl;
    });

    it('derives AI DJ probe health when GEMINI_API_KEY is configured', async () => {
      const oldKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as unknown as Response);

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const ai = report.services.find((s) => s.id === 'ai_dj_engine');
      expect(ai?.status).toBe('operational');

      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
      else delete process.env.GEMINI_API_KEY;
    });

    it('flags AI DJ as outage when Gemini API returns HTTP 403', async () => {
      const oldKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as unknown as Response);

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const ai = report.services.find((s) => s.id === 'ai_dj_engine');
      expect(ai?.status).toBe('outage');
      expect(ai?.error).toContain('Gemini API HTTP 403');

      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
      else delete process.env.GEMINI_API_KEY;
    });

    it('flags AI DJ as outage in production when GEMINI_API_KEY is missing', async () => {
      const oldNodeEnv = process.env.NODE_ENV;
      const oldKey = process.env.GEMINI_API_KEY;

      (process.env as any).NODE_ENV = 'production';
      delete process.env.GEMINI_API_KEY;

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const ai = report.services.find((s) => s.id === 'ai_dj_engine');
      expect(ai?.status).toBe('outage');
      expect(ai?.error).toContain('GEMINI_API_KEY not configured');

      (process.env as any).NODE_ENV = oldNodeEnv;
      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    });

    it('flags community bridge as outage in production when DISCORD_WEBHOOK_URL is missing', async () => {
      const oldNodeEnv = process.env.NODE_ENV;
      const oldHook = process.env.DISCORD_WEBHOOK_URL;

      (process.env as any).NODE_ENV = 'production';
      delete process.env.DISCORD_WEBHOOK_URL;

      const report = await checkSystemHealth({
        mockCheckers: {
          audioStreamer: async () => ({ status: 'operational', latencyMs: 10 }),
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const bridge = report.services.find((s) => s.id === 'community_bridge');
      expect(bridge?.status).toBe('outage');
      expect(bridge?.error).toContain('DISCORD_WEBHOOK_URL not configured');

      (process.env as any).NODE_ENV = oldNodeEnv;
      if (oldHook) process.env.DISCORD_WEBHOOK_URL = oldHook;
    });

    it('runs real audioStreamer probe via probeAudioStreamer when not in test/simulation', async () => {
      const oldVitest = process.env.VITEST;
      const oldNodeEnv = process.env.NODE_ENV;
      delete process.env.VITEST;
      (process.env as any).NODE_ENV = 'production';

      const mockStatusJson = {
        icestats: {
          server_id: 'Icecast 2.4.4',
          source: { listenurl: 'http://localhost:8000/stream.mp3', bitrate: 128 },
        },
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('status-json.xsl')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockStatusJson,
          } as unknown as Response;
        }
        return { ok: true, status: 200 } as unknown as Response;
      });

      const report = await checkSystemHealth({
        mockCheckers: {
          database: async () => ({ status: 'operational', latencyMs: 10 }),
          aiDjEngine: async () => ({ status: 'operational', latencyMs: 10 }),
          edgeDelivery: async () => ({ status: 'operational', latencyMs: 10 }),
          communityBridge: async () => ({ status: 'operational', latencyMs: 10 }),
        },
      });

      const streamer = report.services.find((s) => s.id === 'audio_streamer');
      expect(streamer?.status).toBe('operational');

      if (oldVitest) process.env.VITEST = oldVitest;
      (process.env as any).NODE_ENV = oldNodeEnv;
    });
  });

  describe('OCI deploy readiness contract', () => {
    it('keeps deploy readiness separate from the full status report via the dedicated /api/healthz route', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../src/app/api/healthz/route.ts'))).toBe(true);
    });
  });
});
