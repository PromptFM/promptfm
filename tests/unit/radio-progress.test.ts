// tests/unit/radio-progress.test.ts
// Unit tests for radio track progress, elapsed time calculations, and queue card labeling

import { describe, it, expect } from 'vitest';
import {
  formatAudioTime,
  calculateTrackProgress,
  buildQueueDisplayItems,
  getPlaybackProgressAria,
  formatMobilePlaybackTime,
} from '@/lib/radio/progress';

describe('Radio Playback Progress & Queue Card Labeling', () => {
  describe('formatAudioTime', () => {
    it('formats seconds into mm:ss format correctly', () => {
      expect(formatAudioTime(0)).toBe('0:00');
      expect(formatAudioTime(9)).toBe('0:09');
      expect(formatAudioTime(10)).toBe('0:10');
      expect(formatAudioTime(45)).toBe('0:45');
      expect(formatAudioTime(60)).toBe('1:00');
      expect(formatAudioTime(65)).toBe('1:05');
      expect(formatAudioTime(70)).toBe('1:10');
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

    it('caps percentage at 100% when elapsed exceeds or equals duration and marks isComplete', () => {
      const exactProg = calculateTrackProgress(180, 180);
      expect(exactProg.percent).toBe(100);
      expect(exactProg.isComplete).toBe(true);
      expect(exactProg.remainingSeconds).toBe(0);

      const prog = calculateTrackProgress(200, 180);
      expect(prog.percent).toBe(100);
      expect(prog.isComplete).toBe(true);
      expect(prog.remainingSeconds).toBe(0);
    });

    it('uses fallback duration of 180s when duration is 0, negative, or missing', () => {
      const prog1 = calculateTrackProgress(60, 0);
      expect(prog1.formattedDuration).toBe('3:00');
      expect(prog1.percent).toBe(33);

      const prog2 = calculateTrackProgress(60, -50);
      expect(prog2.formattedDuration).toBe('3:00');
      expect(prog2.percent).toBe(33);

      const prog3 = calculateTrackProgress(60, null);
      expect(prog3.formattedDuration).toBe('3:00');
      expect(prog3.percent).toBe(33);
    });

    it('handles negative elapsed seconds by clamping to zero', () => {
      const prog = calculateTrackProgress(-15, 120);
      expect(prog.percent).toBe(0);
      expect(prog.formattedElapsed).toBe('0:00');
      expect(prog.formattedDuration).toBe('2:00');
      expect(prog.remainingSeconds).toBe(120);
    });
  });

  describe('getPlaybackProgressAria (Accessibility)', () => {
    it('returns complete ARIA progressbar attributes with correct boundaries and text', () => {
      const aria = getPlaybackProgressAria(45, 180);
      expect(aria.role).toBe('progressbar');
      expect(aria['aria-label']).toBe('Playback progress');
      expect(aria['aria-valuenow']).toBe(25);
      expect(aria['aria-valuemin']).toBe(0);
      expect(aria['aria-valuemax']).toBe(100);
      expect(aria['aria-valuetext']).toBe('0:45 of 3:00');
    });

    it('allows custom aria label override', () => {
      const aria = getPlaybackProgressAria(30, 120, 'Cyberpunk stream progress');
      expect(aria['aria-label']).toBe('Cyberpunk stream progress');
      expect(aria['aria-valuenow']).toBe(25);
      expect(aria['aria-valuetext']).toBe('0:30 of 2:00');
    });
  });

  describe('formatMobilePlaybackTime (Issue #87)', () => {
    it('generates mobile-friendly elapsed, duration, aria-label, and percentages', () => {
      const info = formatMobilePlaybackTime(75, 150);
      expect(info.elapsed).toBe('1:15');
      expect(info.duration).toBe('2:30');
      expect(info.display).toBe('1:15 / 2:30');
      expect(info.ariaLabel).toBe('Playback time: 1:15 of 2:30');
      expect(info.percent).toBe(50);
      expect(info.remainingSeconds).toBe(75);
    });

    it('handles fallback duration and edge elapsed values', () => {
      const info = formatMobilePlaybackTime(0, null);
      expect(info.elapsed).toBe('0:00');
      expect(info.duration).toBe('3:00');
      expect(info.display).toBe('0:00 / 3:00');
      expect(info.ariaLabel).toBe('Playback time: 0:00 of 3:00');
      expect(info.percent).toBe(0);
      expect(info.remainingSeconds).toBe(180);
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

    it('falls back to default logo when cover_art_url is undefined or empty', () => {
      const trackNoCover = {
        id: 'track-no-cover',
        title: 'No Cover',
        artist: 'Unknown',
      };
      const upNextNoCover = [
        { title: 'Upcoming No Cover', artist: 'Upcoming Artist' },
      ];
      const cards = buildQueueDisplayItems(trackNoCover, upNextNoCover, 0, 180);

      expect(cards[0]?.cover_art_url).toBe('/logo-mark.png');
      expect(cards[1]?.cover_art_url).toBe('/logo-mark.png');
      expect(cards[1]?.id).toBe('upnext-0');
    });

    it('filters out duplicates of currently playing track from upNext list', () => {
      const duplicateList = [
        { id: 'now-1', title: 'Current Hit', artist: 'DJ Neon' },
        { id: 'unique-next', title: 'Unique Next', artist: 'Artist B' },
      ];
      const cards = buildQueueDisplayItems(mockNowPlaying, duplicateList, 10, 180);

      expect(cards.length).toBe(2);
      expect(cards[0]?.id).toBe('now-1');
      expect(cards[1]?.id).toBe('unique-next');
    });

    it('uses duration_hint_seconds from nowPlaying when durationSeconds is omitted or 0', () => {
      const hintTrack = {
        id: 'hint-1',
        title: 'Hint Track',
        artist: 'Hint Artist',
        duration_hint_seconds: 240,
      };
      const cards = buildQueueDisplayItems(hintTrack, [], 60, 0);
      expect(cards[0]?.formattedTime).toBe('1:00 / 4:00');
      expect(cards[0]?.progressPercent).toBe(25);
    });

    it('uses default elapsedSeconds and durationSeconds when omitted in buildQueueDisplayItems', () => {
      const cards = buildQueueDisplayItems(mockNowPlaying, []);
      expect(cards[0]?.progressPercent).toBe(0);
      expect(cards[0]?.formattedTime).toBe('0:00 / 3:00');
    });
  });
});
