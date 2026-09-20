'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { notificationApi } from '@/lib/api-client';
import type { NotificationResponse } from '@/lib/api-client';
import { ThemeToggle } from './ThemeToggle';
import {
  MenuIcon,
  SearchIcon,
  BellIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
  StatusDot,
} from '@vaeloom/ui-kit';

function resolveBreadcrumb(pathname: string): { section: string; title: string } {
  const parts = pathname.split('/').filter(Boolean);
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
    <header className="h-14 border-b border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] flex items-center justify-between px-3 sm:px-5 shrink-0 z-20">
      {/* Left section: Sidebar toggle & Dynamic Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="p-1.5 -ml-1 rounded-md text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)] shrink-0"
        >
          <MenuIcon size={18} />
        </button>

        {/* Dynamic Breadcrumb Hierarchy */}
        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-text-secondary,#a1a1aa)] truncate"
        >
          <Link
            href={workspaceId ? `/workspace/${workspaceId}` : '/workspace'}
            className="hover:text-[var(--color-text-primary,#f4f4f5)] transition-colors truncate max-w-[140px] font-medium"
          >
            {currentWorkspace?.name || 'Workspace'}
          </Link>
          <span className="text-[var(--color-text-muted,#71717a)] opacity-60">/</span>
          <span className="text-[var(--color-text-muted,#71717a)] text-[11px] uppercase tracking-wider font-mono">
            {breadcrumb.section}
          </span>
          <span className="text-[var(--color-text-muted,#71717a)] opacity-60">/</span>
          <span className="text-[var(--color-text-primary,#f4f4f5)] font-semibold truncate">
            {breadcrumb.title}
          </span>
        </nav>
        <span className="sm:hidden text-sm font-semibold text-[var(--color-text-primary,#f4f4f5)] truncate">
          {breadcrumb.title}
        </span>
      </div>

      {/* Center: Command Center Search Pill Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-canvas,#08080a)] hover:border-[var(--color-border-strong,#3f3f46)] text-xs text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-secondary,#a1a1aa)] transition-all shadow-sm group"
          aria-label="Open Command Center (⌘K)"
        >
          <div className="flex items-center gap-2">
            <SearchIcon
              size={14}
              className="text-[var(--color-text-muted,#71717a)] group-hover:text-[var(--color-action-primary,#3b82f6)]"
            />
            <span className="truncate">Search files, memories, agents, commands…</span>
          </div>
          <kbd className="font-mono text-[10px] text-[var(--color-text-muted,#71717a)] border border-[var(--color-border-subtle,#27272a)] rounded px-1.5 py-0.5 bg-[var(--color-bg-surface,#111114)] shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls: Mobile search, Agent status, Notifications, Theme, User profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="md:hidden p-2 rounded-md text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)]"
          aria-label="Open Command Center"
        >
          <SearchIcon size={16} />
        </button>

        {/* Live Agent Status Indicator */}
        <div
          className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-bg-elevated,#18181c)] border border-[var(--color-border-subtle,#27272a)] text-xs text-[var(--color-text-secondary,#a1a1aa)] font-medium"
          title="All reasoning agent systems operational"
        >
          <StatusDot status="active" pulse />
          <span>Agents Active</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="p-2 rounded-md text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors relative"
            title="Notifications & Approvals"
          >
            <BellIcon size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-action-primary,#3b82f6)]" />
            )}
          </button>

          {notifOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setNotifOpen(false)}
                aria-label="Close notifications menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-[var(--color-border-strong,#3f3f46)] bg-[var(--color-bg-surface,#111114)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-elevated,#18181c)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary,#f4f4f5)]">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-950/50 text-blue-300 font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/notifications` : '/workspace'}
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-[var(--color-action-primary,#3b82f6)] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border-subtle,#27272a)]">
                  {loadingNotifs ? (
                    <div className="p-4 text-center text-xs text-[var(--color-text-muted,#71717a)]">
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--color-text-muted,#71717a)]">
                      No notifications yet. Approvals and system alerts will appear here.
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <div
                        key={notif.id}
                        className="p-3 hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted,#71717a)] mb-1">
                          <span className="uppercase font-mono tracking-wider">
                            {notif.channel}
                          </span>
                          <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-medium text-[var(--color-text-primary,#f4f4f5)] line-clamp-1">
                          {notif.subject || 'System Notification'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary,#a1a1aa)] line-clamp-2 mt-0.5">
                          {notif.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-elevated,#18181c)] text-center">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/approvals` : '/workspace'}
                    onClick={() => setNotifOpen(false)}
                    className="text-[11px] text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)]"
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
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated,#18181c)] border border-[var(--color-border-subtle,#27272a)] flex items-center justify-center text-[var(--color-text-primary,#f4f4f5)] font-mono text-xs hover:border-[var(--color-action-primary,#3b82f6)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)] transition-colors"
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
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
                aria-label="Close user menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-[var(--color-border-strong,#3f3f46)] bg-[var(--color-bg-surface,#111114)] shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-2.5 border-b border-[var(--color-border-subtle,#27272a)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary,#f4f4f5)] truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted,#71717a)] truncate">
                    {user?.email}
                  </p>
                  {currentWorkspace && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-bg-elevated,#18181c)] border border-[var(--color-border-subtle,#27272a)] text-[10px] font-mono text-[var(--color-text-secondary,#a1a1aa)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-action-primary,#3b82f6)]" />
                      <span className="truncate">{currentWorkspace.name}</span>
                    </div>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/profile` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-[var(--color-text-secondary,#a1a1aa)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <UserIcon size={14} />
                    <span>Profile & Security</span>
                  </Link>
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/settings` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-[var(--color-text-secondary,#a1a1aa)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <SettingsIcon size={14} />
                    <span>Workspace Settings</span>
                  </Link>
                </div>

                <div className="border-t border-[var(--color-border-subtle,#27272a)] my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[var(--color-status-danger,#ef4444)] hover:bg-[var(--color-bg-elevated,#18181c)] transition-colors"
                >
                  <LogOutIcon size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
