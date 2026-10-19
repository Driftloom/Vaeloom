'use client';

import React, { useCallback, useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Modal, ErrorState, Button, SearchField, Badge, EmptyState } from '@vaeloom/ui-kit';
import { memoryApi, ApiError } from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useToast } from '@/components/shared/Toast';
import type { Memory } from '@vaeloom/shared-types';

interface MemoryCorrectionPanelProps {
  workspaceId?: string;
}

function readSupersedesId(memory: Memory): string {
  const raw = memory as unknown as Record<string, unknown>;
  const metadata = (raw['metadata'] ?? {}) as Record<string, unknown>;
  const candidate =
    raw['supersedesId'] ??
    raw['supersedes_id'] ??
    metadata['supersedesId'] ??
    metadata['supersedes_id'];
  return typeof candidate === 'string' ? candidate : '';
}

export function MemoryCorrectionPanel({ workspaceId }: MemoryCorrectionPanelProps = {}) {
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'superseded'>('all');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // The Corrections view must include superseded rows - that is its entire job -
  // so it fetches with include_superseded=true under its own cache key. It cannot
  // share the active-memories key: SWR dedupes the two mismatched param sets and
  // the superseded rows vanish. The params object is built separately because the
  // client's list-params type does not declare include_superseded yet.
  const listParams = {
    page_size: 100,
    ...(workspaceId ? { workspace_id: workspaceId } : {}),
    include_superseded: true,
  };
  const {
    data: memoriesData,
    error: loadErrorRaw,
    isLoading: loading,
    mutate: reload,
  } = useSWR(
    workspaceId ? `memories-${workspaceId}-with-superseded` : 'memories-all-with-superseded',
    () => memoryApi.list(listParams),
  );

  const memories: Memory[] = useMemo(() => {
    if (!memoriesData) return [];
    const rows = Array.isArray(memoriesData)
      ? (memoriesData as Memory[])
      : ((memoriesData as { memories?: Memory[]; items?: Memory[] }).memories ??
        (memoriesData as { memories?: Memory[]; items?: Memory[] }).items ??
        []);
    return rows.filter((m) => m.status !== 'deleted');
  }, [memoriesData]);

  const loadError: string | null = loadErrorRaw
    ? loadErrorRaw instanceof ApiError
      ? `Could not load memories (HTTP ${loadErrorRaw.status}).`
      : 'Could not load memories. Check your connection and retry.'
    : null;

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const isSuperseded =
        (m.status as string) === 'superseded' ||
        (m.metadata?.['status'] as string) === 'superseded';
      if (statusFilter === 'active' && isSuperseded) return false;
      if (statusFilter === 'superseded' && !isSuperseded) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const contentStr = ((m as unknown as Record<string, unknown>)['content'] as string) || '';
      return (
        (m.title && m.title.toLowerCase().includes(q)) ||
        (typeof m.summary === 'string' && m.summary.toLowerCase().includes(q)) ||
        contentStr.toLowerCase().includes(q) ||
        (Array.isArray(m.tags) && m.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [memories, searchQuery, statusFilter]);

  const openEditor = (memory: Memory) => {
    setEditing(memory);
    setDraftTitle(memory.title || '');
    setDraftSummary(typeof memory.summary === 'string' ? memory.summary : '');
    const contentVal = ((memory as unknown as Record<string, unknown>)['content'] as string) || '';
    setDraftContent(contentVal);
    setDraftReason('Correction via Enterprise Memory Management');
  };

  const saveCorrection = async () => {
    if (!editing || saving) return;
    const originalSummary = typeof editing.summary === 'string' ? editing.summary : '';
    const originalTitle = editing.title || '';
    const originalContent =
      ((editing as unknown as Record<string, unknown>)['content'] as string) || '';

    const titleChanged = draftTitle.trim() !== originalTitle.trim();
    const summaryChanged = draftSummary.trim() !== originalSummary.trim();
    const contentChanged = draftContent.trim() !== originalContent.trim();

    if (!titleChanged && !summaryChanged && !contentChanged) {
      toast({
        tone: 'info',
        title: 'No edits detected',
        detail: 'The revised fields are identical to the original record.',
      });
      return;
    }

    setSaving(true);
    try {
      await memoryApi.supersede(editing.id, {
        reason: draftReason.trim() || 'Human correction via Memory Management',
        title: titleChanged ? draftTitle.trim() : editing.title,
        summary: summaryChanged
          ? draftSummary.trim()
          : typeof editing.summary === 'string'
            ? editing.summary
            : undefined,
        content: contentChanged ? draftContent.trim() : undefined,
      });

      toast({
        tone: 'success',
        title: 'Memory Corrected & Superseded',
        detail: `Original memory #${editing.id.slice(0, 8)} preserved as superseded in provenance ledger.`,
      });
      setEditing(null);
      await reload();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Correction failed',
        detail: err instanceof Error ? err.message : 'Could not save the correction.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="p-6 rounded-xl border border-border bg-surface space-y-5"
      aria-label="Memory corrections and supersession"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-medium text-text">
              Memory Corrections & Supersession
            </h2>
            <Badge variant="mono" size="sm">
              Immutable Ledger
            </Badge>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Modify any belief or note. Corrections automatically fork an immutable superseded
            version linked by <code className="font-mono text-xs">supersedes_id</code> with zero
            data loss.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh Memories
        </Button>
      </header>

      {/* Controls: Search and Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search memories by title, keyword, or tag..."
          />
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'active', 'superseded'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                statusFilter === s
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'bg-surface-100 text-text-secondary hover:bg-surface-hover border border-border'
              }`}
            >
              {s} (
              {
                memories.filter((m) => {
                  const isSup =
                    (m.status as string) === 'superseded' ||
                    (m.metadata?.['status'] as string) === 'superseded';
                  if (s === 'all') return true;
                  if (s === 'active') return !isSup;
                  return isSup;
                }).length
              }
              )
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-surface-100 border border-border"
            />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void reload()} />
      ) : filteredMemories.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching memories' : 'No memories found'}
          description={
            searchQuery
              ? `No memories matched "${searchQuery}". Try a different keyword.`
              : 'Memories created from your notes or agents will appear here for correction.'
          }
        />
      ) : (
        <ul
          role="list"
          className="divide-y divide-border rounded-lg border border-border overflow-hidden"
        >
          {filteredMemories.map((m) => {
            const isSuperseded =
              (m.status as string) === 'superseded' ||
              (m.metadata?.['status'] as string) === 'superseded';
            const supersedesId = readSupersedesId(m);

            return (
              <li
                key={m.id}
                className="p-4 bg-surface hover:bg-surface-hover transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isSuperseded ? 'warning' : 'primary'} size="sm">
                      {m.type || 'note'}
                    </Badge>
                    {isSuperseded && (
                      <Badge variant="warning" size="sm">
                        SUPERSEDED
                      </Badge>
                    )}
                    <h3 className="truncate text-sm font-semibold text-text">
                      {m.title || 'Untitled Memory'}
                    </h3>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {typeof m.summary === 'string' ? m.summary : 'No summary'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted font-mono">
                    <span>ID: {m.id.slice(0, 8)}</span>
                    {supersedesId && (
                      <span>
                        Supersedes:{' '}
                        {workspaceId ? (
                          <Link
                            href={`/workspace/${workspaceId}/memory/${supersedesId}`}
                            className="text-accent hover:underline"
                          >
                            {supersedesId.slice(0, 8)}
                          </Link>
                        ) : (
                          supersedesId.slice(0, 8)
                        )}
                      </span>
                    )}
                    {Array.isArray(m.tags) && m.tags.length > 0 && (
                      <span>Tags: {m.tags.join(', ')}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openEditor(m)}>
                    {isSuperseded ? 'Re-Correct' : 'Correct'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Interactive Correction Modal with Live Diff */}
      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing ? `Correct memory: ${editing.title || editing.id.slice(0, 8)}` : 'Correct memory'
        }
        size="lg"
      >
        {editing && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Edit the fields below. A live word-level diff compares your changes against the active
              record. Saving creates an immutable new memory revision without overwriting history.
            </p>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Memory Title
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label
                htmlFor="memory-summary"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
              >
                Executive Summary
              </label>
              <textarea
                id="memory-summary"
                rows={3}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Live Diff Comparison */}
            <div>
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
                Live Diff Comparison (Original vs Proposed)
              </h4>
              <DiffViewer
                oldText={typeof editing.summary === 'string' ? editing.summary : ''}
                newText={draftSummary}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Content & Raw Notes (Optional)
              </label>
              <textarea
                rows={4}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Correction / Revision Reason (Audit Trail)
              </label>
              <input
                type="text"
                placeholder="e.g., Promoted to Principal Architect; Corrected graduation year"
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <p className="text-[11px] text-text-muted mt-0.5">
                Preserved immutably in provenance ledger alongside cryptographic lineage.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void saveCorrection()} loading={saving}>
                Save Correction & Supersede
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
