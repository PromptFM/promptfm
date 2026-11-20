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
    badges: {
      emerald: { text: '#065f46', bg: '#ecfdf5' },
      purple: { text: '#6d28d9', bg: '#f5f3ff' },
      amber: { text: '#92400e', bg: '#fffbeb' },
      blue: { text: '#1d4ed8', bg: '#eff6ff' },
      rose: { text: '#be123c', bg: '#fff1f2' },
      red: { text: '#b91c1c', bg: '#fef2f2' },
      teal: { text: '#0f766e', bg: '#f0fdfa' },
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
    badges: {
      emerald: { text: '#6ee7b7', bg: '#022c22' },
      purple: { text: '#d8b4fe', bg: '#2e1065' },
      amber: { text: '#fcd34d', bg: '#451a03' },
      blue: { text: '#93c5fd', bg: '#172554' },
      rose: { text: '#fda4af', bg: '#4c0519' },
      red: { text: '#fca5a5', bg: '#450a0a' },
      teal: { text: '#5eead4', bg: '#042f2e' },
    },
  },
} as const;
