'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentApi, type DocumentResponse, type DocumentAction } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { useToast } from '@/components/shared/Toast';

function getFileName(path: string) {
  const p = path.split('/');
  return p[p.length - 1] || path;
}
function formatSize(b: unknown) {
  const n = typeof b === 'number' ? b : Number(b ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDetailPage() {
  const params = useParams() as { workspaceId?: string; documentId?: string };
  const workspaceId = params.workspaceId as string;
  const documentId = params.documentId as string;
  const router = useRouter();
  const { toast } = useToast();
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  const fetchAll = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await documentApi.list({ workspace_id: workspaceId, include_archived: true });
      const found = list.documents.find((d) => d.id === documentId) ?? null;
      if (!found) throw new Error('Document not found');
      setDoc(found);
      const blob = await documentApi.getContent(found.id, workspaceId);
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      const textTypes = new Set(['text', 'markdown', 'csv', 'json', 'html', 'xml', 'yaml']);
      if (textTypes.has(found.type)) setText(await blob.text());
      const hist = await documentApi
        .actions(found.id, workspaceId)
        .catch(() => ({ actions: [], total: 0 }));
      setActions(hist.actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId]);

  useEffect(() => {
    fetchAll();
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
  const size = (doc.metadata as Record<string, unknown> | undefined)?.['size'];
  const isImage = doc.type === 'image';
  const isPdf = doc.type === 'pdf';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href={`/workspace/${workspaceId}/files`} className="hover:text-text">
          ← Files
        </Link>
        <span>·</span>
        <span className="font-mono text-xs">{doc.id.slice(0, 8)}</span>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-medium text-text truncate">
            {getFileName(doc.path)}
          </h1>
          <p className="text-sm text-text-muted font-mono">
            {doc.type} · {formatSize(size)} ·{' '}
            {new Date(
              (doc as unknown as Record<string, string>)['created_at'] ??
                (doc as unknown as Record<string, string>)['createdAt'] ??
                '',
            ).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/workspace/${workspaceId}/files`)}
            className="btn-secondary text-sm"
          >
            Back
          </button>
          {blobUrl && (
            <a href={blobUrl} download={getFileName(doc.path)} className="btn-primary text-sm">
              Download
            </a>
          )}
        </div>
      </header>
      <div className="flex gap-2 border-b border-border">
        {(['preview', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${activeTab === t ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {t === 'preview' ? 'Preview' : `History (${actions.length})`}
          </button>
        ))}
      </div>
      {activeTab === 'preview' ? (
        <div className="flex-1 overflow-auto rounded-xl border border-border/50 bg-background/40 min-h-[50vh]">
          {text != null ? (
            <pre className="whitespace-pre-wrap p-5 font-mono text-sm leading-relaxed text-text">
              {text}
            </pre>
          ) : isImage && blobUrl ? (
            <img src={blobUrl} alt={getFileName(doc.path)} className="max-w-full mx-auto p-4" />
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={getFileName(doc.path)}
              className="h-[70vh] w-full border-0"
            />
          ) : blobUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-text-muted">
                Preview not available for {doc.type}. Download to view.
              </p>
              <a
                href={blobUrl}
                download={getFileName(doc.path)}
                className="rounded-full bg-white px-4 py-1.5 text-xs text-black"
              >
                Download
              </a>
            </div>
          ) : (
            <p className="p-8 text-center text-text-muted">No preview</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {actions.length === 0 ? (
            <p className="text-sm text-text-muted">
              No changes recorded — rename or archive to see history with diff and undo.
            </p>
          ) : (
            actions.map((a) => {
              const at =
                (a as unknown as Record<string, string>)['action_type'] ??
                (a as unknown as Record<string, string>)['actionType'] ??
                '';
              const oldP =
                (a as unknown as Record<string, string | null>)['old_path'] ??
                (a as unknown as Record<string, string | null>)['oldPath'];
              const newP =
                (a as unknown as Record<string, string | null>)['new_path'] ??
                (a as unknown as Record<string, string | null>)['newPath'];
              const undone = Boolean(
                (a as unknown as Record<string, string | null>)['undone_at'] ??
                (a as unknown as Record<string, string | null>)['undoneAt'],
              );
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3 ${undone ? 'border-border/40 opacity-60' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {at === 'document_rename' && oldP && newP
                          ? `Renamed ${oldP} → ${newP}`
                          : at}
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(
                          (a as unknown as Record<string, string>)['created_at'] ??
                            (a as unknown as Record<string, string>)['createdAt'] ??
                            '',
                        ).toLocaleString()}{' '}
                        · {undone ? 'undone' : at}
                      </p>
                    </div>
                  </div>
                  {at === 'document_rename' && oldP && newP && (
                    <div className="mt-3">
                      <DiffViewer oldText={oldP as string} newText={newP as string} />
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
