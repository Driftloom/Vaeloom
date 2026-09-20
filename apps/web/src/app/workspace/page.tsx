'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken } from '@/lib/api';

export default function WorkspaceIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveWorkspace() {
      const token = getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const me = await api.me();
        if (!isMounted) return;

        if (me.workspaces && me.workspaces.length > 0 && me.workspaces[0]?.id) {
          router.replace(`/workspace/${me.workspaces[0].id}`);
        } else {
          try {
            const newWs = await api.createWorkspace({ name: 'Default Workspace' });
            if (isMounted && newWs?.id) {
              router.replace(`/workspace/${newWs.id}`);
              return;
            }
          } catch (e) {
            console.error('Failed to create default workspace:', e);
          }
          router.replace('/login');
        }
      } catch (err: unknown) {
        console.error('Failed to resolve workspace:', err);
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load workspace';
          setError(msg);
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
        }
      }
    }

    resolveWorkspace();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-400">
          {error ? `${error}. Redirecting to login...` : 'Entering your workspace...'}
        </p>
      </div>
    </div>
  );
}
