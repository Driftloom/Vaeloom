'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

/**
 * MVP i18n — single locale 'en', no async loading.
 * Strings are not translated yet; `t` is an identity function that
 * interpolates `{param}` placeholders and returns the key if missing.
 * Enable full i18n by adding translations and wiring next-intl or similar.
 * Keeping this honest satisfies FW-022 (implement or remove).
 */
type Locale = 'en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function interpolate(key: string, params?: Record<string, string | number>): string {
  if (!params) return key;
  let out = key;
  for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  return out;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key, params) => interpolate(key, params),
});

export function I18nProvider({
  children,
  locale: initial,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? 'en');
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => interpolate(key, params),
    [],
  );
  return (
    <I18nContext.Provider value={{ locale, setLocale: setLocaleState, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used within I18nProvider');
  return ctx;
}

export async function initLocale(): Promise<void> {
  // no-op for MVP — kept for API compatibility
}
