'use client';

import React, { useState, useEffect } from 'react';
import { Panel, SunIcon, MoonIcon, CheckIcon } from '@vaeloom/ui-kit';

export function ThemePreferences() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('dark')) {
        setTheme('dark');
      } else if (document.documentElement.classList.contains('light')) {
        setTheme('light');
      }
    }
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (newTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light', 'dark');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    }
  };

  const THEMES: Array<{
    id: 'light' | 'dark' | 'system';
    label: string;
    desc: string;
    icon: React.FC<{ size?: number | string; className?: string }>;
  }> = [
    {
      id: 'light',
      label: 'Light Mode',
      desc: 'Clean, high-contrast daytime palette',
      icon: SunIcon,
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      desc: 'Subtle slate tones for low-light environments',
      icon: MoonIcon,
    },
    {
      id: 'system',
      label: 'System Sync',
      desc: 'Matches your operating system preference',
      icon: ({ size, className }) => (
        <svg
          width={size || 20}
          height={size || 20}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className={className}
        >
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <Panel
      padding="lg"
      header={
        <div>
          <h2 className="text-base font-semibold text-text">Appearance & Visual Theme</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Customize the visual presentation of the Vaeloom workspace across all devices.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-3">
            Interface Theme
          </label>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            role="radiogroup"
            aria-label="Theme selection"
          >
            {THEMES.map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleThemeChange(t.id)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                      : 'border-border bg-surface hover:bg-surface-hover hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}
                    >
                      <Icon size={18} />
                    </div>
                    {isSelected && (
                      <span className="text-primary">
                        <CheckIcon size={16} />
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text">{t.label}</h3>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-3">
            Brand Accent Palette
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-blue-500 ring-2 ring-offset-2 ring-offset-background ring-blue-500 shadow-xs"
              title="Blue (Default)"
            />
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-emerald-500 hover:opacity-85 transition-opacity"
              title="Emerald"
            />
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-indigo-500 hover:opacity-85 transition-opacity"
              title="Indigo"
            />
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-rose-500 hover:opacity-85 transition-opacity"
              title="Rose"
            />
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-amber-500 hover:opacity-85 transition-opacity"
              title="Amber"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
