'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Modal, ErrorState, Button, SearchField, Badge, EmptyState } from '@vaeloom/ui-kit';
import { memoryApi, ApiError } from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useToast } from '@/components/shared/Toast';
import type { Memory } from '@vaeloom/shared-types';

interface MemoryCorrectionPanelProps {
  workspaceId?: string;
}

export function MemoryCorrectionPanel({ workspaceId }: MemoryCorrectionPanelProps = {}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'superseded'>('all');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await memoryApi.list({
        page_size: 100,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      });
      const rows = Array.isArray(res)
        ? res
        : ((res as { memories?: Memory[]; items?: Memory[] }).memories ??
          (res as { memories?: Memory[]; items?: Memory[] }).items ??
          []);
      setMemories(rows.filter((m) => m.status !== 'deleted'));
    } catch (err) {
      setMemories([]);
      setLoadError(
        err instanceof ApiError
          ? `Could not load memories (HTTP ${err.status}).`
          : 'Could not load memories. Check your connection and retry.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      await memoryApi.update(editing.id, {
        title: titleChanged ? draftTitle.trim() : undefined,
        summary: summaryChanged ? draftSummary.trim() : undefined,
        content: contentChanged ? draftContent.trim() : undefined,
      } as never);

      toast({
        tone: 'success',
        title: 'Memory Corrected & Superseded',
        detail: `Original memory #${editing.id.slice(0, 8)} preserved as superseded in provenance ledger.`,
      });
      setEditing(null);
      await load();
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
      className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-5"
      aria-label="Memory corrections and supersession"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-medium text-[var(--color-text-primary)]">
              Memory Corrections & Supersession
            </h2>
            <Badge variant="mono" size="sm">
              Immutable Ledger
            </Badge>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Modify any belief or note. Corrections automatically fork an immutable superseded
            version linked by <code className="font-mono text-xs">supersedes_id</code> with zero
            data loss.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
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
                  ? 'bg-[var(--color-brand-primary,#818cf8)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
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
              className="h-16 animate-pulse rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)]"
            />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
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
        <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] overflow-hidden">
          {filteredMemories.map((m) => {
            const isSuperseded =
              (m.status as string) === 'superseded' ||
              (m.metadata?.['status'] as string) === 'superseded';
            const supersedesId =
              (m.metadata?.['supersedes_id'] as string) ||
              ((m as unknown as Record<string, unknown>)['supersedes_id'] as string) ||
              '';

            return (
              <div
                key={m.id}
                className="p-4 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
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
                    <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {m.title || 'Untitled Memory'}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                    {typeof m.summary === 'string' ? m.summary : 'No summary'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--color-text-muted)] font-mono">
                    <span>ID: {m.id.slice(0, 8)}</span>
                    {supersedesId && <span>Supersedes: {supersedesId.slice(0, 8)}</span>}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Correction Modal with Live Diff */}
      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing ? `Correct Memory: ${editing.title || editing.id.slice(0, 8)}` : 'Correct Memory'
        }
        size="lg"
      >
        {editing && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Edit the fields below. A live word-level diff compares your changes against the active
              record. Saving creates an immutable new memory revision without overwriting history.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
                Memory Title
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
                Executive Summary
              </label>
              <textarea
                rows={3}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)]"
              />
            </div>

            {/* Live Diff Comparison */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1.5">
                Live Diff Comparison (Original vs Proposed)
              </h4>
              <DiffViewer
                oldText={typeof editing.summary === 'string' ? editing.summary : ''}
                newText={draftSummary}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
                Content & Raw Notes (Optional)
              </label>
              <textarea
                rows={4}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
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
