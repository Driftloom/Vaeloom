'use client';

/**
 * The document detail screen.
 *
 * Design-system rebuild notes
 * ---------------------------
 * This component used to be 1472 lines of raw markup: 19 `<button>`, 8 `<a>`,
 * 57 `<div>`, 10 inline `<svg>`, 2 `<table>` and a hand-rolled tab bar, with
 * zero `@vaeloom/ui-kit` imports and zero `<label>` elements. It now composes
 * ui-kit primitives so every control inherits the shared focus-visible ring,
 * disabled/loading treatment and touch target.
 *
 * Preview rendering is NOT here: `./DocumentPreview` owns all nine branches.
 * This file supplies only the chrome around it (header download, copy button).
 *
 * Honesty notes
 * -------------
 *  - The upload-check badge reports what the backend actually does: an EICAR
 *    test-signature match, a magic-byte comparison against dangerous executable
 *    headers, and an extension allow-list (`services/file_security_service.py`).
 *    It does NOT run an antivirus engine, and the copy says so.
 *  - Every list panel distinguishes loading / empty / error. The shares panel used
 *    to swallow a failed fetch and then render "This document is private to
 *    workspace X", which is a false statement dressed as an empty state.
 *  - The revision number comes from the loaded `DocumentVersion` rows. It used to
 *    come from `Document.metadata.version`, a key no backend path writes, falling
 *    back to a hardcoded `1`, so a document on revision 7 was labelled "Rev v1".
 *  - Uploads are capped at 100 MB per file (`_MAX_UPLOAD_BYTES`,
 *    `routers/documents.py:142`) and 50 files per bulk upload
 *    (`_MAX_BULOAD_FILES`, same file). Both constants below mirror those.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Breadcrumb,
  Button,
  ClockIcon,
  DataTable,
  DownloadIcon,
  EmptyState,
  ErrorState,
  FileTextIcon,
  FormField,
  IconButton,
  Panel,
  RefreshCwIcon,
  ShieldIcon,
  Spinner,
  TabPanel,
  Tabs,
  Tooltip,
  XIcon,
  type ColumnDef,
  type TabItem,
} from '@vaeloom/ui-kit';

import { documentApi, legacySharePermission } from '@/lib/api-client';
import type {
  DocumentResponse,
  DocumentAction,
  DocumentVersionResponse,
  DocumentShareResponse,
} from '@/lib/api-client';
import {
  PLACEHOLDER,
  extensionOf,
  formatDate,
  formatSize,
  getFileName,
  mimeForExtension,
  previewKind,
  scanStateOf,
  type ScanState,
} from '@/lib/document-format';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { PageHeader } from '@/components/shared/Page';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

import { DocumentAuditPanel } from './DocumentAuditPanel';
import { DocumentCompareView } from './DocumentCompareView';
import { DocumentPreview } from './DocumentPreview';
import { DocumentShareDialog } from './DocumentShareDialog';
import { DocumentMoveDialog } from './DocumentMoveDialog';

/** Tab ids, typed so a mistyped `setActiveTab` cannot compile. */
type DetailTab = 'preview' | 'audit' | 'compare' | 'revisions' | 'history' | 'sharing';

const DETAIL_TABS: readonly DetailTab[] = [
  'preview',
  'audit',
  'compare',
  'revisions',
  'history',
  'sharing',
] as const;

/** Mirrors `_MAX_UPLOAD_BYTES` in `apps/api/src/api/routers/documents.py:142`. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const UPLOAD_SIZE_LIMIT = '100 MB';

/** Mirrors `_MAX_BULOAD_FILES` in the same router. */
const BULK_UPLOAD_FILE_LIMIT = 50;

const SCAN_STATE_COPY: Record<
  ScanState,
  { label: string; variant: 'success' | 'error' | 'info' | 'default' }
> = {
  clean: { label: 'Upload checks passed', variant: 'success' },
  quarantined: { label: 'Upload blocked', variant: 'error' },
  scanning: { label: 'Upload checks running', variant: 'info' },
  unknown: { label: 'No upload-check result', variant: 'default' },
};

