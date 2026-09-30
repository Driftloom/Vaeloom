'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentApi, type DocumentResponse, type DocumentAction } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { PageHeader } from '@/components/shared/Page';

const TEXT_TYPES = new Set(['text', 'markdown', 'csv', 'json', 'html', 'xml', 'yaml']);
const FIND_PAGE_SIZE = 100;

function getFileName(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function formatSize(bytes: unknown) {
  const n = typeof bytes === 'number' ? bytes : Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** camel/snake tolerant field read — the API serializer is not consistent. */
function field<T>(source: unknown, snake: string, camel: string): T | undefined {
  const record = source as Record<string, T>;
  return record[snake] ?? record[camel];
}

/** Fetch document directly by id. */
async function fetchDocument(workspaceId: string, documentId: string) {
  try {
    return await documentApi.getById(documentId, workspaceId);
  } catch {
    return null;
  }
}

export default function FileDetailPage() {
  const params = useParams() as { workspaceId?: string; documentId?: string };
  const workspaceId = params.workspaceId as string;
  const documentId = params.documentId as string;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Kept separate from `error`: a failed history fetch must not blank the
   *  document, and it must not masquerade as "no changes recorded" either. */
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  const fetchAll = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setLoading(true);
    setError(null);
    setHistoryError(null);
    try {
      const found = await fetchDocument(workspaceId, documentId);
      if (!found) throw new Error('Document not found');
      setDoc(found);

      const blob = await documentApi.getContent(found.id, workspaceId);
      setBlobUrl(URL.createObjectURL(blob));
      setText(TEXT_TYPES.has(found.type) ? await blob.text() : null);

      try {
        const hist = await documentApi.actions(found.id, workspaceId);
        setActions(hist.actions);
      } catch (histErr) {
        setActions([]);
        setHistoryError(
          histErr instanceof Error ? histErr.message : 'Failed to load document history.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);
  useEffect(
    () => () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    },
    [blobUrl],
  );

  if (loading) return <LoadingSpinner text="Loading file..." />;
  if (error || !doc)
    return (
      <ErrorState title="Failed to load file" message={error ?? 'Not found'} onRetry={fetchAll} />
    );

  const fileName = getFileName(doc.path);
  const size = (doc.metadata as Record<string, unknown> | undefined)?.['size'];
  const isImage = doc.type === 'image';
  const isPdf = doc.type === 'pdf';
  const createdAt = field<string>(doc, 'created_at', 'createdAt') ?? '';

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title={fileName}
        description={`${doc.type} · ${formatSize(size)} · ${
          createdAt ? new Date(createdAt).toLocaleDateString() : '—'
        }`}
        breadcrumb={
          <nav aria-label="Breadcrumb">
            <Link
              href={`/workspace/${workspaceId}/files`}
              className="text-sm text-text-muted hover:text-text"
            >
              Files
            </Link>
            <span className="ml-2 font-mono text-xs" aria-hidden="true">
              · {doc.id.slice(0, 8)}
            </span>
          </nav>
        }
        actions={
          <>
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/files`)}
              className="btn-secondary text-sm"
            >
              Back
            </button>
            {blobUrl && (
              <a href={blobUrl} download={fileName} className="btn-primary text-sm">
                Download
              </a>
            )}
          </>
        }
      />

      <div role="tablist" aria-label="Document view" className="flex gap-2 border-b border-border">
        {(['preview', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
              activeTab === t
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t === 'preview' ? 'Preview' : `History (${actions.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'preview' ? (
        <div className="flex-1 overflow-auto rounded-xl border border-border/50 bg-background/40 min-h-[50vh]">
          {text != null ? (
            <pre className="whitespace-pre-wrap break-words p-5 font-mono text-sm leading-relaxed text-text">
              {text}
            </pre>
          ) : isImage && blobUrl ? (
            <img src={blobUrl} alt={fileName} className="max-w-full mx-auto p-4" />
          ) : isPdf && blobUrl ? (
            <iframe src={blobUrl} title={fileName} className="h-[70vh] w-full border-0" />
          ) : blobUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-text-muted">
                Preview not available for {doc.type}. Download to view.
              </p>
              <a href={blobUrl} download={fileName} className="btn-primary text-sm">
                Download
              </a>
            </div>
          ) : (
            <p className="p-8 text-center text-text-muted">No preview</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {historyError && (
            <div
              role="alert"
              className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
            >
              Could not load change history: {historyError}{' '}
              <button onClick={fetchAll} className="btn-secondary text-xs ml-2">
                Retry
              </button>
            </div>
          )}
          {!historyError && actions.length === 0 ? (
            <p className="text-sm text-text-muted">
              No changes recorded — rename or archive to see history with diff and undo.
            </p>
          ) : (
            actions.map((a) => {
              const actionType = field<string>(a, 'action_type', 'actionType') ?? '';
              const oldPath = field<string>(a, 'old_path', 'oldPath');
              const newPath = field<string>(a, 'new_path', 'newPath');
              const undone = Boolean(field<string | null>(a, 'undone_at', 'undoneAt'));
              const at = field<string>(a, 'created_at', 'createdAt') ?? '';
              const isRename = actionType === 'document_rename' && oldPath && newPath;
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3 ${
                    undone ? 'border-border/40 opacity-60' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {isRename ? `Renamed ${oldPath} → ${newPath}` : actionType}
                      </p>
                      <p className="text-xs text-text-muted">
                        {at ? new Date(at).toLocaleString() : '—'} ·{' '}
                        {undone ? 'undone' : actionType}
                      </p>
                    </div>
                  </div>
                  {isRename && (
                    <div className="mt-3">
                      <DiffViewer oldText={oldPath as string} newText={newPath as string} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <p className="text-xs text-text-dim">
        Deep-link:{' '}
        <span className="font-mono">{`/workspace/${workspaceId}/files/${documentId}`}</span> —
        refresh-safe. Reversible via History → Undo.
      </p>
    </div>
  );
}
