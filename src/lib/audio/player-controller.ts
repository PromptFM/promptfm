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
  setUrl: (url: string) => void;
}

export function createStreamPlayerController(
  audio: HTMLAudioElement,
  streamUrl: string,
  callbacks: PlayerControllerCallbacks
): StreamPlayerController {
  let effectiveUrl = streamUrl?.trim() || DEFAULT_STREAM_URL;
  const notifyError = callbacks.onError || (() => {});

  let state: PlayerState = 'idle';
  let userStopped = true;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let playSessionId = 0;

  const setState = (next: PlayerState) => {
    state = next;
    callbacks.onStateChange(next);
  };

  const clearTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const executePlay = () => {
    const currentSession = ++playSessionId;
    audio.src = `${effectiveUrl}?nocache=${Date.now()}`;
    audio.load();
    Promise.resolve(audio.play()).then(
      () => {
        if (userStopped) {
          audio.pause();
          audio.src = '';
          audio.removeAttribute('src');
          setState('idle');
        }
      },
      () => {
        if (!userStopped && currentSession === playSessionId) {
          scheduleReconnect();
        }
      }
    );
  };

  const setUrl = (newUrl: string) => {
    effectiveUrl = newUrl?.trim() || DEFAULT_STREAM_URL;
    if (!userStopped) {
      clearTimer();
      executePlay();
    }
  };

  const scheduleReconnect = () => {
    if (userStopped) return;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setState('error');
      notifyError('Unable to connect to live stream. Please try again later.');
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * (2 ** reconnectAttempts);
    reconnectAttempts += 1;

    setState('loading');
    notifyError(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})…`);

    clearTimer();
    reconnectTimer = setTimeout(() => {
      if (userStopped) return;
      executePlay();
    }, delay);
  };

  // Event listeners
  const handleWaiting = () => {
    if (userStopped) return;
    setState('loading');
  };

  const handlePlaying = () => {
    if (userStopped) {
      audio.pause();
      audio.src = '';
      audio.removeAttribute('src');
      setState('idle');
      return;
    }
    setState('playing');
    notifyError(null);
    reconnectAttempts = 0;
  };

  const handleError = () => {
    scheduleReconnect();
  };

  const handleEnded = () => {
    scheduleReconnect();
  };

  audio.addEventListener('waiting', handleWaiting);
  audio.addEventListener('playing', handlePlaying);
  audio.addEventListener('error', handleError);
  audio.addEventListener('ended', handleEnded);

  const play = () => {
    userStopped = false;
    clearTimer();
    reconnectAttempts = 0;
    setState('loading');
    notifyError(null);
    executePlay();
  };

  const pause = () => {
    ++playSessionId;
    userStopped = true;
    clearTimer();
    reconnectAttempts = 0;
    setState('idle');
    notifyError(null);

    audio.pause();
    // Cleanly unload audio and sever HTTP connection to prevent background buffering
    audio.src = '';
    audio.removeAttribute('src');
    try {
      audio.load();
    } catch {
      // Ignore browsers where load() throws on empty src
    }
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
    setUrl,
  };
}
