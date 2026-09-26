'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { searchApi } from '@/lib/api-client';
import { WORKSPACE_ROUTES } from '@/lib/route-manifest';
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
  CheckSquareIcon,
  LockIcon,
  UsersIcon,
  MailIcon,
  HelpCircleIcon,
} from '@vaeloom/ui-kit';

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

const ROUTE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <CpuIcon size={16} />,
  capabilities: <TerminalIcon size={16} />,
  chat: <BrainIcon size={16} />,
  agents: <UsersIcon size={16} />,
  cognition: <CpuIcon size={16} />,
  council: <UsersIcon size={16} />,
  memory: <BrainIcon size={16} />,
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

const ROUTE_SHORTCUTS: Record<string, string> = {
  dashboard: 'G D',
  capabilities: 'G C',
  chat: 'G A',
  memory: 'G M',
  settings: 'G S',
};

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

  // Workspace navigation commands generated from canonical WORKSPACE_ROUTES manifest
  const isEnterprise = process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] === 'true';

  const navigationCommands = useMemo<CommandItem[]>(() => {
    return WORKSPACE_ROUTES.filter((r) => !r.enterprise || isEnterprise).map((r) => {
      const path = r.subpath ? `/${r.subpath}` : '';
      return {
        id: `nav-${r.id}`,
        title: r.label,
        subtitle: r.description,
        category: 'navigation',
        badge: r.dataMode === 'preview' ? `${r.section} (Preview)` : r.section,
        shortcut: ROUTE_SHORTCUTS[r.id],
        icon: ROUTE_ICONS[r.id] ?? <CpuIcon size={16} />,
        perform: () => {
          router.push(ws(path));
          onClose();
        },
      };
    });
  }, [ws, router, onClose, isEnterprise]);

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
          router.push(ws('/capabilities?category=agents&action=new'));
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
          else if (r.source === 'agent') router.push(ws('/capabilities?category=agents'));
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
      const curr = cats.indexOf(activeCategory);
      const nextIdx = e.shiftKey
        ? (curr - 1 + cats.length) % cats.length
        : (curr + 1) % cats.length;
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
          <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-2xs text-text-dim border border-border rounded px-1.5 py-0.5 bg-background">
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
            <span className="ml-auto text-xs text-text-dim animate-pulse flex items-center gap-1">
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
                      <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-surface-100 border border-border text-text-dim">
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="font-mono text-2xs px-1.5 py-0.5 rounded border border-border bg-background text-text-muted">
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
        <div className="px-4 py-2.5 border-t border-border bg-surface-50/70 flex items-center justify-between text-xs text-text-dim">
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
          <span className="font-mono text-2xs">Vaeloom Command Center</span>
        </div>
      </div>
    </div>
  );
}
