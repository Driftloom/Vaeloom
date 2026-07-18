'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useAuth } from '../../../hooks/useAuth';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setWorkspaceId(p.workspaceId));
  }, [params]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated || !workspaceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading workspace…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspaceId={workspaceId} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
