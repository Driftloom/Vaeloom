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
  ChevronDownIcon,
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
    <header className="h-14 border-b border-border-subtle bg-surface flex items-center justify-between px-3 sm:px-5 shrink-0 z-20">
      {/* Left section: Sidebar toggle & Dynamic Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          title={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          className="p-1.5 -ml-1 rounded-md text-text-muted hover:text-text hover:bg-surface-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent shrink-0"
        >
          <MenuIcon size={18} />
        </button>

        {/* Dynamic Breadcrumb Hierarchy */}
        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary truncate"
        >
          <Link
            href={workspaceId ? `/workspace/${workspaceId}` : '/workspace'}
            className="hover:text-text transition-colors truncate max-w-[140px] font-medium"
          >
            {currentWorkspace?.name || 'Workspace'}
          </Link>
          <span className="text-text-muted opacity-60">/</span>
          <span className="text-text-muted text-xs uppercase tracking-wider font-mono">
            {breadcrumb.section}
          </span>
          <span className="text-text-muted opacity-60">/</span>
          <span className="text-text font-semibold truncate">{breadcrumb.title}</span>
        </nav>
        <span className="sm:hidden text-sm font-semibold text-text truncate">
          {breadcrumb.title}
        </span>
      </div>

      {/* Center: Command Center Search Pill Trigger */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandCenter}
          className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md border border-border-subtle bg-surface-100 hover:border-border-strong text-xs text-text-muted hover:text-text-secondary transition-all shadow-sm group"
          aria-label="Open Command Center (⌘K)"
        >
          <div className="flex items-center gap-2">
            <SearchIcon size={14} className="text-text-muted group-hover:text-primary" />
            <span className="truncate">Search files, memories, agents, commands…</span>
          </div>
          <kbd className="font-mono text-2xs text-text-muted border border-border-subtle rounded px-1.5 py-0.5 bg-surface shrink-0">
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
          className="md:hidden p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-200"
          aria-label="Open Command Center"
        >
          <SearchIcon size={16} />
        </button>

        {/* Live Agent Status Indicator */}
        <div
          className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-200 border border-border-subtle text-xs text-text-secondary font-medium"
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
            className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-200 transition-colors relative"
            title="Notifications & Approvals"
          >
            <BellIcon size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-action" />
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
              <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-border-strong bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded-full bg-blue-950/50 text-blue-300 font-medium">
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
                <div className="max-h-72 overflow-y-auto divide-y divide-border-subtle">
                  {loadingNotifs ? (
                    <div className="p-4 text-center text-xs text-text-muted">
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">
                      No notifications yet. Approvals and system alerts will appear here.
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <div key={notif.id} className="p-3 hover:bg-surface-200 transition-colors">
                        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                          <span className="uppercase font-mono tracking-wider">
                            {notif.channel}
                          </span>
                          <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-medium text-text line-clamp-1">
                          {notif.subject || 'System Notification'}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                          {notif.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-border-subtle bg-surface-200 text-center">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/approvals` : '/workspace'}
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-text-muted hover:text-text"
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
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-surface-200 border border-transparent hover:border-border-subtle transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-accent cursor-pointer"
            title={user?.email ?? 'User account'}
            aria-label="User account menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-7 h-7 rounded-full bg-surface-100 border border-border-subtle flex items-center justify-center text-text font-mono text-xs font-semibold shrink-0 shadow-xs">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col text-left leading-none max-w-[130px] md:max-w-[180px]">
              <span className="text-xs font-semibold text-text truncate">
                {user?.displayName || user?.email || 'User'}
              </span>
              <span className="text-2xs text-text-muted truncate mt-0.5">Workspace Member</span>
            </div>
            <ChevronDownIcon size={12} className="hidden sm:block text-text-muted" />
          </button>

          {dropdownOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
                aria-label="Close user menu"
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border-strong bg-surface shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 pb-3 pt-1 border-b border-border-subtle">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-full bg-surface-100 border border-border-subtle flex items-center justify-center text-text font-mono text-sm font-semibold shrink-0 shadow-xs">
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text truncate">
                        {user?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-text-muted truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-surface-200 text-text-muted border border-border-subtle">
                      Workspace Member
                    </span>
                    {currentWorkspace && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-200 border border-border-subtle text-2xs font-mono text-text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-action" />
                        <span className="truncate">{currentWorkspace.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/profile` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:text-text hover:bg-surface-200 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <UserIcon size={14} />
                    <span>Profile & Security</span>
                  </Link>
                  <Link
                    href={workspaceId ? `/workspace/${workspaceId}/settings` : '/workspace'}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-secondary hover:text-text hover:bg-surface-200 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <SettingsIcon size={14} />
                    <span>Workspace Settings</span>
                  </Link>
                </div>

                <div className="border-t border-border-subtle my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-error hover:bg-surface-200 transition-colors cursor-pointer"
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
