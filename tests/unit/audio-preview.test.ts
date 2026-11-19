import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_PREVIEW_DURATION_SECONDS,
  DEFAULT_PREVIEW_OFFSET_RATIO,
  calculatePreviewStartTime,
  applyAudioMidsectionSeek,
  createPreviewPlayerSession,
} from '@/lib/audio/preview';

describe('Audio Preview Service (Issue #262)', () => {
  describe('Constants', () => {
    it('defines preview duration as 20 seconds', () => {
      expect(DEFAULT_PREVIEW_DURATION_SECONDS).toBe(20);
    });

    it('defines preview offset ratio in the 30-40% range (0.35)', () => {
      expect(DEFAULT_PREVIEW_OFFSET_RATIO).toBeGreaterThanOrEqual(0.3);
      expect(DEFAULT_PREVIEW_OFFSET_RATIO).toBeLessThanOrEqual(0.4);
      expect(DEFAULT_PREVIEW_OFFSET_RATIO).toBe(0.35);
    });
  });

  describe('calculatePreviewStartTime', () => {
    it('calculates midsection seek offset at 35% of duration for a standard song', () => {
      // 180s track * 0.35 = 63s
      const offset = calculatePreviewStartTime(180, 20, 0.35);
      expect(offset).toBe(63);
    });

    it('calculates midsection seek offset at 30% when specified', () => {
      // 200s track * 0.30 = 60s
      const offset = calculatePreviewStartTime(200, 20, 0.3);
      expect(offset).toBe(60);
    });

    it('calculates midsection seek offset at 40% when specified', () => {
      // 200s track * 0.40 = 80s
      const offset = calculatePreviewStartTime(200, 20, 0.4);
      expect(offset).toBe(80);
    });

    it('uses default 20s preview and default 0.35 ratio when optional arguments are omitted', () => {
      // 100s track * 0.35 = 35s
      const offset = calculatePreviewStartTime(100);
      expect(offset).toBe(35);
    });

    it('clamps seek offset so a 20s preview does not exceed track duration', () => {
      // 25s track: 25 * 0.35 = 8.75s, but max start is 25 - 20 = 5s
      const offset = calculatePreviewStartTime(25, 20, 0.35);
      expect(offset).toBe(5);
    });

    it('returns 0 when track duration is less than or equal to preview duration', () => {
      expect(calculatePreviewStartTime(20, 20)).toBe(0);
      expect(calculatePreviewStartTime(20.00, 20)).toBe(0);
      expect(calculatePreviewStartTime(20.01, 20)).toBeGreaterThan(0);
      expect(calculatePreviewStartTime(19.99, 20)).toBe(0);
      expect(calculatePreviewStartTime(15, 20)).toBe(0);
      expect(calculatePreviewStartTime(5, 20)).toBe(0);
    });

    it('returns 0 when duration is 0, negative, NaN, or non-finite', () => {
      expect(calculatePreviewStartTime(0)).toBe(0);
      expect(calculatePreviewStartTime(-10)).toBe(0);
      expect(calculatePreviewStartTime(-0.01)).toBe(0);
      expect(calculatePreviewStartTime(NaN)).toBe(0);
      expect(calculatePreviewStartTime(Infinity)).toBe(0);
      expect(calculatePreviewStartTime(-Infinity)).toBe(0);
    });

    it('clamps offset ratio between 0 and 1', () => {
      // Negative ratio clamps to 0 -> offset 0
      expect(calculatePreviewStartTime(100, 20, -0.5)).toBe(0);
      // Ratio 0 -> offset 0
      expect(calculatePreviewStartTime(100, 20, 0)).toBe(0);
      // Ratio 1 -> clamped to maxStart (100 - 20 = 80s)
      expect(calculatePreviewStartTime(100, 20, 1)).toBe(80);
      // Ratio > 1 clamps to 1 -> clamped to maxStart (100 - 20 = 80s)
      expect(calculatePreviewStartTime(100, 20, 1.5)).toBe(80);
    });

    it('handles non-positive preview duration safely by enforcing minimum default 20s', () => {
      expect(calculatePreviewStartTime(100, 0, 0.35)).toBe(35);
      expect(calculatePreviewStartTime(100, -5, 0.35)).toBe(35);
    });

    it('rounds start offset to two decimal places', () => {
      // 100 * 0.333333 = 33.33
      expect(calculatePreviewStartTime(100, 20, 1 / 3)).toBe(33.33);
    });
  });

  describe('applyAudioMidsectionSeek', () => {
    let mockAudio: any;
    let listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      listeners = {};
      mockAudio = {
        readyState: 0,
        duration: NaN,
        currentTime: 0,
        addEventListener: vi.fn((event: string, handler: any) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        }),
      };
    });

    it('applies seek immediately if audio metadata is already ready (readyState >= 1 and duration > 0)', () => {
      mockAudio.readyState = 1;
      mockAudio.duration = 200;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      // 200 * 0.35 = 70s
      expect(mockAudio.currentTime).toBe(70);
      expect(mockAudio.addEventListener).not.toHaveBeenCalled();
    });

    it('registers loadedmetadata listener when readyState < 1 and does not seek immediately', () => {
      mockAudio.readyState = 0;
      mockAudio.duration = 200;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      expect(mockAudio.addEventListener).toHaveBeenCalledWith(
        'loadedmetadata',
        expect.any(Function),
        { once: true }
      );
      expect(mockAudio.currentTime).toBe(0);

      // Simulate loadedmetadata event firing later
      mockAudio.readyState = 1;
      mockAudio.duration = 180;
      const handler = listeners['loadedmetadata']?.[0];
      expect(handler).toBeDefined();
      handler?.();

      // 180 * 0.35 = 63s
      expect(mockAudio.currentTime).toBe(63);
    });

    it('does not overwrite currentTime if currentTime is already past the midsection offset', () => {
      mockAudio.readyState = 1;
      mockAudio.duration = 200;
      mockAudio.currentTime = 100;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      expect(mockAudio.currentTime).toBe(100);
    });

    it('does not overwrite currentTime if currentTime is equal to the midsection offset', () => {
      mockAudio.readyState = 1;
      mockAudio.duration = 200;
      mockAudio.currentTime = 70;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      expect(mockAudio.currentTime).toBe(70);
    });

    it('does not change currentTime if track is short and startTime is 0', () => {
      mockAudio.readyState = 1;
      mockAudio.duration = 10;
      mockAudio.currentTime = 0;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      expect(mockAudio.currentTime).toBe(0);
    });

    it('handles audio with invalid duration on loadedmetadata gracefully', () => {
      mockAudio.readyState = 0;
      mockAudio.duration = NaN;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      const handler = listeners['loadedmetadata']?.[0];
      mockAudio.duration = 0;
      handler?.();

      expect(mockAudio.currentTime).toBe(0);
    });

    it('handles audio with negative duration on loadedmetadata gracefully', () => {
      mockAudio.readyState = 0;
      mockAudio.duration = NaN;

      applyAudioMidsectionSeek(mockAudio, 20, 0.35);

      const handler = listeners['loadedmetadata']?.[0];
      mockAudio.duration = -10;
      handler?.();

      expect(mockAudio.currentTime).toBe(0);
    });

    it('handles null/undefined audio gracefully without throwing', () => {
      expect(() => applyAudioMidsectionSeek(null as any)).not.toThrow();
      expect(() => applyAudioMidsectionSeek(undefined as any)).not.toThrow();
    });

    it('handles audio without addEventListener method gracefully', () => {
      const bareAudio = { readyState: 0, duration: 180, currentTime: 0 };
      expect(() => applyAudioMidsectionSeek(bareAudio as any)).not.toThrow();
      expect(bareAudio.currentTime).toBe(0);
    });
  });

  describe('createPreviewPlayerSession', () => {
    let mockAudio: any;
    let listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      vi.useFakeTimers();
      listeners = {};
      mockAudio = {
        readyState: 1,
        duration: 180,
        currentTime: 0,
        volume: 1,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn((event: string, handler: any) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        }),
        removeEventListener: vi.fn((event: string, handler: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        }),
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates an audio session, seeks to midsection, and auto-stops after 20 seconds', () => {
      const onStop = vi.fn();
      const onPlaying = vi.fn();

      const session = createPreviewPlayerSession(mockAudio as any, {
        previewDurationSeconds: 20,
        offsetRatio: 0.35,
        onStop,
        onPlaying,
      });

      // Seeks to 63s (35% of 180s)
      expect(mockAudio.currentTime).toBe(63);
      expect(mockAudio.volume).toBe(0.8);
      expect(mockAudio.play).toHaveBeenCalled();

      // Trigger playing event
      const playingHandler = listeners['playing']?.[0];
      expect(playingHandler).toBeDefined();
      playingHandler?.();
      expect(onPlaying).toHaveBeenCalled();

      // Advance timers by 19 seconds -> should not stop yet
      vi.advanceTimersByTime(19_000);
      expect(mockAudio.pause).not.toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();

      // Advance by another 1 second (total 20s) -> should stop
      vi.advanceTimersByTime(1_000);
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalled();
    });

    it('supports custom previewDurationSeconds option', () => {
      const onStop = vi.fn();
      createPreviewPlayerSession(mockAudio as any, {
        previewDurationSeconds: 10,
        onStop,
      });

      const playingHandler = listeners['playing']?.[0];
      playingHandler?.();

      vi.advanceTimersByTime(9_999);
      expect(onStop).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onStop).toHaveBeenCalled();
    });

    it('supports custom volume and custom offset ratio options', () => {
      createPreviewPlayerSession(mockAudio as any, {
        volume: 0.5,
        offsetRatio: 0.4,
      });

      expect(mockAudio.volume).toBe(0.5);
      // 180 * 0.4 = 72s
      expect(mockAudio.currentTime).toBe(72);
    });

    it('registers ended and error listeners with once: true', () => {
      createPreviewPlayerSession(mockAudio as any);

      expect(mockAudio.addEventListener).toHaveBeenCalledWith(
        'ended',
        expect.any(Function),
        { once: true }
      );
      expect(mockAudio.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
        { once: true }
      );
    });

    it('allows manual stop to clear timer and pause immediately without re-stopping later', () => {
      const onStop = vi.fn();
      const session = createPreviewPlayerSession(mockAudio as any, {
        onStop,
      });

      // Start playing
      const playingHandler = listeners['playing']?.[0];
      playingHandler?.();

      session.stop();
      expect(mockAudio.pause).toHaveBeenCalledTimes(1);
      expect(onStop).toHaveBeenCalledTimes(1);

      // Calling stop again when already stopped does nothing
      session.stop();
      expect(mockAudio.pause).toHaveBeenCalledTimes(1);
      expect(onStop).toHaveBeenCalledTimes(1);

      // Advancing timer after manual stop should not call onStop again
      vi.advanceTimersByTime(25_000);
      expect(onStop).toHaveBeenCalledTimes(1);
      expect(mockAudio.pause).toHaveBeenCalledTimes(1);
    });

    it('handles ended event by cleaning up and calling onStop', () => {
      const onStop = vi.fn();
      createPreviewPlayerSession(mockAudio as any, {
        onStop,
      });

      const endedHandler = listeners['ended']?.[0];
      expect(endedHandler).toBeDefined();
      endedHandler?.();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalled();
    });

    it('handles error event by cleaning up and calling onError', () => {
      const onError = vi.fn();
      const onStop = vi.fn();
      createPreviewPlayerSession(mockAudio as any, {
        onError,
        onStop,
      });

      const errorHandler = listeners['error']?.[0];
      expect(errorHandler).toBeDefined();
      const testErr = new Error('Network error');
      errorHandler?.(testErr);

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(testErr);
    });

    it('handles multiple playing events by clearing existing timer and resetting timeout', () => {
      const onStop = vi.fn();
      createPreviewPlayerSession(mockAudio as any, {
        previewDurationSeconds: 20,
        onStop,
      });

      const playingHandler = listeners['playing']?.[0];
      playingHandler?.();

      // 10 seconds pass
      vi.advanceTimersByTime(10_000);
      expect(onStop).not.toHaveBeenCalled();

      // Another playing event fires (e.g. after buffer seek)
      playingHandler?.();

      // Another 15 seconds pass (25s total since start, but only 15s since second playing)
      vi.advanceTimersByTime(15_000);
      expect(onStop).not.toHaveBeenCalled();

      // Remaining 5 seconds pass (20s since second playing)
      vi.advanceTimersByTime(5_000);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('handles play promise rejection gracefully and calls cleanup and onError', async () => {
      const onError = vi.fn();
      const onStop = vi.fn();
      mockAudio.play.mockRejectedValue(new Error('Autoplay blocked'));

      createPreviewPlayerSession(mockAudio as any, {
        onError,
        onStop,
      });

      await Promise.resolve(); // flush microtasks
      expect(onError).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalled();
      expect(mockAudio.pause).toHaveBeenCalled();
    });

    it('handles pause throwing error during cleanup safely', () => {
      mockAudio.pause.mockImplementation(() => {
        throw new Error('Pause failed');
      });

      const onStop = vi.fn();
      const session = createPreviewPlayerSession(mockAudio as any, {
        onStop,
      });

      expect(() => session.stop()).not.toThrow();
      expect(onStop).toHaveBeenCalled();
    });

    it('handles volume setter throwing error safely', () => {
      Object.defineProperty(mockAudio, 'volume', {
        set() {
          throw new Error('Volume change not permitted');
        },
        get() {
          return 1;
        },
      });

      expect(() => createPreviewPlayerSession(mockAudio as any)).not.toThrow();
    });

    it('handles playing event fired after session is already stopped', () => {
      const onPlaying = vi.fn();
      const session = createPreviewPlayerSession(mockAudio as any, {
        onPlaying,
      });

      session.stop();
      const playingHandler = listeners['playing']?.[0];
      playingHandler?.();

      expect(onPlaying).not.toHaveBeenCalled();
    });

    it('works when options callbacks are completely omitted', async () => {
      mockAudio.play.mockRejectedValue(new Error('Autoplay blocked'));
      expect(() => createPreviewPlayerSession(mockAudio as any)).not.toThrow();
      await Promise.resolve();

      const session = createPreviewPlayerSession(mockAudio as any);
      const playingHandler = listeners['playing']?.[1];
      playingHandler?.();
      expect(() => session.stop()).not.toThrow();

      const errorHandler = listeners['error']?.[1];
      expect(() => errorHandler?.(new Error('Err'))).not.toThrow();
    });

    it('handles audio object without addEventListener gracefully', () => {
      const bareAudio = {
        readyState: 1,
        duration: 180,
        currentTime: 0,
        volume: 1,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
      };

      const session = createPreviewPlayerSession(bareAudio as any);
      expect(bareAudio.currentTime).toBe(63);
      expect(() => session.stop()).not.toThrow();
    });
  });
});
