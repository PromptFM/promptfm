'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import {
  THEME_STORAGE_KEY,
  parseStoredTheme,
  resolveColorScheme,
  cycleThemePreference,
  themeToggleLabel,
  applyTheme,
  type ColorScheme,
  type ThemePreference,
} from '@/lib/theme/color-scheme';

export { applyTheme };

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolvedScheme, setResolvedScheme] = useState<ColorScheme>('dark');

  useEffect(() => {
    let stored: ThemePreference | null = null;
    try {
      stored = parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      stored = null;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const initialPref: ThemePreference = stored ?? 'system';
    const initialResolved = resolveColorScheme(initialPref, mediaQuery.matches);

    applyTheme(initialPref, initialResolved);
    setPreference(initialPref);
    setResolvedScheme(initialResolved);

    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        document.documentElement.dataset.themeReady = 'true';
      });
    }

    const handleSystemChange = (e: MediaQueryListEvent) => {
      let currentStored: ThemePreference | null = null;
      try {
        currentStored = parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY));
      } catch {
        currentStored = null;
      }

      if (!currentStored || currentStored === 'system') {
        const nextResolved: ColorScheme = e.matches ? 'light' : 'dark';
        applyTheme('system', nextResolved);
        setPreference('system');
        setResolvedScheme(nextResolved);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const label = themeToggleLabel(preference);

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors ${className}`}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = cycleThemePreference(preference);
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        const resolved = resolveColorScheme(next, prefersLight);
        applyTheme(next, resolved);
        setPreference(next);
        setResolvedScheme(resolved);
      }}
    >
      {preference === 'system' ? (
        <Monitor className="w-4 h-4" aria-hidden="true" />
      ) : preference === 'light' ? (
        <Sun className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  );
}
