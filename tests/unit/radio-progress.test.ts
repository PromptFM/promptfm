// tests/unit/radio-progress.test.ts
// Unit tests for radio track progress, elapsed time calculations, and queue card labeling

import { describe, it, expect } from 'vitest';
import {
  formatAudioTime,
  calculateTrackProgress,
  buildQueueDisplayItems,
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
    });

    it('caps percentage at 100% when elapsed exceeds duration and marks isComplete', () => {
      const prog = calculateTrackProgress(200, 180);
      expect(prog.percent).toBe(100);
      expect(prog.isComplete).toBe(true);
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
  });
});
