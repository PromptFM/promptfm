import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatPageTitle, updateMediaSession } from '@/lib/player/media-session';

describe('Media Session & Dynamic Page Title (iOS Lock Screen & Browser Player)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatPageTitle', () => {
    it('returns default station title when audio is not playing', () => {
      const title = formatPageTitle(null, false);
      expect(title).toBe('PromptFM — 24/7 AI Radio Station');
    });

    it('returns default station title when playing is false even if track is present', () => {
      const title = formatPageTitle({ title: 'Synthetic Horizons', artist: 'Neon Pulse' }, false);
      expect(title).toBe('PromptFM — 24/7 AI Radio Station');
    });

    it('formats title with track and artist when playing', () => {
      const title = formatPageTitle({ title: 'Hold That Line', artist: 'Letra' }, true);
      expect(title).toBe('▶ Hold That Line — Letra | PromptFM');
    });

    it('formats title with only track name if artist is absent', () => {
      const title = formatPageTitle({ title: 'Midnight City' }, true);
      expect(title).toBe('▶ Midnight City | PromptFM');
    });
  });

  describe('updateMediaSession', () => {
    it('updates navigator.mediaSession metadata and playbackState when supported', () => {
      const mockSetActionHandler = vi.fn();
      const mockMediaSession = {
        metadata: null,
        playbackState: 'none',
        setActionHandler: mockSetActionHandler,
      };

      class MockMediaMetadata {
        constructor(public init: any) {}
      }
      vi.stubGlobal('MediaMetadata', MockMediaMetadata);

      const nav = { mediaSession: mockMediaSession };
      vi.stubGlobal('navigator', nav);

      const onPlay = vi.fn();
      const onPause = vi.fn();

      updateMediaSession({
        nowPlaying: {
          title: 'You’re on the Road',
          artist: 'Bradbury Lane',
          cover_art_url: 'https://example.com/cover.jpg',
          active_dj: { name: 'DJ Neon' },
        },
        channelName: 'PromptFM Main Stage',
        isPlaying: true,
        origin: 'https://promptfm.live',
        onPlay,
        onPause,
      });

      expect((mockMediaSession.metadata as any).init).toEqual({
        title: 'You’re on the Road',
        artist: 'Bradbury Lane • DJ Neon',
        album: 'PromptFM — PromptFM Main Stage',
        artwork: [
          { src: 'https://example.com/cover.jpg', sizes: '512x512', type: 'image/png' },
          { src: 'https://promptfm.live/logo-mark.png', sizes: '192x192', type: 'image/png' },
        ],
      });

      expect(mockMediaSession.playbackState).toBe('playing');
      expect(mockSetActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
      expect(mockSetActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    });

    it('sets playbackState to paused when isPlaying is false', () => {
      const mockMediaSession = {
        metadata: null,
        playbackState: 'playing',
        setActionHandler: vi.fn(),
      };
      class MockMediaMetadata {
        constructor(public init: any) {}
      }
      vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
      vi.stubGlobal('MediaMetadata', MockMediaMetadata);

      updateMediaSession({
        nowPlaying: null,
        channelName: 'PromptFM Main Stage',
        isPlaying: false,
      });

      expect(mockMediaSession.playbackState).toBe('paused');
    });

    it('handles environments without navigator.mediaSession gracefully without throwing', () => {
      vi.stubGlobal('navigator', {});
      expect(() => {
        updateMediaSession({
          nowPlaying: { title: 'Test' },
          channelName: 'Main',
          isPlaying: true,
        });
      }).not.toThrow();
    });
  });
});
