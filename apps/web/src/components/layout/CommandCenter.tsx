'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { searchApi } from '@/lib/api-client';

export type CommandCategory = 'all' | 'navigation' | 'actions' | 'search';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'navigation' | 'actions' | 'search';
  badge?: string;
  shortcut?: string;
  icon: React.ReactNode;
  perform: () => void;
}

interface SearchResultItem {
  id: string;
  text: string;
  source: string;
  score: number;
}

const RECENT_KEY = 'vaeloom.commandCenter.recent';

export function CommandCenter({
  open,
  onClose,
  onToggleSidebar,
}: {
  open: boolean;
  onClose: () => void;
  onToggleSidebar?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommandCategory>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputId = useId();

  const workspaceId = useMemo(() => {
    const match = pathname?.match(/\/workspace\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const ws = useCallback(
    (subpath: string) => (workspaceId ? `/workspace/${workspaceId}${subpath}` : '/workspace'),
    [workspaceId],
  );

  // Load recent IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecent = useCallback((id: string) => {
    try {
      setRecentIds((prev) => {
        const next = [id, ...prev.filter((item) => item !== id)].slice(0, 6);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  // Base navigation commands across all 22 workspace routes
  const navigationCommands = useMemo<CommandItem[]>(() => {
    return [
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        subtitle: 'Overview, morning briefing & active feed',
        category: 'navigation',
        badge: 'Workspace',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws(''));
          onClose();
        },
      },
      {
        id: 'nav-agents',
        title: 'Agents',
        subtitle: 'Autonomous agents, status & execution logs',
        category: 'navigation',
        badge: 'Assist',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 14.25l-1.25-2.25L13.5 10.75l2.25-1.25L17 7.25l1.25 2.25L20.5 10.75l-2.25 1.25z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/agents'));
          onClose();
        },
      },
      {
        id: 'nav-chat',
        title: 'Chat Assistant',
        subtitle: 'Conversational agent orchestration & memory recall',
        category: 'navigation',
        badge: 'Assist',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.154-.63 3.75 3.75 0 00-.51-1.92A8.966 8.966 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/chat'));
          onClose();
        },
      },
      {
        id: 'nav-memory',
        title: 'Memory Graph',
        subtitle: 'Interactive knowledge graph, entities & memory nodes',
        category: 'navigation',
        badge: 'Memory',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/memory'));
          onClose();
        },
      },
      {
        id: 'nav-resume',
        title: 'Resume & Documents',
        subtitle: 'ATS resume builder, tailoring & PDF/DOCX compile',
        category: 'navigation',
        badge: 'Career',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/resume'));
          onClose();
        },
      },
      {
        id: 'nav-applications',
        title: 'Job Applications',
        subtitle: 'Application tracking, stages & automated submissions',
        category: 'navigation',
        badge: 'Career',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/applications'));
          onClose();
        },
      },
      {
        id: 'nav-files',
        title: 'Files & Documents',
        subtitle: 'Source files, PDF uploads & embeddings index',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/files'));
          onClose();
        },
      },
      {
        id: 'nav-notifications',
        title: 'Notifications & Approvals',
        subtitle: 'Human-in-the-loop approval gates & system alerts',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/notifications'));
          onClose();
        },
      },
      {
        id: 'nav-connectors',
        title: 'Integrations & Connectors',
        subtitle: 'Google Drive, Gmail, GitHub, LinkedIn, MCP bridges',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/connectors'));
          onClose();
        },
      },
      {
        id: 'nav-schedule',
        title: 'Schedule & Crons',
        subtitle: 'Automated recurring tasks and agent triggers',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/schedule'));
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        title: 'Analytics & Token Usage',
        subtitle: 'Execution costs, token budgeting & agent metrics',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/analytics'));
          onClose();
        },
      },
      {
        id: 'nav-billing',
        title: 'Billing & Plans',
        subtitle: 'Subscription management, plan upgrade & payment methods',
        category: 'navigation',
        badge: 'Operations',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/billing'));
          onClose();
        },
      },
      {
        id: 'nav-profile',
        title: 'Profile & Security',
        subtitle: 'Sessions, TOTP MFA, 2FA recovery, GDPR data export',
        category: 'navigation',
        badge: 'Trust & Rights',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/profile'));
          onClose();
        },
      },
      {
        id: 'nav-settings',
        title: 'Workspace Settings',
        subtitle: 'Workspace name, preferences & configuration',
        category: 'navigation',
        badge: 'Operations',
        icon: (
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
        ),
        perform: () => {
          router.push(ws('/settings'));
          onClose();
        },
      },
      {
        id: 'nav-vault',
        title: 'Secrets Vault',
        subtitle: 'Zero-trust encryption keys and external credentials',
        category: 'navigation',
        badge: 'Trust & Rights',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/vault'));
          onClose();
        },
      },
    ];
  }, [ws, router, onClose]);

  // Quick action commands
  const actionCommands = useMemo<CommandItem[]>(() => {
    return [
      {
        id: 'act-new-agent',
        title: 'Create New AI Agent',
        subtitle: 'Configure a new autonomous reasoning agent',
        category: 'actions',
        shortcut: 'N',
        badge: 'Action',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/agents?action=new'));
          onClose();
        },
      },
      {
        id: 'act-new-chat',
        title: 'Start Fresh Chat',
        subtitle: 'Open a clean conversational session with AI agents',
        category: 'actions',
        badge: 'Action',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/chat?new=true'));
          onClose();
        },
      },
      {
        id: 'act-upload-resume',
        title: 'Upload Resume / Document',
        subtitle: 'Extract skills and ingest into semantic memory',
        category: 'actions',
        badge: 'Action',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/resume'));
          onClose();
        },
      },
      {
        id: 'act-toggle-theme',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: `Current: ${theme === 'dark' ? 'Pure Black' : 'Enterprise Light'}`,
        category: 'actions',
        shortcut: 'T',
        badge: 'Theme',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
            />
          </svg>
        ),
        perform: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'act-toggle-sidebar',
        title: 'Toggle Sidebar Collapse',
        subtitle: 'Expand or minimize the left workspace navigation',
        category: 'actions',
        shortcut: 'Ctrl+B',
        badge: 'Layout',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={1.5} />
            <path d="M9 3v18" strokeWidth={1.5} />
          </svg>
        ),
        perform: () => {
          if (onToggleSidebar) onToggleSidebar();
          onClose();
        },
      },
      {
        id: 'act-security-sessions',
        title: 'Manage Active Sessions',
        subtitle: 'Audit remote devices and revoke other active sessions',
        category: 'actions',
        badge: 'Security',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/profile'));
          onClose();
        },
      },
      {
        id: 'act-export-data',
        title: 'Export Personal Data (GDPR)',
        subtitle: 'Download complete profile archive in JSON format',
        category: 'actions',
        badge: 'Privacy',
        icon: (
          <svg
            className="w-4 h-4 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        ),
        perform: () => {
          router.push(ws('/profile'));
          onClose();
        },
      },
      {
        id: 'act-logout',
        title: 'Log Out',
        subtitle: 'End session and clear auth tokens',
        category: 'actions',
        badge: 'Auth',
        icon: (
          <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
        ),
        perform: () => {
          logout();
          router.replace('/login');
          onClose();
        },
      },
    ];
  }, [router, ws, onClose, theme, toggleTheme, onToggleSidebar, logout]);

  // Debounced live search across searchApi.all()
  useEffect(() => {
    if (!open || !query.trim() || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchApi.all({ query: query.trim(), limit: 6 });
        setSearchResults(res.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Transform live search results into CommandItem
  const searchCommands = useMemo<CommandItem[]>(() => {
    return searchResults.map((r) => {
      const matchScore = Math.round(r.score * 100);
      return {
        id: `search-${r.source}-${r.id}`,
        title: r.text,
        subtitle: `${r.source.toUpperCase()} · Match ${matchScore}%`,
        category: 'search',
        badge: `${matchScore}%`,
        icon: (
          <svg
            className="w-4 h-4 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        ),
        perform: () => {
          if (r.source === 'memory') router.push(ws('/memory'));
          else if (r.source === 'document') router.push(ws('/files'));
          else if (r.source === 'agent') router.push(ws('/agents'));
          else router.push(ws('/schedule'));
          onClose();
        },
      };
    });
  }, [searchResults, router, ws, onClose]);

  // Filtered command items according to query and category tab
  const filteredCommands = useMemo(() => {
    let pool: CommandItem[] = [];
    if (activeCategory === 'navigation') pool = navigationCommands;
    else if (activeCategory === 'actions') pool = actionCommands;
    else if (activeCategory === 'search') pool = searchCommands;
    else pool = [...actionCommands, ...navigationCommands, ...searchCommands];

    if (!query.trim()) {
      return pool;
    }

    const q = query.toLowerCase().trim();
    return pool.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
        (cmd.badge && cmd.badge.toLowerCase().includes(q)),
    );
  }, [activeCategory, navigationCommands, actionCommands, searchCommands, query]);

  // Reset focus on query/filter changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [query, activeCategory]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setFocusedIndex(0);
      setQuery('');
      setActiveCategory('all');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[focusedIndex];
      if (selected) {
        saveRecent(selected.id);
        selected.perform();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cats: CommandCategory[] = ['all', 'navigation', 'actions', 'search'];
      const nextIdx = (cats.indexOf(activeCategory) + 1) % cats.length;
      setActiveCategory(cats[nextIdx]!);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={searchInputId}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh] p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onKeyDown={handleKeyDown}
      >
        {/* Search header bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-surface">
          <svg
            className="w-5 h-5 text-primary shrink-0"
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
          <input
            id={searchInputId}
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search memories, or jump to a page…"
            className="flex-1 bg-transparent text-sm sm:text-base text-text placeholder:text-text-dim outline-none"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs text-text-dim hover:text-text px-1.5 py-0.5 rounded bg-surface-hover"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-text-dim border border-border rounded px-1.5 py-0.5 bg-background">
            ESC
          </kbd>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-surface-50/50 overflow-x-auto text-xs">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'navigation', label: 'Navigation' },
              { id: 'actions', label: 'Quick Actions' },
              { id: 'search', label: 'Search Results' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeCategory === tab.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {isSearching && (
            <span className="ml-auto text-[11px] text-text-dim animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Searching…
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border/20"
        >
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-text">No matching commands or records</p>
              <p className="text-xs text-text-dim mt-1">
                Try typing keywords like &ldquo;agent&rdquo;, &ldquo;resume&rdquo;,
                &ldquo;theme&rdquo;, or &ldquo;chat&rdquo;.
              </p>
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const isFocused = index === focusedIndex;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    saveRecent(item.id);
                    item.perform();
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isFocused
                      ? 'bg-surface-200 border border-primary/30 shadow-sm'
                      : 'border border-transparent hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isFocused ? 'bg-primary/20 text-primary' : 'bg-surface-100 text-text-muted'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${isFocused ? 'text-primary' : 'text-text'}`}
                      >
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="text-xs text-text-dim truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-100 border border-border text-text-dim">
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-background text-text-muted">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer command legend */}
        <div className="px-4 py-2.5 border-t border-border bg-surface-50/70 flex items-center justify-between text-[11px] text-text-dim">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono px-1 py-0.5 border border-border rounded bg-background text-text-muted">
                ↑
              </kbd>{' '}
              <kbd className="font-mono px-1 py-0.5 border border-border rounded bg-background text-text-muted">
                ↓
              </kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="font-mono px-1 py-0.5 border border-border rounded bg-background text-text-muted">
                ↵
              </kbd>{' '}
              select
            </span>
            <span>
              <kbd className="font-mono px-1 py-0.5 border border-border rounded bg-background text-text-muted">
                tab
              </kbd>{' '}
              filter
            </span>
          </div>
          <span className="font-mono text-[10px]">Vaeloom Command Center</span>
        </div>
      </div>
    </div>
  );
}
