'use client';

/**
 * Global SWR policy (Phase 02A / F-15).
 *
 * Phase-01 found that no SWRConfig was ever mounted: every raw useSWR call
 * ran on library defaults (refetchOnFocus=true, dedupingInterval=2000),
 * producing focus-refetch storms — observed amplifying failing endpoints
 * into 20-42 repeated console errors per page.
 *
 * Data-class policy (documented in docs; applied via the globals below and
 * per-call-site overrides where a class needs different behavior):
 *
 *   STATIC    agent catalog, plan catalogs   dedupe 30 min, no focus refetch
 *   SESSION   user, workspace lists          dedupe 60 s, no focus refetch
 *   MUTABLE   files, history, jobs, memory   dedupe 5 s, mutate() after writes
 *   LIVE      approvals, notifications       dedupe 5 s, focus revalidate ON
 *             (opt back in per call site with revalidateOnFocus: true)
 *   STREAMING chat                           not SWR-managed (SSE)
 */

import type { SWRConfiguration } from 'swr';
import { SWRConfig } from 'swr';

const GLOBAL_POLICY: SWRConfiguration = {
  // Focus-refetch storms are the default failure mode of an enterprise
  // dashboard; surfaces that genuinely need live-ish data opt back in.
  revalidateOnFocus: false,
  revalidateIfStale: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  // Client errors are deterministic (auth, validation, missing enterprise
  // entitlements) — retrying them just multiplies noise.
  shouldRetryOnError: (err: unknown) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status?: number }).status
        : undefined;
    if (typeof status === 'number') return status >= 500 || status === 429;
    return true;
  },
};

/** Per-class overrides for individual call sites. */
export const swrClass = {
  STATIC: { dedupingInterval: 30_000 } satisfies SWRConfiguration,
  SESSION: { dedupingInterval: 60_000 } satisfies SWRConfiguration,
  LIVE: { revalidateOnFocus: true, refreshInterval: 30_000 } satisfies SWRConfiguration,
} as const;

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={GLOBAL_POLICY}>{children}</SWRConfig>;
}
