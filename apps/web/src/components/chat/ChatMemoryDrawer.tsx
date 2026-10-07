'use client';

import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';

export interface MemoryItem {
  id: string;
  type: string;
  title: string;
  content: string;
  domain?: string;
  confidence?: number;
  createdAt?: string;
}

export interface ChatMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onRecallContext?: (contextSnippet: string) => void;
}

export function ChatMemoryDrawer({
  isOpen,
  onClose,
  workspaceId,
  onRecallContext,
}: ChatMemoryDrawerProps): JSX.Element | null {
  const [search, setSearch] = useState('');

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { data, isLoading, error } = useSWR<{ memories?: MemoryItem[]; items?: MemoryItem[] }>(
    isOpen && workspaceId ? `/workspaces/${workspaceId}/memories` : null,
    async (url: string) => {
      try {
        const res = await api.get<Record<string, unknown>>(url);
        return res as unknown as { memories?: MemoryItem[]; items?: MemoryItem[] };
      } catch {
        return { memories: [] };
      }
    },
    { revalidateOnFocus: false },
  );

  if (!isOpen) return null;

  const rawList = data?.memories ?? data?.items ?? [];
  const filteredMemories = rawList.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.type && m.type.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end"
      data-testid="chat-memory-drawer-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-100 border-l border-border h-full shadow-2xl flex flex-col p-4 space-y-3 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Obsidian Memory Vault"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📌</span>
            <div>
              <h2 className="text-sm font-semibold text-text">Memory & Vault Grounding</h2>
              <p className="text-[11px] text-text-dim">
                Long-term knowledge nodes referenced by workspace agents
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close memory drawer"
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pinned memories & notes..."
            className="w-full px-3 py-1.5 text-xs bg-surface-50 border border-border/60 rounded-lg text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-action"
            data-testid="memory-search-input"
          />
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="py-8 text-center text-xs text-text-dim animate-pulse">
              Reading memory vault nodes...
            </div>
          )}

          {!isLoading && filteredMemories.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <span className="text-2xl">🧠</span>
              <p className="text-xs text-text-muted font-medium">No memories found</p>
              <p className="text-[11px] text-text-dim max-w-xs mx-auto">
                Pin key assistant answers using &ldquo;📌 Save to Memory Vault&rdquo; to build
                persistent workspace knowledge.
              </p>
            </div>
          )}

          {filteredMemories.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-lg border border-border/50 bg-surface-50/70 hover:border-border transition-colors space-y-1.5"
              data-testid={`memory-item-${m.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-text line-clamp-1">{m.title}</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-surface-200 border border-border text-text-dim shrink-0">
                  {m.type || 'knowledge'}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">{m.content}</p>
              {onRecallContext && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onRecallContext(`[Memory: ${m.title}]\n${m.content}`);
                      onClose();
                    }}
                    className="text-[11px] text-action hover:underline font-medium"
                  >
                    + Inject Context
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
