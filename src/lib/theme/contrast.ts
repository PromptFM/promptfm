export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses a 3-character or 6-character hex string into RGB values.
 * Returns { r: 0, g: 0, b: 0 } for invalid input.
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, '');

  if (clean.length === 3) {
    const c0 = clean.charAt(0);
    const c1 = clean.charAt(1);
    const c2 = clean.charAt(2);
    const r = parseInt(c0 + c0, 16);
    const g = parseInt(c1 + c1, 16);
    const b = parseInt(c2 + c2, 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { r, g, b };
    }
  }

  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { r, g, b };
    }
  }

  return { r: 0, g: 0, b: 0 };
}

/**
 * Calculates relative luminance for an sRGB color per WCAG 2.1 specs.
 */
export function relativeLuminance(rgb: RGB): number {
  const transform = (val: number): number => {
    const c = val / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const r = transform(rgb.r);
  const g = transform(rgb.g);
  const b = transform(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes the WCAG 2.1 contrast ratio between two hex colors.
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = relativeLuminance(hexToRgb(color1));
  const lum2 = relativeLuminance(hexToRgb(color2));

  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Validates whether a foreground / background pair satisfies WCAG 2.1 AA.
 * Standard text: >= 4.5:1. Large text: >= 3.0:1.
 */
export function meetsWcagAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  return ratio >= (isLargeText ? 3.0 : 4.5);
}

/**
 * Central theme tokens ensuring compliance with WCAG 2.1 AA across light and dark modes.
 */
export const THEME_TOKENS = {
  light: {
    background: '#fafafa',
    card: '#ffffff',
    hover: '#e4e4e7',
    textPrimary: '#18181b',
    textSecondary: '#3f3f46',
    buttonEmeraldBg: '#ecfdf5',
    buttonEmeraldText: '#065f46',
    channelCardBg: '#ffffff',
    activeQueueBg: '#ecfdf5',
    activeQueueTitle: '#064e3b',
    communityCard: {
      discord: {
        bg: '#f5f3ff',
        title: '#18181b',
        description: '#3f3f46',
        badgeText: '#4338ca',
        badgeBg: '#e0e7ff',
      },
      telegram: {
        bg: '#f0f9ff',
        title: '#18181b',
        description: '#3f3f46',
        badgeText: '#0369a1',
        badgeBg: '#e0f2fe',
      },
    },
    prose: {
      body: '#27272a',
      heading: '#18181b',
      codeText: '#065f46',
      codeBg: '#ecfdf5',
    },
    badges: {
      emerald: { text: '#065f46', bg: '#ecfdf5' },
      purple: { text: '#6d28d9', bg: '#f5f3ff' },
      amber: { text: '#92400e', bg: '#fffbeb' },
      blue: { text: '#1d4ed8', bg: '#eff6ff' },
      rose: { text: '#be123c', bg: '#fff1f2' },
      red: { text: '#b91c1c', bg: '#fef2f2' },
      teal: { text: '#0f766e', bg: '#f0fdfa' },
      sky: { text: '#0369a1', bg: '#f0f9ff' },
      indigo: { text: '#4338ca', bg: '#eef2ff' },
      violet: { text: '#6d28d9', bg: '#f5f3ff' },
      zinc: { text: '#27272a', bg: '#f4f4f5' },
    },
  },
  dark: {
    background: '#09090b',
    card: '#18181b',
    hover: '#27272a',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    buttonEmeraldBg: '#022c22',
    buttonEmeraldText: '#6ee7b7',
    channelCardBg: '#18181b',
    activeQueueBg: '#022c22',
    activeQueueTitle: '#6ee7b7',
    communityCard: {
      discord: {
        bg: '#1e1b4b',
        title: '#ffffff',
        description: '#a1a1aa',
        badgeText: '#a5b4fc',
        badgeBg: '#312e81',
      },
      telegram: {
        bg: '#082f49',
        title: '#ffffff',
        description: '#a1a1aa',
        badgeText: '#7dd3fc',
        badgeBg: '#0c4a6e',
      },
    },
    prose: {
      body: '#d4d4d8',
      heading: '#ffffff',
      codeText: '#6ee7b7',
      codeBg: '#022c22',
    },
    badges: {
      emerald: { text: '#6ee7b7', bg: '#022c22' },
      purple: { text: '#d8b4fe', bg: '#2e1065' },
      amber: { text: '#fcd34d', bg: '#451a03' },
      blue: { text: '#93c5fd', bg: '#172554' },
      rose: { text: '#fda4af', bg: '#4c0519' },
      red: { text: '#fca5a5', bg: '#450a0a' },
      teal: { text: '#5eead4', bg: '#042f2e' },
      sky: { text: '#7dd3fc', bg: '#082f49' },
      indigo: { text: '#a5b4fc', bg: '#1e1b4b' },
      violet: { text: '#c4b5fd', bg: '#2e1065' },
      zinc: { text: '#e4e4e7', bg: '#27272a' },
    },
  },
} as const;
