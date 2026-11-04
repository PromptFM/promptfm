// src/lib/radio/progress.ts
// Real-time broadcast progress calculation, time formatting, and queue display helpers.

import type { AirplayItem } from '../dj/rotation';

export interface TrackProgress {
  percent: number;
  formattedElapsed: string;
  formattedDuration: string;
  isComplete: boolean;
  remainingSeconds: number;
}

export interface QueueDisplayItem {
  id: string;
  title: string;
  artist: string;
  badgeLabel: string;
  isCurrent: boolean;
  progressPercent?: number;
  formattedTime?: string;
  cover_art_url?: string;
  category?: string;
  tool_used?: string;
  upvotes_count?: number;
  type?: string;
}

export type QueueInputTrack = {
  id?: string;
  title: string;
  artist: string;
  cover_art_url?: string;
  category?: string;
  tool_used?: string;
  upvotes_count?: number;
  type?: string;
  duration_hint_seconds?: number;
};

/**
 * Formats a duration in seconds into 'm:ss' representation.
 */
export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) {
    return '0:00';
  }
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Calculates current on-air track playback percentage and remaining time.
 */
export function calculateTrackProgress(
  elapsedSeconds: number,
  durationSeconds?: number | null
): TrackProgress {
  const safeDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : 180;
  const safeElapsed = Math.max(0, elapsedSeconds || 0);

  const percent = Math.min(100, Math.round((safeElapsed / safeDuration) * 100));
  const remainingSeconds = Math.max(0, safeDuration - safeElapsed);
  const isComplete = safeElapsed >= safeDuration;

  return {
    percent,
    formattedElapsed: formatAudioTime(safeElapsed),
    formattedDuration: formatAudioTime(safeDuration),
    isComplete,
    remainingSeconds,
  };
}

/**
 * Builds the visual list for Up Next & modal widgets.
 * Accurately marks the currently playing track as '▶ NOW PLAYING' with progress,
 * and upcoming items as '#1 NEXT', '#2 NEXT', etc.
 */
export function buildQueueDisplayItems(
  nowPlaying: QueueInputTrack | null,
  upNext: QueueInputTrack[],
  elapsedSeconds = 0,
  durationSeconds = 180
): QueueDisplayItem[] {
  const items: QueueDisplayItem[] = [];

  if (nowPlaying && nowPlaying.id) {
    const progress = calculateTrackProgress(elapsedSeconds, durationSeconds || nowPlaying.duration_hint_seconds);
    items.push({
      ...nowPlaying,
      id: nowPlaying.id,
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      cover_art_url: nowPlaying.cover_art_url || '/logo-mark.png',
      badgeLabel: '▶ NOW PLAYING',
      isCurrent: true,
      progressPercent: progress.percent,
      formattedTime: `${progress.formattedElapsed} / ${progress.formattedDuration}`,
    });
  }

  // Filter out any accidental duplicate of currently playing track from upcoming list
  const currentId = nowPlaying?.id;
  const filteredUpNext = upNext.filter((item) => !currentId || item.id !== currentId);

  filteredUpNext.forEach((item, index) => {
    items.push({
      ...item,
      id: item.id || `upnext-${index}`,
      title: item.title,
      artist: item.artist,
      cover_art_url: item.cover_art_url || '/logo-mark.png',
      badgeLabel: `#${index + 1} NEXT`,
      isCurrent: false,
    });
  });

  return items;
}
