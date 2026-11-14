// src/lib/radio/mobile-layout.ts
// Responsive layout helpers, safe-area calculations, and popover positioning for mobile iPhone screens.

import { formatAudioTime } from './progress';

/**
 * Breakpoint threshold for compact iPhone viewports (e.g. iPhone SE / mini).
 */
export const SMALL_SCREEN_BREAKPOINT = 380;

/**
 * Checks whether a given viewport width falls below the compact mobile threshold.
 */
export function isSmallScreenViewport(width: number): boolean {
  return width < SMALL_SCREEN_BREAKPOINT;
}

/**
 * Formats elapsed and duration seconds into a clean, compact audio timestamp.
 * Defaults duration to 180 seconds if invalid or 0.
 */
export function formatMobilePlayerTime(
  elapsedSeconds: number,
  durationSeconds: number
): string {
  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 180;
  return `${formatAudioTime(elapsedSeconds)} / ${formatAudioTime(safeDuration)}`;
}

/**
 * Popover types supported by the audio player.
 */
export type PlayerPopoverType = 'channels' | 'upNext' | 'transcript';

/**
 * Computes responsive Tailwind layout classes for player popover modals.
 * Prevents full-width overflow on small iPhone screens by enforcing symmetrical
 * `left-2 right-2` margins on mobile with max-height constraints, while retaining
 * anchored responsive widths on tablet and desktop.
 */
export function getPopoverPositionClasses(popoverType: PlayerPopoverType): string {
  const commonMobile =
    'absolute bottom-full mb-2 left-2 right-2 max-h-[min(75vh,520px)] flex flex-col min-h-0 z-50 animate-in fade-in slide-in-from-bottom-2';

  switch (popoverType) {
    case 'channels':
      return `${commonMobile} sm:left-6 sm:right-auto sm:w-80`;
    case 'upNext':
      return `${commonMobile} sm:left-auto sm:right-6 sm:w-96`;
    case 'transcript':
      return 'absolute bottom-full mb-2 left-2 right-2 max-h-[60vh] flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 sm:left-6 sm:right-auto sm:max-w-md';
    default:
      return `${commonMobile} sm:w-80`;
  }
}

/**
 * Responsive classes for home page action buttons.
 * Avoids stacking 5 tall vertical buttons on mobile by rendering a prominent
 * primary CTA followed by a tidy 2x2 grid on small screens, converting to
 * a unified row on desktop.
 */
export function getMobileHeroGridClasses() {
  return {
    container: 'flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full max-w-sm sm:max-w-none justify-center pt-2',
    primaryButton: 'flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-3 rounded-xl transition-colors text-sm sm:text-base shadow-lg shadow-emerald-500/20 w-full sm:w-auto',
    secondaryGrid: 'grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto',
    secondaryButton: 'flex items-center justify-center gap-1.5 sm:gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl transition-colors text-xs sm:text-base',
  };
}

/**
 * Safe-area bottom padding class for bottom-pinned mobile elements.
 * Incorporates `env(safe-area-inset-bottom)` to lift audio player controls
 * above the iOS home indicator bar on modern iPhones.
 */
export function getBottomPlayerSafeAreaClass(): string {
  return 'pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]';
}

/**
 * Scrollable body region for the mobile Up Next bottom sheet (Issue #220).
 */
export function getUpNextPopoverScrollClasses(): string {
  return 'flex-1 min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] space-y-1.5 pr-0.5 pb-[env(safe-area-inset-bottom,0px)]';
}