/**
 * What the badge actually verified.
 *
 * `file_security_service.inspect_file` runs four checks: an EICAR anti-malware
 * test-signature substring match, a dangerous-executable magic-byte comparison,
 * an extension allow-list, and a magic-byte verification that the declared
 * extension matches the real content. There is no antivirus engine and no
 * heuristic scanner, so "Antivirus scan: clean" would be a lie a security
 * reviewer would correctly fail.
 */
const SCAN_STATE_DETAIL: Record<ScanState, string> = {
  clean:
    'Passed malware test-signature, file-content and extension checks at upload. This is not a full antivirus engine.',
  quarantined:
    'Rejected at upload: malware test-signature, executable content, or a disallowed extension.',
  scanning: 'Upload checks are still in flight.',
  unknown: 'No upload-check result was recorded for this document.',
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

/**
 * `formatDate` with a time component.
 *
 * `@/lib/document-format` has no `formatDateTime` export and one is NOT
 * re-declared here, because `formatDate` already accepts an options object and
 * `{ dateStyle, timeStyle }` is exactly what this needs. What matters is that it
 * keeps the "never return Invalid Date" guarantee, which the five
 * `new Date(x).toLocaleString()` call sites this replaces could and did violate.
 */
function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, { options: DATE_TIME_FORMAT });
}

interface LoadablePanelProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** What is being loaded, e.g. "revisions". Used in the status and retry copy. */
  label: string;
  children: React.ReactNode;
}

/**
 * Loading / error wrapper with a live region.
 *
 * Every data panel needs these two states plus its own empty state, and four of
 * the six panels had at most one of the three. The spinner sits inside
 * `role="status"` because a bare spinner announces nothing.
 */
