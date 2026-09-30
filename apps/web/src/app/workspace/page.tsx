'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@vaeloom/ui-kit';
import { api, ApiError, clearToken, clearRefreshToken, setToken } from '@/lib/api';

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
      // Only the legacy, JavaScript-readable cookies can be cleared from here.
      // `vaeloom_at` / `vaeloom_rt` are HttpOnly, so `document.cookie` cannot see
      // or delete them - only a `Set-Cookie` from the server can. Attempting it
      // here was a silent no-op that looked like it was cleaning up. The session
      // is already invalidated server-side by `POST /auth/logout`, and an
      // anonymous visitor never had one.
      try {
        document.cookie = 'vaeloom.accessToken=; Path=/; Max-Age=0;';
        document.cookie = 'vaeloom.refreshToken=; Path=/; Max-Age=0;';
      } catch {}
      window.location.replace('/login');
    }

    async function resolveWorkspace() {
      try {
        const me = await api.me();
        if (!isMounted) return;

        setToken();

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
        // A 401 here is the *expected* state for this route, not a failure: an
        // anonymous visitor, or a session that has just been revoked by signing
        // out. It used to be logged as a console error and surfaced to the user
        // as "Token has been revoked" for a second and a half before the
        // redirect - alarming, and wrong for someone who never had a session.
        // Redirect straight away and say nothing.
        if (err instanceof ApiError && err.status === 401) {
          cleanupAndGoLogin();
          return;
        }

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
        {/* Redirect stub: no visible title bar by design (it is on screen for a
            second or two), but the route still needs a name in the a11y tree. */}
        <h1 className="sr-only">Entering your workspace</h1>
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
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
              >
                Sign in again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
