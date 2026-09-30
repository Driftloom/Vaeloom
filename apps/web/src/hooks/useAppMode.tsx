'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PORTAL_MODES, type AppPortalMode, type PortalModeConfig } from '@/lib/route-manifest';

export interface AppModeContextValue {
  mode: AppPortalMode;
  setMode: (mode: AppPortalMode, shouldNavigate?: boolean) => void;
  cycleMode: () => void;
  availableModes: readonly AppPortalMode[];
  currentModeMeta: PortalModeConfig;
}

const STORAGE_KEY = 'vaeloom.app.portalMode';
const VALID_MODES: readonly AppPortalMode[] = ['workspace', 'admin', 'developer'] as const;

function isValidMode(val: unknown): val is AppPortalMode {
  return typeof val === 'string' && VALID_MODES.includes(val as AppPortalMode);
}

const ADMIN_ROUTE_PREFIXES = ['admin', 'organizations', 'billing', 'feature-flags'];

const DEVELOPER_ROUTE_PREFIXES = ['developer', 'cognition', 'council', 'connectors', 'marketplace'];

const WORKSPACE_ROUTE_PREFIXES = [
  'chat',
  'memory',
  'search',
  'files',
  'career',
  'resume',
  'resumes',
  'jobs',
  'applications',
  'email',
  'profile',
];

export function detectPortalModeFromPath(pathname: string): AppPortalMode | null {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'workspace' || !parts[1]) return null;

  const subroute = parts.slice(2).join('/');
  if (!subroute) return null;

  const baseSub = parts[2] || '';

  if (ADMIN_ROUTE_PREFIXES.some((prefix) => baseSub === prefix || subroute.startsWith(prefix))) {
    return 'admin';
  }
  if (
    DEVELOPER_ROUTE_PREFIXES.some((prefix) => baseSub === prefix || subroute.startsWith(prefix))
  ) {
    return 'developer';
  }
  if (
    WORKSPACE_ROUTE_PREFIXES.some((prefix) => baseSub === prefix || subroute.startsWith(prefix))
  ) {
    return 'workspace';
  }

  return null;
}

const defaultContextValue: AppModeContextValue = {
  mode: 'workspace',
  setMode: () => {},
  cycleMode: () => {},
  availableModes: VALID_MODES,
  currentModeMeta: PORTAL_MODES.workspace,
};

const AppModeContext = createContext<AppModeContextValue>(defaultContextValue);

export function AppModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: AppPortalMode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setModeState] = useState<AppPortalMode>(() => {
    if (initialMode && isValidMode(initialMode)) return initialMode;
    if (typeof window !== 'undefined') {
      const fromPath = detectPortalModeFromPath(pathname || '');
      if (fromPath) return fromPath;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isValidMode(stored)) return stored;
      } catch {
        // ignore storage errors
      }
    }
    return 'workspace';
  });

  const workspaceId = useMemo(() => {
    const m = pathname?.match(/\/workspace\/([^/]+)/);
    return m ? m[1] : null;
  }, [pathname]);

  // Sync mode whenever pathname changes to a route specifically belonging to a mode
  useEffect(() => {
    if (!pathname) return;
    const detected = detectPortalModeFromPath(pathname);
    if (detected && detected !== mode) {
      setModeState(detected);
      try {
        localStorage.setItem(STORAGE_KEY, detected);
      } catch {
        // ignore storage errors
      }
    }
  }, [pathname, mode]);

  const setMode = useCallback(
    (newMode: AppPortalMode, shouldNavigate = true) => {
      if (!isValidMode(newMode)) return;
      setModeState(newMode);
      try {
        localStorage.setItem(STORAGE_KEY, newMode);
      } catch {
        // ignore storage errors
      }

      if (shouldNavigate && workspaceId) {
        const targetSubpath = PORTAL_MODES[newMode].defaultSubpath;
        const targetUrl = targetSubpath
          ? `/workspace/${workspaceId}/${targetSubpath}`
          : `/workspace/${workspaceId}`;
        router.push(targetUrl);
      }
    },
    [router, workspaceId],
  );

  const cycleMode = useCallback(() => {
    const currentIndex = VALID_MODES.indexOf(mode);
    const nextIndex = (currentIndex + 1) % VALID_MODES.length;
    const target = VALID_MODES[nextIndex] ?? 'workspace';
    setMode(target, true);
  }, [mode, setMode]);

  const currentModeMeta = useMemo(() => PORTAL_MODES[mode], [mode]);

  const value = useMemo<AppModeContextValue>(
    () => ({
      mode,
      setMode,
      cycleMode,
      availableModes: VALID_MODES,
      currentModeMeta,
    }),
    [mode, setMode, cycleMode, currentModeMeta],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  return useContext(AppModeContext);
}
