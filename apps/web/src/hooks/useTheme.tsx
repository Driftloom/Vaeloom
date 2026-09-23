'use client';

/**
 * Vaeloom theming (Phase 02A / Wave 03).
 *
 * ONE theme system, TWO first-class themes. The resolved theme is applied as
 * a `dark`/`light` class on <html>; all colors flow from the semantic CSS
 * variables in globals.css, so components never branch on theme.
 *
 * Resolution order: explicit user choice (localStorage 'theme') > OS
 * preference > dark (brand default). A blocking inline script in the root
 * layout applies the stored choice before first paint to avoid FOUC.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const STORAGE_KEY = 'theme';

function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'high-contrast') return stored;
    } catch {
      // storage unavailable — fall through to media query
    }
    if (window.matchMedia('(prefers-contrast: more)').matches) return 'high-contrast';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'high-contrast');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
  }
}

const THEME_BG: Record<Theme, string> = {
  dark: '#000000',
  light: '#F7F8FC',
  'high-contrast': '#000000',
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer keeps SSR markup stable (server renders 'dark' default;
  // the pre-paint script reconciles before hydration paint).
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_BG[theme];
  }, [theme]);

  // Follow OS changes only while the user has not made an explicit choice.
  useEffect(() => {
    const mqLight = window.matchMedia('(prefers-color-scheme: light)');
    const mqContrast = window.matchMedia('(prefers-contrast: more)');
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === 'light' || stored === 'dark' || stored === 'high-contrast') return;

    const onChange = (): void => {
      if (mqContrast.matches) {
        setThemeState('high-contrast');
      } else {
        setThemeState(mqLight.matches ? 'light' : 'dark');
      }
    };
    mqLight.addEventListener('change', onChange);
    mqContrast.addEventListener('change', onChange);
    return () => {
      mqLight.removeEventListener('change', onChange);
      mqContrast.removeEventListener('change', onChange);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore persistence failures (private mode)
    }
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : prev === 'light' ? 'high-contrast' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
