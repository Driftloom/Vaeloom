'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Modal } from '@vaeloom/ui-kit';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/Toast';
import { documentApi, agentApi } from '@/lib/api-client';
import type { DocumentResponse, DocumentAction } from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSize(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function docWorkspaceId(d: DocumentResponse): string {
  return (
    (d as unknown as Record<string, string>)['workspace_id'] ??
    (d as unknown as Record<string, string>)['workspaceId'] ??
    ''
  );
}
function docCreatedAt(d: DocumentResponse): string {
  return (
    (d as unknown as Record<string, string>)['created_at'] ??
    (d as unknown as Record<string, string>)['createdAt'] ??
    ''
  );
}
function docDeletedAt(d: DocumentResponse): string | null | undefined {
  return (
    (d as unknown as Record<string, string | null>)['deleted_at'] ??
    (d as unknown as Record<string, string | null>)['deletedAt']
  );
}
function docMetaSize(d: DocumentResponse): unknown {
  const m = d.metadata as Record<string, unknown> | undefined;
  return m?.['size'];
}
function actionType(a: DocumentAction): string {
  return (
    (a as unknown as Record<string, string>)['action_type'] ??
    (a as unknown as Record<string, string>)['actionType'] ??
    ''
  );
}
function actionOldPath(a: DocumentAction): string | null | undefined {
  return (
    (a as unknown as Record<string, string | null>)['old_path'] ??
    (a as unknown as Record<string, string | null>)['oldPath']
  );
}
function actionNewPath(a: DocumentAction): string | null | undefined {
  return (
    (a as unknown as Record<string, string | null>)['new_path'] ??
    (a as unknown as Record<string, string | null>)['newPath']
  );
}
function actionCreatedAt(a: DocumentAction): string {
  return (
    (a as unknown as Record<string, string>)['created_at'] ??
    (a as unknown as Record<string, string>)['createdAt'] ??
    ''
  );
}
function actionUndoneAt(a: DocumentAction): string | null | undefined {
  return (
    (a as unknown as Record<string, string | null>)['undone_at'] ??
    (a as unknown as Record<string, string | null>)['undoneAt']
  );
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; name: string; percent: number }
  | { phase: 'processing'; name: string }
  | { phase: 'error'; name: string; message: string; file: File };

const TEXT_TYPES = new Set(['text', 'markdown', 'csv', 'json', 'html', 'xml', 'yaml']);
const IMAGE_TYPES = new Set(['image']);

export default function WorkspaceFilesPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' });

  const [viewer, setViewer] = useState<DocumentResponse | null>(null);
  const [viewerContent, setViewerContent] = useState<{
    url: string;
    text?: string;
    unsupported?: boolean;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
    };
  }, [viewerContent?.url]);

  const [renaming, setRenaming] = useState<DocumentResponse | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [history, setHistory] = useState<DocumentResponse | null>(null);
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const fetchDocuments = useCallback(
    async (includeArchived = showArchived, pageNum = page) => {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await documentApi.list({
          workspace_id: workspaceId,
          include_archived: includeArchived,
          page: pageNum,
          page_size: PAGE_SIZE,
        });
        setDocuments(res.documents);
        setTotal(res.total ?? res.documents.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, showArchived, page],
  );

  useEffect(() => {
    fetchDocuments(showArchived, page);
  }, [fetchDocuments, page, showArchived]);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery || getFileName(doc.path).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      typeFilter === 'all' ||
      (typeFilter === 'pdf' && doc.type === 'pdf') ||
      (typeFilter === 'docx' && doc.type === 'docx') ||
      (typeFilter === 'text' && TEXT_TYPES.has(doc.type)) ||
      (typeFilter === 'image' && IMAGE_TYPES.has(doc.type)) ||
      (typeFilter === 'other' &&
        !TEXT_TYPES.has(doc.type) &&
        !IMAGE_TYPES.has(doc.type) &&
        doc.type !== 'pdf' &&
        doc.type !== 'docx');
    return matchesSearch && matchesType;
  });

  const startUpload = useCallback(
    async (file: File) => {
      if (!workspaceId) return;
      setUpload({ phase: 'uploading', name: file.name, percent: 0 });
      try {
        const doc = await documentApi.uploadWithProgress(file, workspaceId, (percent) =>
          setUpload({ phase: 'uploading', name: file.name, percent }),
        );
        setUpload({ phase: 'processing', name: file.name });
        setDocuments((prev) => [doc, ...prev]);
        toast({ tone: 'success', title: 'Upload complete', detail: doc.path });
      } catch (err) {
        setUpload({
          phase: 'error',
          name: file.name,
          message: err instanceof Error ? err.message : 'Upload failed',
          file,
        });
        toast({
          tone: 'error',
          title: 'Upload failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setTimeout(() => setUpload({ phase: 'idle' }), 1200);
      }
    },
    [workspaceId, toast],
  );

  const openViewer = useCallback(
    async (doc: DocumentResponse) => {
      if (viewerUrlRef.current) {
        URL.revokeObjectURL(viewerUrlRef.current);
        viewerUrlRef.current = null;
      }
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
      setViewer(doc);
      setViewerContent(null);
      setViewerLoading(true);
      try {
        const blob = await documentApi.getContent(doc.id, docWorkspaceId(doc));
        const url = URL.createObjectURL(blob);
        viewerUrlRef.current = url;
        if (TEXT_TYPES.has(doc.type)) {
          setViewerContent({ url, text: await blob.text() });
        } else if (IMAGE_TYPES.has(doc.type)) {
          setViewerContent({ url });
        } else if (doc.type === 'pdf') {
          setViewerContent({ url });
        } else {
          setViewerContent({ url, unsupported: true });
        }
      } catch (err) {
        setViewerContent(null);
        toast({
          tone: 'error',
          title: 'Failed to load document',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setViewerLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewerContent revoked via ref + immediate check; adding would cause loop
    [toast],
  );

  const closeViewer = useCallback(() => {
    if (viewerUrlRef.current) {
      URL.revokeObjectURL(viewerUrlRef.current);
      viewerUrlRef.current = null;
    }
    if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
    setViewer(null);
    setViewerContent(null);
  }, [viewerContent?.url]);

  const handleRename = useCallback(async () => {
    if (!renaming || !renameValue.trim() || !workspaceId) return;
    const newPath = renameValue.trim();
    const oldPath = renaming.path;
    // Propose via Organization Agent for audit trail (non-blocking fallback to direct rename)
    try {
      await agentApi
        .chat({
          workspaceId,
          message: `propose rename document ${renaming.id} from "${oldPath}" to "${newPath}"`,
          agentName: 'organization',
        })
        .catch(() => null);
    } catch {
      /* fallback to direct */
    }
    try {
      const updated = await documentApi.rename(renaming.id, workspaceId, newPath);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setRenaming(null);
      toast({
        tone: 'success',
        title: 'Renamed (reversible)',
        detail: `${oldPath} → ${updated.path} — undo via History`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Rename failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }, [renaming, renameValue, workspaceId, toast]);

  const handleArchive = useCallback(
    async (doc: DocumentResponse) => {
      if (!workspaceId) return;
      try {
        const updated = await documentApi.archive(doc.id, workspaceId);
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        toast({ tone: 'info', title: 'Archived', detail: getFileName(doc.path) });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Archive failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [workspaceId, toast],
  );

  const handleRestore = useCallback(
    async (doc: DocumentResponse) => {
      if (!workspaceId) return;
      try {
        const updated = await documentApi.restore(doc.id, workspaceId);
        setDocuments((prev) =>
          showArchived
            ? prev.map((d) => (d.id === updated.id ? updated : d))
            : prev.filter((d) => d.id !== updated.id),
        );
        toast({ tone: 'success', title: 'Restored', detail: getFileName(doc.path) });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Restore failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [workspaceId, showArchived, toast],
  );

  const openHistory = useCallback(
    async (doc: DocumentResponse) => {
      setHistory(doc);
      setActions([]);
      setActionsLoading(true);
      try {
        const res = await documentApi.actions(doc.id, docWorkspaceId(doc));
        setActions(res.actions);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to load history',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setActionsLoading(false);
      }
    },
    [toast],
  );

  const handleUndo = useCallback(
    async (action: DocumentAction, doc: DocumentResponse) => {
      setBusyAction(action.id);
      try {
        const updated = await documentApi.undo(action.id, docWorkspaceId(doc));
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, undone_at: new Date().toISOString() } : a)),
        );
        toast({ tone: 'success', title: 'Change undone', detail: getFileName(updated.path) });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Undo failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setBusyAction(null);
      }
    },
    [toast],
  );

  const actionLabel = (a: DocumentAction): string => {
    switch (actionType(a)) {
      case 'document_rename':
        return `Renamed ${actionOldPath(a) ?? ''} → ${actionNewPath(a) ?? ''}`;
      case 'document_archive':
        return 'Archived';
      case 'document_restore':
        return 'Restored from archive';
      default:
        return actionType(a);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Files</h1>
        <p className="text-text-muted">Upload, view and manage your documents.</p>
      </header>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void startUpload(file);
        }}
        className={`card mb-6 flex flex-col items-center justify-center gap-2 border-2 border-dashed py-10 text-center transition-colors ${
          dragOver ? 'border-primary/60 bg-primary/5' : 'border-border/60'
        }`}
      >
        <p className="text-sm font-medium text-text">
          {dragOver ? 'Drop to upload' : 'Drop a file here or click to browse'}
        </p>
        <p className="text-xs text-text-muted">
          PDF, DOCX, TXT, MD, CSV, images — stored in your workspace
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          aria-label="Choose file to upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void startUpload(file);
            e.target.value = '';
          }}
        />
      </div>

      {upload.phase !== 'idle' && (
        <div className="card mb-6 p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-text">{upload.name}</span>
            {upload.phase === 'uploading' && (
              <span className="text-text-muted font-mono text-xs">{upload.percent}%</span>
            )}
          </div>
          {upload.phase === 'uploading' && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${upload.percent}%` }}
              />
            </div>
          )}
          {upload.phase === 'processing' && (
            <p className="text-xs text-text-muted">Storing content…</p>
          )}
          {upload.phase === 'error' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-red-400">Failed: {upload.message}</p>
              <button
                onClick={() => void startUpload(upload.file)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search files…"
          aria-label="Search files by name"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary w-48"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter files by type"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="all">All types</option>
          <option value="pdf">PDF</option>
          <option value="docx">DOCX</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="other">Other</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 accent-primary"
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading files..." />
      ) : error ? (
        <ErrorState title="Failed to load files" message={error} onRetry={() => fetchDocuments()} />
      ) : documents.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No archived files' : 'No files yet'}
          description={
            showArchived
              ? 'Archived files will appear here.'
              : 'Upload your resume, transcripts, or cover letters to get started.'
          }
        />
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          title="No matching files"
          description="Try adjusting your search or filter criteria."
        />
      ) : (
        <div className="hidden md:block card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                <th scope="col" className="pb-3 font-normal">
                  Name
                </th>
                <th scope="col" className="pb-3 font-normal">
                  Type
                </th>
                <th scope="col" className="pb-3 font-normal">
                  Size
                </th>
                <th scope="col" className="pb-3 font-normal">
                  Created
                </th>
                <th scope="col" className="pb-3 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const archived = Boolean(docDeletedAt(doc));
                return (
                  <tr
                    key={doc.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${getFileName(doc.path)}`}
                    onClick={() => void openViewer(doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void openViewer(doc);
                      }
                    }}
                    className={`border-b border-border/50 transition-colors focus:outline-none focus:bg-background/50 ${
                      archived ? 'opacity-50 hover:opacity-80' : 'hover:bg-background/50'
                    } cursor-pointer`}
                  >
                    <td className="py-3">
                      <span className="font-medium text-text">{getFileName(doc.path)}</span>
                      {archived && (
                        <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-text-dim">
                          archived
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-text-muted font-mono text-sm">{doc.type}</td>
                    <td className="py-3 text-text-muted text-sm">{formatSize(docMetaSize(doc))}</td>
                    <td className="py-3 text-text-muted text-sm">
                      {formatDate(docCreatedAt(doc))}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setRenaming(doc);
                            setRenameValue(getFileName(doc.path));
                          }}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                        >
                          Rename
                        </button>
                        {archived ? (
                          <button
                            onClick={() => void handleRestore(doc)}
                            className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleArchive(doc)}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => void openHistory(doc)}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filteredDocs.length > 0 && (
        <div className="md:hidden mt-4 space-y-3">
          {filteredDocs.map((doc) => (
            <div
              key={`card-${doc.id}`}
              role="button"
              tabIndex={0}
              onClick={() => void openViewer(doc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void openViewer(doc);
                }
              }}
              className="card p-4 flex flex-col gap-2 cursor-pointer hover:border-primary/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-text truncate">{getFileName(doc.path)}</span>
                <span className="text-xs font-mono text-text-muted">{doc.type}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>{formatSize(docMetaSize(doc))}</span>
                <span>·</span>
                <span>{formatDate(docCreatedAt(doc))}</span>
                {Boolean(docDeletedAt(doc)) && (
                  <span className="rounded-full border border-border px-2 py-0.5">archived</span>
                )}
              </div>
              <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setRenaming(doc);
                    setRenameValue(getFileName(doc.path));
                  }}
                  className="flex-1 rounded-full border border-border px-3 py-1 text-xs"
                >
                  Rename
                </button>
                <button
                  onClick={() => void openViewer(doc)}
                  className="flex-1 rounded-full bg-white text-black px-3 py-1 text-xs"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-xs font-mono text-text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-surface-hover"
            >
              Previous
            </button>
            <button
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-surface-hover"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(viewer)}
        onClose={closeViewer}
        title={viewer ? getFileName(viewer.path) : ''}
      >
        {viewer && (
          <div className="flex max-h-[70vh] flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="font-mono uppercase">{viewer.type}</span>
              <span>·</span>
              <span>{formatSize(docMetaSize(viewer))}</span>
              <span>·</span>
              <span>{formatDate(docCreatedAt(viewer))}</span>
              <div className="ml-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setRenaming(viewer);
                    setRenameValue(getFileName(viewer.path));
                  }}
                  className="rounded-full border border-border px-3 py-1 hover:bg-surface-hover"
                >
                  Rename
                </button>
                {docDeletedAt(viewer) ? (
                  <button
                    onClick={() => void handleRestore(viewer)}
                    className="rounded-full border border-emerald-500/30 px-3 py-1 text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => void handleArchive(viewer)}
                    className="rounded-full border border-border px-3 py-1 hover:bg-surface-hover"
                  >
                    Archive
                  </button>
                )}
                <a
                  href={viewerContent?.url}
                  download={getFileName(viewer.path)}
                  className="rounded-full border border-border px-3 py-1 hover:bg-surface-hover"
                >
                  Download
                </a>
              </div>
            </div>
            <div className="min-h-[40vh] flex-1 overflow-auto rounded-xl border border-border/50 bg-background/40">
              {viewerLoading ? (
                <div className="flex h-full items-center justify-center p-8">
                  <LoadingSpinner text="Loading content..." />
                </div>
              ) : viewerContent?.unsupported ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="text-sm text-text-muted">
                    Preview isn&apos;t available for this file type. Download it to view.
                  </p>
                  <a
                    href={viewerContent.url}
                    download={getFileName(viewer.path)}
                    className="rounded-full bg-white px-4 py-1.5 text-xs text-black"
                  >
                    Download
                  </a>
                </div>
              ) : viewerContent?.text != null ? (
                <pre className="whitespace-pre-wrap p-5 font-mono text-sm leading-relaxed text-text">
                  {viewerContent.text}
                </pre>
              ) : viewerContent ? (
                <iframe
                  src={viewerContent.url}
                  title={getFileName(viewer.path)}
                  className="h-[60vh] w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <p className="text-sm text-text-muted">No content available.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title={`Rename ${renaming ? getFileName(renaming.path) : ''}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleRename();
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1 text-sm text-text-muted">
            New name
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          {renaming && renameValue.trim() && renaming.path !== renameValue.trim() && (
            <DiffViewer oldText={renaming.path} newText={renameValue.trim()} />
          )}
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-text-muted">
            <span className="font-medium text-amber-700">Organization Agent suggestion</span> — this
            rename is logged and reversible via <span className="font-mono">History → Undo</span>.
            An approval record is created for traceability.
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenaming(null)}
              className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!renameValue.trim()}
              className="rounded-full bg-white px-4 py-1.5 text-sm text-black disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(history)}
        onClose={() => setHistory(null)}
        title={`History — ${history ? getFileName(history.path) : ''}`}
      >
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-auto">
          {actionsLoading ? (
            <LoadingSpinner text="Loading history..." />
          ) : actions.length === 0 ? (
            <p className="text-sm text-text-muted">No changes recorded for this file.</p>
          ) : (
            actions.map((a) => {
              const undone = Boolean(actionUndoneAt(a));
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3 ${
                    undone ? 'border-border/40 opacity-60' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">{actionLabel(a)}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(actionCreatedAt(a)).toLocaleString()} ·{' '}
                        {undone ? 'undone' : actionType(a)}
                      </p>
                    </div>
                    {!undone && (
                      <button
                        disabled={busyAction === a.id}
                        onClick={() => void handleUndo(a, history!)}
                        className="shrink-0 rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
                      >
                        {busyAction === a.id ? 'Undoing…' : 'Undo'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}
