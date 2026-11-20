import { describe, it, expect } from 'vitest';
import {
  calculateContrastRatio,
  hexToRgb,
  relativeLuminance,
  meetsWcagAA,
  THEME_TOKENS,
} from '@/lib/theme/contrast';

describe('WCAG 2.1 AA Contrast Engine (Issues #234 - #239)', () => {
  describe('calculateContrastRatio', () => {
    it('computes 21:1 for pure black against pure white', () => {
      const ratio = calculateContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('computes 1:1 for identical colors', () => {
      const ratio = calculateContrastRatio('#18181b', '#18181b');
      expect(ratio).toBeCloseTo(1, 1);
    });

    it('is commutative (order of foreground and background does not matter)', () => {
      expect(calculateContrastRatio('#10b981', '#ffffff')).toBeCloseTo(
        calculateContrastRatio('#ffffff', '#10b981'),
        2
      );
    });
  });

  describe('WCAG AA validation for theme tokens in light mode', () => {
    const lightBg = THEME_TOKENS.light.background; // #fafafa
    const lightCard = THEME_TOKENS.light.card; // #ffffff
    const lightHover = THEME_TOKENS.light.hover; // #e4e4e7

    it('Issue #234: Section card texts meet WCAG AA on light card backgrounds', () => {
      const headingRatio = calculateContrastRatio(THEME_TOKENS.light.textPrimary, lightCard);
      const bodyRatio = calculateContrastRatio(THEME_TOKENS.light.textSecondary, lightCard);

      expect(headingRatio).toBeGreaterThanOrEqual(4.5);
      expect(bodyRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(THEME_TOKENS.light.textPrimary, lightCard)).toBe(true);
      expect(meetsWcagAA(THEME_TOKENS.light.textSecondary, lightCard)).toBe(true);
    });

    it('Issue #235: Dropdown hover state keeps text readable against light hover background', () => {
      const hoverRatio = calculateContrastRatio(THEME_TOKENS.light.textPrimary, lightHover);
      expect(hoverRatio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(THEME_TOKENS.light.textPrimary, lightHover)).toBe(true);
    });

    it('Issue #236: Support Station CTA emerald text meets WCAG AA on light background', () => {
      const buttonBg = THEME_TOKENS.light.buttonEmeraldBg; // #ecfdf5
      const buttonText = THEME_TOKENS.light.buttonEmeraldText; // #065f46
      const ratio = calculateContrastRatio(buttonText, buttonBg);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(buttonText, buttonBg)).toBe(true);
    });

    it('Issue #237: Channels Grid broadcast card meta text meets WCAG AA on light gradient card', () => {
      const metaText = THEME_TOKENS.light.textSecondary; // #3f3f46
      const cardBg = THEME_TOKENS.light.channelCardBg; // #ffffff
      const ratio = calculateContrastRatio(metaText, cardBg);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(metaText, cardBg)).toBe(true);
    });

    it('Issue #238: Up Next active row title meets WCAG AA against emerald active slot', () => {
      const activeSlotBg = THEME_TOKENS.light.activeQueueBg; // #ecfdf5
      const activeTitleText = THEME_TOKENS.light.activeQueueTitle; // #064e3b
      const ratio = calculateContrastRatio(activeTitleText, activeSlotBg);

      expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(activeTitleText, activeSlotBg)).toBe(true);
    });

    it('Issue #239: Pastel status badges meet WCAG AA in light mode', () => {
      const badgePairs = [
        { label: 'emerald', text: THEME_TOKENS.light.badges.emerald.text, bg: THEME_TOKENS.light.badges.emerald.bg },
        { label: 'purple', text: THEME_TOKENS.light.badges.purple.text, bg: THEME_TOKENS.light.badges.purple.bg },
        { label: 'amber', text: THEME_TOKENS.light.badges.amber.text, bg: THEME_TOKENS.light.badges.amber.bg },
        { label: 'blue', text: THEME_TOKENS.light.badges.blue.text, bg: THEME_TOKENS.light.badges.blue.bg },
        { label: 'rose', text: THEME_TOKENS.light.badges.rose.text, bg: THEME_TOKENS.light.badges.rose.bg },
        { label: 'red', text: THEME_TOKENS.light.badges.red.text, bg: THEME_TOKENS.light.badges.red.bg },
        { label: 'teal', text: THEME_TOKENS.light.badges.teal.text, bg: THEME_TOKENS.light.badges.teal.bg },
        { label: 'sky', text: (THEME_TOKENS.light.badges as any).sky.text, bg: (THEME_TOKENS.light.badges as any).sky.bg },
        { label: 'indigo', text: (THEME_TOKENS.light.badges as any).indigo.text, bg: (THEME_TOKENS.light.badges as any).indigo.bg },
        { label: 'violet', text: (THEME_TOKENS.light.badges as any).violet.text, bg: (THEME_TOKENS.light.badges as any).violet.bg },
        { label: 'zinc', text: (THEME_TOKENS.light.badges as any).zinc.text, bg: (THEME_TOKENS.light.badges as any).zinc.bg },
      ];

      for (const badge of badgePairs) {
        const ratio = calculateContrastRatio(badge.text, badge.bg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
        expect(meetsWcagAA(badge.text, badge.bg)).toBe(true);
      }
    });

    it('Issue #271: Community card titles, descriptions, and pill badges meet WCAG AA on light card backgrounds', () => {
      const community = (THEME_TOKENS.light as any).communityCard;
      expect(community).toBeDefined();

      // Discord card
      expect(calculateContrastRatio(community.discord.title, community.discord.bg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(community.discord.description, community.discord.bg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(community.discord.badgeText, community.discord.badgeBg)).toBeGreaterThanOrEqual(4.5);

      // Telegram card
      expect(calculateContrastRatio(community.telegram.title, community.telegram.bg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(community.telegram.description, community.telegram.bg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(community.telegram.badgeText, community.telegram.badgeBg)).toBeGreaterThanOrEqual(4.5);
    });

    it('Issue #271: Prose typography and code snippets meet WCAG AA in light mode', () => {
      const prose = (THEME_TOKENS.light as any).prose;
      expect(prose).toBeDefined();
      expect(calculateContrastRatio(prose.body, lightBg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(prose.heading, lightBg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(prose.codeText, prose.codeBg)).toBeGreaterThanOrEqual(4.5);
    });

    it('Issue #271: Solid action buttons retain high-contrast text in light mode', () => {
      // Indigo action button (Discord CTA): deep saturated purple-blue requires white text (>= 4.5:1)
      const indigoBg = '#4f46e5'; // bg-indigo-600
      const whiteText = '#ffffff';
      expect(calculateContrastRatio(whiteText, indigoBg)).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(whiteText, indigoBg)).toBe(true);

      // Sky action button (Telegram CTA): cyan-sky hue uses text-black to achieve 8:1 contrast
      const skyBg = '#0ea5e9'; // bg-sky-500
      const blackText = '#000000';
      expect(calculateContrastRatio(blackText, skyBg)).toBeGreaterThanOrEqual(7.0);
      expect(meetsWcagAA(blackText, skyBg)).toBe(true);
    });
  });

  describe('WCAG AA validation for theme tokens in dark mode', () => {
    const darkBg = THEME_TOKENS.dark.background; // #09090b
    const darkCard = THEME_TOKENS.dark.card; // #18181b
    const darkMutedCard = '#131316'; // bg-zinc-900/70 on dark bg

    it('Issue #271: Muted secondary text (#a1a1aa) satisfies WCAG AA across all dark surfaces', () => {
      const secondary = THEME_TOKENS.dark.textSecondary; // #a1a1aa
      expect(calculateContrastRatio(secondary, darkBg)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(secondary, darkCard)).toBeGreaterThanOrEqual(4.5);
      expect(calculateContrastRatio(secondary, darkMutedCard)).toBeGreaterThanOrEqual(4.5);
      expect(meetsWcagAA(secondary, darkBg)).toBe(true);
      expect(meetsWcagAA(secondary, darkCard)).toBe(true);
      expect(meetsWcagAA(secondary, darkMutedCard)).toBe(true);
    });

    it('Issue #271: Default unremapped zinc-500 (#71717a) fails WCAG AA on dark surfaces, demonstrating need for remapping', () => {
      const unmappedZinc500 = '#71717a';
      expect(calculateContrastRatio(unmappedZinc500, darkBg)).toBeLessThan(4.5);
      expect(calculateContrastRatio(unmappedZinc500, darkMutedCard)).toBeLessThan(4.5);
    });
  });

  describe('hexToRgb & relativeLuminance edge cases', () => {
    it('parses 3-digit shorthand hex (#fff)', () => {
      const rgb = hexToRgb('#fff');
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses 6-digit hex (#18181b)', () => {
      const rgb = hexToRgb('#18181b');
      expect(rgb).toEqual({ r: 24, g: 24, b: 27 });
    });

    it('clamps invalid hex gracefully to black', () => {
      expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#zzz')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#zzzzzz')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('handles low sRGB component values in relative luminance formula', () => {
      // Color with component <= 0.04045 * 255 (~10)
      const lum = relativeLuminance({ r: 5, g: 5, b: 5 });
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(0.01);
    });
  });

  describe('meetsWcagAA boundary conditions and large text', () => {
    it('differentiates large text from normal text', () => {
      // Test a color pair with contrast ~3.5:1 (passes large text >= 3.0, fails normal text >= 4.5)
      // E.g. #767676 on #ffffff is ~4.54:1, #808080 on #ffffff is ~3.95:1
      const midGrey = '#808080';
      const white = '#ffffff';
      const ratio = calculateContrastRatio(midGrey, white);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      expect(ratio).toBeLessThan(4.5);

      expect(meetsWcagAA(midGrey, white, true)).toBe(true);
      expect(meetsWcagAA(midGrey, white, false)).toBe(false);
      expect(meetsWcagAA(midGrey, white)).toBe(false);
    });

    it('returns false for low contrast pairs', () => {
      expect(meetsWcagAA('#ffffff', '#ffffff')).toBe(false);
      expect(meetsWcagAA('#6ee7b7', '#fafafa')).toBe(false); // pale mint on light bg
    });
  });
});
