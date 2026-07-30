'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';

type PrefetchMap = Record<string, () => Promise<void>>;

interface PrefetchContextValue {
  register: (key: string, preloader: () => Promise<void>) => void;
  prefetched: Set<string>;
}

const PrefetchContext = createContext<PrefetchContextValue>({
  register: () => {},
  prefetched: new Set(),
});

export function PrefetchProvider({ children }: { children: React.ReactNode }) {
  const prefetchedRef = useRef<Set<string>>(new Set());
  const handlersRef = useRef<PrefetchMap>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idleCallback = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: IdleRequestCallback) => setTimeout(cb, 200);

    const idleId = idleCallback(() => {
      for (const [key, preloader] of Object.entries(handlersRef.current)) {
        if (!prefetchedRef.current.has(key)) {
          prefetchedRef.current.add(key);
          void preloader();
        }
      }
    }, { timeout: 2000 });

    return () => {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(idleId as unknown as number);
      } else {
        clearTimeout(idleId as unknown as number);
      }
    };
  }, []);

  const register = useCallback((key: string, preloader: () => Promise<void>) => {
    handlersRef.current[key] = preloader;
  }, []);

  return (
    <PrefetchContext.Provider value={{ register, prefetched: prefetchedRef.current }}>
      {children}
    </PrefetchContext.Provider>
  );
}

export function usePrefetch() {
  const ctx = useContext(PrefetchContext);
  const prefetchRoute = useCallback(
    (path: string) => {
      ctx.register(path, () => import(/* webpackPrefetch: true */ `../app${path}/page`).then(() => {}));
    },
    [ctx],
  );
  return { prefetchRoute };
}

export function prefetchWorkspaceRoutes(workspaceId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const routes = [
    'dashboard',
    'memory',
    'chat',
    'files',
    'settings',
    'resume',
    'jobs',
    'applications',
    'schedule',
    'connectors',
  ];
  for (const route of routes) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/workspace/${workspaceId}/${route}`;
    link.as = 'document';
    document.head.appendChild(link);
  }
}
