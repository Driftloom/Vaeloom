'use client';

/**
 * Client island for the (otherwise server-rendered) landing page.
 * Preserves the exact Phase-01 behavior: signed-in users with a workspace
 * are redirected; everyone else sees the marketing content.
 *
 * Runs only after the browser is idle (requestIdleCallback / 500ms fallback)
 * so it never blocks clicks on Sign in / Get started.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export function AuthRedirectProbe() {
  const router = useRouter();

  useEffect(() => {
    // Only bother if a token is stored — avoids any network call for logged-out users.
    const token = getToken();
    if (!token) return;

    let cancelled = false;

    // Defer until the browser is idle so heavy 3D/WebGL landing content
    // doesn't compete with this network call, and Sign In / Get Started
    // clicks feel instant (they navigate before the probe resolves).
    const schedule = (cb: () => void) => {
      if (typeof requestIdleCallback !== 'undefined') {
        const id = requestIdleCallback(cb, { timeout: 2000 });
        return () => cancelIdleCallback(id);
      }
      const id = setTimeout(cb, 500);
      return () => clearTimeout(id);
    };

    const cancel = schedule(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const { api } = await import('@/lib/api');
          const me = await api.me();
          const ws = (me as unknown as { workspaces?: Array<{ id: string }> })?.workspaces;
          if (!cancelled && ws && ws.length > 0 && ws[0]?.id) {
            router.replace(`/workspace/${ws[0].id}`);
            return;
          }
          const workspaces = await api.listWorkspaces();
          if (
            !cancelled &&
            Array.isArray(workspaces) &&
            workspaces.length > 0 &&
            workspaces[0]?.id
          ) {
            router.replace(`/workspace/${workspaces[0].id}`);
          }
        } catch {
          // not authenticated or no workspace yet — stay on landing
        }
      })();
    });

    return () => {
      cancelled = true;
      cancel?.();
    };
  }, [router]);

  return null;
}
