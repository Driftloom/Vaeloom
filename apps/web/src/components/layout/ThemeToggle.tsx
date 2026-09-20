'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SunIcon, MoonIcon } from '@vaeloom/ui-kit';

/**
 * Hydration-safe theme toggle.
 *
 * The resolved theme is only known after mount (localStorage / OS
 * preference). Rendering theme-dependent markup on the server caused a
 * hydration mismatch when the client resolved the opposite theme. We now
 * render a stable neutral button pre-mount (same footprint — no layout
 * shift) and swap the icon/label immediately after hydration.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  // `dark` is the brand default and matches SSR output.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effective: 'dark' | 'light' = mounted ? theme : 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-md text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
      aria-label={`Switch to ${effective === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${effective === 'dark' ? 'light' : 'dark'} mode`}
    >
      {effective === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );
}
