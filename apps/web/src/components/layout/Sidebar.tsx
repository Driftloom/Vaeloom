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
  MailIcon,
  HelpCircleIcon,
  CheckSquareIcon,
  LockIcon,
  UsersIcon,
  useScrollLock,
} from '@vaeloom/ui-kit';
import {
  getNavigationGroups,
  PORTAL_MODES,
  type DataMode,
  type AppPortalMode,
} from '@/lib/route-manifest';
import { useAppMode } from '@/hooks/useAppMode';
import { useAuth } from '@/hooks/useAuth';

interface NavLink {
  id: string;
  name: string;
  path: string;
  icon: React.ReactNode;
  dataMode: DataMode;
}

interface NavGroup {
  label: string;
  links: NavLink[];
  enterprise?: boolean;
}

function groupLinks(
  workspaceId: string,
  portalMode?: AppPortalMode | 'all',
  enableEnterprise = false,
): NavGroup[] {
  // E6: enableEnterprise is the server-attested capability from /auth/me —
  // never a client-side NEXT_PUBLIC_* flag.
  const manifestGroups = getNavigationGroups(workspaceId, {
    enableEnterprise,
    portalMode,
  });

  return manifestGroups.map((g) => ({
    label: g.label,
    enterprise: g.enterprise,
    links: g.links.map((link) => ({
      id: link.id,
      name: link.name,
      path: link.path,
      icon: ROUTE_ICONS[link.id] ?? <CpuIcon size={16} />,
      dataMode: link.dataMode,
    })),
  }));
}

