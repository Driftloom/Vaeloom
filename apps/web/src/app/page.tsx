'use client';

import React, { useEffect } from 'react';

export const dynamic = 'force-dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { useWorkspaces } from '../hooks/useWorkspace';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { workspaces, isLoading: wsLoading } = useWorkspaces();

  useEffect(() => {
    if (authLoading || wsLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (workspaces.length > 0) {
      router.replace(`/workspace/${workspaces[0]?.id}`);
    } else {
      // Provision a default workspace on first login.
      void import('../lib/api').then(({ api }) =>
        api.createWorkspace({ name: 'My Workspace' }).then((ws) => router.replace(`/workspace/${ws.id}`)),
      );
    }
  }, [authLoading, wsLoading, isAuthenticated, workspaces, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" text="Loading Vaeloom…" />
    </main>
  );
}
