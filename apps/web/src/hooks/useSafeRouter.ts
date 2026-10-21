'use client';

import { useRouter } from 'next/navigation';

/**
 * `useRouter()` throws when the component renders outside a Next.js app-router
 * context (some component tests mount without one). Callers only need the
 * navigation affordances, so degrade to no-ops instead of crashing.
 */
export function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return {
      push: (_url: string) => {},
      replace: (_url: string) => {},
      prefetch: (_url: string) => {},
    };
  }
}
