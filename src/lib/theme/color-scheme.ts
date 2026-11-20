export const THEME_STORAGE_KEY = 'promptfm_theme';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

export function parseStoredTheme(value: string | null): ThemePreference | null {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return null;
}

export function resolveColorScheme(
  stored: ThemePreference | null,
  prefersLight: boolean
): ColorScheme {
  if (stored === 'light') {
    return 'light';
  }
  if (stored === 'dark') {
    return 'dark';
  }
  return prefersLight ? 'light' : 'dark';
}

export function toggleColorScheme(current: ColorScheme): ColorScheme {
  return current === 'dark' ? 'light' : 'dark';
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'system') {
    return 'light';
  }
  if (current === 'light') {
    return 'dark';
  }
  return 'system';
}

export function themeToggleLabel(current: ThemePreference): string {
  if (current === 'system') {
    return 'Switch to light mode';
  }
  if (current === 'light') {
    return 'Switch to dark mode';
  }
  return 'Switch to system default';
}

export function applyTheme(
  preference: ThemePreference | ColorScheme,
  resolved?: ColorScheme,
  doc?: {
    documentElement: {
      dataset: Record<string, string | undefined>;
      style: { colorScheme: string };
    };
  } | null,
  storage?: Storage | null
): ColorScheme {
  const targetDoc = doc !== undefined ? doc : typeof document !== 'undefined' ? document : null;
  const targetStorage = storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;

  const scheme: ColorScheme =
    resolved ??
    (preference === 'light'
      ? 'light'
      : preference === 'dark'
        ? 'dark'
        : typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-color-scheme: light)')?.matches
          ? 'light'
          : 'dark');

  if (targetDoc) {
    targetDoc.documentElement.dataset.theme = scheme;
    targetDoc.documentElement.dataset.themePreference = preference;
    targetDoc.documentElement.style.colorScheme = scheme;
  }

  if (targetStorage) {
    try {
      targetStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage restrictions
    }
  }

  return scheme;
}

