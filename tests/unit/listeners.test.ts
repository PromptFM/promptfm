// tests/unit/listeners.test.ts
// Unit tests for Live Listener Telemetry & Presence Tracking

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerListenerPing,
  getLiveListenerStats,
  getActiveWebSessionCount,
  clearListenerSessionsForTesting,
  calculateBaselineListeners,
} from '@/lib/radio/listeners';

describe('Live Listener Telemetry & Telemetry Counter', () => {
  beforeEach(() => {
    clearListenerSessionsForTesting();
    vi.useRealTimers();
  });

  describe('calculateBaselineListeners', () => {
    it('calculates deterministic baseline listener counts based on hour and channel', () => {
      // Hour 16 (peak hour in UTC)
      const mainPeak = calculateBaselineListeners('main', 16);
      const cyberpunkPeak = calculateBaselineListeners('cyberpunk', 16);
      const chilloutPeak = calculateBaselineListeners('chillout', 16);
      const kidsPeak = calculateBaselineListeners('kids', 16);

      expect(mainPeak).toBeGreaterThan(cyberpunkPeak);
      expect(chilloutPeak).toBeGreaterThan(cyberpunkPeak);
      expect(cyberpunkPeak).toBeGreaterThan(kidsPeak);

      // Night hour (4 AM)
      const mainNight = calculateBaselineListeners('main', 4);
      expect(mainNight).toBeLessThan(mainPeak);
      expect(mainNight).toBeGreaterThanOrEqual(5);

      // Verify specific stations scale differences
      expect(cyberpunkPeak).toBeGreaterThanOrEqual(30);
      expect(chilloutPeak).toBeGreaterThanOrEqual(35);
      expect(kidsPeak).toBeGreaterThanOrEqual(15);
    });

    it('enforces minimum bound of 5 listeners', () => {
      const result = calculateBaselineListeners('kids', 4);
      expect(result).toBeGreaterThanOrEqual(5);
    });

    it('handles uppercase and untrimmed channel slugs', () => {
      const clean = calculateBaselineListeners('cyberpunk', 12);
      const dirty = calculateBaselineListeners('  CYBERPUNK  ', 12);
      expect(dirty).toBe(clean);
    });

    it('defaults invalid slug to main channel', () => {
      const standard = calculateBaselineListeners('main', 15);
      const invalid = calculateBaselineListeners('unknown-xyz', 15);
      expect(invalid).toBe(standard);
    });
  });

  describe('getActiveWebSessionCount & registerListenerPing', () => {
    it('registers listener pings and counts active web sessions', () => {
      expect(getActiveWebSessionCount('main')).toBe(0);

      registerListenerPing('main', 'session-1');
      registerListenerPing('main', 'session-2');
      registerListenerPing('cyberpunk', 'session-3');

      expect(getActiveWebSessionCount('main')).toBe(2);
      expect(getActiveWebSessionCount('cyberpunk')).toBe(1);
      expect(getActiveWebSessionCount('chillout')).toBe(0);
    });

    it('refreshes session timestamp without duplicate counting', () => {
      registerListenerPing('main', 'session-1');
      registerListenerPing('main', 'session-1');
      registerListenerPing('main', 'session-1');

      expect(getActiveWebSessionCount('main')).toBe(1);
    });

    it('handles uppercase and untrimmed channel slugs in pings', () => {
      registerListenerPing('  MAIN  ', 'session-clean');
      expect(getActiveWebSessionCount('main')).toBe(1);
      expect(getActiveWebSessionCount('  MAIN  ')).toBe(1);
    });

    it('expires inactive listener sessions precisely after 45000ms TTL', () => {
      vi.useFakeTimers();
      const start = 100000;
      vi.setSystemTime(start);

      registerListenerPing('main', 'session-active', start);
      expect(getActiveWebSessionCount('main', start)).toBe(1);

      // At exactly 45000ms, session is still active (> check)
      expect(getActiveWebSessionCount('main', start + 45000)).toBe(1);

      // At 45001ms, session has expired
      expect(getActiveWebSessionCount('main', start + 45001)).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('getLiveListenerStats', () => {
    it('accurately computes target channel listeners and network total', () => {
      const fixedTime = 1700000000000;
      const initialStats = getLiveListenerStats('cyberpunk', fixedTime);

      expect(initialStats.channelSlug).toBe('cyberpunk');
      expect(initialStats.activeChannelsCount).toBe(4);
      expect(initialStats.timestamp).toBe(fixedTime);

      // Add 3 listeners to cyberpunk and 2 to chillout
      registerListenerPing('cyberpunk', 'c1', fixedTime);
      registerListenerPing('cyberpunk', 'c2', fixedTime);
      registerListenerPing('cyberpunk', 'c3', fixedTime);
      registerListenerPing('chillout', 'ch1', fixedTime);
      registerListenerPing('chillout', 'ch2', fixedTime);

      const afterStatsCyberpunk = getLiveListenerStats('cyberpunk', fixedTime);
      expect(afterStatsCyberpunk.channelListeners).toBe(initialStats.channelListeners + 3);

      const afterStatsChillout = getLiveListenerStats('chillout', fixedTime);
      expect(afterStatsChillout.channelListeners).toBeGreaterThan(initialStats.channelListeners);

      // Total network should include all active pings (3 + 2 = 5)
      expect(afterStatsCyberpunk.totalNetworkListeners).toBe(initialStats.totalNetworkListeners + 5);
    });

    it('handles uppercase and invalid channel slug by defaulting to main', () => {
      const stats = getLiveListenerStats('UNKNOWN-GENRE');
      expect(stats.channelSlug).toBe('main');

      const upperStats = getLiveListenerStats('  CYBERPUNK  ');
      expect(upperStats.channelSlug).toBe('cyberpunk');
    });
  });
});
