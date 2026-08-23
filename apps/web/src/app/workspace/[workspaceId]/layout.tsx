'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

  // F-13: Escape closes the mobile drawer and returns focus to the trigger.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        const trigger = document.querySelector<HTMLButtonElement>(
          'button[aria-label="Open navigation"]',
        );
        trigger?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated || !workspaceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading workspaceâ€¦" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspaceId={workspaceId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        {/* F-08: the root layout owns the single <main id="main-content">
              landmark; this wrapper stays a plain div to avoid nested/duplicate
              main landmarks on every workspace route. */}
        <div
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-6 focus:outline-none"
          aria-hidden={sidebarOpen ? true : undefined}
          {...(sidebarOpen ? { inert: true } : {})}
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
