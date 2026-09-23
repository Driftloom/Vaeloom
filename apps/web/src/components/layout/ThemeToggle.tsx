'use client';

import React, { useEffect, useState } from 'react';
import { useTheme, type Theme } from '../../hooks/useTheme';
import { SunIcon, MoonIcon } from '@vaeloom/ui-kit';

/**
 * Hydration-safe theme toggle.
 *
 * The resolved theme is only known after mount (localStorage / OS
 * preference). Rendering theme-dependent markup on the server caused a
 * hydration mismatch when the client resolved the opposite theme. We now
 * render a stable neutral button pre-mount (same footprint — no layout
 * shift) and swap the icon/label immediately after hydration.
 * Supports dark, light, and high-contrast modes.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  // `dark` is the brand default and matches SSR output.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effective: Theme = mounted ? theme : 'dark';

  const nextThemeTitle =
    effective === 'dark'
      ? 'Switch to light mode'
      : effective === 'light'
        ? 'Switch to high-contrast mode'
        : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      aria-label={nextThemeTitle}
      title={nextThemeTitle}
    >
      {effective === 'light' ? (
        <MoonIcon size={16} />
      ) : effective === 'high-contrast' ? (
        <svg
          className="w-4 h-4 text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" />
          <path d="M12 3a9 9 0 0 0 0 18v-18z" fill="currentColor" />
        </svg>
      ) : (
        <SunIcon size={16} />
      )}
    </button>
  );
}
