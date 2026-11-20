import { describe, it, expect, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveColorScheme,
  toggleColorScheme,
  cycleThemePreference,
  themeToggleLabel,
  applyTheme,
  type ThemePreference,
  type ColorScheme,
} from '@/lib/theme/color-scheme';

describe('Issue #82 & #240 Theme Preferences and Color Scheme Engine', () => {
  it('stores the listener choice under promptfm_theme', () => {
    expect(THEME_STORAGE_KEY).toBe('promptfm_theme');
  });

  describe('parseStoredTheme', () => {
    it('treats missing, empty, or unknown values as no saved choice (null)', () => {
      expect(parseStoredTheme(null)).toBeNull();
      expect(parseStoredTheme('')).toBeNull();
      expect(parseStoredTheme('auto')).toBeNull();
      expect(parseStoredTheme('LIGHT')).toBeNull();
      expect(parseStoredTheme('DARK')).toBeNull();
    });

    it('accepts exact light, dark, and system values', () => {
      expect(parseStoredTheme('light')).toBe('light');
      expect(parseStoredTheme('dark')).toBe('dark');
      expect(parseStoredTheme('system')).toBe('system');
    });
  });

  describe('resolveColorScheme', () => {
    it('resolves system or null preference against the OS preference', () => {
      expect(resolveColorScheme(null, true)).toBe('light');
      expect(resolveColorScheme(null, false)).toBe('dark');
      expect(resolveColorScheme('system', true)).toBe('light');
      expect(resolveColorScheme('system', false)).toBe('dark');
    });

    it('lets explicit light or dark preference override OS preference', () => {
      expect(resolveColorScheme('dark', true)).toBe('dark');
      expect(resolveColorScheme('dark', false)).toBe('dark');
      expect(resolveColorScheme('light', true)).toBe('light');
      expect(resolveColorScheme('light', false)).toBe('light');
    });
  });

  describe('toggleColorScheme (2-way backward compatibility)', () => {
    it('toggles cleanly between light and dark', () => {
      expect(toggleColorScheme('dark')).toBe('light');
      expect(toggleColorScheme('light')).toBe('dark');
    });
  });

  describe('cycleThemePreference (Issue #240 3-way toggle)', () => {
    it('cycles from system -> light -> dark -> system', () => {
      expect(cycleThemePreference('system')).toBe('light');
      expect(cycleThemePreference('light')).toBe('dark');
      expect(cycleThemePreference('dark')).toBe('system');
    });
  });

  describe('themeToggleLabel', () => {
    it('names the upcoming theme for system, light, and dark modes', () => {
      expect(themeToggleLabel('system')).toBe('Switch to light mode');
      expect(themeToggleLabel('light')).toBe('Switch to dark mode');
      expect(themeToggleLabel('dark')).toBe('Switch to system default');
    });
  });

  describe('applyTheme', () => {
    it('applies light and dark themes to document dataset and style and writes to storage', () => {
      const mockDoc = {
        documentElement: {
          dataset: {} as Record<string, string | undefined>,
          style: { colorScheme: '' },
        },
      };
      const mockStorage = {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: () => null,
        length: 0,
      };

      const applied = applyTheme('light', 'light', mockDoc, mockStorage);
      expect(applied).toBe('light');
      expect(mockDoc.documentElement.dataset.theme).toBe('light');
      expect(mockDoc.documentElement.dataset.themePreference).toBe('light');
      expect(mockDoc.documentElement.style.colorScheme).toBe('light');
      expect(mockStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
    });

    it('handles system preference and resolves scheme', () => {
      const mockDoc = {
        documentElement: {
          dataset: {} as Record<string, string | undefined>,
          style: { colorScheme: '' },
        },
      };
      const mockStorage = {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: () => null,
        length: 0,
      };

      const applied = applyTheme('system', 'dark', mockDoc, mockStorage);
      expect(applied).toBe('dark');
      expect(mockDoc.documentElement.dataset.theme).toBe('dark');
      expect(mockDoc.documentElement.dataset.themePreference).toBe('system');
      expect(mockDoc.documentElement.style.colorScheme).toBe('dark');
      expect(mockStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'system');
    });

    it('resolves color scheme automatically when resolved parameter is omitted', () => {
      const mockDoc = {
        documentElement: {
          dataset: {} as Record<string, string | undefined>,
          style: { colorScheme: '' },
        },
      };

      expect(applyTheme('light', undefined, mockDoc, null)).toBe('light');
      expect(mockDoc.documentElement.dataset.theme).toBe('light');

      expect(applyTheme('dark', undefined, mockDoc, null)).toBe('dark');
      expect(mockDoc.documentElement.dataset.theme).toBe('dark');

      // Test preference system with simulated matchMedia
      const originalWindow = globalThis.window;
      try {
        (globalThis as any).window = {
          matchMedia: vi.fn().mockImplementation((query: string) => ({
            matches: query.includes('light'),
          })),
        };
        expect(applyTheme('system', undefined, mockDoc, null)).toBe('light');
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });

    it('prefers explicit resolved parameter over preference-derived fallback', () => {
      const mockDoc = {
        documentElement: {
          dataset: {} as Record<string, string | undefined>,
          style: { colorScheme: '' },
        },
      };
      // If mutant changes ?? to &&, 'dark' && 'light' would evaluate differently or break
      expect(applyTheme('dark', 'light', mockDoc, null)).toBe('light');
      expect(mockDoc.documentElement.dataset.theme).toBe('light');
    });

    it('handles storage errors without throwing', () => {
      const mockDoc = {
        documentElement: {
          dataset: {} as Record<string, string | undefined>,
          style: { colorScheme: '' },
        },
      };
      const mockFailingStorage = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => null,
        clear: () => null,
        key: () => null,
        length: 0,
      };

      expect(() => {
        applyTheme('dark', 'dark', mockDoc, mockFailingStorage);
      }).not.toThrow();
      expect(mockDoc.documentElement.dataset.theme).toBe('dark');
    });

    it('safely handles null doc and null storage', () => {
      expect(applyTheme('light', 'light', null, null)).toBe('light');
      expect(applyTheme('dark', 'dark', null, null)).toBe('dark');
    });

    it('handles missing window gracefully when resolving system preference', () => {
      const originalWindow = globalThis.window;
      try {
        delete (globalThis as any).window;
        expect(applyTheme('system', undefined, null, null)).toBe('dark');
      } finally {
        (globalThis as any).window = originalWindow;
      }
    });
  });
});
