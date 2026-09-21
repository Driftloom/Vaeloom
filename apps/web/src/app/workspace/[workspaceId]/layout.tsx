'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { CommandCenter } from '@/components/layout/CommandCenter';
import { useAuth } from '../../../hooks/useAuth';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner';
import { ErrorBoundary } from '../../../components/common/ErrorBoundary';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  useEffect(() => {
    void params.then((p) => setWorkspaceId(p.workspaceId));
  }, [params]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Load persisted desktop collapsed state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vaeloom.sidebar.collapsed');
      if (saved === 'true') {
        setSidebarCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('vaeloom.sidebar.collapsed', String(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
  }, []);

  // Shortcut: Ctrl+B or Cmd+B toggles sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);

  // Global ⌘K / Ctrl+K listener for Command Center
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // F-13: Escape closes the mobile drawer and returns focus to the trigger.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        const trigger = document.querySelector<HTMLButtonElement>(
          'button[aria-label="Toggle navigation"], button[aria-label="Open navigation"]',
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
        <LoadingSpinner size="lg" text="Loading workspace…" />
      </div>
    );
  }

  return (
    <RealtimeProvider workspaceId={workspaceId}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          workspaceId={workspaceId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onOpenCommandCenter={() => setCommandCenterOpen(true)}
        />
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav
            onMenuClick={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
            onOpenCommandCenter={() => setCommandCenterOpen(true)}
          />
          {/* F-08: the root layout owns the single <main id="main-content">
                landmark; this wrapper stays a plain div to avoid nested/duplicate
                main landmarks on every workspace route. */}
          <div
            tabIndex={-1}
            className={`flex-1 focus:outline-none ${
              pathname?.endsWith('/chat') ||
              pathname?.includes('/chat/') ||
              pathname?.includes('/capabilities')
                ? 'flex flex-col min-h-0 overflow-hidden p-0'
                : 'overflow-y-auto p-4 sm:p-6'
            }`}
            aria-hidden={sidebarOpen ? true : undefined}
            {...(sidebarOpen ? { inert: true } : {})}
          >
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>

        {/* Global Command Center */}
        <CommandCenter
          open={commandCenterOpen}
          onClose={() => setCommandCenterOpen(false)}
          onToggleSidebar={toggleSidebar}
        />
      </div>
    </RealtimeProvider>
  );
}
