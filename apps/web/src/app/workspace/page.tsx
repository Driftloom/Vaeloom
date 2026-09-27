'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearToken, clearRefreshToken, setToken } from '@/lib/api';

export default function WorkspaceIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isTakingLong, setIsTakingLong] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: If resolving takes longer than 4 seconds, show actionable buttons
    const timer = setTimeout(() => {
      if (isMounted) setIsTakingLong(true);
    }, 4000);

    function cleanupAndGoLogin() {
      clearToken();
      clearRefreshToken();
      try {
        document.cookie = 'vaeloom_at=; Path=/; Max-Age=0;';
        document.cookie = 'vaeloom.accessToken=; Path=/; Max-Age=0;';
        document.cookie = 'vaeloom_rt=; Path=/; Max-Age=0;';
        document.cookie = 'vaeloom.refreshToken=; Path=/; Max-Age=0;';
      } catch {}
      window.location.replace('/login');
    }

    async function resolveWorkspace() {
      try {
        const me = await api.me();
        if (!isMounted) return;

        setToken('active-session');

        if (me?.workspaces && me.workspaces.length > 0 && me.workspaces[0]?.id) {
          router.replace(`/workspace/${me.workspaces[0].id}`);
          return;
        }

        // Try creating default workspace if none exist
        try {
          const newWs = await api.createWorkspace({ name: 'Default Workspace' });
          if (isMounted && newWs?.id) {
            router.replace(`/workspace/${newWs.id}`);
            return;
          }
        } catch (e) {
          console.error('Failed to create default workspace:', e);
        }

        cleanupAndGoLogin();
      } catch (err: unknown) {
        console.error('Failed to resolve workspace:', err);
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Session verification failed';
          setError(msg);
          setTimeout(() => {
            cleanupAndGoLogin();
          }, 1500);
        }
      }
    }

    resolveWorkspace();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-text p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-text-muted">
          {error ? `${error}. Redirecting to login...` : 'Entering your workspace...'}
        </p>

        {isTakingLong && !error && (
          <div className="mt-4 flex flex-col items-center gap-3 animate-fade-in">
            <p className="text-xs text-text-dim">
              Taking longer than usual to connect to your workspace.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg border border-border-subtle bg-surface text-xs font-medium hover:bg-surface-hover text-text transition-colors"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  clearToken();
                  clearRefreshToken();
                  try {
                    document.cookie = 'vaeloom_at=; Path=/; Max-Age=0;';
                    document.cookie = 'vaeloom.accessToken=; Path=/; Max-Age=0;';
                    document.cookie = 'vaeloom_rt=; Path=/; Max-Age=0;';
                    document.cookie = 'vaeloom.refreshToken=; Path=/; Max-Age=0;';
                  } catch {}
                  window.location.replace('/login');
                }}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-600 transition-colors"
              >
                Sign in again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
