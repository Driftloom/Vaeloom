'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; text: string; source: string; score: number }>>([]);
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
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => { if (paletteOpen) { setFocusedIndex(-1); setTimeout(() => inputRef.current?.focus(), 30); } else { setFocusedIndex(-1); } }, [paletteOpen]);
  useEffect(() => { setFocusedIndex(-1); }, [query, results.length]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await searchApi.all({ query: q.trim(), limit: 10 });
      setResults(res.results ?? []);
    } catch (err) {
      setResults([]);
      toast({ tone: 'error', title: 'Search failed', detail: err instanceof Error ? err.message : 'Try again' });
    } finally { setSearching(false); }
  }, [toast]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = setTimeout(() => { void doSearch(query); }, 300);
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
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
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
      <div className="flex items-center gap-4">
        <button onClick={() => setPaletteOpen(true)} className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-colors" aria-label="Global search">
          <span>Search</span><kbd className="font-mono text-[10px] border border-border rounded px-1">ΓîÿK</kbd>
        </button>
        <button onClick={() => setPaletteOpen(true)} className="sm:hidden p-2 rounded-lg border border-border hover:bg-surface-hover" aria-label="Search">Γîò</button>
        <div className="text-xs font-mono text-text-dim hidden sm:block">Enterprise Mode</div>
        <button
          onClick={handleLogout}
          className="text-xs font-mono text-text-muted hover:text-text transition-colors"
          aria-label="Log out"
        >
          Log out
        </button>
        <div
          className="w-8 h-8 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-muted font-mono text-xs"
          title={user?.email ?? 'User'}
        >
          {initials}
        </div>
      </div>
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} aria-label="Close search" />
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <span className="text-text-muted">Γîò</span>
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
                      if (r.source === 'memory' && workspaceId) router.push(`/workspace/${workspaceId}/memory`);
                      else if (r.source === 'document' && workspaceId) router.push(`/workspace/${workspaceId}/files`);
                      else if (workspaceId) router.push(`/workspace/${workspaceId}/schedule`);
                    }
                  }
                }}
                placeholder="Search files, memories, eventsΓÇª  (e.g. Q3 plan)"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-text-dim outline-none"
              />
              <button onClick={() => setPaletteOpen(false)} className="text-xs text-text-muted">ESC</button>
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {searching ? <p className="p-4 text-center text-sm text-text-muted">SearchingΓÇª</p>
              : results.length === 0 ? <p className="p-6 text-center text-sm text-text-muted">{query.trim() ? 'No results ΓÇö try different keywords.' : 'Type to search across files, memories, and events grouped by source + score.'}</p>
              : (
                <div className="space-y-1">
                  {results.map((r, idx) => (
                    <button
                      key={`${r.source}-${r.id}`}
                      onClick={() => {
                        setPaletteOpen(false);
                        if (r.source === 'memory' && workspaceId) router.push(`/workspace/${workspaceId}/memory`);
                        else if (r.source === 'document' && workspaceId) router.push(`/workspace/${workspaceId}/files`);
                        else if (workspaceId) router.push(`/workspace/${workspaceId}/schedule`);
                      }}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`w-full text-left rounded-lg px-3 py-2 border flex items-start justify-between gap-3 ${idx === focusedIndex ? 'bg-background border-border/50 ring-1 ring-primary/20' : 'border-transparent hover:bg-background hover:border-border/50'}`}>
                      <div className="min-w-0">
                        <p className="text-sm text-text truncate">{r.text}</p>
                        <p className="text-xs font-mono text-text-dim capitalize">{r.source} ┬╖ id {r.id.slice(0,8)}</p>
                      </div>
                      <span className="shrink-0 text-xs font-mono text-text-muted">{Math.round(r.score*100)}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="px-4 py-2 text-xs text-text-dim border-t border-border">Enter opens ┬╖ ΓåæΓåô navigates ┬╖ Global search is workspace-aware.</p>
          </div>
        </div>
      )}
    </header>
  );
}
