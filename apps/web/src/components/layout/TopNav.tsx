'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { notificationApi } from '@/lib/api-client';
import type { NotificationResponse } from '@/lib/api-client';
import { ThemeToggle } from './ThemeToggle';

// Breadcrumb mapping helper
function resolveBreadcrumb(pathname: string): { section: string; title: string } {
  const parts = pathname.split('/').filter(Boolean);
  // Expected structure: ['workspace', workspaceId, ...rest]
  const subroute = parts[2] || '';

  const routeMap: Record<string, { section: string; title: string }> = {
    '': { section: 'Assist', title: 'Dashboard' },
    profile: { section: 'Trust & Rights', title: 'Profile & Security' },
    agents: { section: 'Assist', title: 'Agents' },
    chat: { section: 'Assist', title: 'Chat Assistant' },
    memory: { section: 'Memory', title: 'Memory Graph' },
    resume: { section: 'Career', title: 'Resume & Documents' },
    applications: { section: 'Career', title: 'Job Applications' },
    jobs: { section: 'Career', title: 'Job Tracker' },
    files: { section: 'Operations', title: 'Files & Documents' },
    connectors: { section: 'Operations', title: 'Integrations & Connectors' },
    schedule: { section: 'Operations', title: 'Schedule & Crons' },
    notifications: { section: 'Operations', title: 'Notifications & Approvals' },
    approvals: { section: 'Operations', title: 'Pending Approvals' },
    analytics: { section: 'Operations', title: 'Analytics & Usage' },
    billing: { section: 'Operations', title: 'Billing & Plans' },
    settings: { section: 'Operations', title: 'Workspace Settings' },
    vault: { section: 'Trust & Rights', title: 'Secrets Vault' },
    admin: { section: 'Enterprise', title: 'Admin Console' },
    marketplace: { section: 'Enterprise', title: 'Marketplace' },
    organizations: { section: 'Enterprise', title: 'Organizations' },
    developer: { section: 'Enterprise', title: 'Developer Portal' },
    'feature-flags': { section: 'Enterprise', title: 'Feature Flags' },
  };

  return (
    routeMap[subroute] || {
      section: 'Workspace',
      title: subroute ? subroute.charAt(0).toUpperCase() + subroute.slice(1) : 'Overview',
    }
  );
}

export function TopNav({
  onMenuClick,
  sidebarCollapsed,
  onOpenCommandCenter,
}: {
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  onOpenCommandCenter?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, me, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const workspaceId = useMemo(() => {
    const m = pathname?.match(/\/workspace\/([^/]+)/);
    return m ? m[1] : null;
  }, [pathname]);

  const currentWorkspace = useMemo(() => {
    if (!me?.workspaces || !workspaceId) return null;
    return me.workspaces.find((w) => w.id === workspaceId) || null;
  }, [me?.workspaces, workspaceId]);

  const breadcrumb = useMemo(() => resolveBreadcrumb(pathname || ''), [pathname]);

  // Fetch recent notifications
  useEffect(() => {
    if (!workspaceId) return;
    let isMounted = true;
    const fetchNotifs = async () => {
      setLoadingNotifs(true);
      try {
        const list = await notificationApi.list();
        if (isMounted) {
          setNotifications(list ?? []);
        }
      } catch {
        // non-fatal
      } finally {
        if (isMounted) setLoadingNotifs(false);
      }
    };
    void fetchNotifs();
    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  // Close dropdowns on route changes
  useEffect(() => {
    setDropdownOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const unreadCount = notifications.filter(
    (n) => n.status !== 'READ' && n.status !== 'DELIVERED',
  ).length;

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-3 sm:px-5 shrink-0 z-20">
      {/* Left section: Sidebar toggle & Dynamic Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="p-1.5 -ml-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={1.5} />
            <path d="M9 3v18" strokeWidth={1.5} />
          </svg>
        </button>

        {/* Dynamic Breadcrumb Hierarchy */}
        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted truncate"
        >
          <Link
            href={workspaceId ? `/workspace/${workspaceId}` : '/workspace'}
            className="hover:text-text transition-colors truncate max-w-[140px] font-medium"
          >
            {currentWorkspace?.name || 'Workspace'}
          </Link>
          <span className="text-text-dim/60">/</span>
          <span className="text-text-dim text-[11px] uppercase tracking-wider">
            {breadcrumb.section}
          </span>
          <span className="text-text-dim/60">/</span>
          <span className="text-text font-medium truncate">{breadcrumb.title}</span>
        </nav>
        <span className="sm:hidden text-sm font-medium text-text truncate">{breadcrumb.title}</span>
      </div>

      {/* Center: Command Center Search Pill Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenCommandCenter}
          className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-border bg-background/80 hover:bg-background hover:border-primary/40 text-xs text-text-muted hover:text-text transition-all shadow-sm group"
          aria-label="Open Command Center (⌘K)"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-text-dim group-hover:text-primary transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <span className="truncate">Search files, memories, agents, commands…</span>
          </div>
          <kbd className="font-mono text-[10px] text-text-dim border border-border rounded px-1.5 py-0.5 bg-surface-100 group-hover:border-primary/30 shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls: Mobile search, Agent status, Notifications, Theme, User profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenCommandCenter}
          className="md:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover"
          aria-label="Open Command Center"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </button>

        {/* Live Agent Status Indicator */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-100 border border-border/60 text-[11px] text-text-dim font-medium"
          title="All reasoning agent systems operational"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span>Agents Ready</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors relative"
            title="Notifications & Approvals"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>

          {notifOpen && (
            <>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setNotifOpen(false)}
                aria-label="Close notifications menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-border bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/notifications` : '/workspace'}
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
                  {loadingNotifs ? (
                    <div className="p-4 text-center text-xs text-text-dim">
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-dim">
                      No notifications yet. Approvals and system alerts will appear here.
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <div key={notif.id} className="p-3 hover:bg-surface-hover transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-text-dim mb-1">
                          <span className="uppercase font-mono tracking-wider">
                            {notif.channel}
                          </span>
                          <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-medium text-text line-clamp-1">
                          {notif.subject || 'System Notification'}
                        </p>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                          {notif.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-border bg-surface-50/50 text-center">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/approvals` : '/workspace'}
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] text-text-muted hover:text-text"
                  >
                    Check Human-in-the-Loop Approvals →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* User Account Avatar & Dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-muted font-mono text-xs hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            title={user?.email ?? 'User'}
            aria-label="User account menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {userInitials}
          </button>

          {dropdownOpen && (
            <>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
                aria-label="Close user menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-surface shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-border">
                  <p className="text-sm font-medium text-text truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-text-dim truncate">{user?.email}</p>
                  {currentWorkspace && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-100 border border-border text-[10px] font-mono text-text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="truncate">{currentWorkspace.name}</span>
                    </div>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/profile` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    Profile & Security
                  </Link>
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/settings` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Workspace Settings
                  </Link>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenCommandCenter) onOpenCommandCenter();
                    }}
                    className="flex items-center justify-between w-full px-3.5 py-2 text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                        />
                      </svg>
                      Command Center
                    </span>
                    <kbd className="font-mono text-[9px] px-1 border border-border rounded text-text-dim">
                      ⌘K
                    </kbd>
                  </button>
                </div>

                <div className="border-t border-border my-1" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-text-muted hover:text-error hover:bg-surface-hover transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    />
                  </svg>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
