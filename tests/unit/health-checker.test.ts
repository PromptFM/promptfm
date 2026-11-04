import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkSystemHealth,
  probeStreamEndpoint,
  type SystemHealthReport,
  type ServiceCheckResult,
} from '@/lib/status/health-checker';

describe('System Health Checker & Status Monitoring', () => {
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

    it('throws error when server returns HTTP 400 or HTTP 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        body: { cancel: vi.fn() },
      } as unknown as Response);

      await expect(probeStreamEndpoint('https://stream.promptfm.live/stream.mp3')).rejects.toThrow('HTTP 400');
    });
  });
});