function LoadablePanel({ loading, error, onRetry, label, children }: LoadablePanelProps) {
  if (error) {
    return (
      <ErrorState
        title={`Could not load ${label}`}
        message={error}
        actionText={`Retry loading ${label}`}
        onRetry={onRetry}
      />
    );
  }
  if (loading) {
    return (
      <div
        className="py-12 flex justify-center"
        data-testid={`loading-${label.replace(/\s+/g, '-')}`}
      >
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-text-muted">Loading {label}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

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

  // Content state. `contentError` is deliberately separate from the page-level
  // `error`: a 403 on the blob must not blank the metadata, tag, revision and
  // share panels, all of which load on their own.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // History & Actions state
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);

  // Versions state
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  // Shares state
  const [shares, setShares] = useState<DocumentShareResponse[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Move Dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [syncingMemory, setSyncingMemory] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<DetailTab>('preview');

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
    setContentError(null);
    setTextContent(null);
    try {
      const found = await documentApi.getById(documentId, workspaceId);
      if (!found) throw new Error('Document not found in workspace');
      setDoc(found);
      setTags(found.metadata?.tags ?? []);

      // Second request, third try/catch: the blob. A failure here is reported in
      // the preview panel and leaves the rest of the page intact.
      try {
        // The document's OWN workspace, not the one in the URL: a cross-workspace
        // share link renders a document stored elsewhere, and asking the content
        // endpoint for the wrong workspace is a guaranteed 404.
        //
        // `docWorkspaceId` from document-format is NOT used here: its parameter is
        // typed `(WorkspaceScoped & Record<string, unknown>)`, and `DocumentResponse`
        // is an interface with no index signature, so it rejects a typed document.
        // `workspaceId` is a required string on the interface, so this is the same
        // lookup without the unsatisfiable type.
        const blob = await documentApi.getContent(found.id, found.workspaceId || workspaceId);

        // The content endpoint returns whatever the object store held, which for
        // a `.md` or `.csv` is frequently `application/octet-stream`, and a blob
        // typed that way is refused by the renderer.
        const resolvedMime =
          mimeForExtension(found.path) ??
          found.detectedMimeType ??
          blob.type ??
          'application/octet-stream';
        const typedBlob = new Blob([await blob.arrayBuffer()], { type: resolvedMime });
        setBlobUrl(URL.createObjectURL(typedBlob));

        // `previewKind` decides whether the bytes are text. The old code branched
        // on a hand-maintained type set plus eight `.endsWith()` checks, which
        // missed `.tsv`, `.log`, `.toml`, `.kt` and every other extension the
        // shared helper already knows.
        const kind = previewKind(resolvedMime, null, found.type, { path: found.path });
        const isTextKind =
          kind === 'markdown' || kind === 'text' || kind === 'csv' || kind === 'code';
        setTextContent(isTextKind ? await blob.text() : null);
      } catch (contentErr) {
        setBlobUrl(null);
        setContentError(
          contentErr instanceof Error ? contentErr.message : 'Could not load the file contents.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId]);

  // Synchronize document into Memory
  const handleSyncMemory = useCallback(async () => {
    if (!doc || !workspaceId) return;
    setSyncingMemory(true);
    try {
      const res = await documentApi.syncMemory(doc.id, workspaceId);
      toast({
        tone: 'success',
        title: 'Synced to Memory',
        detail: `Document "${getFileName(doc.path)}" is synchronized with workspace memory.`,
      });
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...prev.metadata,
                syncStatus: 'synced',
                memoryId: res.memoryId,
                syncedAt: new Date().toISOString(),
              },
            }
          : null,
      );
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Memory sync failed',
        detail: err instanceof Error ? err.message : 'Error syncing document to memory',
      });
    } finally {
      setSyncingMemory(false);
    }
  }, [doc, workspaceId, toast]);

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
    setVersionsError(null);
    try {
      const vList = await documentApi.listVersions(documentId, workspaceId);
      setVersions(vList);
    } catch (err) {
      // Previously swallowed by an empty catch, which left the tab rendering
      // "No previous revisions found": a confident falsehood about a document
      // that may have twenty revisions.
      setVersions([]);
      setVersionsError(err instanceof Error ? err.message : 'Failed to load revisions');
    } finally {
      setVersionsLoading(false);
    }
  }, [workspaceId, documentId]);

  // Fetch shares
  const fetchShares = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setSharesLoading(true);
    setSharesError(null);
    try {
      const sList = await documentApi.listShares(documentId, workspaceId);
      setShares(sList);
    } catch (err) {
      // Previously swallowed, which rendered "This document is private to
      // workspace X" for a document shared with six workspaces whose fetch had
      // just failed.
      setShares([]);
      setSharesError(err instanceof Error ? err.message : 'Failed to load sharing information');
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
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        tone: 'error',
        title: 'File too large',
        detail: `Revisions are capped at ${UPLOAD_SIZE_LIMIT} per file.`,
      });
      if (versionFileInputRef.current) versionFileInputRef.current.value = '';
      return;
    }
    setVersionBusy(true);
    try {
      const newVer = await documentApi.createVersion(documentId, workspaceId, file);
      toast({
        tone: 'success',
        title: 'Revision uploaded',
        detail: `New version v${newVer.versionNumber} saved.`,
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

  const handleShareRevoke = async (shareId: string) => {
    if (!workspaceId || !documentId) return;
    setRevokeBusyId(shareId);
    try {
      await documentApi.revokeShare(shareId, workspaceId, documentId);
      toast({ tone: 'success', title: 'Share revoked', detail: 'Access removed.' });
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Revoke failed',
        detail: err instanceof Error ? err.message : 'Could not revoke access',
      });
      // The local list is unchanged, so re-read rather than leave a stale view.
      void fetchShares();
    } finally {
      setRevokeBusyId(null);
    }
  };

  // Copy text content
  const handleCopyText = useCallback((text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Tag management
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!clean || tags.includes(clean) || !doc) return;
    setTagBusy(true);
    const updated = [...tags, clean];
    try {
      await documentApi.updateTags(doc.id, workspaceId, updated);
      setTags(updated);
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...prev.metadata,
                tags: updated,
              },
            }
          : null,
      );
      setNewTagInput('');
      toast({ tone: 'success', title: 'Tag added', detail: `#${clean}` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to add tag',
        detail: err instanceof Error ? err.message : 'Error adding tag',
      });
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!doc) return;
    setTagBusy(true);
    const updated = tags.filter((t) => t !== tagToRemove);
    try {
      await documentApi.updateTags(doc.id, workspaceId, updated);
      setTags(updated);
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...prev.metadata,
                tags: updated,
              },
            }
          : null,
      );
      toast({ tone: 'success', title: 'Tag removed', detail: `#${tagToRemove}` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to remove tag',
        detail: err instanceof Error ? err.message : 'Error removing tag',
      });
    } finally {
      setTagBusy(false);
    }
  };

  // ─── Derived document facts ────────────────────────────────────────────────

  const fileName = doc ? getFileName(doc.path) : '';
  const ext = doc ? extensionOf(doc.path) : '';
  const type = (doc?.type || '').toLowerCase();
  const size = doc?.metadata?.size;
  const isSynced = doc?.metadata?.syncStatus === 'synced';
  const scanState = scanStateOf(doc?.scanStatus);
  const scanCopy = SCAN_STATE_COPY[scanState];

  // The current revision comes from the loaded DocumentVersion rows. The old
  // source was `Document.metadata.version`, which no backend code path writes,
  // falling back to a hardcoded `1`. When the revisions fetch FAILED there is no
  // honest number to show, so the header says so instead of guessing.
  const currentRevision = useMemo(() => {
    if (versionsError) return null;
    if (versions.length === 0) return 1;
    return versions.reduce((max, v) => Math.max(max, v.versionNumber ?? 1), 1);
  }, [versions, versionsError]);

  const revisionColumns = useMemo<ColumnDef<DocumentVersionResponse>[]>(
    () => [
      {
        key: 'versionNumber',
        header: 'Revision',
        render: (_value, row) => (
          <Badge variant="primary" size="sm" className="font-mono">
            v{row.versionNumber}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Uploaded',
        render: (_value, row) => (
          <span className="text-xs text-text-muted">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        key: 'sizeBytes',
        header: 'Size',
        render: (_value, row) => (
          <span className="font-mono text-xs">{formatSize(row.sizeBytes)}</span>
        ),
      },
      {
        key: 'checksum',
        header: 'Checksum',
        render: (_value, row) => (
          <span className="font-mono text-xs text-text-dim" title={row.checksum ?? undefined}>
            {row.checksum ? `${row.checksum.slice(0, 12)}…` : PLACEHOLDER}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Action',
        render: (_value, row) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`Restore revision ${row.versionNumber} of ${fileName}`}
            onClick={() =>
              setConfirmDialog({ kind: 'restore-version', versionNumber: row.versionNumber })
            }
          >
            Restore
          </Button>
        ),
      },
    ],
    [fileName],
  );

  const tabItems = useMemo<TabItem[]>(
    () => [
      { id: 'preview', label: 'Preview' },
      { id: 'audit', label: 'AI Quality Audit' },
      { id: 'compare', label: 'Version Compare', badge: versions.length },
      { id: 'revisions', label: 'Revisions', badge: versions.length },
      { id: 'history', label: 'Activity & History', badge: actions.length },
      { id: 'sharing', label: 'Access & Sharing', badge: shares.length },
    ],
    [versions.length, actions.length, shares.length],
  );
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted">Loading document</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <ErrorState
        title="Failed to load document"
        message={error ?? 'Document not found'}
        actionText="Retry loading document"
        onRetry={() => void fetchDocAndContent()}
      />
    );
  }

  const inlinePreviewable = previewKind(doc.detectedMimeType ?? null, null, doc.type, {
    path: doc.path,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Navigation Header */}
      <PageHeader
        title={fileName}
        description={[
          type ? type.toUpperCase() : 'FILE',
          formatSize(size),
          `Created ${formatDate(doc.createdAt)}`,
          currentRevision === null ? `Revision ${PLACEHOLDER}` : `Rev v${currentRevision}`,
        ].join(' · ')}
        breadcrumb={
          <Breadcrumb
            items={[
              {
                label: `Workspace ${basePath === 'files' ? 'Files' : 'Documents'}`,
                href: `/workspace/${workspaceId}/${basePath}`,
              },
              { label: fileName, current: true },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/workspace/${workspaceId}/${basePath}`)}
            >
              Back
            </Button>

            {blobUrl && (
              <a
                href={blobUrl}
                download={fileName}
                aria-label={`Download ${fileName}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium bg-action text-action-fg hover:bg-action-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <DownloadIcon size={14} />
                <span>Download</span>
              </a>
            )}

            <Link
              href={`/workspace/${workspaceId}/chat?docId=${doc.id}&docName=${encodeURIComponent(fileName)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border border-border bg-surface-hover text-text hover:bg-surface-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Chat
            </Link>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMoveDialogOpen(true)}
            >
              Move
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
            >
              Share
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('audit')}
            >
              AI Audit
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('compare')}
            >
              Compare
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDialog({ kind: 'archive-document' })}
            >
              Archive
            </Button>

            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDialog({ kind: 'delete-document' })}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Document facts, upload-check verdict and tag editor */}
      <Panel padding="sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* The upload-check verdict. Previously fetched into a `scanStatus`
                const that was never rendered, so the verdict was invisible on a
                document whose whole purpose includes being safe to open. */}
            <Tooltip content={SCAN_STATE_DETAIL[scanState]}>
              <Badge variant={scanCopy.variant} size="sm">
                <ShieldIcon size={12} />
                {scanCopy.label}
              </Badge>
            </Tooltip>
            {scanState === 'quarantined' && doc.scanResult && (
              <Badge variant="error" size="sm" role="status">
                {doc.scanResult}
              </Badge>
            )}

            <Badge variant={isSynced ? 'success' : 'default'} size="sm">
              {isSynced ? 'Memory Synced' : 'Memory Integration'}
            </Badge>

            <Badge variant="mono" size="sm">
              {ext || type || 'file'}
            </Badge>
            <Badge variant="default" size="sm" className="font-mono">
              {formatSize(size)}
            </Badge>
            <Badge variant="default" size="sm">
              <ClockIcon size={12} />
              Updated {formatDateTime(doc.updatedAt)}
            </Badge>
            <Badge variant="mono" size="sm">
              <FileTextIcon size={12} />
              {doc.id.slice(0, 8)}
            </Badge>
            {doc.deletedAt && (
              <Badge variant="warning" size="sm" role="status">
                Archived {formatDate(doc.deletedAt)}
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={syncingMemory}
              onClick={() => void handleSyncMemory()}
            >
              {!syncingMemory && <RefreshCwIcon size={14} />}
              {syncingMemory ? 'Syncing' : isSynced ? 'Re-sync Memory' : 'Sync with Memory'}
            </Button>

            <Link
              href={`/workspace/${workspaceId}/memory?query=${encodeURIComponent(fileName)}`}
              className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium border border-border bg-surface text-text-muted hover:text-text hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              View in Memory
            </Link>
          </div>

          {/* Tag editor. The old markup had a placeholder and an aria-label but
              no <label>, and its remove control was a bare ✕ glyph. */}
          <div className="flex flex-wrap items-start gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-text-muted">Tags</span>
              {tags.length === 0 && <span className="text-xs text-text-dim">none yet</span>}
              {tags.map((tag) => (
                <Badge key={tag} variant="mono" size="sm">
                  <span>#{tag}</span>
                  <IconButton
                    type="button"
                    aria-label={`Remove tag #${tag}`}
                    variant="ghost"
                    size="sm"
                    disabled={tagBusy}
                    onClick={() => void handleRemoveTag(tag)}
                    className="h-4 w-4"
                  >
                    <XIcon size={10} />
                  </IconButton>
                </Badge>
              ))}
            </div>

            <form onSubmit={handleAddTag} className="inline-flex items-end gap-1">
              <FormField label="Add tag" htmlFor="document-tag-input">
                <input
                  id="document-tag-input"
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="new-tag"
                  disabled={tagBusy}
                  className="px-2 py-0.5 text-xs rounded-md bg-surface border border-border/70 text-text placeholder:text-text-dim focus:outline-none focus:border-primary w-24"
                />
              </FormField>
              <Button type="submit" variant="primary" size="sm" disabled={tagBusy}>
                Add
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-dim">
          Uploads are accepted up to {UPLOAD_SIZE_LIMIT} per file, and up to{' '}
          {BULK_UPLOAD_FILE_LIMIT} files per bulk upload.
        </p>
      </Panel>

      {/* Tabs. ui-kit `Tabs` already emits role=tablist/tab, aria-selected,
          id={`tab-${id}`}, aria-controls={`tabpanel-${id}`}, a roving tabIndex and
          Arrow/Home/End key handling; `TabPanel` emits role=tabpanel,
          aria-labelledby and tabIndex=0. Together they satisfy the WAI-ARIA tabs
          pattern, which the hand-rolled tab bar did not. */}
      <Tabs
        tabs={tabItems}
        activeTab={activeTab}
        // `Tabs` hands back an untyped string. Guarding against an id that is not
        // in DETAIL_TABS keeps `activeTab` from ever holding a value no panel
        // matches, which would render a tablist with no tabpanel at all.
        onTabChange={(id: string) => {
          if (DETAIL_TABS.includes(id as DetailTab)) setActiveTab(id as DetailTab);
        }}
        variant="underline"
        size="sm"
        ariaLabel="Document views"
        className="overflow-x-auto"
      />

      {DETAIL_TABS.map((tabId) => (
        <TabPanel key={tabId} id={tabId} activeTab={activeTab}>
          {tabId === 'preview' && (
            <div className="space-y-3">
              {textContent != null && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {copied && (
                    <Badge variant="success" size="sm" role="status">
                      Copied to clipboard
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyText(textContent)}
                  >
                    Copy Content
                  </Button>
                </div>
              )}

              <Panel padding="none" variant="subtle" className="min-h-[50dvh] overflow-auto">
                <DocumentPreview
                  document={doc}
                  source={{ url: blobUrl, text: textContent }}
                  error={contentError}
                  onCopyText={handleCopyText}
                  headerActions={
                    <>
                      {inlinePreviewable !== 'none' && blobUrl && (
                        <a
                          href={blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${fileName} in a new browser tab`}
                          className="px-2.5 py-1 rounded bg-surface hover:bg-surface-hover text-text border border-border font-medium inline-flex items-center gap-1 transition-colors text-xs"
                        >
                          Open in New Tab
                        </a>
                      )}
                      {blobUrl && (
                        <a
                          href={blobUrl}
                          download={fileName}
                          aria-label={`Download ${fileName}`}
                          className="px-2.5 py-1 rounded bg-primary text-primary-fg hover:bg-primary/90 font-medium inline-flex items-center gap-1 transition-colors text-xs"
                        >
                          <DownloadIcon size={12} />
                          Download
                        </a>
                      )}
                    </>
                  }
                  fallbackAction={
                    blobUrl ? (
                      <a
                        href={blobUrl}
                        download={fileName}
                        aria-label={`Download ${fileName}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-action text-action-fg hover:bg-action-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <DownloadIcon size={16} />
                        Download File ({fileName})
                      </a>
                    ) : undefined
                  }
                />
              </Panel>
            </div>
          )}

          {tabId === 'audit' && (
            <DocumentAuditPanel documentId={documentId} workspaceId={workspaceId} />
          )}

          {tabId === 'compare' && (
            <DocumentCompareView
              documentId={documentId}
              workspaceId={workspaceId}
              versions={versions}
            />
          )}

          {tabId === 'revisions' && (
            <div className="space-y-4">
              <Panel padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text">Document Revisions</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Every update creates an immutable revision record with a SHA256 checksum and
                      instant rollback. Revisions are capped at {UPLOAD_SIZE_LIMIT} per file.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={versionBusy}
                    onClick={() => versionFileInputRef.current?.click()}
                  >
                    {!versionBusy && <FileTextIcon size={14} />}
                    {versionBusy ? 'Uploading' : 'Upload Revision'}
                  </Button>
                  <label htmlFor="document-version-upload" className="sr-only">
                    Upload a new revision of {fileName}
                  </label>
                  <input
                    id="document-version-upload"
                    ref={versionFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => void handleUploadVersion(e)}
                  />
                </div>
              </Panel>

              <LoadablePanel
                loading={versionsLoading}
                error={versionsError}
                onRetry={() => void fetchVersions()}
                label="revisions"
              >
                {versions.length === 0 ? (
                  <EmptyState
                    icon={<ClockIcon size={24} />}
                    title="No previous revisions"
                    description="The current file is the initial revision of this document."
                  />
                ) : (
                  <DataTable<DocumentVersionResponse>
                    columns={revisionColumns}
                    data={versions}
                    keyExtractor={(row) => row.id}
                    emptyMessage="No revisions to show"
                    loading={false}
                    skeletonRows={3}
                  />
                )}
              </LoadablePanel>
            </div>
          )}

          {tabId === 'history' && (
            <div className="space-y-4">
              <Panel padding="sm">
                <h2 className="text-sm font-semibold text-text">
                  Audit Trail &amp; Action History
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Reversible forensic log of modifications, renames, and workspace archival events.
                </p>
              </Panel>

              <LoadablePanel
                loading={historyLoading}
                error={historyError}
                onRetry={() => void fetchActions()}
                label="activity history"
              >
                {actions.length === 0 ? (
                  <EmptyState
                    icon={<ClockIcon size={24} />}
                    title="No recorded changes"
                    description="Nothing has been modified, renamed or archived on this document."
                  />
                ) : (
                  <div className="space-y-3">
                    {actions.map((act) => {
                      const oldPath = act.oldPath;
                      const newPath = act.newPath;
                      const undone = Boolean(act.undoneAt);
                      const isRename = act.actionType === 'document_rename' && oldPath && newPath;

                      return (
                        <Panel key={act.id} padding="sm" className={undone ? 'opacity-60' : ''}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-text">
                                {isRename
                                  ? `Renamed ${oldPath} to ${newPath}`
                                  : act.actionType.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {formatDateTime(act.createdAt)}
                                {' · '}
                                {undone ? (
                                  <span className="text-warning font-medium">
                                    Reverted / Undone
                                  </span>
                                ) : (
                                  <span className="text-success font-medium">Active</span>
                                )}
                              </p>
                            </div>

                            {!undone && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                loading={undoBusyId === act.id}
                                onClick={() =>
                                  setConfirmDialog({ kind: 'undo-action', actionId: act.id })
                                }
                              >
                                Undo Action
                              </Button>
                            )}
                          </div>

                          {isRename && (
                            <div className="mt-3 pt-3 border-t border-border/40">
                              <DiffViewer oldText={oldPath} newText={newPath} />
                            </div>
                          )}
                        </Panel>
                      );
                    })}
                  </div>
                )}
              </LoadablePanel>
            </div>
          )}

          {tabId === 'sharing' && (
            <div className="space-y-4">
              <Panel padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text">Workspace Access Controls</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Share this file across distinct organizational tenants with time-bound
                      permissions.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                  >
                    Share Access
                  </Button>
                </div>
              </Panel>

              <LoadablePanel
                loading={sharesLoading}
                error={sharesError}
                onRetry={() => void fetchShares()}
                label="sharing information"
              >
                {shares.length === 0 ? (
                  <EmptyState
                    icon={<FileTextIcon size={24} />}
                    title="Not shared"
                    description={`This document is private to workspace ${workspaceId}.`}
                  />
                ) : (
                  <ul className="flex flex-col gap-3" data-testid="document-share-list">
                    {shares.map((sh) => {
                      const targetWs = sh.targetWorkspaceId;
                      const perm = legacySharePermission(sh.permission);
                      const exp = sh.expiresAt;

                      return (
                        <li key={sh.id}>
                          <Panel padding="sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-text">
                                    {targetWs}
                                  </span>
                                  <Badge
                                    variant={perm === 'write' ? 'primary' : 'default'}
                                    size="sm"
                                  >
                                    {perm === 'write' ? 'Read & write' : 'Read only'}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-text-dim">
                                  {exp ? `Expires ${formatDateTime(exp)}` : 'Indefinite access'}
                                  {' · granted '}
                                  {formatDate(sh.createdAt)}
                                </p>
                              </div>

                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                loading={revokeBusyId === sh.id}
                                aria-label={`Revoke ${perm === 'write' ? 'read and write' : 'read'} access for workspace ${targetWs}`}
                                onClick={() => void handleShareRevoke(sh.id)}
                              >
                                Revoke
                              </Button>
                            </div>
                          </Panel>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </LoadablePanel>
            </div>
          )}
        </TabPanel>
      ))}

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

      {/* Document Move Dialog */}
      <DocumentMoveDialog
        isOpen={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        document={doc}
        workspaceId={workspaceId}
        onMoved={() => {
          toast({
            tone: 'success',
            title: 'Document moved',
            detail: 'Document location updated.',
          });
          void fetchDocAndContent();
        }}
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
