'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { memoryApi, memoryFeedApi, type MemoryLineageResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import {
  Button,
  Badge,
  Card,
  Modal,
  EmptyState,
  ErrorState,
  ConfidenceIndicator,
  Breadcrumb,
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

  const [activeView, setActiveView] = useState<'rendered' | 'raw'>('rendered');
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
      <div className="space-y-6 animate-pulse max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-36 bg-[var(--color-surface-subtle)] rounded" />
        <div className="h-10 w-full max-w-md bg-[var(--color-surface-subtle)] rounded" />
        <div className="h-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]" />
      </div>
    );
  }

  if (memoryError) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <ErrorState
          title="Failed to load memory"
          message={(memoryError as Error).message || 'Could not load memory details.'}
          onRetry={() => void mutateMemory()}
        />
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <EmptyState
          title="Memory not found"
          description="This memory does not exist or has been deleted."
          action={{
            label: 'Back to Memory Explorer',
            onClick: () =>
              router.push(workspaceId ? `/workspace/${workspaceId}/memory` : '/memory'),
          }}
        />
      </div>
    );
  }

  const mem = memory as unknown as Record<string, unknown>;
  const title = (mem['title'] as string) || 'Untitled Memory';
  const type = (mem['type'] as string) || 'note';
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
  const documentId = (metadata['document_id'] as string) || '';

  const isSuperseded = status === 'superseded';

  const breadcrumbItems = [
    {
      label: 'Memory',
      href: workspaceId ? `/workspace/${workspaceId}/memory` : '/memory',
    },
    {
      label: title,
      current: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title={title}
        eyebrow={`MEMORY / ${type.toUpperCase()}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={startEdit}>
              Edit Note
            </Button>
            {workspaceId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/workspace/${workspaceId}/memory/graph`)}
              >
                View in Graph
              </Button>
            )}
          </div>
        }
      />

      {/* Status Badges & Provenance Indicators */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={isSuperseded ? 'warning' : 'success'} size="sm">
          {isSuperseded ? '● SUPERSEDED' : '● ACTIVE'}
        </Badge>
        <ConfidenceIndicator score={confidence} />
        {sourceType && (
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            Source: <strong className="text-[var(--color-text-primary)]">{sourceType}</strong>
          </span>
        )}
        {sourceLabel && (
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">
            ({sourceLabel})
          </span>
        )}
      </div>

      {/* Main Content Layout (2/3 main, 1/3 sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Executive Summary Card */}
          {summary && (
            <Card
              padding="md"
              className="space-y-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Executive Synthesis
              </h2>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{summary}</p>
            </Card>
          )}

          {/* Clean Markdown Note Content */}
          <Card
            padding="md"
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Markdown Note Content
              </h2>
              <div className="flex items-center gap-1 bg-[var(--color-surface-subtle)] p-1 rounded-lg border border-[var(--color-border)] text-xs">
                <button
                  type="button"
                  onClick={() => setActiveView('rendered')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    activeView === 'rendered'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Formatted
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('raw')}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    activeView === 'raw'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Raw Markdown
                </button>
              </div>
            </div>

            {content ? (
              activeView === 'rendered' ? (
                <div className="prose prose-invert max-w-none text-sm text-[var(--color-text-primary)] leading-relaxed p-4 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] overflow-x-auto space-y-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <pre className="font-mono text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap p-4 rounded-lg bg-[var(--color-surface-sunken)] border border-[var(--color-border)] overflow-x-auto max-h-[450px]">
                  {content}
                </pre>
              )
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] italic p-4">
                No full note content recorded for this memory item.
              </p>
            )}
          </Card>

          {/* Linked Concepts & Tags */}
          {tags.length > 0 && (
            <Card
              padding="md"
              className="space-y-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
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

          {/* Lineage & Supersession History */}
          <Card
            padding="md"
            className="space-y-4 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Lineage & Supersession Chain
              </h2>
              <Badge variant="mono" size="sm">
                Zero-Trust Audit
              </Badge>
            </div>

            {lineageLoading ? (
              <p className="text-xs text-[var(--color-text-muted)] animate-pulse">
                Tracing provenance chain...
              </p>
            ) : lineage && lineage.chainBackwards.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Every revision is preserved immutably. Click any historical version to inspect its
                  state:
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {lineage.chainBackwards.map((m: unknown, idx: number) => {
                    const ances = m as Record<string, unknown>;
                    const ancesId = String(ances['id']);
                    const isCurrent = ancesId === memory.id;

                    return (
                      <Link
                        key={ancesId}
                        href={
                          workspaceId
                            ? `/workspace/${workspaceId}/memory/${ancesId}`
                            : `/memory/${ancesId}`
                        }
                        className={`shrink-0 w-60 rounded-xl border p-3.5 transition block hover:border-[var(--color-brand-primary,#818cf8)] ${
                          isCurrent
                            ? 'border-[var(--color-brand-primary,#818cf8)] bg-[var(--color-brand-primary,#818cf8)]/10 text-[var(--color-text-primary)] ring-1 ring-[var(--color-brand-primary,#818cf8)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-mono text-[10px] uppercase font-semibold">
                            {idx === 0 ? 'Current Version' : `v-${idx} Ancestor`}
                          </p>
                          {isCurrent && (
                            <Badge variant="primary" size="sm">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate mt-1 text-[var(--color-text-primary)]">
                          {String(ances['title'] || ancesId).slice(0, 32)}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-1">
                          {String(ances['summary'] || 'No summary')}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                Origin record (no prior superseded versions).
              </p>
            )}

            {supersedesId && (
              <p className="text-xs text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border)]">
                This record supersedes ancestor{' '}
                <Link
                  href={
                    workspaceId
                      ? `/workspace/${workspaceId}/memory/${supersedesId}`
                      : `/memory/${supersedesId}`
                  }
                  className="font-mono text-[var(--color-brand-primary,#818cf8)] hover:underline font-semibold"
                >
                  #{supersedesId.slice(0, 8)}
                </Link>
                .
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar column (1/3) */}
        <div className="space-y-6">
          {/* Metadata & Record Info */}
          <Card
            padding="md"
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Record Metadata
            </h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-[var(--color-text-muted)]">Memory ID</dt>
                <dd className="font-mono text-[var(--color-text-primary)] break-all mt-0.5 font-medium">
                  {memory.id}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Memory Type</dt>
                <dd className="text-[var(--color-text-primary)] font-medium mt-0.5 capitalize">
                  {type}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Created</dt>
                <dd className="text-[var(--color-text-primary)] mt-0.5">
                  {formatTimestamp(createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Last Updated</dt>
                <dd className="text-[var(--color-text-primary)] mt-0.5">
                  {formatTimestamp(updatedAt)}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Source Document Link & Evidence Card */}
          {(sourceType || sourceUri || sourceLabel || documentId) && (
            <Card
              padding="md"
              className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Source Evidence & Files
                </h2>
                <Badge variant="mono" size="sm">
                  Grounding
                </Badge>
              </div>
              <dl className="space-y-2 text-xs">
                {sourceType && (
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Source Type</dt>
                    <dd className="text-[var(--color-text-primary)] font-medium mt-0.5">
                      {sourceType}
                    </dd>
                  </div>
                )}
                {sourceLabel && (
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Source Label</dt>
                    <dd className="text-[var(--color-text-primary)] mt-0.5">{sourceLabel}</dd>
                  </div>
                )}
                {sourceUri && (
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Source URI / Path</dt>
                    <dd className="text-[var(--color-text-primary)] break-all font-mono text-[11px] mt-0.5 bg-[var(--color-surface-subtle)] p-1.5 rounded border border-[var(--color-border)]">
                      {sourceUri}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Action link to Documents */}
              {workspaceId && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <Link
                    href={`/workspace/${workspaceId}/documents`}
                    className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] transition"
                  >
                    Open Documents Hub →
                  </Link>
                </div>
              )}
            </Card>
          )}

          {/* Extended Metadata Attributes */}
          {Object.keys(metadata).length > 0 && (
            <Card
              padding="md"
              className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl"
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Extended Attributes
              </h2>
              <div className="space-y-1.5 text-xs font-mono">
                {Object.entries(metadata).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-2 border-b border-[var(--color-border)]/50 pb-1"
                  >
                    <span className="text-[var(--color-text-muted)] truncate">{k}</span>
                    <span className="text-[var(--color-text-primary)] text-right text-[11px] truncate">
                      {typeof v === 'string' ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Memory Modal */}
      <Modal isOpen={editing} onClose={cancelEdit} title={`Edit Memory: ${title}`} size="lg">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="edit-title"
              className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1"
            >
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-sans"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-summary"
              className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1"
            >
              Executive Summary
            </label>
            <textarea
              id="edit-summary"
              rows={3}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-sans"
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="edit-content"
              className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1"
            >
              Markdown Content
            </label>
            <textarea
              id="edit-content"
              rows={6}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-mono"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
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
