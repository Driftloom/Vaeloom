'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { searchApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ id: string; text: string; source: string; score: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceId = React.useMemo(() => {
    const m = pathname?.match(/\/workspace\/([^/]+)/);
    return m ? m[1] : null;
  }, [pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (paletteOpen) {
      setFocusedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setFocusedIndex(-1);
    }
  }, [paletteOpen]);
  useEffect(() => {
    setFocusedIndex(-1);
  }, [query, results.length]);

  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchApi.all({ query: q.trim(), limit: 10 });
        setResults(res.results ?? []);
      } catch (err) {
        setResults([]);
        toast({
          tone: 'error',
          title: 'Search failed',
          detail: err instanceof Error ? err.message : 'Try again',
        });
      } finally {
        setSearching(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => {
      void doSearch(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, paletteOpen, doSearch]);

  const initials = user?.displayName
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

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="md:hidden text-text-muted hover:text-text transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <div className="font-display text-sm text-text-muted">Workspace</div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-colors"
          aria-label="Global search"
        >
          <span>Search</span>
          <kbd className="font-mono text-[10px] border border-border rounded px-1">⌘K</kbd>
        </button>
        <button
          onClick={() => setPaletteOpen(true)}
          className="sm:hidden p-2 rounded-lg border border-border hover:bg-surface-hover"
          aria-label="Search"
        >
          ⌕
        </button>
        <div className="text-xs font-mono text-text-dim hidden sm:block">Enterprise Mode</div>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-muted font-mono text-xs hover:border-primary/30 transition-colors"
            title={user?.email ?? 'User'}
            aria-label="User menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {initials}
          </button>
          {dropdownOpen && (
            <>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-surface shadow-lg py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-text truncate">{user?.displayName}</p>
                  <p className="text-xs text-text-dim truncate">{user?.email}</p>
                </div>
                <Link
                  href={`/workspace/${workspaceId}/profile`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  Profile
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/settings`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <svg
                    className="w-4 h-4"
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
                  Settings
                </Link>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4">
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPaletteOpen(false)}
            aria-label="Close search"
          />
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="text-text-muted">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.max(prev - 1, -1));
                  } else if (e.key === 'Enter') {
                    if (focusedIndex >= 0 && results[focusedIndex]) {
                      e.preventDefault();
                      const r = results[focusedIndex];
                      setPaletteOpen(false);
                      if (r.source === 'memory' && workspaceId)
                        router.push(`/workspace/${workspaceId}/memory`);
                      else if (r.source === 'document' && workspaceId)
                        router.push(`/workspace/${workspaceId}/files`);
                      else if (workspaceId) router.push(`/workspace/${workspaceId}/schedule`);
                    }
                  }
                }}
                placeholder="Search files, memories, events…  (e.g. Q3 plan)"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-text-dim outline-none"
              />
              <button onClick={() => setPaletteOpen(false)} className="text-xs text-text-muted">
                ESC
              </button>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {searching ? (
                <p className="p-4 text-center text-sm text-text-muted">Searching…</p>
              ) : results.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-muted">
                  {query.trim()
                    ? 'No results — try different keywords.'
                    : 'Type to search across files, memories, and events grouped by source + score.'}
                </p>
              ) : (
                <div className="space-y-1">
                  {results.map((r, idx) => (
                    <button
                      key={`${r.source}-${r.id}`}
                      onClick={() => {
                        setPaletteOpen(false);
                        if (r.source === 'memory' && workspaceId)
                          router.push(`/workspace/${workspaceId}/memory`);
                        else if (r.source === 'document' && workspaceId)
                          router.push(`/workspace/${workspaceId}/files`);
                        else if (workspaceId) router.push(`/workspace/${workspaceId}/schedule`);
                      }}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`w-full text-left rounded-lg px-3 py-2 border flex items-start justify-between gap-3 ${idx === focusedIndex ? 'bg-background border-border/50 ring-1 ring-primary/20' : 'border-transparent hover:bg-background hover:border-border/50'}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-text truncate">{r.text}</p>
                        <p className="text-xs font-mono text-text-dim capitalize">
                          {r.source} · id {r.id.slice(0, 8)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-mono text-text-muted">
                        {Math.round(r.score * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="px-4 py-2 text-xs text-text-dim border-t border-border">
              Enter opens · ↑↓ navigates · Global search is workspace-aware.
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
