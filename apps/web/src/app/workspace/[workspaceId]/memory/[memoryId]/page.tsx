'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { memoryApi, memoryFeedApi, type MemoryLineageResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/shared/Page';
import {
  Button,
  Badge,
  Card,
  Modal,
  EmptyState,
  ErrorState,
  ConfidenceIndicator,
} from '@vaeloom/ui-kit';

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function MemoryDetailPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const memoryId = params?.['memoryId'] as string | undefined;
  const router = useRouter();
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
        detail: 'Changes saved successfully into memory index.',
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
        <div className="h-10 w-full max-w-72 bg-surface-hover rounded" />
        <div className="card h-96" />
      </div>
    );
  }

  if (memoryError) {
    return (
      <ErrorState
        title="Failed to load memory"
        message={(memoryError as Error).message || 'Could not load memory details.'}
        onRetry={() => void mutateMemory()}
      />
    );
  }

  if (!memory) {
    return (
      <EmptyState
        title="Memory not found"
        description="This memory does not exist or has been deleted."
        action={{
          label: 'Back to Memory Explorer',
          onClick: () => router.push(workspaceId ? `/workspace/${workspaceId}/memory` : '/memory'),
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
  const confidence = (mem['confidence'] as number) ?? 0.85;
  const status = (mem['status'] as string) || 'active';
  const tags = (mem['tags'] as string[]) || [];
  const createdAt = (mem['createdAt'] as string) || (mem['created_at'] as string) || '';
  const updatedAt = (mem['updatedAt'] as string) || (mem['updated_at'] as string) || '';
  const supersedesId = (mem['supersedesId'] as string) || (mem['supersedes_id'] as string) || '';
  const metadata = (mem['metadata'] as Record<string, unknown>) || {};

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={title}
        eyebrow={type.toUpperCase()}
        breadcrumb={
          <nav aria-label="Breadcrumb">
            <Link
              href={workspaceId ? `/workspace/${workspaceId}/memory` : '/memory'}
              className="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-1"
            >
              <span>← Back to Memory Explorer</span>
            </Link>
          </nav>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={startEdit}>
            Edit Memory
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={status === 'superseded' ? 'warning' : 'success'} size="sm">
          {status}
        </Badge>
        <ConfidenceIndicator score={confidence} />
        {sourceType && (
          <span className="text-xs text-text-muted font-mono">
            Source: <strong className="text-text">{sourceType}</strong>
          </span>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Content column (2/3) */}
        <div className="md:col-span-2 space-y-6">
          {/* Summary Card */}
          {summary && (
            <Card padding="md" className="space-y-2 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Executive Summary
              </h2>
              <p className="text-sm text-text leading-relaxed">{summary}</p>
            </Card>
          )}

          {/* Full Note Content Card */}
          {content && (
            <Card padding="md" className="space-y-3 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Memory Content & Raw Notes
              </h2>
              <div className="text-sm text-text whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-sans p-3 rounded-lg bg-surface-sunken border border-border">
                {content}
              </div>
            </Card>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <Card padding="md" className="space-y-2 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Linked Concepts & Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <Badge key={t} variant="mono" size="sm">
                    #{t}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Lineage & Supersession Chain */}
          {lineage && (
            <Card padding="md" className="space-y-4 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Lineage & Supersession History
              </h2>

              {lineage.chainBackwards.length > 1 && (
                <div>
                  <p className="text-2xs text-text-muted mb-2 uppercase tracking-wider">
                    Superseded Ancestors
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {lineage.chainBackwards.map((m: unknown, idx: number) => {
                      const ances = m as Record<string, unknown>;
                      return (
                        <div
                          key={String(ances['id'])}
                          className={`shrink-0 w-52 rounded-lg border p-3 ${
                            idx === 0
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border bg-surface-hover text-text'
                          }`}
                        >
                          <p className="font-mono text-2xs uppercase">
                            {idx === 0 ? 'Current' : `v-${idx} Superseded`}
                          </p>
                          <p className="text-xs font-medium truncate mt-1">
                            {String(ances['title'] || ances['id']).slice(0, 30)}
                          </p>
                          <p className="text-2xs text-text-muted line-clamp-2 mt-0.5">
                            {String(ances['summary'] || '')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {supersedesId && (
                <p className="text-xs text-text-dim">
                  This record supersedes{' '}
                  <span className="font-mono text-text">{supersedesId.slice(0, 8)}</span>.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card padding="md" className="space-y-3 border-border bg-surface">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Metadata & Record Info
            </h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-text-muted">ID</dt>
                <dd className="font-mono text-text break-all mt-0.5">{memory.id}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Type</dt>
                <dd className="text-text font-medium mt-0.5">{type}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Created</dt>
                <dd className="text-text mt-0.5">{formatTimestamp(createdAt)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last Updated</dt>
                <dd className="text-text mt-0.5">{formatTimestamp(updatedAt)}</dd>
              </div>
            </dl>
          </Card>

          {/* Source Evidence Card */}
          {(sourceType || sourceUri || sourceLabel) && (
            <Card padding="md" className="space-y-3 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Source Evidence
              </h2>
              <dl className="space-y-2 text-xs">
                {sourceType && (
                  <div>
                    <dt className="text-text-muted">Source Type</dt>
                    <dd className="text-text font-medium mt-0.5">{sourceType}</dd>
                  </div>
                )}
                {sourceLabel && (
                  <div>
                    <dt className="text-text-muted">Source Label</dt>
                    <dd className="text-text mt-0.5">{sourceLabel}</dd>
                  </div>
                )}
                {sourceUri && (
                  <div>
                    <dt className="text-text-muted">Source URI</dt>
                    <dd className="text-text break-all font-mono text-2xs mt-0.5">{sourceUri}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {/* Dynamic Metadata Attributes */}
          {Object.keys(metadata).length > 0 && (
            <Card padding="md" className="space-y-3 border-border bg-surface">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Extended Attributes
              </h2>
              <div className="space-y-1.5 text-xs">
                {Object.entries(metadata).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-2 border-b border-border/50 pb-1"
                  >
                    <span className="font-mono text-text-muted truncate">{k}</span>
                    <span className="text-text text-right font-mono text-2xs truncate">
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editing} onClose={cancelEdit} title={`Edit Memory: ${title}`} size="lg">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="edit-title"
              className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
            >
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              className="w-full rounded-md border border-border bg-surface-sunken p-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-summary"
              className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
            >
              Summary
            </label>
            <textarea
              id="edit-summary"
              rows={3}
              className="w-full rounded-md border border-border bg-surface-sunken p-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-content"
              className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
            >
              Content
            </label>
            <textarea
              id="edit-content"
              rows={5}
              className="w-full rounded-md border border-border bg-surface-sunken p-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void saveEdit()} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
