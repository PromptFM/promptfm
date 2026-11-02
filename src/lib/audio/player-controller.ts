// src/lib/audio/player-controller.ts
// Robust HTML5 Audio stream controller for 24/7 Icecast live streams.
// Prevents reconnection loops on user pause/stop and cleanly unloads network buffers.

export type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

export const DEFAULT_STREAM_URL = 'https://stream.promptfm.live/stream.mp3';
export const MAX_RECONNECT_ATTEMPTS = 5;
export const BASE_RECONNECT_DELAY_MS = 2000;

export interface PlayerControllerCallbacks {
  onStateChange: (state: PlayerState) => void;
  onError?: (message: string | null) => void;
}

export interface StreamPlayerController {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  destroy: () => void;
  getState: () => PlayerState;
}

export function createStreamPlayerController(
  audio: HTMLAudioElement,
  streamUrl: string,
  callbacks: PlayerControllerCallbacks
): StreamPlayerController {
  const effectiveUrl = streamUrl?.trim() || DEFAULT_STREAM_URL;

  let state: PlayerState = 'idle';
  let userStopped = true;
  let reconnectAttempts = 0;
  let reconnectTimer: any = null;

  const setState = (next: PlayerState) => {
    state = next;
    callbacks.onStateChange(next);
  };

  const scheduleReconnect = () => {
    if (userStopped || state === 'idle') return;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setState('error');
      callbacks.onError?.('Unable to connect to live stream. Please try again later.');
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts;
    reconnectAttempts += 1;

    setState('loading');
    callbacks.onError?.(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})…`);

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (userStopped || state === 'idle') return;

      audio.src = `${effectiveUrl}?nocache=${Date.now()}`;
      audio.load();
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (!userStopped && state !== 'idle') {
            scheduleReconnect();
          }
        });
      }
    }, delay);
  };

  // Event listeners
  const handleWaiting = () => {
    if (userStopped || state === 'idle') return;
    setState('loading');
  };

  const handlePlaying = () => {
    if (userStopped || state === 'idle') {
      audio.pause();
      return;
    }
    setState('playing');
    callbacks.onError?.(null);
    reconnectAttempts = 0;
  };

  const handleError = () => {
    // When paused or stopped, browser fires error on src removal. Ignore it!
    if (userStopped || state === 'idle') return;
    scheduleReconnect();
  };

  const handleEnded = () => {
    // Live streams should never fire ended unless network severed.
    if (userStopped || state === 'idle') return;
    scheduleReconnect();
  };

  audio.addEventListener('waiting', handleWaiting);
  audio.addEventListener('playing', handlePlaying);
  audio.addEventListener('error', handleError);
  audio.addEventListener('ended', handleEnded);

  const play = () => {
    userStopped = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    setState('loading');
    callbacks.onError?.(null);

    audio.src = `${effectiveUrl}?nocache=${Date.now()}`;
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (!userStopped && state !== 'idle') {
          scheduleReconnect();
        }
      });
    }
  };

  const pause = () => {
    userStopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    setState('idle');
    callbacks.onError?.(null);

    audio.pause();
    // Cleanly unload audio without firing loopback reconnects
    audio.removeAttribute('src');
    audio.load();
  };

  const toggle = () => {
    if (state === 'playing' || state === 'loading') {
      pause();
    } else {
      play();
    }
  };

  const destroy = () => {
    pause();
    audio.removeEventListener('waiting', handleWaiting);
    audio.removeEventListener('playing', handlePlaying);
    audio.removeEventListener('error', handleError);
    audio.removeEventListener('ended', handleEnded);
  };

  return {
    play,
    pause,
    toggle,
    destroy,
    getState: () => state,
  };
}
