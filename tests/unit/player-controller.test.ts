// tests/unit/player-controller.test.ts
// Unit tests for Live Radio Stream Audio Player Controller

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createStreamPlayerController,
  DEFAULT_STREAM_URL,
  MAX_RECONNECT_ATTEMPTS,
  BASE_RECONNECT_DELAY_MS,
} from '@/lib/audio/player-controller';

describe('Live Stream Player Controller', () => {
  let mockAudio: any;
  let listeners: Record<string, () => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};
    mockAudio = {
      src: '',
      volume: 0.8,
      load: vi.fn(),
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[event];
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports valid constants', () => {
    expect(DEFAULT_STREAM_URL).toBe('https://stream.promptfm.live/stream.mp3');
    expect(MAX_RECONNECT_ATTEMPTS).toBe(5);
    expect(BASE_RECONNECT_DELAY_MS).toBe(2000);
  });

  it('works when onError callback is omitted', () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
    });
    expect(() => {
      controller.play();
      controller.pause();
    }).not.toThrow();
  });

  it('initializes in idle state and falls back to DEFAULT_STREAM_URL when url is empty or whitespace', () => {
    const onStateChange = vi.fn();
    const controller1 = createStreamPlayerController(mockAudio, '', {
      onStateChange,
      onError: vi.fn(),
    });
    expect(controller1.getState()).toBe('idle');
    controller1.play();
    expect(mockAudio.src).toContain(DEFAULT_STREAM_URL);

    controller1.pause();
    const controller2 = createStreamPlayerController(mockAudio, '   ', {
      onStateChange,
      onError: vi.fn(),
    });
    controller2.play();
    expect(mockAudio.src).toContain(DEFAULT_STREAM_URL);
  });

  it('uses custom stream url when provided', () => {
    const controller = createStreamPlayerController(mockAudio, 'https://custom.promptfm.live/stream.mp3', {
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });
    controller.play();
    expect(mockAudio.src).toContain('https://custom.promptfm.live/stream.mp3');
  });

  it('transitions to loading and calls play when play() is initiated', async () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    controller.play();

    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(onError).toHaveBeenCalledWith(null);
    expect(mockAudio.src).toContain(DEFAULT_STREAM_URL);
    expect(mockAudio.load).toHaveBeenCalled();
    expect(mockAudio.play).toHaveBeenCalled();

    // Trigger playing event
    listeners['playing']?.();
    expect(onStateChange).toHaveBeenCalledWith('playing');
    expect(onError).toHaveBeenCalledWith(null);
    expect(controller.getState()).toBe('playing');
  });

  it('handles waiting event during active playback', () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError: vi.fn(),
    });

    controller.play();
    listeners['playing']?.();
    expect(controller.getState()).toBe('playing');

    listeners['waiting']?.();
    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(controller.getState()).toBe('loading');

    // Waiting while user stopped should do nothing
    controller.pause();
    listeners['waiting']?.();
    expect(controller.getState()).toBe('idle');
  });

  it('stops cleanly and DOES NOT reconnect when pause() is called', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    controller.play();
    listeners['playing']?.();
    expect(controller.getState()).toBe('playing');

    controller.pause();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockAudio.load).toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(onError).toHaveBeenCalledWith(null);

    // Simulate browser asynchronous error or ended events triggered by clearing src
    listeners['error']?.();
    listeners['ended']?.();

    // Advance time by 10 seconds
    vi.advanceTimersByTime(10000);

    // Verify it stays in idle state and DID NOT reconnect or call play again!
    expect(controller.getState()).toBe('idle');
    expect(mockAudio.play).toHaveBeenCalledTimes(1);
  });

  it('toggles playback correctly between idle and playing/loading', () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError: vi.fn(),
    });

    expect(controller.getState()).toBe('idle');
    controller.toggle();
    expect(controller.getState()).toBe('loading');

    listeners['playing']?.();
    expect(controller.getState()).toBe('playing');

    controller.toggle();
    expect(controller.getState()).toBe('idle');

    // Toggle while loading pauses
    controller.play();
    expect(controller.getState()).toBe('loading');
    controller.toggle();
    expect(controller.getState()).toBe('idle');
  });

  it('cleans up all listeners and stops playback when destroy() is called', () => {
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });

    controller.play();
    controller.destroy();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('waiting', expect.any(Function));
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('playing', expect.any(Function));
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    expect(controller.getState()).toBe('idle');
  });

  it('reconnects with exponential backoff on error during active playback', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    controller.play();
    listeners['playing']?.();

    // Sudden error
    listeners['error']?.();
    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(onError).toHaveBeenCalledWith(`Reconnecting (attempt 1/${MAX_RECONNECT_ATTEMPTS})…`);

    // Backoff delay 1: BASE_RECONNECT_DELAY_MS (2000ms)
    vi.advanceTimersByTime(2000);
    expect(mockAudio.play).toHaveBeenCalledTimes(2);

    // Error again -> attempt 2
    listeners['error']?.();
    expect(onError).toHaveBeenCalledWith(`Reconnecting (attempt 2/${MAX_RECONNECT_ATTEMPTS})…`);

    // Backoff delay 2: 2000 * 2 = 4000ms
    vi.advanceTimersByTime(4000);
    expect(mockAudio.play).toHaveBeenCalledTimes(3);
  });

  it('transitions to error state and stops reconnecting when MAX_RECONNECT_ATTEMPTS is exceeded', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    controller.play();

    // Trigger errors repeatedly up to limit
    for (let i = 1; i <= MAX_RECONNECT_ATTEMPTS; i++) {
      listeners['error']?.();
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS * 2 ** (i - 1));
    }

    // Trigger one more error exceeding limit
    listeners['error']?.();

    expect(controller.getState()).toBe('error');
    expect(onStateChange).toHaveBeenCalledWith('error');
    expect(onError).toHaveBeenCalledWith('Unable to connect to live stream. Please try again later.');

    const callCount = mockAudio.play.mock.calls.length;
    vi.advanceTimersByTime(60000);
    expect(mockAudio.play.mock.calls.length).toBe(callCount); // No further attempts!
  });

  it('reconnects when audio.play() promise rejects during active playback', async () => {
    mockAudio.play = vi.fn().mockRejectedValue(new Error('Playback failed'));
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    controller.play();
    await vi.waitFor(() => {
      expect(mockAudio.play).toHaveBeenCalled();
    });

    // Advance backoff timer
    vi.advanceTimersByTime(2500);

    // Verify it scheduled a reconnect
    expect(mockAudio.play).toHaveBeenCalledTimes(2);
  });

  it('pauses audio immediately if playing event fires after user stopped', () => {
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });

    controller.play();
    controller.pause();

    // Async playing event arrives after user stopped
    listeners['playing']?.();
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
  });

  it('reconnects when ended event fires during active stream', () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError: vi.fn(),
    });

    controller.play();
    listeners['playing']?.();

    listeners['ended']?.();
    expect(onStateChange).toHaveBeenCalledWith('loading');

    vi.advanceTimersByTime(2500);
    expect(mockAudio.play).toHaveBeenCalledTimes(2);
  });

  it('clears pending reconnect timer if user hits pause or play while waiting', () => {
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });

    controller.play();
    listeners['error']?.(); // Schedules 2s reconnect

    // User hits pause during the 2s wait
    controller.pause();
    vi.advanceTimersByTime(3000);

    // Should NOT have reconnected
    expect(mockAudio.play).toHaveBeenCalledTimes(1);

    // User starts again and error occurs
    controller.play();
    listeners['error']?.();

    // User hits play again immediately
    controller.play();
    vi.advanceTimersByTime(3000);
    expect(controller.getState()).toBe('loading');
  });

  it('updates stream URL via setUrl and switches playback immediately if active', () => {
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });

    // Case 1: When idle, setUrl updates target without playing
    controller.setUrl('https://stream.promptfm.live/cyberpunk.mp3');
    expect(mockAudio.play).not.toHaveBeenCalled();

    // Now play uses the new URL
    controller.play();
    expect(mockAudio.src).toContain('cyberpunk.mp3');

    // Case 2: When active, setUrl immediately switches stream source
    controller.setUrl('https://stream.promptfm.live/chillout.mp3');
    expect(mockAudio.src).toContain('chillout.mp3');
    expect(mockAudio.play).toHaveBeenCalledTimes(2);

    // Case 3: Empty string falls back to default stream URL
    controller.setUrl('');
    expect(mockAudio.src).toContain(DEFAULT_STREAM_URL);
  });
});
