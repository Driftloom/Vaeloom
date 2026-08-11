'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useAuth } from '../../../hooks/useAuth';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { PrefetchProvider } from '../../../lib/prefetch';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    void params.then((p) => setWorkspaceId(p.workspaceId));
  }, [params]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
    <PrefetchProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          workspaceId={workspaceId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav onMenuClick={() => setSidebarOpen(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-6 focus:outline-none"
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </PrefetchProvider>
  );
}
