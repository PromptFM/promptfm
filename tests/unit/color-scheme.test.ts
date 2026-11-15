import { describe, it, expect } from 'vitest';
import {
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveColorScheme,
  toggleColorScheme,
  themeToggleLabel,
} from '@/lib/theme/color-scheme';

describe('Issue #82 color scheme', () => {
  it('stores the listener choice under promptfm_theme', () => {
    expect(THEME_STORAGE_KEY).toBe('promptfm_theme');
  });

  it('treats missing or unknown values as no saved choice', () => {
    expect(parseStoredTheme(null)).toBeNull();
    expect(parseStoredTheme('')).toBeNull();
    expect(parseStoredTheme('system')).toBeNull();
    expect(parseStoredTheme('LIGHT')).toBeNull();
  });

  it('accepts only exact light and dark values', () => {
    expect(parseStoredTheme('light')).toBe('light');
    expect(parseStoredTheme('dark')).toBe('dark');
  });

  it('follows the system preference when nothing is saved', () => {
    expect(resolveColorScheme(null, true)).toBe('light');
    expect(resolveColorScheme(null, false)).toBe('dark');
  });

  it('lets a saved choice beat the system preference', () => {
    expect(resolveColorScheme('dark', true)).toBe('dark');
    expect(resolveColorScheme('light', false)).toBe('light');
  });

  it('toggles between light and dark', () => {
    expect(toggleColorScheme('dark')).toBe('light');
    expect(toggleColorScheme('light')).toBe('dark');
  });

  it('names the theme the control will switch to', () => {
    const toLight = themeToggleLabel('dark');
    const toDark = themeToggleLabel('light');
    expect(toLight.toLowerCase()).toContain('light');
    expect(toDark.toLowerCase()).toContain('dark');
    expect(toLight).not.toBe(toDark);
  });
});
