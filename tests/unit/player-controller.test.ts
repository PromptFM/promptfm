// tests/unit/player-controller.test.ts
// Unit tests for Live Radio Stream Audio Player Controller

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamPlayerController, DEFAULT_STREAM_URL } from '@/lib/audio/player-controller';

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

  it('initializes in idle state and sets default stream url', () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, '', {
      onStateChange,
      onError: vi.fn(),
    });

    expect(controller.getState()).toBe('idle');
  });

  it('transitions to loading and calls play when play() is initiated', async () => {
    const onStateChange = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError: vi.fn(),
    });

    controller.play();

    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(mockAudio.src).toContain(DEFAULT_STREAM_URL);
    expect(mockAudio.load).toHaveBeenCalled();
    expect(mockAudio.play).toHaveBeenCalled();

    // Trigger playing event
    listeners['playing']?.();
    expect(onStateChange).toHaveBeenCalledWith('playing');
    expect(controller.getState()).toBe('playing');
  });

  it('stops cleanly and DOES NOT reconnect when pause() is called', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    // Start playing
    controller.play();
    listeners['playing']?.();
    expect(controller.getState()).toBe('playing');

    // User pauses
    controller.pause();

    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.removeAttribute).toHaveBeenCalledWith('src');
    expect(mockAudio.load).toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
    expect(onStateChange).toHaveBeenCalledWith('idle');

    // Simulate browser asynchronous error or ended events triggered by clearing src
    listeners['error']?.();
    listeners['ended']?.();

    // Advance time by 5 seconds
    vi.advanceTimersByTime(5000);

    // Verify it stays in idle state and DID NOT reconnect or call play again!
    expect(controller.getState()).toBe('idle');
    expect(mockAudio.play).toHaveBeenCalledTimes(1); // Only the initial play, no reconnect!
  });

  it('reconnects automatically if error occurs during active playback', () => {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const controller = createStreamPlayerController(mockAudio, DEFAULT_STREAM_URL, {
      onStateChange,
      onError,
    });

    // Start playback
    controller.play();
    listeners['playing']?.();

    // Sudden network drop while playing
    listeners['error']?.();

    expect(onStateChange).toHaveBeenCalledWith('loading');

    // Fast-forward past reconnect delay (2000ms)
    vi.advanceTimersByTime(2500);

    // Verify reconnect attempt called play again
    expect(mockAudio.play).toHaveBeenCalledTimes(2);
  });
});
