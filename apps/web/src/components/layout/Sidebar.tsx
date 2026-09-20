'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BrainIcon,
  CpuIcon,
  SearchIcon,
  FileTextIcon,
  BriefcaseIcon,
  DatabaseIcon,
  ShieldIcon,
  ClockIcon,
  SettingsIcon,
  BuildingIcon,
  TerminalIcon,
  PlugIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from '@vaeloom/ui-kit';

interface NavLink {
  name: string;
  path: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  links: NavLink[];
  enterprise?: boolean;
}

function isEnterpriseEnabled(): boolean {
  return process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] === 'true';
}

function groupLinks(workspaceId: string): NavGroup[] {
  const ws = (path: string) => `/workspace/${workspaceId}${path}`;
  const enableEnterprise = isEnterpriseEnabled();

  const allGroups: NavGroup[] = [
    {
      label: 'Assist',
      links: [
        { name: 'Dashboard', path: ws(''), icon: <CpuIcon size={16} /> },
        { name: 'Capabilities', path: ws('/capabilities'), icon: <TerminalIcon size={16} /> },
        { name: 'Chat', path: ws('/chat'), icon: <BrainIcon size={16} /> },
      ],
    },
    {
      label: 'Memory',
      links: [
        { name: 'Memory Graph', path: ws('/memory'), icon: <BrainIcon size={16} /> },
        { name: 'Knowledge Graph', path: ws('/graph'), icon: <BrainIcon size={16} /> },
        { name: 'Search', path: ws('/search'), icon: <SearchIcon size={16} /> },
        { name: 'Documents', path: ws('/documents'), icon: <FileTextIcon size={16} /> },
      ],
    },
    {
      label: 'Career',
      links: [
        { name: 'Career Overview', path: ws('/career'), icon: <BriefcaseIcon size={16} /> },
        { name: 'Resumes', path: ws('/resumes'), icon: <FileTextIcon size={16} /> },
        { name: 'Jobs', path: ws('/jobs'), icon: <BriefcaseIcon size={16} /> },
        { name: 'Applications', path: ws('/applications'), icon: <FileTextIcon size={16} /> },
      ],
    },
    {
      label: 'Operations',
      links: [
        { name: 'Activity Log', path: ws('/history'), icon: <ClockIcon size={16} /> },
        { name: 'Schedule', path: ws('/schedule'), icon: <CalendarIcon size={16} /> },
        { name: 'Connectors', path: ws('/connectors'), icon: <PlugIcon size={16} /> },
        { name: 'Approvals', path: ws('/approvals'), icon: <ShieldIcon size={16} /> },
      ],
    },
    {
      label: 'Trust & Rights',
      links: [
        { name: 'Workspace Settings', path: ws('/settings'), icon: <SettingsIcon size={16} /> },
        { name: 'Security & Keys', path: ws('/settings/security'), icon: <ShieldIcon size={16} /> },
        { name: 'Secrets Vault', path: ws('/vault'), icon: <ShieldIcon size={16} /> },
      ],
    },
  ];

  if (enableEnterprise) {
    allGroups.push({
      label: 'Enterprise',
      enterprise: true,
      links: [
        { name: 'Admin', path: ws('/admin'), icon: <BuildingIcon size={16} /> },
        { name: 'Organizations', path: ws('/organizations'), icon: <BuildingIcon size={16} /> },
        { name: 'Marketplace', path: ws('/marketplace'), icon: <BuildingIcon size={16} /> },
        { name: 'Developer', path: ws('/developer'), icon: <TerminalIcon size={16} /> },
        { name: 'Feature Flags', path: ws('/feature-flags'), icon: <SettingsIcon size={16} /> },
      ],
    });
  }

  return allGroups;
}

interface SidebarNavLinkProps {
  link: NavLink;
  current: boolean;
  collapsed: boolean;
}

function SidebarNavLink({ link, current, collapsed }: SidebarNavLinkProps) {
  return (
    <li>
      <Link
        href={link.path}
        title={collapsed ? link.name : undefined}
        aria-label={collapsed ? link.name : undefined}
        aria-current={current ? 'page' : undefined}
        className={`flex items-center rounded-md transition-colors text-xs font-medium ${
          collapsed ? 'p-2 justify-center' : 'gap-2.5 px-2.5 py-1.5'
        } ${
          current
            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
            : 'text-text-secondary hover:text-text hover:bg-surface-200'
        }`}
      >
        <span className="shrink-0">{link.icon}</span>
        {!collapsed ? (
          <span className="truncate">{link.name}</span>
        ) : (
          <span className="sr-only">{link.name}</span>
        )}
      </Link>
    </li>
  );
}

