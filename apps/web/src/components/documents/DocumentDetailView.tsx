'use client';

/**
 * The document detail screen.
 *
 * Decomposed architecture
 * -----------------------
 * Previously a 1394-line monolith. Subcomponents and state management have been cleanly
 * decomposed into modular units under `./detail/`:
 *  - useDocumentDetailData: State machine, data fetching, and mutations
 *  - DocumentDetailHeader: Navigation, metadata overview, and action toolbar
 *  - DocumentFactsPanel: Security scan status, tags, and memory sync status
 *  - DocumentPreviewTab: Document renderer with text copy and header action links
 *  - DocumentRevisionsPanel: Immutable version history, rollback, diff, and upload
 *  - DocumentHistoryPanel: Forensic audit trail and reversible actions
 *  - DocumentSharingPanel: Cross-workspace access permissions and revocation
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ErrorState, Spinner, TabPanel, Tabs, type TabItem } from '@vaeloom/ui-kit';

import {
  extensionOf,
  getFileName,
  previewKind,
  scanStateOf,
  type ScanState,
} from '@/lib/document-format';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

import { DocumentAuditPanel } from './DocumentAuditPanel';
import { DocumentCompareView } from './DocumentCompareView';
import { DocumentShareDialog } from './DocumentShareDialog';
import { DocumentMoveDialog } from './DocumentMoveDialog';
import { DocumentDetailHeader } from './detail/DocumentDetailHeader';
import { DocumentFactsPanel } from './detail/DocumentFactsPanel';
import { DocumentPreviewTab } from './detail/DocumentPreviewTab';
import { DocumentRevisionsPanel } from './detail/DocumentRevisionsPanel';
import { DocumentHistoryPanel } from './detail/DocumentHistoryPanel';
import { DocumentSharingPanel } from './detail/DocumentSharingPanel';
import { useDocumentDetailData } from './detail/useDocumentDetailData';
import {
  type ConfirmAction,
  getConfirmMeta,
  SCAN_STATE_COPY,
  SCAN_STATE_DETAIL,
} from './detail/confirmHelpers';

type DetailTab = 'preview' | 'audit' | 'compare' | 'revisions' | 'history' | 'sharing';

const DETAIL_TABS: readonly DetailTab[] = [
  'preview',
  'audit',
  'compare',
  'revisions',
  'history',
  'sharing',
] as const;

const UPLOAD_SIZE_LIMIT = '100 MB';
const BULK_UPLOAD_FILE_LIMIT = 50;

export interface DocumentDetailViewProps {
  basePath?: string;
}

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({
  basePath = 'documents',
}) => {
  const params = useParams();
  const router = useRouter();

  const workspaceId = (params?.['workspaceId'] as string) || '';
  const documentId = (params?.['documentId'] as string) || '';

  const [activeTab, setActiveTab] = useState<DetailTab>('preview');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    doc,
    blobUrl,
    textContent,
    contentError,
    loading,
    error,
    versions,
    versionsLoading,
    versionsError,
    versionBusy,
    versionFileInputRef,
    actions,
    historyLoading,
    historyError,
    undoBusyId,
    shares,
    sharesLoading,
    sharesError,
    revokeBusyId,
    syncingMemory,
    tags,
    newTagInput,
    setNewTagInput,
    tagBusy,
    fetchDocAndContent,
    fetchVersions,
    fetchActions,
    fetchShares,
    handleSyncMemory,
    handleUploadVersion,
    handleRollbackConfirm,
    handleArchive,
    handleDelete,
    handleShareRevoke,
    handleUndoAction,
    handleAddTag,
    handleRemoveTag,
  } = useDocumentDetailData(workspaceId, documentId, basePath);

  const handleCopyText = useCallback((text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const fileName = doc ? getFileName(doc.path) : '';
  const ext = doc ? extensionOf(doc.path) : '';
  const type = (doc?.type || '').toLowerCase();
  const size = doc?.metadata?.size ?? 0;
  const isSynced = doc?.metadata?.syncStatus === 'synced';
  const scanState = scanStateOf(doc?.scanStatus);
  const scanCopy = SCAN_STATE_COPY[scanState];
  const confirmMeta = getConfirmMeta(confirmDialog, fileName);

  const currentRevision = useMemo(() => {
    if (versionsError) return null;
    if (versions.length === 0) return 1;
    return versions.reduce((max, v) => Math.max(max, v.versionNumber ?? 1), 1);
  }, [versions, versionsError]);

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
      <DocumentDetailHeader
        fileName={fileName}
        type={type}
        size={size}
        createdAt={doc.createdAt}
        currentRevision={currentRevision}
        workspaceId={workspaceId}
        basePath={basePath}
        blobUrl={blobUrl}
        docId={doc.id}
        onBack={() => router.push(`/workspace/${workspaceId}/${basePath}`)}
        onMove={() => setMoveDialogOpen(true)}
        onShare={() => setShareDialogOpen(true)}
        onAuditTab={() => setActiveTab('audit')}
        onCompareTab={() => setActiveTab('compare')}
        onArchive={() => setConfirmDialog({ kind: 'archive-document' })}
        onDelete={() => setConfirmDialog({ kind: 'delete-document' })}
      />

      <DocumentFactsPanel
        scanState={scanState}
        scanCopy={scanCopy}
        scanDetail={SCAN_STATE_DETAIL[scanState]}
        scanResult={doc.scanResult ?? null}
        isSynced={isSynced}
        syncingMemory={syncingMemory}
        onSyncMemory={() => void handleSyncMemory()}
        ext={ext}
        type={type}
        size={size}
        updatedAt={doc.updatedAt}
        docId={doc.id}
        deletedAt={doc.deletedAt ?? null}
        workspaceId={workspaceId}
        fileName={fileName}
        tags={tags}
        tagBusy={tagBusy}
        newTagInput={newTagInput}
        onNewTagInputChange={setNewTagInput}
        onAddTag={handleAddTag}
        onRemoveTag={(tag) => void handleRemoveTag(tag)}
        uploadSizeLimit={UPLOAD_SIZE_LIMIT}
        bulkUploadFileLimit={BULK_UPLOAD_FILE_LIMIT}
      />

      <Tabs
        tabs={tabItems}
        activeTab={activeTab}
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
            <DocumentPreviewTab
              doc={doc}
              blobUrl={blobUrl}
              textContent={textContent}
              contentError={contentError}
              copied={copied}
              inlinePreviewable={inlinePreviewable}
              fileName={fileName}
              onCopyText={handleCopyText}
            />
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
            <DocumentRevisionsPanel
              fileName={fileName}
              versions={versions}
              versionsLoading={versionsLoading}
              versionsError={versionsError}
              onRetry={() => void fetchVersions()}
              versionBusy={versionBusy}
              uploadSizeLimit={UPLOAD_SIZE_LIMIT}
              fileInputRef={versionFileInputRef}
              onUploadRevision={(e) => void handleUploadVersion(e)}
              onRestorePrompt={(versionNumber) =>
                setConfirmDialog({ kind: 'restore-version', versionNumber })
              }
            />
          )}

          {tabId === 'history' && (
            <DocumentHistoryPanel
              actions={actions}
              historyLoading={historyLoading}
              historyError={historyError}
              onRetry={() => void fetchActions()}
              undoBusyId={undoBusyId}
              onUndoPrompt={(actionId) => setConfirmDialog({ kind: 'undo-action', actionId })}
            />
          )}

          {tabId === 'sharing' && (
            <DocumentSharingPanel
              shares={shares}
              sharesLoading={sharesLoading}
              sharesError={sharesError}
              onRetry={() => void fetchShares()}
              revokeBusyId={revokeBusyId}
              onOpenShareDialog={() => setShareDialogOpen(true)}
              onRevokeShare={(shareId) => void handleShareRevoke(shareId)}
            />
          )}
        </TabPanel>
      ))}

      <DocumentMoveDialog
        isOpen={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        document={doc}
        workspaceId={workspaceId}
        onMoved={() => {
          setMoveDialogOpen(false);
          void fetchDocAndContent();
        }}
      />

      <DocumentShareDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        document={doc}
        workspaceId={workspaceId}
        onShareCreated={() => {
          setShareDialogOpen(false);
          void fetchShares();
        }}
        onShareRevoked={() => {
          void fetchShares();
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        title={confirmMeta.title}
        message={confirmMeta.message}
        confirmLabel={confirmMeta.label}
        variant={confirmMeta.isDanger ? 'danger' : 'default'}
        loading={confirmBusy}
        onConfirm={async () => {
          if (!confirmDialog) return;
          setConfirmBusy(true);
          try {
            if (confirmDialog.kind === 'restore-version') {
              await handleRollbackConfirm(confirmDialog.versionNumber);
            } else if (confirmDialog.kind === 'archive-document') {
              await handleArchive();
            } else if (confirmDialog.kind === 'delete-document') {
              await handleDelete();
            } else if (confirmDialog.kind === 'undo-action') {
              await handleUndoAction(confirmDialog.actionId);
            }
          } finally {
            setConfirmBusy(false);
            setConfirmDialog(null);
          }
        }}
      />
    </div>
  );
};

export default DocumentDetailView;
