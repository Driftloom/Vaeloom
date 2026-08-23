'use client';

/**
 * Client island for the (otherwise server-rendered) landing page.
 * Preserves the exact Phase-01 behavior: signed-in users with a workspace
 * are redirected; everyone else sees the marketing content.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export function AuthRedirectProbe() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
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
        if (!cancelled && Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.id) {
          router.replace(`/workspace/${workspaces[0].id}`);
        }
      } catch {
        // not authenticated or no workspace yet — stay on landing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
