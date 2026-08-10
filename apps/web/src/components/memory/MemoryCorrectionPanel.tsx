'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '@vaeloom/ui-kit';
import { memoryApi } from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useToast } from '@/components/shared/Toast';
import { EmptyState } from '@/components/shared/EmptyState';

interface MemoryRow {
  id: string;
  title: string;
  summary?: string;
  type?: string;
  status?: string;
  [key: string]: unknown;
}

export function MemoryCorrectionPanel() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MemoryRow | null>(null);
  const [draftText, setDraftText] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memoryApi.list({ page_size: 25 });
      const items = Array.isArray(res) ? res : ((res as { items?: MemoryRow[] }).items ?? []);
      setMemories(items.filter((m) => m.status !== 'deleted'));
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (memory: MemoryRow) => {
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
    <section className="card mt-6" aria-label="Memory corrections">
      <header className="mb-4">
        <h2 className="text-xl font-display font-medium text-text">Memory Corrections</h2>
        <p className="text-sm text-text-muted">
          Correct a memory summary. Corrections supersede the old version — it stays visible in
          History.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <EmptyState
          title="No memories yet"
          description="Memories created from your documents will appear here for correction."
        />
      ) : (
        <ul className="divide-y divide-border">
          {memories.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{m.title || 'Untitled memory'}</p>
                <p className="truncate text-xs text-text-muted">
                  {typeof m.summary === 'string' ? m.summary : 'No summary'}
                </p>
              </div>
              <button className="btn-secondary shrink-0" onClick={() => openEditor(m)}>
                Correct
              </button>
            </li>
          ))}
        </ul>
      )}

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
            <DiffViewer
              oldText={typeof editing.summary === 'string' ? editing.summary : ''}
              newText={draftText}
            />
            <div>
              <label htmlFor="memory-summary" className="block text-sm text-text-muted mb-1">
                New summary
              </label>
              <textarea
                id="memory-summary"
                className="w-full min-h-[96px] bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
              <p className="mt-1 text-xs text-text-muted">
                Saving creates a superseded version; you can undo from History after saving.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => void saveCorrection()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save correction'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
