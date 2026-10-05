'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { documentApi, type DocumentStatsResponse } from '@/lib/api-client';

export interface UseDocumentStatsResult {
  /**
   * The workspace aggregates, or `null` before the first success.
   *
   * `null` and `{}` are deliberately different: `null` means "not loaded yet",
   * and the bar shows a skeleton for it, whereas a partially-populated object
   * means the server answered and simply did not have every field — the bar then
   * omits the cards it has no number for instead of showing a skeleton forever.
   */
  stats: DocumentStatsResponse | null;
  /** The first load for this workspace is in flight. */
  loading: boolean;
  /**
   * A load failure.
   *
   * Reported by the stats bar alone. It must NOT blank the document table: the
   * two requests are independent, and a workspace whose totals endpoint is down
   * can still list its files perfectly well.
   */
  error: string | null;
  /** Re-run the request. Wired to the stats bar's Retry button. */
  retry: () => void;
  /**
   * Re-run the request after something changed the workspace's contents (an
   * upload, an archive, a folder created or deleted). Without this the counters
   * would still be describing the workspace as it was before the mutation.
   */
  refresh: () => void;
}

/**
 * Workspace-wide document aggregates.
 *
 * WHY THIS IS A SEPARATE HOOK AND NOT PART OF `useDocumentList`
 *
 * The list is one page of at most `page_size` rows and every filter it applies
 * narrows that page. The stats describe the entire workspace. Folding them
 * together is what produced the mixed-denominator bar: `total` came from the
 * server's unfiltered count while storage/clean/quarantined were summed over the
 * visible rows, and all four were captioned with workspace-scoped wording. Two
 * requests, two lifecycles, two failure modes — `DocumentStatsBar` now receives
 * its error and its retry from here, so a totals failure cannot take the
 * document table down with it.
 *
 * @param workspaceId The workspace to query. `''` disables the request.
 */
export function useDocumentStats(workspaceId: string): UseDocumentStatsResult {
  const [stats, setStats] = useState<DocumentStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Monotonic request id, for the same reason as in `useDocumentList`: a workspace
   * switch can leave a slower earlier request in flight, and committing its answer
   * would attribute one workspace's totals to another.
   */
  const requestId = useRef(0);

  const refreshStats = useCallback(async () => {
    if (!workspaceId) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }

    const id = (requestId.current += 1);
    setLoading(true);
    setError(null);

    try {
      const response = await documentApi.stats(workspaceId);
      if (id !== requestId.current) return;
      // An empty object is a legitimate answer only if the server sent one;
      // `null` is reserved for "nothing has loaded yet" so the skeleton and the
      // "omitted card" states cannot be confused.
      setStats(response ?? {});
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load document metrics');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  // Stable identities: `useDocumentActions` takes this result and calls
  // `refresh` from inside a `useCallback`, so a fresh function each render would
  // churn every mutation callback with it.
  const retry = useCallback(() => void refreshStats(), [refreshStats]);
  const refresh = retry;

  return { stats, loading, error, retry, refresh };
}
