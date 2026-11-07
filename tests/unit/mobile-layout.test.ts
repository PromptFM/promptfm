// tests/unit/mobile-layout.test.ts
// Unit tests for mobile iPhone layout helpers, safe-area calculations, and responsive popover positioning

import { describe, it, expect } from 'vitest';
import {
  formatMobilePlayerTime,
  getPopoverPositionClasses,
  getMobileHeroGridClasses,
  getBottomPlayerSafeAreaClass,
  isSmallScreenViewport,
} from '@/lib/radio/mobile-layout';

describe('Mobile iPhone Layout Helpers & Safe Area Handling', () => {
  describe('formatMobilePlayerTime', () => {
    it('formats elapsed and duration seconds into compact mobile audio timestamp', () => {
      expect(formatMobilePlayerTime(0, 180)).toBe('0:00 / 3:00');
      expect(formatMobilePlayerTime(75, 210)).toBe('1:15 / 3:30');
      expect(formatMobilePlayerTime(125, 125)).toBe('2:05 / 2:05');
    });

    it('handles zero or missing duration by defaulting duration gracefully', () => {
      expect(formatMobilePlayerTime(45, 0)).toBe('0:45 / 3:00');
      expect(formatMobilePlayerTime(30, NaN)).toBe('0:30 / 3:00');
      expect(formatMobilePlayerTime(30, -50)).toBe('0:30 / 3:00');
    });

    it('handles negative or invalid elapsed seconds gracefully', () => {
      expect(formatMobilePlayerTime(-15, 180)).toBe('0:00 / 3:00');
      expect(formatMobilePlayerTime(NaN, 180)).toBe('0:00 / 3:00');
    });
  });

  describe('getPopoverPositionClasses', () => {
    it('returns symmetrical full-width centered mobile classes with left/right padding for channel popover', () => {
      const classes = getPopoverPositionClasses('channels');
      expect(classes).toContain('left-2');
      expect(classes).toContain('right-2');
      expect(classes).toContain('sm:left-6');
      expect(classes).toContain('sm:right-auto');
      expect(classes).toContain('sm:w-80');
      expect(classes).toContain('max-h-[75vh]');
    });

    it('returns symmetrical full-width centered mobile classes with right-anchored desktop classes for upNext popover', () => {
      const classes = getPopoverPositionClasses('upNext');
      expect(classes).toContain('left-2');
      expect(classes).toContain('right-2');
      expect(classes).toContain('sm:left-auto');
      expect(classes).toContain('sm:right-6');
      expect(classes).toContain('sm:w-96');
      expect(classes).toContain('max-h-[75vh]');
    });

    it('returns symmetrical full-width centered mobile classes with max-w-md desktop classes for transcript popover', () => {
      const classes = getPopoverPositionClasses('transcript');
      expect(classes).toContain('left-2');
      expect(classes).toContain('right-2');
      expect(classes).toContain('sm:left-6');
      expect(classes).toContain('sm:right-auto');
      expect(classes).toContain('sm:max-w-md');
      expect(classes).toContain('max-h-[60vh]');
    });

    it('falls back to default mobile popover classes for unspecified popover type', () => {
      const classes = getPopoverPositionClasses('unknown' as any);
      expect(classes).toContain('left-2');
      expect(classes).toContain('right-2');
      expect(classes).toContain('sm:w-80');
    });
  });

  describe('getMobileHeroGridClasses', () => {
    it('returns mobile 2-column grid and desktop row layout classes', () => {
      const ctaClasses = getMobileHeroGridClasses();
      expect(ctaClasses.container).toContain('flex flex-col sm:flex-row');
      expect(ctaClasses.secondaryGrid).toContain('grid grid-cols-2 sm:flex sm:flex-row');
      expect(ctaClasses.primaryButton).toContain('w-full sm:w-auto');
      expect(ctaClasses.secondaryButton).toContain('px-3 py-2.5 sm:px-5 sm:py-3');
    });
  });

  describe('getBottomPlayerSafeAreaClass', () => {
    it('returns safe area padding class for iOS home indicator avoidance', () => {
      const safeClass = getBottomPlayerSafeAreaClass();
      expect(safeClass).toContain('pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]');
    });
  });

  describe('isSmallScreenViewport', () => {
    it('identifies iPhone SE width (< 380px) correctly', () => {
      expect(isSmallScreenViewport(375)).toBe(true);
      expect(isSmallScreenViewport(320)).toBe(true);
      expect(isSmallScreenViewport(379)).toBe(true);
      expect(isSmallScreenViewport(379.9)).toBe(true);
    });

    it('identifies standard iPhone and desktop viewports (>= 380px) correctly', () => {
      expect(isSmallScreenViewport(380)).toBe(false);
      expect(isSmallScreenViewport(380.1)).toBe(false);
      expect(isSmallScreenViewport(390)).toBe(false);
      expect(isSmallScreenViewport(428)).toBe(false);
      expect(isSmallScreenViewport(768)).toBe(false);
      expect(isSmallScreenViewport(1280)).toBe(false);
    });
  });
});
