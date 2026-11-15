'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  THEME_STORAGE_KEY,
  parseStoredTheme,
  themeToggleLabel,
  toggleColorScheme,
  type ColorScheme,
} from '@/lib/theme/color-scheme';

function readAppliedTheme(): ColorScheme {
  if (typeof document === 'undefined') {
    return 'dark';
  }
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(scheme: ColorScheme) {
  document.documentElement.dataset.theme = scheme;
  document.documentElement.style.colorScheme = scheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, scheme);
  } catch {
    // Ignore storage restrictions
  }
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [scheme, setScheme] = useState<ColorScheme>('dark');

  useEffect(() => {
    const stored = parseStoredTheme(
      (() => {
        try {
          return localStorage.getItem(THEME_STORAGE_KEY);
        } catch {
          return null;
        }
      })()
    );
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const next = stored ?? (prefersLight ? 'light' : 'dark');
    applyTheme(next);
    setScheme(next);
  }, []);

  const label = themeToggleLabel(scheme);

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:text-white hover:bg-zinc-800 ${className}`}
      aria-label={label}
      title={label}
      onClick={() => {
        const next = toggleColorScheme(readAppliedTheme());
        applyTheme(next);
        setScheme(next);
      }}
    >
      {scheme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}
