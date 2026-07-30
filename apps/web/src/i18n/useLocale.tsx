'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

type Locale = 'en';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const messages: Record<string, Record<string, unknown>> = {};

async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  if (messages[locale]) return messages[locale];
  const mod = (await import(`./translations/${locale}.json`)) as { default: Record<string, unknown> };
  messages[locale] = mod.default;
  return mod.default;
}

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  let result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[k] = value;
    } else if (value && typeof value === 'object') {
      result = { ...result, ...flatten(value as Record<string, unknown>, k) };
    }
  }
  return result;
}

let flatMessages: Record<string, string> = {};

export async function initLocale(locale: Locale): Promise<void> {
  const msgs = await loadMessages(locale);
  flatMessages = flatten(msgs);
}

function lookup(key: string, params?: Record<string, string | number>): string {
  let msg = flatMessages[key];
  if (!msg) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, String(v));
    }
  }
  return msg;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children, locale: initial }: { children: React.ReactNode; locale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial ?? 'en');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    initLocale(locale).then(() => setReady(true));
  }, [locale]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => lookup(key, params), []);

  if (!ready) {
    return <>{children}</>;
  }

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
