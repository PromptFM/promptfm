// tests/unit/radio-progress.test.ts
// Unit tests for radio track progress, elapsed time calculations, and queue card labeling

import { describe, it, expect } from 'vitest';
import {
  formatAudioTime,
  calculateTrackProgress,
  buildQueueDisplayItems,
  getQueueStateSummary,
  getQueueDisplayMode,
} from '@/lib/radio/progress';

describe('Radio Playback Progress & Queue Card Labeling', () => {
  describe('formatAudioTime', () => {
    it('formats seconds into mm:ss format correctly', () => {
      expect(formatAudioTime(0)).toBe('0:00');
      expect(formatAudioTime(45)).toBe('0:45');
      expect(formatAudioTime(60)).toBe('1:00');
      expect(formatAudioTime(125)).toBe('2:05');
      expect(formatAudioTime(210)).toBe('3:30');
    });

    it('handles negative or invalid values gracefully', () => {
      expect(formatAudioTime(-10)).toBe('0:00');
      expect(formatAudioTime(NaN)).toBe('0:00');
    });
  });

  describe('calculateTrackProgress', () => {
    it('calculates progress percentage, remaining seconds, and formatted times', () => {
      const prog = calculateTrackProgress(90, 180);
      expect(prog.percent).toBe(50);
      expect(prog.formattedElapsed).toBe('1:30');
      expect(prog.formattedDuration).toBe('3:00');
      expect(prog.isComplete).toBe(false);
      expect(prog.remainingSeconds).toBe(90);
    });

    it('caps percentage at 100% when elapsed exceeds duration and marks isComplete', () => {
      const prog = calculateTrackProgress(200, 180);
      expect(prog.percent).toBe(100);
      expect(prog.isComplete).toBe(true);
      expect(prog.remainingSeconds).toBe(0);

      // Boundary condition: exactly when elapsed equals duration
      const progExact = calculateTrackProgress(180, 180);
      expect(progExact.percent).toBe(100);
      expect(progExact.isComplete).toBe(true);
      expect(progExact.remainingSeconds).toBe(0);
    });

    it('uses duration_hint_seconds when durationSeconds is 0 or undefined in buildQueueDisplayItems', () => {
      const trackWithHint = {
        id: 'track-hint',
        title: 'Hint Track',
        artist: 'Hint Artist',
        duration_hint_seconds: 240,
      };
      const cards = buildQueueDisplayItems(trackWithHint, [], 60, 0);
      expect(cards[0]?.formattedTime).toBe('1:00 / 4:00');
      expect(cards[0]?.progressPercent).toBe(25);
    });

    it('uses fallback duration of 180s when duration is 0 or missing', () => {
      const prog = calculateTrackProgress(60, 0);
      expect(prog.formattedDuration).toBe('3:00');
      expect(prog.percent).toBe(33);
    });
  });

  describe('buildQueueDisplayItems', () => {
    const mockNowPlaying = {
      id: 'now-1',
      title: 'Current Hit',
      artist: 'DJ Neon',
      type: 'music',
      upvotes_count: 35,
    };

    const mockUpNext = [
      { id: 'next-1', title: 'Next In Line', artist: 'Artist A', type: 'music', upvotes_count: 20 },
      { id: 'next-2', title: 'Second Next', artist: 'Artist B', type: 'music', upvotes_count: 15 },
    ];

    it('places currently playing track as the first card with NOW PLAYING badge', () => {
      const cards = buildQueueDisplayItems(mockNowPlaying, mockUpNext, 45, 180);

      expect(cards.length).toBe(3);
      expect(cards[0]?.id).toBe('now-1');
      expect(cards[0]?.badgeLabel).toBe('▶ NOW PLAYING');
      expect(cards[0]?.isCurrent).toBe(true);
      expect(cards[0]?.progressPercent).toBe(25);
      expect(cards[0]?.formattedTime).toBe('0:45 / 3:00');
    });

    it('labels subsequent items with #1 NEXT and #2 NEXT badges', () => {
      const cards = buildQueueDisplayItems(mockNowPlaying, mockUpNext, 0, 180);

      expect(cards[1]?.id).toBe('next-1');
      expect(cards[1]?.badgeLabel).toBe('#1 NEXT');
      expect(cards[1]?.isCurrent).toBe(false);

      expect(cards[2]?.id).toBe('next-2');
      expect(cards[2]?.badgeLabel).toBe('#2 NEXT');
      expect(cards[2]?.isCurrent).toBe(false);
    });

    it('falls back gracefully to upcoming tracks when nowPlaying is null', () => {
      const cards = buildQueueDisplayItems(null, mockUpNext, 0, 180);

      expect(cards.length).toBe(2);
      expect(cards[0]?.badgeLabel).toBe('#1 NEXT');
      expect(cards[1]?.badgeLabel).toBe('#2 NEXT');
    });

    it('renders demo-fallback track as NOW PLAYING with progress bar when on air', () => {
      const demoTrack = {
        id: 'demo-fallback',
        title: 'PromptFM Ambient AI Anthem',
        artist: 'PromptFM Core',
        type: 'music',
      };
      const cards = buildQueueDisplayItems(demoTrack, mockUpNext, 30, 180);

      expect(cards.length).toBe(3);
      expect(cards[0]?.id).toBe('demo-fallback');
      expect(cards[0]?.badgeLabel).toBe('▶ NOW PLAYING');
      expect(cards[0]?.isCurrent).toBe(true);
      expect(cards[0]?.progressPercent).toBe(17);
      expect(cards[0]?.formattedTime).toBe('0:30 / 3:00');
    });

    it('filters out duplicates of currently playing track from upNext list', () => {
      const duplicateUpcoming = [
        { id: 'now-1', title: 'Duplicate Current Hit', artist: 'DJ Neon' },
        { id: 'next-1', title: 'Real Next', artist: 'Artist A' },
      ];
      const cards = buildQueueDisplayItems(mockNowPlaying, duplicateUpcoming, 0, 180);
      expect(cards.length).toBe(2);
      expect(cards[0]?.id).toBe('now-1');
      expect(cards[0]?.isCurrent).toBe(true);
      expect(cards[1]?.id).toBe('next-1');
      expect(cards[1]?.isCurrent).toBe(false);
      expect(cards[1]?.badgeLabel).toBe('#1 NEXT');
    });

    it('uses fallback cover art /logo-mark.png when cover_art_url is missing, and preserves custom cover art', () => {
      const trackWithoutCover = { id: 'now-nocover', title: 'Track 1', artist: 'Artist 1' };
      const upcomingWithCover = [
        { id: 'next-withcover', title: 'Track 2', artist: 'Artist 2', cover_art_url: '/custom-cover.jpg' },
        { id: 'next-emptycover', title: 'Track 3', artist: 'Artist 3', cover_art_url: '' },
      ];
      const cards = buildQueueDisplayItems(trackWithoutCover, upcomingWithCover, 0, 180);
      expect(cards[0]?.cover_art_url).toBe('/logo-mark.png');
      expect(cards[1]?.cover_art_url).toBe('/custom-cover.jpg');
      expect(cards[2]?.cover_art_url).toBe('/logo-mark.png');
    });

    it('assigns fallback upnext-index id when upcoming item does not have an id', () => {
      const upcomingWithoutId = [{ title: 'No ID Track', artist: 'Mystery Artist' }];
      const cards = buildQueueDisplayItems(null, upcomingWithoutId, 0, 180);
      expect(cards[0]?.id).toBe('upnext-0');
    });
  });

  describe('Issue #84: Queue State Summary & Empty Upcoming Track Differentiation', () => {
    const mockTrackOnAir = {
      id: 'active-song-1',
      title: 'Current Hit',
      artist: 'Resident AI',
      type: 'music',
      upvotes_count: 42,
    };

    const mockUpcoming = [
      { id: 'upcoming-song-1', title: 'Next In Line', artist: 'Suno Beats', type: 'music' },
      { id: 'upcoming-song-2', title: 'Future Wave', artist: 'Udio Master', type: 'music' },
    ];

    describe('getQueueStateSummary', () => {
      it('correctly identifies empty queue state when neither nowPlaying nor upNext exists', () => {
        const summary = getQueueStateSummary(null, []);
        expect(summary.isEmpty).toBe(true);
        expect(summary.hasNowPlaying).toBe(false);
        expect(summary.hasUpcoming).toBe(false);
        expect(summary.onlyNowPlaying).toBe(false);
        expect(summary.upcomingCount).toBe(0);
        expect(summary.totalCards).toBe(0);
      });

      it('detects "only now playing exists" when upNext is empty but nowPlaying is present', () => {
        const summary = getQueueStateSummary(mockTrackOnAir, []);
        expect(summary.isEmpty).toBe(false);
        expect(summary.hasNowPlaying).toBe(true);
        expect(summary.hasUpcoming).toBe(false);
        expect(summary.onlyNowPlaying).toBe(true);
        expect(summary.upcomingCount).toBe(0);
        expect(summary.totalCards).toBe(1);
      });

      it('detects "only now playing exists" if upNext accidentally only contains the same active track', () => {
        const duplicateUpNext = [{ id: 'active-song-1', title: 'Current Hit', artist: 'Resident AI' }];
        const summary = getQueueStateSummary(mockTrackOnAir, duplicateUpNext);
        expect(summary.hasNowPlaying).toBe(true);
        expect(summary.hasUpcoming).toBe(false);
        expect(summary.onlyNowPlaying).toBe(true);
        expect(summary.upcomingCount).toBe(0);
        expect(summary.totalCards).toBe(1);
      });

      it('detects active upcoming queue when real distinct upcoming tracks exist', () => {
        const summary = getQueueStateSummary(mockTrackOnAir, mockUpcoming);
        expect(summary.isEmpty).toBe(false);
        expect(summary.hasNowPlaying).toBe(true);
        expect(summary.hasUpcoming).toBe(true);
        expect(summary.onlyNowPlaying).toBe(false);
        expect(summary.upcomingCount).toBe(2);
        expect(summary.totalCards).toBe(3);
      });

      it('handles queue with upcoming tracks but null nowPlaying', () => {
        const summary = getQueueStateSummary(null, mockUpcoming);
        expect(summary.isEmpty).toBe(false);
        expect(summary.hasNowPlaying).toBe(false);
        expect(summary.hasUpcoming).toBe(true);
        expect(summary.onlyNowPlaying).toBe(false);
        expect(summary.upcomingCount).toBe(2);
        expect(summary.totalCards).toBe(2);
      });

      it('filters out falsy or nullish entries in upNext list', () => {
        const summary = getQueueStateSummary(mockTrackOnAir, [null as any, undefined as any]);
        expect(summary.hasUpcoming).toBe(false);
        expect(summary.onlyNowPlaying).toBe(true);
        expect(summary.upcomingCount).toBe(0);
      });

      it('handles undefined or null upNext list gracefully', () => {
        const summary = getQueueStateSummary(mockTrackOnAir, null as any);
        expect(summary.hasUpcoming).toBe(false);
        expect(summary.onlyNowPlaying).toBe(true);
        expect(summary.upcomingCount).toBe(0);
        expect(summary.totalCards).toBe(1);
      });

      it('handles nowPlaying object without an id as not having an active track', () => {
        const trackNoId = { title: 'Unknown', artist: 'Unknown' } as any;
        const summary = getQueueStateSummary(trackNoId, []);
        expect(summary.hasNowPlaying).toBe(false);
        expect(summary.onlyNowPlaying).toBe(false);
        expect(summary.isEmpty).toBe(true);
        expect(summary.totalCards).toBe(0);
      });

      it('correctly calculates totalCards when both nowPlaying and upcoming items exist', () => {
        const summary = getQueueStateSummary(mockTrackOnAir, mockUpcoming);
        expect(summary.totalCards).toBe(3);
      });
    });

    describe('getQueueDisplayMode', () => {
      it('returns "empty" when neither on-air nor upcoming tracks are present', () => {
        expect(getQueueDisplayMode(null, [])).toBe('empty');
      });

      it('returns "now-playing-only" when on-air track is present but upcoming queue is empty', () => {
        expect(getQueueDisplayMode(mockTrackOnAir, [])).toBe('now-playing-only');
      });

      it('returns "active-queue" when upcoming tracks are present', () => {
        expect(getQueueDisplayMode(mockTrackOnAir, mockUpcoming)).toBe('active-queue');
        expect(getQueueDisplayMode(null, mockUpcoming)).toBe('active-queue');
      });
    });
  });
});
