'use client';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { documentApi } from '@/lib/api-client';
import type {
  DocumentResponse,
  DocumentAction,
  DocumentVersionResponse,
  DocumentShareResponse,
} from '@/lib/api-client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { PageHeader } from '@/components/shared/Page';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

import { DocumentAuditPanel } from './DocumentAuditPanel';
import { DocumentCompareView } from './DocumentCompareView';
import { DocumentShareDialog } from './DocumentShareDialog';

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function formatSize(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function docWorkspaceId(d: DocumentResponse, fallbackWsId?: string): string {
  return (
    (d as unknown as Record<string, string>)['workspace_id'] ??
    (d as unknown as Record<string, string>)['workspaceId'] ??
    fallbackWsId ??
    ''
  );
}

function field<T>(source: unknown, snake: string, camel: string): T | undefined {
  const record = source as Record<string, T>;
  return record?.[snake] ?? record?.[camel];
}

const TEXT_TYPES = new Set([
  'text',
  'markdown',
  'csv',
  'json',
  'html',
  'xml',
  'yaml',
  'sql',
  'ts',
  'js',
  'py',
]);
const IMAGE_TYPES = new Set(['image', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

export interface DocumentDetailViewProps {
  workspaceId?: string;
  documentId?: string;
  basePath?: 'documents' | 'files';
}

export function DocumentDetailView({
  workspaceId: propWorkspaceId,
  documentId: propDocId,
  basePath = 'documents',
}: DocumentDetailViewProps) {
  const params = useParams() as { workspaceId?: string; documentId?: string };
  const workspaceId = propWorkspaceId ?? params?.workspaceId ?? '';
  const documentId = propDocId ?? params?.documentId ?? '';
  const router = useRouter();
  const { toast } = useToast();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Content state
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // History & Actions state
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);

  // Versions state
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  // Shares state
  const [shares, setShares] = useState<DocumentShareResponse[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'preview' | 'audit' | 'compare' | 'revisions' | 'history' | 'sharing'
  >('preview');

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: 'restore-version'; versionNumber: number }
    | { kind: 'archive-document' }
    | { kind: 'delete-document' }
    | { kind: 'undo-action'; actionId: string }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Fetch document & content
  const fetchDocAndContent = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setLoading(true);
    setError(null);
    try {
      const found = await documentApi.getById(documentId, workspaceId);
      if (!found) throw new Error('Document not found in workspace');
      setDoc(found);

      const blob = await documentApi.getContent(found.id, workspaceId);
      const ext = found.path.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon',
        txt: 'text/plain',
        md: 'text/markdown',
        json: 'application/json',
        csv: 'text/csv',
      };
      const resolvedMime =
        mimeMap[ext] ||
        (found as unknown as { detected_mime_type?: string; detectedMimeType?: string })
          .detected_mime_type ||
        (found as unknown as { detected_mime_type?: string; detectedMimeType?: string })
          .detectedMimeType ||
        blob.type ||
        'application/octet-stream';
      const typedBlob = new Blob([await blob.arrayBuffer()], { type: resolvedMime });
      const url = URL.createObjectURL(typedBlob);
      setBlobUrl(url);

      const type = found.type?.toLowerCase() || '';
      if (
        TEXT_TYPES.has(type) ||
        found.path.endsWith('.txt') ||
        found.path.endsWith('.md') ||
        found.path.endsWith('.json') ||
        found.path.endsWith('.csv') ||
        found.path.endsWith('.py') ||
        found.path.endsWith('.ts') ||
        found.path.endsWith('.tsx') ||
        found.path.endsWith('.js')
      ) {
        setTextContent(await blob.text());
      } else {
        setTextContent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId]);

  // Fetch history / actions
  const fetchActions = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await documentApi.actions(documentId, workspaceId);
      setActions(res.actions);
    } catch (err) {
      setActions([]);
      setHistoryError(err instanceof Error ? err.message : 'Failed to load action history');
    } finally {
      setHistoryLoading(false);
    }
  }, [workspaceId, documentId]);

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setVersionsLoading(true);
    try {
      const vList = await documentApi.listVersions(documentId, workspaceId);
      setVersions(vList);
    } catch {
      // Best effort version load
    } finally {
      setVersionsLoading(false);
    }
  }, [workspaceId, documentId]);

  // Fetch shares
  const fetchShares = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setSharesLoading(true);
    try {
      const sList = await documentApi.listShares(documentId, workspaceId);
      setShares(sList);
    } catch {
      // Best effort shares load
    } finally {
      setSharesLoading(false);
    }
  }, [workspaceId, documentId]);

  useEffect(() => {
    void fetchDocAndContent();
    void fetchActions();
    void fetchVersions();
    void fetchShares();
  }, [fetchDocAndContent, fetchActions, fetchVersions, fetchShares]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Undo action
  const handleUndo = async (actionId: string) => {
    if (!workspaceId) return;
    setUndoBusyId(actionId);
    try {
      const updated = await documentApi.undo(actionId, workspaceId);
      toast({ tone: 'success', title: 'Action Undone', detail: 'The change has been reverted.' });
      setDoc(updated);
      void fetchActions();
      void fetchDocAndContent();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Undo failed',
        detail: err instanceof Error ? err.message : 'Could not undo action',
      });
    } finally {
      setUndoBusyId(null);
      setConfirmDialog(null);
    }
  };

  // Upload new version
  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !documentId) return;
    setVersionBusy(true);
    try {
      const newVer = await documentApi.createVersion(documentId, workspaceId, file);
      toast({
        tone: 'success',
        title: 'Revision uploaded',
        detail: `New version v${newVer.versionNumber ?? newVer.version_number} saved.`,
      });
      void fetchVersions();
      void fetchDocAndContent();
      void fetchActions();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Upload version failed',
        detail: err instanceof Error ? err.message : 'Could not upload new version',
      });
    } finally {
      setVersionBusy(false);
      if (versionFileInputRef.current) versionFileInputRef.current.value = '';
    }
  };

  // Restore version
  const handleRestoreVersion = async (versionNum: number) => {
    if (!workspaceId || !documentId) return;
    setConfirmBusy(true);
    try {
      const updated = await documentApi.restoreVersion(documentId, versionNum, workspaceId);
      toast({
        tone: 'success',
        title: 'Version restored',
        detail: `Active document now at revision ${versionNum}.`,
      });
      setDoc(updated);
      void fetchDocAndContent();
      void fetchActions();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Restore failed',
        detail: err instanceof Error ? err.message : 'Could not restore revision',
      });
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  // Archive document
  const handleArchive = async () => {
    if (!workspaceId || !documentId) return;
    setConfirmBusy(true);
    try {
      await documentApi.archive(documentId, workspaceId);
      toast({ tone: 'success', title: 'Archived', detail: 'Document moved to archive.' });
      router.push(`/workspace/${workspaceId}/${basePath}`);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Archive failed',
        detail: err instanceof Error ? err.message : 'Could not archive document',
      });
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  // Delete document permanently
  const handleDelete = async () => {
    if (!workspaceId || !documentId) return;
    setConfirmBusy(true);
    try {
      await documentApi.delete(documentId, workspaceId);
      toast({ tone: 'success', title: 'Deleted', detail: 'Document deleted permanently.' });
      router.push(`/workspace/${workspaceId}/${basePath}`);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Could not delete document',
      });
    } finally {
      setConfirmBusy(false);
      setConfirmDialog(null);
    }
  };

  // Share handlers
  const handleShareSubmit = async (targetWs: string, perm: string, exp?: string) => {
    if (!workspaceId || !documentId) return;
    const created = await documentApi.createShare(documentId, workspaceId, targetWs, perm, exp);
    toast({
      tone: 'success',
      title: 'Share granted',
      detail: `Access shared with workspace ${targetWs}.`,
    });
    setShares((prev) => [created, ...prev]);
  };

  const handleShareRevoke = async (shareId: string) => {
    if (!workspaceId || !documentId) return;
    await documentApi.revokeShare(shareId, workspaceId, documentId);
    toast({ tone: 'success', title: 'Share revoked', detail: 'Access removed.' });
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  // Copy text content
  const handleCopyText = () => {
    if (!textContent) return;
    void navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" text="Loading document..." />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <ErrorState
        title="Failed to load document"
        message={error ?? 'Document not found'}
        onRetry={fetchDocAndContent}
      />
    );
  }

  const fileName = getFileName(doc.path);
  const size = (doc.metadata as Record<string, unknown> | undefined)?.['size'];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = (doc.type || '').toLowerCase();
  const isImage =
    IMAGE_TYPES.has(type) ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext);
  const isPdf = type === 'pdf' || ext === 'pdf';
  const isMarkdown = type === 'markdown' || ext === 'md' || ext === 'markdown';
  const createdAt = field<string>(doc, 'created_at', 'createdAt');
  const scanStatus = doc.scan_status;
  const versionNum = field<number | string>(doc.metadata, 'version', 'version_number') ?? 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation Header */}
      <PageHeader
        title={fileName}
        description={`${type.toUpperCase()} · ${formatSize(size)} · Created ${
          createdAt ? new Date(createdAt).toLocaleDateString() : '—'
        } · Rev v${versionNum}`}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
            <Link
              href={`/workspace/${workspaceId}/${basePath}`}
              className="hover:text-primary transition-colors font-medium"
            >
              Workspace {basePath === 'files' ? 'Files' : 'Documents'}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-text font-medium truncate max-w-xs">{fileName}</span>
            <span className="font-mono text-[11px] text-text-dim ml-1">({doc.id.slice(0, 8)})</span>
          </nav>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/workspace/${workspaceId}/${basePath}`)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              ← Back
            </button>

            {blobUrl && (
              <a
                href={blobUrl}
                download={fileName}
                className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Download</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>AI Audit</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span>Compare</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmDialog({ kind: 'archive-document' })}
              className="btn-secondary text-xs px-3 py-1.5 text-warning hover:bg-warning/10 hover:border-warning/30"
              title="Archive document"
            >
              Archive
            </button>

            <button
              type="button"
              onClick={() => setConfirmDialog({ kind: 'delete-document' })}
              className="btn-secondary text-xs px-3 py-1.5 text-error hover:bg-error/10 hover:border-error/30"
              title="Delete document permanently"
            >
              Delete
            </button>
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Document views"
        className="flex gap-1 border-b border-border/70 overflow-x-auto"
      >
        {(
          [
            { id: 'preview', label: 'Preview' },
            { id: 'audit', label: 'AI Quality Audit' },
            { id: 'compare', label: `Version Compare (${versions.length})` },
            { id: 'revisions', label: `Revisions (${versions.length})` },
            { id: 'history', label: `Activity & History (${actions.length})` },
            { id: 'sharing', label: `Access & Sharing (${shares.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-[1px] transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'border-primary text-text font-semibold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Preview */}
      {activeTab === 'preview' && (
        <div className="space-y-3">
          {textContent != null && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCopyText}
                className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 text-text-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>{copied ? 'Copied!' : 'Copy Content'}</span>
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-surface/40 p-4 min-h-[50dvh] overflow-auto">
            {textContent != null ? (
              isMarkdown ? (
                <div className="prose prose-invert prose-sm max-w-none p-4 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
                </div>
              ) : (
                <pre className="font-mono text-xs text-text leading-relaxed whitespace-pre-wrap break-words p-4">
                  {textContent}
                </pre>
              )
            ) : isImage && blobUrl ? (
              <div className="flex flex-col items-center justify-center p-2 sm:p-4">
                <div className="w-full flex items-center justify-between pb-3 text-xs border-b border-border/40 mb-3">
                  <span className="font-mono text-text-muted">{fileName}</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>↗</span> Full Resolution
                    </a>
                    <a
                      href={blobUrl}
                      download={fileName}
                      className="px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>↓</span> Download
                    </a>
                  </div>
                </div>
                <div className="max-h-[70vh] w-full overflow-auto flex items-center justify-center">
                  <img
                    src={blobUrl}
                    alt={fileName}
                    className="max-h-[65vh] max-w-full rounded-lg shadow-lg object-contain"
                  />
                </div>
              </div>
            ) : isPdf && blobUrl ? (
              <div className="flex flex-col w-full min-h-[60vh] max-h-[78vh]">
                <div className="flex items-center justify-between px-3 py-2 bg-surface-200/80 rounded-t-lg border border-border/70 border-b-0 text-xs">
                  <span className="font-mono text-text-muted truncate">{fileName}</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>↗</span> Open in New Tab
                    </a>
                    <a
                      href={blobUrl}
                      download={fileName}
                      className="px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>↓</span> Download PDF
                    </a>
                  </div>
                </div>
                <object
                  data={`${blobUrl}#toolbar=1`}
                  type="application/pdf"
                  className="w-full flex-1 min-h-[58vh] rounded-b-lg border border-border bg-surface-100"
                >
                  <iframe
                    src={`${blobUrl}#toolbar=1`}
                    title={fileName}
                    className="w-full h-full min-h-[58vh] rounded-b-lg border-0"
                  >
                    <div className="p-8 text-center bg-surface-100 rounded-b-lg space-y-3">
                      <p className="text-sm text-text-muted">
                        Embedded PDF preview was blocked by your browser settings.
                      </p>
                      <div className="flex justify-center gap-3">
                        <a
                          href={blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Open in New Tab
                        </a>
                        <a
                          href={blobUrl}
                          download={fileName}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          Download PDF
                        </a>
                      </div>
                    </div>
                  </iframe>
                </object>
              </div>
            ) : blobUrl ? (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-200 flex items-center justify-center text-text-dim">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text">
                  Preview not available for {type || 'binary'}
                </p>
                <p className="text-xs text-text-muted max-w-xs">
                  This file format requires downloading to inspect directly on your local system.
                </p>
                <a
                  href={blobUrl}
                  download={fileName}
                  className="btn-primary text-xs px-4 py-2 mt-2"
                >
                  Download File ({fileName})
                </a>
              </div>
            ) : (
              <p className="p-12 text-center text-text-muted text-xs">
                No preview content available.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AI Quality Audit */}
      {activeTab === 'audit' && (
        <DocumentAuditPanel documentId={documentId} workspaceId={workspaceId} />
      )}

      {/* Tab 3: Version Compare */}
      {activeTab === 'compare' && (
        <DocumentCompareView
          documentId={documentId}
          workspaceId={workspaceId}
          versions={versions}
        />
      )}

      {/* Tab 4: Revisions */}
      {activeTab === 'revisions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-surface/50">
            <div>
              <h3 className="text-sm font-semibold text-text">Document Revisions</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Every update creates an immutable revision record with SHA256 checksum and instant
                rollback.
              </p>
            </div>

            <button
              type="button"
              onClick={() => versionFileInputRef.current?.click()}
              disabled={versionBusy}
              className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
            >
              {versionBusy ? <LoadingSpinner size="sm" /> : <span>+ Upload Revision</span>}
            </button>
            <input
              ref={versionFileInputRef}
              type="file"
              className="hidden"
              onChange={handleUploadVersion}
            />
          </div>

          {versionsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading revisions..." />
            </div>
          ) : versions.length === 0 ? (
            <p className="p-8 text-center text-xs text-text-muted border border-dashed border-border/60 rounded-xl">
              No previous revisions found. The current file represents the initial revision.
            </p>
          ) : (
            <div className="divide-y divide-border/40 rounded-xl border border-border/70 overflow-hidden bg-surface/30">
              {versions.map((ver) => {
                const num = ver.versionNumber ?? ver.version_number ?? 1;
                const created = ver.createdAt ?? ver.created_at;
                const checksum = ver.checksum;
                const sizeBytes = ver.sizeBytes ?? ver.size_bytes;

                return (
                  <div
                    key={ver.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-surface-hover/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                          v{num}
                        </span>
                        <span className="text-xs font-medium text-text">Revision {num}</span>
                      </div>
                      <p className="text-[11px] text-text-dim">
                        Uploaded {created ? new Date(created).toLocaleString() : '—'} ·{' '}
                        {formatSize(sizeBytes)}
                        {checksum && ` · SHA: ${checksum.slice(0, 12)}...`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({ kind: 'restore-version', versionNumber: num })
                      }
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Restore to v{num}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Activity & History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border/70 bg-surface/50">
            <h3 className="text-sm font-semibold text-text">Audit Trail & Action History</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Reversible forensic log of modifications, renames, and workspace archival events.
            </p>
          </div>

          {historyError && (
            <div
              role="alert"
              className="p-3 text-xs text-error bg-error/10 border border-error/30 rounded-lg"
            >
              Could not load change history: {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading activity history..." />
            </div>
          ) : actions.length === 0 ? (
            <p className="p-8 text-center text-xs text-text-muted border border-dashed border-border/60 rounded-xl">
              No historical changes recorded for this document.
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((act) => {
                const actionType = field<string>(act, 'action_type', 'actionType') ?? '';
                const oldPath = field<string>(act, 'old_path', 'oldPath');
                const newPath = field<string>(act, 'new_path', 'newPath');
                const undone = Boolean(field<string | null>(act, 'undone_at', 'undoneAt'));
                const created = field<string>(act, 'created_at', 'createdAt') ?? '';
                const isRename = actionType === 'document_rename' && oldPath && newPath;

                return (
                  <div
                    key={act.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      undone
                        ? 'border-border/40 opacity-60 bg-surface/20'
                        : 'border-border/70 bg-surface/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-text">
                          {isRename ? `Renamed ${oldPath} → ${newPath}` : actionType}
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {created ? new Date(created).toLocaleString() : '—'} ·{' '}
                          {undone ? (
                            <span className="text-warning font-medium">Reverted / Undone</span>
                          ) : (
                            <span className="text-success font-medium">Active</span>
                          )}
                        </p>
                      </div>

                      {!undone && (
                        <button
                          type="button"
                          disabled={undoBusyId === act.id}
                          onClick={() =>
                            setConfirmDialog({ kind: 'undo-action', actionId: act.id })
                          }
                          className="btn-secondary text-xs px-2.5 py-1"
                        >
                          {undoBusyId === act.id ? 'Undoing...' : 'Undo Action'}
                        </button>
                      )}
                    </div>

                    {isRename && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <DiffViewer oldText={oldPath as string} newText={newPath as string} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Access & Sharing */}
      {activeTab === 'sharing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-surface/50">
            <div>
              <h3 className="text-sm font-semibold text-text">Workspace Access Controls</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Share this file across distinct organizational tenants with time-bound cryptographic
                permissions.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShareDialogOpen(true)}
              className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
            >
              <span>+ Share Access</span>
            </button>
          </div>

          {sharesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading active shares..." />
            </div>
          ) : shares.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted border border-dashed border-border/60 rounded-xl">
              This document is private to workspace <span className="font-mono">{workspaceId}</span>
              .
            </div>
          ) : (
            <div className="divide-y divide-border/40 rounded-xl border border-border/70 overflow-hidden bg-surface/30">
              {shares.map((sh) => {
                const targetWs = sh.targetWorkspaceId ?? sh.target_workspace_id;
                const perm = sh.permission;
                const exp = sh.expiresAt ?? sh.expires_at;

                return (
                  <div key={sh.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-text">{targetWs}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-primary/10 text-primary border border-primary/20">
                          {perm}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-dim">
                        {exp ? `Expires ${new Date(exp).toLocaleString()}` : 'Indefinite Access'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleShareRevoke(sh.id)}
                      className="px-2.5 py-1 text-xs text-error hover:bg-error/10 border border-error/20 rounded transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Share Dialog */}
      <DocumentShareDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        documentId={doc.id}
        workspaceId={workspaceId}
        documentName={fileName}
        onShareCreated={(s) => setShares((prev) => [s, ...prev])}
        onShareRevoked={(sId) => setShares((prev) => prev.filter((s) => s.id !== sId))}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (confirmDialog?.kind === 'restore-version') {
            void handleRestoreVersion(confirmDialog.versionNumber);
          } else if (confirmDialog?.kind === 'archive-document') {
            void handleArchive();
          } else if (confirmDialog?.kind === 'delete-document') {
            void handleDelete();
          } else if (confirmDialog?.kind === 'undo-action') {
            void handleUndo(confirmDialog.actionId);
          } else {
            setConfirmDialog(null);
          }
        }}
        title={
          confirmDialog?.kind === 'restore-version'
            ? 'Restore Revision'
            : confirmDialog?.kind === 'archive-document'
              ? 'Archive Document'
              : confirmDialog?.kind === 'delete-document'
                ? 'Permanently Delete Document'
                : 'Undo Modification'
        }
        message={
          confirmDialog?.kind === 'restore-version'
            ? `Restore revision v${confirmDialog.versionNumber}? A new active version will be generated.`
            : confirmDialog?.kind === 'archive-document'
              ? `Move "${fileName}" to the archive? It can be restored later.`
              : confirmDialog?.kind === 'delete-document'
                ? `Are you sure you want to permanently delete "${fileName}"? This will delete all versions and associated content. This action cannot be undone.`
                : 'Revert this action and restore the prior state?'
        }
        confirmLabel={
          confirmBusy
            ? 'Working...'
            : confirmDialog?.kind === 'delete-document'
              ? 'Delete Permanently'
              : 'Confirm'
        }
        variant={
          confirmDialog?.kind === 'archive-document' || confirmDialog?.kind === 'delete-document'
            ? 'danger'
            : 'default'
        }
      />
    </div>
  );
}
export default DocumentDetailView;
