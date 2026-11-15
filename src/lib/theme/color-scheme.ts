export const THEME_STORAGE_KEY = 'promptfm_theme';

export type ColorScheme = 'light' | 'dark';

export function parseStoredTheme(value: string | null): ColorScheme | null {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return null;
}

export function resolveColorScheme(stored: ColorScheme | null, prefersLight: boolean): ColorScheme {
  if (stored) {
    return stored;
  }
  return prefersLight ? 'light' : 'dark';
}

export function toggleColorScheme(current: ColorScheme): ColorScheme {
  return current === 'dark' ? 'light' : 'dark';
}

export function themeToggleLabel(current: ColorScheme): string {
  return current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}
