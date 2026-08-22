'use client';

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { memoryApi, memoryFeedApi, type MemoryLineageResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@vaeloom/ui-kit';

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString();
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-text-muted">{pct}%</span>
    </div>
  );
}

export default function MemoryDetailPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const memoryId = params?.['memoryId'] as string | undefined;
  const { toast } = useToast();

  const {
    data: memory,
    error: memoryError,
    isLoading: memoryLoading,
    mutate: mutateMemory,
  } = useSWR(memoryId ? `memory-${memoryId}` : null, () => memoryApi.get(memoryId!));

  const { data: lineage, isLoading: lineageLoading } = useSWR<MemoryLineageResponse>(
    memoryId ? `lineage-${memoryId}` : null,
    () => memoryFeedApi.lineage(memoryId!),
  );

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback(() => {
    if (!memory) return;
    const mem = memory as unknown as Record<string, unknown>;
    setEditTitle((mem['title'] as string) ?? '');
    setEditSummary((mem['summary'] as string) ?? '');
    setEditContent((mem['content'] as string) ?? '');
    setEditing(true);
  }, [memory]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!memory || saving) return;
    setSaving(true);
    try {
      await memoryApi.update(memory.id, {
        title: editTitle || undefined,
        summary: editSummary || undefined,
        content: editContent || undefined,
      });
      toast({
        tone: 'success',
        title: 'Memory updated',
        detail: 'Changes saved successfully.',
      });
      setEditing(false);
      await mutateMemory();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Update failed',
        detail: err instanceof Error ? err.message : 'Could not save changes.',
      });
    } finally {
      setSaving(false);
    }
  }, [memory, editTitle, editSummary, editContent, saving, toast, mutateMemory]);

  if (memoryLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-surface-hover rounded" />
        <div className="h-10 w-72 bg-surface-hover rounded" />
        <div className="card h-96" />
      </div>
    );
  }

  if (memoryError) {
    return (
      <ErrorState
        title="Failed to load memory"
        message={(memoryError as Error).message || 'Could not load memory details.'}
        onRetry={() => mutateMemory()}
      />
    );
  }

  if (!memory) {
    return (
      <EmptyState
        title="Memory not found"
        description="This memory does not exist or has been deleted."
        action={{
          label: 'Back to memory',
          onClick: () => {},
        }}
      />
    );
  }

  const mem = memory as unknown as Record<string, unknown>;
  const title = (mem['title'] as string) || 'Untitled memory';
  const type = (mem['type'] as string) || 'document';
  const content = (mem['content'] as string) || '';
  const summary = (mem['summary'] as string) || '';
  const sourceType = (mem['sourceType'] as string) || (mem['source_type'] as string) || '';
  const sourceUri = (mem['sourceUri'] as string) || (mem['source_uri'] as string) || '';
  const sourceLabel = (mem['sourceLabel'] as string) || (mem['source_label'] as string) || '';
  const confidence = (mem['confidence'] as number) ?? 0;
  const status = (mem['status'] as string) || '';
  const tags = (mem['tags'] as string[]) || [];
  const createdAt = (mem['createdAt'] as string) || (mem['created_at'] as string) || '';
  const updatedAt = (mem['updatedAt'] as string) || (mem['updated_at'] as string) || '';
  const supersedesId = (mem['supersedesId'] as string) || (mem['supersedes_id'] as string) || '';
  const metadata = (mem['metadata'] as Record<string, unknown>) || {};

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <nav aria-label="Breadcrumb">
        <Link
          href={workspaceId ? `/workspace/${workspaceId}/memory` : '/memory'}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to memory
        </Link>
      </nav>

      {/* Header */}
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-mono text-xs rounded bg-surface-hover border border-border px-2 py-0.5 text-text-muted">
            {type}
          </span>
          {status && (
            <span
              className={`text-xs rounded-full px-2.5 py-0.5 border ${
                status === 'superseded'
                  ? 'bg-warning/10 text-warning border-warning/30'
                  : status === 'READY' || status === 'active'
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-surface-hover text-text-muted border-border'
              }`}
            >
              {status}
            </span>
          )}
          {confidence > 0 && <ConfidenceBar value={confidence} />}
        </div>
        <h1 className="text-3xl font-display font-medium text-text">{title}</h1>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Content column (2/3) */}
        <div className="md:col-span-2 space-y-6">
          {/* Summary */}
          {summary && (
            <div className="card space-y-2">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Summary</h2>
              <p className="text-sm text-text leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Content */}
          {content && (
            <div className="card space-y-2">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Content</h2>
              <div className="text-sm text-text whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {content}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="card space-y-2">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-hover border border-border px-3 py-1 text-xs text-text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lineage */}
          {lineage && (
            <div className="card space-y-4">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Lineage</h2>
              {lineage.chainBackwards.length > 1 && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Supersession chain (backwards)</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {lineage.chainBackwards.map((m: unknown, idx: number) => {
                      const mem = m as Record<string, unknown>;
                      return (
                        <div
                          key={String(mem['id'])}
                          className={`shrink-0 w-48 rounded border p-2 ${
                            idx === 0
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-surface-hover'
                          }`}
                        >
                          <p className="font-mono text-xs text-text-dim">
                            {idx === 0 ? 'current' : `#${idx} superseded`}
                          </p>
                          <p className="text-sm font-medium text-text truncate">
                            {String(mem['title'] || mem['id']).slice(0, 28)}
                          </p>
                          <p className="text-xs text-text-muted line-clamp-2">
                            {String(mem['summary'] || '')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {lineage.chainForwards.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Superseded by</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {lineage.chainForwards.map((m: unknown) => {
                      const mem = m as Record<string, unknown>;
                      return (
                        <div
                          key={String(mem['id'])}
                          className="shrink-0 w-48 rounded border border-warning/30 bg-warning/10 p-2"
                        >
                          <p className="text-sm font-medium text-text truncate">
                            {String(mem['title'] || mem['id']).slice(0, 28)}
                          </p>
                          <p className="text-xs text-text-muted line-clamp-2">
                            {String(mem['summary'] || '')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {supersedesId && (
                <p className="text-xs text-text-dim">
                  This memory supersedes{' '}
                  <span className="font-mono">{supersedesId.slice(0, 8)}</span>
                </p>
              )}
            </div>
          )}

          {/* Correction panel */}
          <div className="card space-y-3">
            <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
              Correction
            </h2>
            <p className="text-xs text-text-muted">
              Correct this memory to create an updated version. The original is preserved in the
              supersession chain.
            </p>
            <button className="btn-secondary text-sm" onClick={startEdit}>
              Edit memory
            </button>
          </div>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-6">
          {/* ID & metadata */}
          <div className="card space-y-3">
            <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">Details</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-text-muted">ID</dt>
                <dd className="font-mono text-xs text-text break-all">{memory.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Type</dt>
                <dd className="text-sm text-text">{type}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Created</dt>
                <dd className="text-sm text-text">{formatTimestamp(createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Updated</dt>
                <dd className="text-sm text-text">{formatTimestamp(updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Source evidence */}
          {(sourceType || sourceUri || sourceLabel) && (
            <div className="card space-y-3">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
                Source Evidence
              </h2>
              <dl className="space-y-2">
                {sourceType && (
                  <div>
                    <dt className="text-xs text-text-muted">Source type</dt>
                    <dd className="text-sm text-text">{sourceType}</dd>
                  </div>
                )}
                {sourceLabel && (
                  <div>
                    <dt className="text-xs text-text-muted">Source label</dt>
                    <dd className="text-sm text-text">{sourceLabel}</dd>
                  </div>
                )}
                {sourceUri && (
                  <div>
                    <dt className="text-xs text-text-muted">Source URI</dt>
                    <dd className="text-sm text-text break-all font-mono text-xs">{sourceUri}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Provenance (from lineage) */}
          {lineage && lineage.provenance.length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
                Provenance
              </h2>
              <ol className="space-y-1">
                {lineage.provenance.map(
                  (n: { table: string; id: string; type: string; detail: string }) => (
                    <li key={`${n.table}-${n.id}`} className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-surface-hover border border-border px-1.5 py-0.5 font-mono text-text-dim">
                        {n.table}
                      </span>
                      <span className="font-mono text-text-dim">{n.id.slice(0, 8)}</span>
                      <span className="text-text-muted truncate">{n.detail || n.type}</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(metadata).length > 0 && (
            <div className="card space-y-3">
              <h2 className="font-mono text-sm uppercase tracking-widest text-text-dim">
                Metadata
              </h2>
              <div className="space-y-1">
                {Object.entries(metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-xs">
                    <span className="font-mono text-text-muted truncate">{k}</span>
                    <span className="text-text text-right break-all">
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <Modal isOpen={editing} onClose={cancelEdit} title={`Edit memory: ${title}`} size="lg">
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm text-text-muted mb-1">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edit-summary" className="block text-sm text-text-muted mb-1">
              Summary
            </label>
            <textarea
              id="edit-summary"
              className="w-full min-h-[80px] bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edit-content" className="block text-sm text-text-muted mb-1">
              Content
            </label>
            <textarea
              id="edit-content"
              className="w-full min-h-[120px] bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={cancelEdit}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