export interface SidebarProps {
  workspaceId: string;
  isCollapsed?: boolean;
  collapsed?: boolean;
  open?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  onOpenCommandCenter?: () => void;
}

export function Sidebar({
  workspaceId,
  isCollapsed = false,
  collapsed,
  open = false,
  onClose,
  onToggleCollapse,
  onOpenCommandCenter,
}: SidebarProps) {
  const pathname = usePathname();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const isCol = collapsed !== undefined ? collapsed : isCollapsed;
  const groups = groupLinks(workspaceId);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleCollapse?.();
      }
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCollapse]);

  return (
    <>
      <aside
        aria-label="Sidebar navigation"
        className={`h-screen border-r border-border-subtle bg-surface flex flex-col transition-all duration-200 select-none ${
          open ? 'fixed inset-y-0 left-0 z-40 w-64' : 'hidden md:flex'
        } ${isCol ? 'md:w-16' : 'md:w-64'}`}
      >
        {/* Brand & Workspace Header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle">
          {!isCol && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-action flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                V
              </div>
              <span className="font-semibold text-sm text-text truncate tracking-tight">
                Vaeloom
              </span>
            </div>
          )}
          {isCol && (
            <div className="flex items-center justify-center w-full">
              {onToggleCollapse ? (
                <button
                  type="button"
                  aria-label="Expand sidebar"
                  onClick={onToggleCollapse}
                  className="w-8 h-8 rounded-lg bg-action flex items-center justify-center text-white font-bold text-xs shadow-sm hover:opacity-90"
                >
                  V
                </button>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-action flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  V
                </div>
              )}
            </div>
          )}
          {onToggleCollapse && !isCol && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={onToggleCollapse}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <ChevronLeftIcon size={16} />
            </button>
          )}
        </div>

        {/* Nav Links */}
        <nav
          className="flex-1 overflow-y-auto py-2.5 px-2 space-y-4"
          aria-label="Workspace navigation"
        >
          {groups.map((group) => (
            <div key={group.label}>
              {!isCol ? (
                <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-widest text-text-dim">
                  {group.label}
                  {group.enterprise && (
                    <span className="ml-1.5 text-2xs px-1 py-0.2 rounded border border-border-subtle">
                      gated
                    </span>
                  )}
                </p>
              ) : (
                <div className="mx-2 my-1 border-t border-border-subtle" />
              )}
              <ul className="space-y-0.5">
                {group.links.map((link) => (
                  <SidebarNavLink
                    key={link.name}
                    link={link}
                    current={pathname === link.path}
                    collapsed={isCol}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer Utilities */}
        <div
          className={`p-2 border-t border-border-subtle bg-surface ${isCol ? 'flex flex-col items-center gap-2' : 'space-y-1'}`}
        >
          {onOpenCommandCenter && (
            <button
              type="button"
              onClick={onOpenCommandCenter}
              title="Command Center (⌘K)"
              className={`flex items-center rounded-md text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-200 transition-colors ${
                isCol ? 'p-2 justify-center' : 'w-full justify-between px-2 py-1.5'
              }`}
            >
              <div className="flex items-center gap-2">
                <SearchIcon size={15} />
                {!isCol && <span>Command Center</span>}
              </div>
              {!isCol && (
                <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded bg-surface-100 border border-border-subtle text-text-muted">
                  ⌘K
                </kbd>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            title="Shortcuts (?)"
            className={`flex items-center rounded-md text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-200 transition-colors ${
              isCol ? 'p-2 justify-center' : 'w-full justify-between px-2 py-1.5'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-1">?</span>
              {!isCol && <span>Keyboard Shortcuts</span>}
            </div>
            {!isCol && (
              <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded bg-surface-100 border border-border-subtle text-text-muted">
                ?
              </kbd>
            )}
          </button>
        </div>
      </aside>

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface border border-border-strong shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-text">Keyboard Shortcuts</h3>
              <button
                type="button"
                aria-label="Close shortcuts dialog"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded text-text-muted hover:text-text"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between py-1 px-2 rounded bg-surface-200">
                  <span className="text-text">Open Command Center</span>
                  <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded bg-surface-100 border border-border-subtle text-text-muted">
                    ⌘K / Ctrl+K
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded bg-surface-200">
                  <span className="text-text">Toggle Sidebar</span>
                  <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded bg-surface-100 border border-border-subtle text-text-muted">
                    ⌘B / Ctrl+B
                  </kbd>
                </div>
                <div className="flex items-center justify-between py-1 px-2 rounded bg-surface-200">
                  <span className="text-text">Shortcuts Cheatsheet</span>
                  <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded bg-surface-100 border border-border-subtle text-text-muted">
                    ?
                  </kbd>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface-200 text-text hover:bg-border-subtle transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
