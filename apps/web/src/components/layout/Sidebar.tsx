'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  name: string;
  path: string;
  icon: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
  enterprise?: boolean;
}

function groupLinks(workspaceId: string): NavGroup[] {
  const ws = (path: string) => `/workspace/${workspaceId}${path}`;
  return [
    {
      label: 'Assist',
      links: [
        { name: 'Dashboard', path: ws(''), icon: '📊' },
        { name: 'Chat', path: ws('/chat'), icon: '💬' },
      ],
    },
    {
      label: 'Memory',
      links: [
        { name: 'Files', path: ws('/files'), icon: '📁' },
        { name: 'Memory Graph', path: ws('/memory'), icon: '🕸️' },
        { name: 'History', path: ws('/history'), icon: '⏳' },
      ],
    },
    {
      label: 'Career',
      links: [
        { name: 'Resume', path: ws('/resume'), icon: '📄' },
        { name: 'Jobs', path: ws('/jobs'), icon: '💼' },
        { name: 'Applications', path: ws('/applications'), icon: '📋' },
      ],
    },
    {
      label: 'Operations',
      links: [
        { name: 'Schedule', path: ws('/schedule'), icon: '📅' },
        { name: 'Notifications', path: ws('/notifications'), icon: '🔔' },
        { name: 'Connectors', path: ws('/connectors'), icon: '🔌' },
      ],
    },
    {
      label: 'Trust & Rights',
      links: [{ name: 'Settings', path: ws('/settings'), icon: '⚙️' }],
    },
    {
      label: 'Enterprise',
      enterprise: true,
      links: [
        { name: 'Admin', path: ws('/admin'), icon: '🛡️' },
        { name: 'Billing', path: ws('/billing'), icon: '💰' },
        { name: 'Organizations', path: ws('/organizations'), icon: '🏢' },
        { name: 'Feature Flags', path: ws('/feature-flags'), icon: '🚩' },
        { name: 'Marketplace', path: ws('/marketplace'), icon: '🧩' },
        { name: 'Developer', path: ws('/developer'), icon: '🔧' },
      ],
    },
  ];
}

function SidebarNavLink({ link, current }: { link: NavLink; current: boolean }) {
  return (
    <li key={link.name}>
      <Link
        href={link.path}
        aria-current={current ? 'page' : undefined}
        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors font-mono text-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true" className="w-5 text-center">
          {link.icon}
        </span>
        <span>{link.name}</span>
      </Link>
    </li>
  );
}

export function Sidebar({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const groups = groupLinks(workspaceId);

  return (
    <aside
      data-testid="sidebar"
      className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col h-screen shrink-0 transition-transform duration-200 md:static ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-display font-semibold text-primary">Vaeloom</h1>
        <button
          onClick={onClose}
          aria-label="Close navigation"
          className="md:hidden text-text-muted hover:text-text transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Workspace navigation">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-muted/70">
              {group.label}
              {group.enterprise && (
                <span
                  className="ml-1 rounded border border-border px-1 py-0.5 text-[9px] normal-case tracking-normal text-text-muted"
                  title="Enterprise features are visible but gated out of MVP scope"
                >
                  gated
                </span>
              )}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => (
                <SidebarNavLink key={link.name} link={link} current={pathname === link.path} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
