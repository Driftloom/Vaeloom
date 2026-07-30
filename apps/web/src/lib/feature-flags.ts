import React from 'react';
import type { SWRConfiguration } from 'swr';

const STORAGE_KEY = 'vaeloom.featureFlags';
const CACHE_TTL = 5 * 60 * 1000;

export interface FeatureFlagDefinition {
  name: string;
  enabled: boolean;
  description?: string;
}

const DEFAULT_FLAGS: FeatureFlagDefinition[] = [
  { name: 'new_chat_ui', enabled: true, description: 'Enable the redesigned chat interface' },
  { name: 'beta_memory_graph', enabled: false, description: 'Enable the beta memory graph visualization' },
  { name: 'dark_mode', enabled: true, description: 'Enable dark mode theme' },
  { name: 'batch_operations', enabled: false, description: 'Enable batch operations on files and memories' },
];

interface CachedFlags {
  flags: FeatureFlagDefinition[];
  timestamp: number;
}

async function fetchFlagsFromApi(): Promise<FeatureFlagDefinition[]> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';
  try {
    const res = await fetch(`${apiBase}/api/v1/feature-flags`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return DEFAULT_FLAGS;
    const data = await res.json() as { flags?: FeatureFlagDefinition[] };
    return data.flags ?? DEFAULT_FLAGS;
  } catch {
    return DEFAULT_FLAGS;
  }
}

function getFlagsFromStorage(): FeatureFlagDefinition[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedFlags = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached.flags;
  } catch {
    return null;
  }
}

function saveFlagsToStorage(flags: FeatureFlagDefinition[]): void {
  if (typeof window === 'undefined') return;
  const cached: CachedFlags = { flags, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

let cachedFlags: FeatureFlagDefinition[] | null = null;
let fetchPromise: Promise<FeatureFlagDefinition[]> | null = null;

export async function getFeatureFlags(): Promise<FeatureFlagDefinition[]> {
  if (cachedFlags) return cachedFlags;
  const stored = getFlagsFromStorage();
  if (stored) {
    cachedFlags = stored;
    return stored;
  }

  if (!fetchPromise) {
    fetchPromise = fetchFlagsFromApi().then(flags => {
      cachedFlags = flags;
      saveFlagsToStorage(flags);
      fetchPromise = null;
      return flags;
    });
  }
  return fetchPromise;
}

export function useFeatureFlag(name: string): boolean {
  // This is a simplified synchronous hook.
  // In production this would use SWR or React state.
  if (typeof window === 'undefined') {
    const flag = DEFAULT_FLAGS.find(f => f.name === name);
    return flag?.enabled ?? false;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cached: CachedFlags = JSON.parse(raw);
      if (Date.now() - cached.timestamp <= CACHE_TTL) {
        const flag = cached.flags.find(f => f.name === name);
        return flag?.enabled ?? false;
      }
    }
  } catch {
    // ignore
  }
  const flag = DEFAULT_FLAGS.find(f => f.name === name);
  return flag?.enabled ?? false;
}

export function FeatureFlag({
  name,
  fallback = null,
  children,
}: {
  name: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const enabled = useFeatureFlag(name);
  return enabled ? React.createElement(React.Fragment, null, children) : React.createElement(React.Fragment, null, fallback);
}

export function invalidateFeatureFlags(): void {
  cachedFlags = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
