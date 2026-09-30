'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Modal, ErrorState, Button, SearchField, Badge } from '@vaeloom/ui-kit';
import { memoryApi, ApiError } from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useToast } from '@/components/shared/Toast';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Memory } from '@vaeloom/shared-types';

export function MemoryCorrectionPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draftText, setDraftText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await memoryApi.list({ page_size: 50 });
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories;
    const q = searchQuery.toLowerCase();
    return memories.filter(
      (m) =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (typeof m.summary === 'string' && m.summary.toLowerCase().includes(q)) ||
        (Array.isArray(m.tags) && m.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [memories, searchQuery]);

  const openEditor = (memory: Memory) => {
    setEditing(memory);
    setDraftText(typeof memory.summary === 'string' ? memory.summary : '');
  };

  const saveCorrection = async () => {
    if (!editing || saving) return;
    const original = typeof editing.summary === 'string' ? editing.summary : '';
    if (draftText.trim() === original.trim()) {
      toast({ tone: 'info', title: 'No change', detail: 'You did not change the summary.' });
      return;
    }
    setSaving(true);
    try {
      await memoryApi.update(editing.id, { summary: draftText } as never);
      toast({
        tone: 'success',
        title: 'Memory corrected',
        detail: `This replaces memory #${editing.id.slice(0, 8)} — the previous version is kept in History as superseded.`,
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
    <section className="card space-y-4" aria-label="Memory corrections">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h2 className="text-xl font-display font-medium text-text">
            Memory Corrections & Supersession
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Modify any memory summary. Corrections automatically create a new version linked by{' '}
            <code className="text-xs font-mono">supersedes_id</code> while keeping full provenance
            history.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </header>

      {/* Search Field */}
      <div className="max-w-md">
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filter memories by title, keyword, or tag..."
        />
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => void load()} />
      ) : filteredMemories.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching memories' : 'No memories yet'}
          description={
            searchQuery
              ? `No memories matched "${searchQuery}". Try a different keyword.`
              : 'Memories created from your documents or agents will appear here for correction.'
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {filteredMemories.map((m) => {
            const isSuperseded =
              (m.status as string) === 'superseded' ||
              (m.metadata?.['status'] as string) === 'superseded';

            return (
              <div
                key={m.id}
                className="p-3 bg-surface hover:bg-surface-hover transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isSuperseded ? 'warning' : 'default'} size="sm">
                      {m.type || 'document'}
                    </Badge>
                    {isSuperseded && (
                      <Badge variant="warning" size="sm">
                        superseded
                      </Badge>
                    )}
                    <p className="truncate text-sm font-medium text-text">
                      {m.title || 'Untitled memory'}
                    </p>
                  </div>
                  <p className="truncate text-xs text-text-muted mt-1">
                    {typeof m.summary === 'string' ? m.summary : 'No summary'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => openEditor(m)}>
                    Correct
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Correction Modal */}
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
            <p className="text-xs text-text-muted">
              Compare the original summary against your proposed edits below before saving.
            </p>

            <DiffViewer
              oldText={typeof editing.summary === 'string' ? editing.summary : ''}
              newText={draftText}
            />

            <div>
              <label htmlFor="memory-summary" className="block text-sm font-medium text-text mb-1">
                Updated Summary Content
              </label>
              <textarea
                id="memory-summary"
                rows={4}
                className="w-full rounded-md border border-border bg-surface-sunken p-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
              <p className="mt-1 text-2xs text-text-muted">
                Saving creates an immutable superseded version. The original remains queryable in
                the lineage graph.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void saveCorrection()} loading={saving}>
                Save Correction
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
