// src/lib/player/media-session.ts
// Media Session API integration for iOS Lock Screen, macOS Control Center, Android media shade, and dynamic page titles.

export interface MediaSessionTrackInfo {
  title?: string;
  artist?: string;
  cover_art_url?: string;
  active_dj?: {
    name?: string;
  };
}

export interface UpdateMediaSessionParams {
  nowPlaying?: MediaSessionTrackInfo | null;
  channelName: string;
  isPlaying: boolean;
  origin?: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export const DEFAULT_PAGE_TITLE = 'PromptFM — 24/7 AI Radio Station';

/**
 * Formats the browser tab and fallback lock screen document.title dynamically.
 */
export function formatPageTitle(
  nowPlaying: { title?: string; artist?: string } | null,
  isPlaying: boolean
): string {
  if (!isPlaying || !nowPlaying?.title) {
    return DEFAULT_PAGE_TITLE;
  }

  const artistPart = nowPlaying.artist ? ` — ${nowPlaying.artist}` : '';
  return `▶ ${nowPlaying.title}${artistPart} | PromptFM`;
}

/**
 * Syncs the currently playing broadcast track to navigator.mediaSession.
 * Controls lock-screen media cards, album art, audio metadata, and remote play/pause on iOS & Android.
 */
export function updateMediaSession({
  nowPlaying,
  channelName,
  isPlaying,
  origin = typeof window !== 'undefined' ? window.location.origin : 'https://promptfm.live',
  onPlay,
  onPause,
}: UpdateMediaSessionParams): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession) {
    return;
  }

  const ms = navigator.mediaSession;

  try {
    ms.playbackState = isPlaying ? 'playing' : 'paused';

    if (nowPlaying?.title && typeof MediaMetadata !== 'undefined') {
      const coverUrl =
        nowPlaying.cover_art_url && nowPlaying.cover_art_url.startsWith('http')
          ? nowPlaying.cover_art_url
          : `${origin}${nowPlaying.cover_art_url || '/logo-mark.png'}`;

      const rawDj = nowPlaying.active_dj?.name;
      const djText = rawDj ? (rawDj.toLowerCase().startsWith('dj ') ? rawDj : `DJ ${rawDj}`) : '';
      const artistText = nowPlaying.artist
        ? `${nowPlaying.artist}${djText ? ` • ${djText}` : ''}`
        : 'PromptFM Resident';

      ms.metadata = new MediaMetadata({
        title: nowPlaying.title,
        artist: artistText,
        album: `PromptFM — ${channelName}`,
        artwork: [
          { src: coverUrl, sizes: '512x512', type: 'image/png' },
          { src: `${origin}/logo-mark.png`, sizes: '192x192', type: 'image/png' },
        ],
      });
    }

    if (onPlay) {
      ms.setActionHandler('play', onPlay);
    }
    if (onPause) {
      ms.setActionHandler('pause', onPause);
      ms.setActionHandler('stop', onPause);
    }
  } catch {
    // Non-blocking fallback for restricted browser contexts
  }
}