const ROUTE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <CpuIcon size={16} />,
  capabilities: <TerminalIcon size={16} />,
  chat: <BrainIcon size={16} />,
  agents: <UsersIcon size={16} />,
  cognition: <CpuIcon size={16} />,
  council: <UsersIcon size={16} />,
  memory: <BrainIcon size={16} />,
  'vault-sync': <DatabaseIcon size={16} />,
  search: <SearchIcon size={16} />,
  files: <FileTextIcon size={16} />,
  career: <BriefcaseIcon size={16} />,
  resume: <FileTextIcon size={16} />,
  jobs: <BriefcaseIcon size={16} />,
  applications: <FileTextIcon size={16} />,
  tasks: <CheckSquareIcon size={16} />,
  history: <ClockIcon size={16} />,
  schedule: <CalendarIcon size={16} />,
  approvals: <ShieldIcon size={16} />,
  connectors: <PlugIcon size={16} />,
  email: <MailIcon size={16} />,
  profile: <UsersIcon size={16} />,
  settings: <SettingsIcon size={16} />,
  security: <ShieldIcon size={16} />,
  vault: <LockIcon size={16} />,
  help: <HelpCircleIcon size={16} />,
  billing: <DatabaseIcon size={16} />,
  admin: <BuildingIcon size={16} />,
  organizations: <BuildingIcon size={16} />,
  marketplace: <BuildingIcon size={16} />,
  developer: <TerminalIcon size={16} />,
  'feature-flags': <SettingsIcon size={16} />,
};

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
        className={`relative flex items-center rounded-md transition-colors text-xs font-medium ${
          collapsed ? 'p-2 justify-center' : 'gap-2.5 px-2.5 py-1.5'
        } ${
          current
            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
            : 'text-text-secondary hover:text-text hover:bg-surface-200'
        }`}
      >
        <span className="shrink-0" aria-hidden="true">
          {link.icon}
        </span>
        {!collapsed ? (
          <>
            <span className="truncate">{link.name}</span>
            {link.dataMode === 'preview' && (
              <span
                aria-hidden="true"
                className="ml-auto text-[9px] font-mono uppercase tracking-wider px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              >
                preview
              </span>
            )}
          </>
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
  portalMode?: AppPortalMode | 'all';
  onClose?: () => void;
  onToggleCollapse?: () => void;
  onOpenCommandCenter?: () => void;
}

export function Sidebar({
  workspaceId,
  isCollapsed = false,
  collapsed,
  open = false,
  portalMode,
  onClose,
  onToggleCollapse,
  onOpenCommandCenter,
}: SidebarProps) {
  const pathname = usePathname();
  const { me } = useAuth();
  const enterpriseEnabled = me?.capabilities?.enterprise === true;
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  useScrollLock(showShortcutsModal);
  const { mode: contextMode, setMode, cycleMode, currentModeMeta } = useAppMode();
  const effectiveMode = portalMode ?? contextMode;

  const isCol = collapsed !== undefined ? collapsed : isCollapsed;
  const groups = groupLinks(workspaceId, effectiveMode, enterpriseEnabled);

  const handleModeChange = (targetMode: AppPortalMode) => {
    setMode(targetMode, true);
  };

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
        className={`h-full border-r border-border-subtle bg-surface flex flex-col transition-all duration-200 select-none relative overflow-hidden ${
          open ? 'fixed inset-y-0 left-0 z-40 w-64' : 'hidden md:flex'
        } ${isCol ? 'md:w-16' : 'md:w-64'}`}
      >
        {/* Brand & Workspace Header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-border-subtle shrink-0">
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

        {/* App Mode Switcher (User Workspace / Admin Console / Developer Studio) */}
        {!isCol ? (
          <div className="px-2.5 pt-2.5 pb-2 border-b border-border-subtle bg-surface-100/60 shrink-0">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-semibold">
                Mode
              </span>
              <span className="text-[10px] font-medium text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                {currentModeMeta.shortLabel}
              </span>
            </div>
            <div
              role="tablist"
              aria-label="Application Mode Switcher"
              className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-surface-200 border border-border-subtle"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'workspace'}
                onClick={() => handleModeChange('workspace')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-2xs font-medium transition-all ${
                  effectiveMode === 'workspace'
                    ? 'bg-surface text-text shadow-sm font-semibold border border-border-subtle'
                    : 'text-text-secondary hover:text-text hover:bg-surface-300/60'
                }`}
                title="Personal Workspace — daily assistant, memory, career"
              >
                <BrainIcon size={12} className="shrink-0" />
                <span>User</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'admin'}
                onClick={() => handleModeChange('admin')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-2xs font-medium transition-all ${
                  effectiveMode === 'admin'
                    ? 'bg-surface text-text shadow-sm font-semibold border border-border-subtle'
                    : 'text-text-secondary hover:text-text hover:bg-surface-300/60'
                }`}
                title="Admin Console — tenant governance, billing, security"
              >
                <BuildingIcon size={12} className="shrink-0" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'developer'}
                onClick={() => handleModeChange('developer')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md text-2xs font-medium transition-all ${
                  effectiveMode === 'developer'
                    ? 'bg-surface text-text shadow-sm font-semibold border border-border-subtle'
                    : 'text-text-secondary hover:text-text hover:bg-surface-300/60'
                }`}
                title="Developer Studio — cognition S1/S2, agent council, connectors"
              >
                <TerminalIcon size={12} className="shrink-0" />
                <span>Dev</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2 border-b border-border-subtle gap-1 shrink-0">
            <button
              type="button"
              onClick={cycleMode}
              title={`Active Mode: ${currentModeMeta.label} (Click to switch)`}
              aria-label={`Active Mode: ${currentModeMeta.label}. Click to switch mode.`}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-200 text-text hover:bg-surface-300 transition-colors border border-border-subtle shadow-sm"
            >
              {effectiveMode === 'workspace' && <BrainIcon size={14} />}
              {effectiveMode === 'admin' && <BuildingIcon size={14} />}
              {effectiveMode === 'developer' && <TerminalIcon size={14} />}
            </button>
            <span className="text-[8px] font-mono uppercase text-text-muted">
              {effectiveMode === 'workspace' ? 'User' : effectiveMode === 'admin' ? 'Adm' : 'Dev'}
            </span>
          </div>
        )}

        {/* Nav Links */}
        <nav
          className="relative flex-1 min-h-0 overflow-y-auto overscroll-y-contain py-2.5 px-2 space-y-4"
          aria-label="Workspace navigation"
        >
          {groups.map((group, gIdx) => (
            <div key={`group-${group.label || gIdx}`}>
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
                {group.links.map((link, lIdx) => (
                  <SidebarNavLink
                    key={`link-${group.label}-${link.id || link.path}-${lIdx}`}
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
          className={`p-2 border-t border-border-subtle bg-surface shrink-0 ${isCol ? 'flex flex-col items-center gap-2' : 'space-y-1'}`}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overscroll-contain"
          onClick={() => setShowShortcutsModal(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowShortcutsModal(false);
          }}
        >
          <div
            className="w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-xl bg-surface border border-border-strong shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
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
