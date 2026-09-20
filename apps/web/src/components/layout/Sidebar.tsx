'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';

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

const iconClass = 'w-4 h-4 shrink-0';

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
        {
          name: 'Dashboard',
          path: ws(''),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          ),
        },
        {
          name: 'Agents',
          path: ws('/agents'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 14.25l-1.25-2.25L13.5 10.75l2.25-1.25L17 7.25l1.25 2.25L20.5 10.75l-2.25 1.25z"
              />
            </svg>
          ),
        },
        {
          name: 'Capabilities',
          path: ws('/capabilities'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
              />
            </svg>
          ),
        },
        {
          name: 'Chat',
          path: ws('/chat'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Memory',
      links: [
        {
          name: 'Files',
          path: ws('/files'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          ),
        },
        {
          name: 'Memory Graph',
          path: ws('/memory'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
          ),
        },
        {
          name: 'History',
          path: ws('/history'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Career',
      links: [
        {
          name: 'Resume',
          path: ws('/resume'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          ),
        },
        {
          name: 'Jobs',
          path: ws('/jobs'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
              />
            </svg>
          ),
        },
        {
          name: 'Applications',
          path: ws('/applications'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Operations',
      links: [
        {
          name: 'Schedule',
          path: ws('/schedule'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          ),
        },
        {
          name: 'Notifications',
          path: ws('/notifications'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          ),
        },
        {
          name: 'Connectors',
          path: ws('/connectors'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
          ),
        },
        {
          name: 'Approvals',
          path: ws('/approvals'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Trust & Rights',
      links: [
        {
          name: 'Sovereign Vault',
          path: ws('/vault'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          ),
        },
        {
          name: 'Settings',
          path: ws('/settings'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Enterprise',
      enterprise: true,
      links: [
        {
          name: 'Admin',
          path: ws('/admin'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          ),
        },
        {
          name: 'Billing',
          path: ws('/billing'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
              />
            </svg>
          ),
        },
        {
          name: 'Organizations',
          path: ws('/organizations'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          ),
        },
        {
          name: 'Feature Flags',
          path: ws('/feature-flags'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
              />
            </svg>
          ),
        },
        {
          name: 'Marketplace',
          path: ws('/marketplace'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V6a3 3 0 013-3h12a3 3 0 013 3v3.349"
              />
            </svg>
          ),
        },
        {
          name: 'Developer',
          path: ws('/developer'),
          icon: (
            <svg
              className={iconClass}
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
          ),
        },
      ],
    },
  ];

  return enableEnterprise ? allGroups : allGroups.filter((g) => !g.enterprise);
}

function SidebarNavLink({
  link,
  current,
  collapsed = false,
}: {
  link: NavLink;
  current: boolean;
  collapsed?: boolean;
}) {
  return (
    <li>
      <Link
        href={link.path}
        aria-current={current ? 'page' : undefined}
        title={collapsed ? link.name : undefined}
        className={`group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${
          collapsed ? 'justify-center p-2.5 mx-auto' : 'gap-3 px-3 py-2'
        } ${
          current
            ? 'bg-surface-200 text-text font-semibold shadow-xs'
            : 'text-text-muted hover:bg-surface-hover hover:text-text'
        }`}
      >
        {/* Subtle glowing left accent pill on active state */}
        {current && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary shadow-[0_0_8px_rgba(230,126,34,0.6)]"
          />
        )}
        <span
          aria-hidden="true"
          className={`shrink-0 transition-colors ${
            current ? 'text-primary' : 'text-text-muted group-hover:text-text'
          }`}
        >
          {link.icon}
        </span>
        <span className={collapsed ? 'sr-only' : 'truncate'}>{link.name}</span>
      </Link>
    </li>
  );
}

export interface SidebarProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommandCenter?: () => void;
}

export function Sidebar({
  workspaceId,
  open,
  onClose,
  collapsed = false,
  onToggleCollapse,
  onOpenCommandCenter,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, me } = useAuth();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  const groups = groupLinks(workspaceId);
  const ws = (path: string) => `/workspace/${workspaceId}${path}`;

  // On mobile drawer (open === true), show full width expanded view
  const isCollapsed = collapsed && !open;

  // Multi-workspace list from authenticated session
  const workspaces = me?.workspaces ?? [];
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId) ?? {
    id: workspaceId,
    name: 'Personal Workspace',
    description: undefined,
  };

  // Close workspace dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    }
    if (workspaceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [workspaceMenuOpen]);

  // Global listener for '?' to open shortcuts modal (unless focused in text field)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? 'U');

  const userName = user?.displayName ?? user?.email ?? 'User';

  return (
    <>
      <aside
        data-testid="sidebar"
        aria-label="Workspace sidebar"
        className={`fixed inset-y-0 left-0 z-40 bg-surface border-r border-border flex flex-col h-screen shrink-0 transition-[width,transform] duration-200 ease-in-out md:static ${
          isCollapsed ? 'w-60 md:w-[68px]' : 'w-60'
        } ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Top Header & Workspace Switcher */}
        <div
          className={`h-14 border-b border-border flex items-center shrink-0 ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
          }`}
        >
          {isCollapsed ? (
            <button
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              title="Expand sidebar (Ctrl+B)"
              className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            >
              V
            </button>
          ) : (
            <>
              {/* Workspace Switcher Trigger */}
              <div className="relative min-w-0 flex-1 mr-1" ref={workspaceMenuRef}>
                <button
                  type="button"
                  onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
                  aria-expanded={workspaceMenuOpen}
                  aria-haspopup="true"
                  title="Switch workspace"
                  className="w-full flex items-center gap-2 p-1 rounded-lg hover:bg-surface-hover transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0 group-hover:bg-primary/25 transition-colors">
                    {activeWorkspace.name ? activeWorkspace.name.charAt(0).toUpperCase() : 'V'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-text truncate leading-tight">
                        {activeWorkspace.name || 'Vaeloom'}
                      </span>
                    </div>
                    <span className="block text-[10px] font-mono text-text-dim truncate">
                      {activeWorkspace.description || 'workspace'}
                    </span>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200 ${
                      workspaceMenuOpen ? 'rotate-180 text-text' : 'group-hover:text-text'
                    }`}
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>

                {/* Workspace Switcher Menu */}
                {workspaceMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 rounded-xl bg-surface-100 border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-dim border-b border-border/50 mb-1 flex items-center justify-between">
                      <span>Workspaces</span>
                      <span className="text-[9px] font-sans text-text-muted">
                        {workspaces.length > 0 ? `${workspaces.length} active` : '1 active'}
                      </span>
                    </div>
                    <div className="space-y-0.5 max-h-56 overflow-y-auto">
                      {workspaces.length > 0 ? (
                        workspaces.map((wsItem) => {
                          const isActive = wsItem.id === workspaceId;
                          const initial = wsItem.name ? wsItem.name.charAt(0).toUpperCase() : 'W';
                          return (
                            <Link
                              key={wsItem.id}
                              href={`/workspace/${wsItem.id}`}
                              onClick={() => setWorkspaceMenuOpen(false)}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                                isActive
                                  ? 'bg-surface-200 text-text font-medium border border-border/50'
                                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded bg-surface-300 border border-border flex items-center justify-center text-2xs font-bold text-text-muted shrink-0">
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium leading-none mb-0.5">
                                    {wsItem.name}
                                  </p>
                                  {wsItem.description && (
                                    <p className="text-2xs text-text-dim truncate leading-none">
                                      {wsItem.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isActive && (
                                <svg
                                  className="w-4 h-4 text-primary shrink-0 ml-1.5"
                                  aria-hidden="true"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2.5}
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12.75l6 6 9-13.5"
                                  />
                                </svg>
                              )}
                            </Link>
                          );
                        })
                      ) : (
                        <div className="px-2.5 py-2 text-xs text-text-muted">
                          {activeWorkspace.name}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border mt-1 pt-1">
                      <Link
                        href={ws('/settings')}
                        onClick={() => setWorkspaceMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                        <span>Workspace Settings</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapse & Mobile Close Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar (Ctrl+B)"
                    className="hidden md:flex p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close navigation"
                  className="md:hidden p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* User Card */}
        <div
          className={`border-b border-border shrink-0 ${
            isCollapsed ? 'p-2 flex justify-center' : 'px-3 py-2.5'
          }`}
        >
          <Link
            href={ws('/profile')}
            title={isCollapsed ? `${userName} (Profile)` : undefined}
            className={`flex items-center rounded-lg hover:bg-surface-hover transition-colors group ${
              isCollapsed ? 'p-1.5 justify-center' : 'gap-3 px-2 py-1.5'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-surface-active border border-border flex items-center justify-center text-text font-mono text-xs font-semibold shrink-0 group-hover:border-primary/50 transition-colors">
              {userInitials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text truncate group-hover:text-primary transition-colors">
                  {userName}
                </p>
                <p className="text-[11px] text-text-dim truncate">View Profile & Security</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation IA spaces */}
        <nav
          className={`flex-1 overflow-y-auto py-3 ${isCollapsed ? 'px-1.5' : 'px-2'}`}
          aria-label="Workspace navigation"
        >
          {groups.map((group) => (
            <div key={group.label} className={isCollapsed ? 'mb-2' : 'mb-4'}>
              {isCollapsed ? (
                <div className="mx-2 my-2 border-t border-border/40" title={group.label} />
              ) : (
                <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-text-dim">
                  {group.label}
                  {group.enterprise && (
                    <span
                      className="ml-1.5 rounded border border-border px-1 py-0.5 text-[9px] normal-case tracking-normal text-text-dim"
                      title="Enterprise features are visible but gated out of MVP scope"
                    >
                      gated
                    </span>
                  )}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.links.map((link) => (
                  <SidebarNavLink
                    key={link.name}
                    link={link}
                    current={pathname === link.path}
                    collapsed={isCollapsed}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Utility Bar */}
        <div
          className={`border-t border-border bg-surface shrink-0 ${
            isCollapsed ? 'p-2 flex flex-col items-center gap-1.5' : 'p-2.5 space-y-1.5'
          }`}
        >
          {isCollapsed ? (
            <>
              {onOpenCommandCenter && (
                <button
                  type="button"
                  onClick={onOpenCommandCenter}
                  title="Command Center (⌘K)"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors"
                >
                  <span className="sr-only">Command Center (⌘K)</span>
                  <svg
                    className="w-4 h-4"
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                title="Keyboard shortcuts (?)"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors"
              >
                <span className="sr-only">Keyboard shortcuts (?)</span>
                <svg
                  className="w-4 h-4"
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.008v.008H12V18z"
                  />
                </svg>
              </button>
            </>
          ) : (
            <>
              {onOpenCommandCenter && (
                <button
                  type="button"
                  onClick={onOpenCommandCenter}
                  title="Open Command Center (⌘K)"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text bg-surface-100 hover:bg-surface-hover border border-border transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors shrink-0"
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                    <span>Command Center</span>
                  </div>
                  <kbd className="inline-flex items-center font-mono text-[10px] text-text-dim px-1.5 py-0.5 rounded bg-surface-200 border border-border">
                    ⌘K
                  </kbd>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.008v.008H12V18z"
                    />
                  </svg>
                  <span>Shortcuts</span>
                </div>
                <kbd className="inline-flex items-center font-mono text-[10px] text-text-dim px-1.5 py-0.5 rounded bg-surface-200 border border-border">
                  ?
                </kbd>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface-100 border border-border shadow-2xl overflow-hidden p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  ⌨
                </div>
                <h3 className="text-sm font-semibold text-text">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                aria-label="Close shortcuts dialog"
                className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  aria-hidden="true"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim mb-2">
                  Navigation & Command Center
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Open Command Center</span>
                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                      ⌘K / Ctrl+K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Toggle Sidebar</span>
                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                      Ctrl+B / ⌘B
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Keyboard Shortcuts Help</span>
                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                      ?
                    </kbd>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim mb-2">
                  Modal Navigation
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Move selection</span>
                    <div className="flex items-center gap-1">
                      <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                        ↑
                      </kbd>
                      <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                        ↓
                      </kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Select / Execute action</span>
                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                      Enter
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-200/50">
                    <span className="text-text">Close Modal / Drawer</span>
                    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-200 hover:bg-surface-300 text-text transition-colors"
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
