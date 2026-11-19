// src/lib/audio/preview.ts
// Shared audio preview engine for PromptFM (Issue #262).
// Plays 20s song previews starting from the midsection (30-40% into the track)
// rather than 0:00, allowing listeners to immediately hear the hook or chorus.

export const DEFAULT_PREVIEW_DURATION_SECONDS = 20;
export const DEFAULT_PREVIEW_OFFSET_RATIO = 0.35; // 35% of track duration (30-40% range)

export interface PreviewSessionOptions {
  previewDurationSeconds?: number;
  offsetRatio?: number;
  volume?: number;
  onPlaying?: () => void;
  onStop?: () => void;
  onError?: (err?: unknown) => void;
}

export interface PreviewSession {
  stop: () => void;
}

/**
 * Calculates the seek offset for previewing the midsection of a track.
 * Ensures the preview starts at ~35% (30-40%) of the song duration and does
 * not overrun the end of the file. If the track is shorter than or equal to
 * the preview length, it plays from 0:00.
 */
export function calculatePreviewStartTime(
  durationSeconds: number,
  previewDurationSeconds: number = DEFAULT_PREVIEW_DURATION_SECONDS,
  offsetRatio: number = DEFAULT_PREVIEW_OFFSET_RATIO
): number {
  const safePreviewSec = previewDurationSeconds > 0 ? previewDurationSeconds : DEFAULT_PREVIEW_DURATION_SECONDS;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= safePreviewSec) {
    return 0;
  }

  const safeRatio = Math.max(0, Math.min(1, offsetRatio));
  const rawOffset = durationSeconds * safeRatio;
  const maxStart = durationSeconds - safePreviewSec;
  const target = Math.max(0, Math.min(rawOffset, maxStart));

  return Math.round(target * 100) / 100;
}

/**
 * Seeks an HTMLAudioElement to the midsection start time.
 * If metadata is already loaded (readyState >= 1 and finite duration), seeks immediately.
 * Otherwise, registers a once listener on 'loadedmetadata' to seek as soon as duration is known.
 */
export function applyAudioMidsectionSeek(
  audio: HTMLAudioElement | null | undefined,
  previewDurationSeconds: number = DEFAULT_PREVIEW_DURATION_SECONDS,
  offsetRatio: number = DEFAULT_PREVIEW_OFFSET_RATIO
): void {
  if (!audio) return;

  const seek = () => {
    const startTime = calculatePreviewStartTime(audio.duration, previewDurationSeconds, offsetRatio);
    if (startTime > 0 && audio.currentTime < startTime) {
      audio.currentTime = startTime;
    }
  };

  if (audio.readyState >= 1) {
    seek();
  } else if (typeof audio.addEventListener === 'function') {
    audio.addEventListener('loadedmetadata', seek, { once: true });
  }
}

/**
 * Creates and runs an audio preview session for an HTMLAudioElement.
 * Automatically sets volume, seeks to midsection, starts playback, sets up the 20s
 * auto-stop timeout, and provides a cleanup `stop()` callback.
 */
export function createPreviewPlayerSession(
  audio: HTMLAudioElement,
  options: PreviewSessionOptions = {}
): PreviewSession {
  const previewDuration = options.previewDurationSeconds ?? DEFAULT_PREVIEW_DURATION_SECONDS;
  const offsetRatio = options.offsetRatio ?? DEFAULT_PREVIEW_OFFSET_RATIO;
  const volume = options.volume ?? 0.8;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      audio.pause();
    } catch {
      // Audio element might already be cleaned up
    }
    options.onStop?.();
  };

  try {
    audio.volume = volume;
  } catch {
    // Volume adjustments unsupported
  }

  applyAudioMidsectionSeek(audio, previewDuration, offsetRatio);

  const handlePlaying = () => {
    if (stopped) return;
    options.onPlaying?.();
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      cleanup();
    }, previewDuration * 1000);
  };

  const handleEnded = () => {
    cleanup();
  };

  const handleError = (e: unknown) => {
    cleanup();
    options.onError?.(e);
  };

  if (typeof audio.addEventListener === 'function') {
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });
  }

  Promise.resolve(audio.play()).catch((err) => {
    cleanup();
    options.onError?.(err);
  });

  return {
    stop: cleanup,
  };
}
