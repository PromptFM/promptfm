// tests/unit/telemetry-client.test.ts
// Unit tests for client-side radio telemetry deduplication and event broadcasting (Issue #123)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchRadioTelemetry,
  broadcastRadioTelemetry,
  subscribeRadioTelemetry,
  getLatestRadioTelemetry,
  clearRadioTelemetryCache,
  RADIO_TELEMETRY_EVENT,
  type RadioTelemetryPayload,
} from '@/lib/radio/telemetry-client';

describe('Client Radio Telemetry Deduplication & Sharing (Issue #123)', () => {
  const mockTelemetry: RadioTelemetryPayload = {
    success: true,
    channel: 'main',
    now_playing: {
      id: 'song-123',
      type: 'music',
      title: 'Neon Dreams',
      artist: 'Suno Beats',
      cover_art_url: '/logo-mark.png',
      upvotes_count: 42,
    },
    up_next: [
      {
        id: 'song-456',
        type: 'music',
        title: 'Cyber Pulse',
        artist: 'PromptFM Artist',
      },
    ],
    listeners_count: 85,
    listeners: {
      channel: 85,
      network_total: 120,
      active_channels_count: 3,
    },
    elapsed_seconds: 45,
    duration_seconds: 210,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearRadioTelemetryCache();
  });

  afterEach(() => {
    clearRadioTelemetryCache();
  });

  describe('fetchRadioTelemetry', () => {
    it('fetches telemetry from /api/radio/now and returns JSON', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTelemetry,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await fetchRadioTelemetry('main');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('/api/radio/now?channel=main');
      expect(result.now_playing?.id).toBe('song-123');
      expect(result.listeners_count).toBe(85);
    });

    it('coalesces concurrent in-flight requests into a single network call', async () => {
      let resolvePromise: (value: any) => void;
      const deferred = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const fetchSpy = vi.fn().mockReturnValue(deferred);
      vi.stubGlobal('fetch', fetchSpy);

      // Trigger 3 concurrent calls
      const call1 = fetchRadioTelemetry('main');
      const call2 = fetchRadioTelemetry('main');
      const call3 = fetchRadioTelemetry('main');

      resolvePromise!({
        ok: true,
        json: async () => mockTelemetry,
      });

      const [res1, res2, res3] = await Promise.all([call1, call2, call3]);

      // Only 1 fetch call should be made
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
    });

    it('uses cached telemetry within TTL window instead of issuing another network request', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTelemetry,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const first = await fetchRadioTelemetry('main');
      const second = await fetchRadioTelemetry('main');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('throws error when HTTP status is not ok', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(fetchRadioTelemetry('main')).rejects.toThrow('Failed to fetch radio telemetry: HTTP 502');
    });

    it('refetches when cache has expired past TTL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTelemetry,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const originalDateNow = Date.now;
      let currentTime = 1_000_000;
      Date.now = () => currentTime;

      try {
        await fetchRadioTelemetry('main', { ttlMs: 5000 });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // Advance 4 seconds (still within 5s TTL)
        currentTime += 4000;
        await fetchRadioTelemetry('main', { ttlMs: 5000 });
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // Advance past 5s TTL (total 6 seconds elapsed)
        currentTime += 2000;
        await fetchRadioTelemetry('main', { ttlMs: 5000 });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTelemetry,
      });
      vi.stubGlobal('fetch', fetchSpy);

      await fetchRadioTelemetry('main');
      await fetchRadioTelemetry('main', { forceRefresh: true });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('broadcastRadioTelemetry and subscribeRadioTelemetry', () => {
    it('notifies subscribers via window custom event when telemetry is broadcast', () => {
      const subscriber = vi.fn();
      const unsubscribe = subscribeRadioTelemetry(subscriber);

      broadcastRadioTelemetry(mockTelemetry);

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith(mockTelemetry);

      unsubscribe();
      broadcastRadioTelemetry(mockTelemetry);
      // Should not be called again after unsubscribe
      expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it('has the correct RADIO_TELEMETRY_EVENT constant string', () => {
      expect(RADIO_TELEMETRY_EVENT).toBe('promptfm:radio-telemetry');
    });

    it('isolates subscriber errors so one faulty listener does not break others', () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener crash');
      });
      const goodListener = vi.fn();

      subscribeRadioTelemetry(badListener);
      subscribeRadioTelemetry(goodListener);

      expect(() => broadcastRadioTelemetry(mockTelemetry)).not.toThrow();
      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalledWith(mockTelemetry);
    });

    it('dispatches CustomEvent on global window when window is available', () => {
      const dispatchedEvents: any[] = [];
      const listeners: Record<string, Function[]> = {};

      const fakeWindow = {
        addEventListener: (event: string, fn: any) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
        removeEventListener: (event: string, fn: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((f) => f !== fn);
          }
        },
        dispatchEvent: (event: any) => {
          dispatchedEvents.push(event);
          (listeners[event.type] || []).forEach((fn) => fn(event));
          return true;
        },
      };

      vi.stubGlobal('window', fakeWindow);

      const winSubscriber = vi.fn();
      const unsubscribe = subscribeRadioTelemetry(winSubscriber);

      broadcastRadioTelemetry(mockTelemetry);
      expect(dispatchedEvents.length).toBe(1);
      expect(dispatchedEvents[0].type).toBe(RADIO_TELEMETRY_EVENT);
      expect(winSubscriber).toHaveBeenCalledTimes(1);
      expect(winSubscriber).toHaveBeenCalledWith(mockTelemetry);

      unsubscribe();
      broadcastRadioTelemetry(mockTelemetry);
      expect(dispatchedEvents.length).toBe(2);
      expect(winSubscriber).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });
});
