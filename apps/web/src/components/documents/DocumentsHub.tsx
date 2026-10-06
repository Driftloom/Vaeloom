'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, XIcon } from '@vaeloom/ui-kit';

import { PageHeader } from '@/components/shared/Page';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { DocumentResponse } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

import { DocumentStatsBar } from './DocumentStatsBar';
import { DocumentUploadQueue } from './DocumentUploadQueue';
import { DocumentShareDialog } from './DocumentShareDialog';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentMoveDialog } from './DocumentMoveDialog';

import { useDocumentActions } from './hooks/useDocumentActions';
import { useDocumentFolders } from './hooks/useDocumentFolders';
import { useDocumentList } from './hooks/useDocumentList';
import { useDocumentStats } from './hooks/useDocumentStats';
import { useDocumentVersions } from './hooks/useDocumentVersions';
import { useDocumentViewer } from './hooks/useDocumentViewer';
import { useFolderUpload } from './hooks/useFolderUpload';

import { CreateFolderModal } from './parts/CreateFolderModal';
import { DocumentsBulkBar } from './parts/DocumentsBulkBar';
import { DocumentsFolderRail } from './parts/DocumentsFolderRail';
import { DocumentsHeaderActions } from './parts/DocumentsHeaderActions';
import { DocumentsResultsPanel } from './parts/DocumentsResultsPanel';
import { DocumentsToolbar } from './parts/DocumentsToolbar';
import { DocumentVersionHistoryModal } from './parts/DocumentVersionHistoryModal';
import { RenameDocumentModal } from './parts/RenameDocumentModal';
import { categoryLabel } from './parts/documentCategories';
import {
  bulkSelectionProxy,
  confirmCopy,
  type PendingConfirm,
} from './parts/documentConfirmations';
import type { DocumentRowHandlers } from './parts/DocumentRowActions';

export interface DocumentsHubProps {
  workspaceId?: string;
  basePath?: 'documents' | 'files';
}

/**
 * The workspace documents screen.
 *
 * This component is now only the WIRING: five hooks own the data, eight presentational
 * pieces own the markup, and what is left here is deciding which of them is open.
 * The public API is unchanged — `{ workspaceId?, basePath? }` — because
 * `documents/page.tsx` and `files/page.tsx` both render this with no props and
 * with only `basePath` respectively.
 */
export function DocumentsHub({
  workspaceId: propWorkspaceId,
  basePath = 'documents',
}: DocumentsHubProps) {
  const params = useParams();
  const currentWorkspaceId =
    propWorkspaceId ?? (params?.['workspaceId'] as string | undefined) ?? '';
  const { toast } = useToast();

  const list = useDocumentList(currentWorkspaceId);
  // Destructured so the dependency is the stable callback itself rather than a
  // property access on `list`, which `react-hooks/exhaustive-deps` cannot prove
  // stable and reports as a missing dependency on every render.
  const { prependDocument } = list;
  // A second, independent request. The list is one page; these are workspace
  // aggregates, so they are neither derived from the page nor blocked by it, and
  // a failure here is reported by the stats bar alone.
  const stats = useDocumentStats(currentWorkspaceId);
  const folders = useDocumentFolders(currentWorkspaceId);
  const viewer = useDocumentViewer(currentWorkspaceId);
  const versions = useDocumentVersions(currentWorkspaceId);
  const actions = useDocumentActions({
    workspaceId: currentWorkspaceId,
    notify: toast,
    list,
    folders,
    stats,
  });
  const folderUpload = useFolderUpload({
    workspaceId: currentWorkspaceId,
    selectedFolderId: list.selectedFolderId,
    notify: toast,
    onFoldersChanged: folders.retry,
    onDocumentsChanged: () => {
      list.refresh();
      stats.refresh();
    },
  });

  const [shareDoc, setShareDoc] = useState<DocumentResponse | null>(null);
  const [moveDoc, setMoveDoc] = useState<DocumentResponse | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [renaming, setRenaming] = useState<DocumentResponse | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // A preview fetch that fails has no in-modal home: `DocumentPreviewModal` takes
  // no error prop and re-derives everything else from the document itself.
  // Reporting it as a toast is the honest option — the user asked to preview a
  // file and the answer is "that failed", not a dialog rendering nothing.
  useEffect(() => {
    if (!viewer.error) return;
    toast({ tone: 'error', title: 'Preview failed', detail: viewer.error });
  }, [viewer.error, toast]);

  const selectedFolderName = useMemo(
    () => folders.folders.find((folder) => folder.id === list.selectedFolderId)?.name ?? null,
    [folders.folders, list.selectedFolderId],
  );

  /**
   * What the category tab is doing, stated accurately.
   *
   * The old note counted how many rows on the CURRENT page matched and ended
   * "This filter runs in the browser, not on the server." Both halves were true
   * then and neither is now: `category` is a query parameter, the server returns
   * only matching rows, and `list.total` is the filtered count. What is worth
   * telling the user is that the totals around this table are scoped to the
   * filter — which is exactly the mixed-denominator confusion the workspace-level
   * stats bar exists to fix.
   */
  const categoryFilterNote = useMemo(() => {
    if (list.category === 'all') return null;
    return `Filtered on the server to "${categoryLabel(list.category)}". The counts and page total below describe this filtered set, not every file in the workspace.`;
  }, [list.category]);

  /**
   * The single "something changed" signal for this screen.
   *
   * A document write moves three things at once: the visible rows, the workspace
   * aggregates behind the stats bar, and (for folder operations) the tree. Calling
   * only `list.refresh()` is what left the counters describing the workspace as it
   * was before the click, so every refresh path here goes through this one helper.
   */
  const refreshDocuments = useCallback(() => {
    list.refresh();
    stats.refresh();
  }, [list, stats]);

  const rowHandlers = useMemo<DocumentRowHandlers>(
    () => ({
      workspaceId: currentWorkspaceId,
      basePath,
      syncingDocId: actions.syncingDocId,
      onPreview: (doc) => void viewer.open(doc),
      onShare: setShareDoc,
      onOpenVersions: (doc) => void versions.open(doc),
      onSyncMemory: (doc) => void actions.syncMemory(doc.id, doc.path),
      onRename: setRenaming,
      onMove: setMoveDoc,
      onArchive: (doc) =>
        setPendingConfirm({ kind: 'archive-document', docId: doc.id, name: getFileName(doc.path) }),
      onRestore: (doc) => void actions.restoreDocument(doc),
      onDelete: (doc) =>
        setPendingConfirm({ kind: 'delete-document', docId: doc.id, name: getFileName(doc.path) }),
    }),
    [currentWorkspaceId, basePath, actions, viewer, versions],
  );

  /** Opens the create-folder modal nested under whatever the tree row supplied. */
  const openCreateFolder = useCallback((parentId?: string | null) => {
    setFolderModalParentId(parentId ?? null);
    setFolderModalOpen(true);
  }, []);

  const submitCreateFolder = useCallback(
    async (name: string, parentId: string | null) => {
      await folders.createFolder(name, parentId);
      toast({ tone: 'success', title: 'Folder created', detail: `Folder "${name}" created.` });
      setFolderModalOpen(false);
    },
    [folders, toast],
  );

  const runConfirm = useCallback(async () => {
    if (!pendingConfirm) return;
    const target = pendingConfirm;
    setConfirmBusy(true);
    try {
      if (target.kind === 'delete-folder') {
        await folders.deleteFolder(target.folderId);
        // Deleting the folder you are browsing empties the filter, so the rail
        // would otherwise keep selecting an id that no longer exists.
        if (list.selectedFolderId === target.folderId) list.selectFolder(null);
        refreshDocuments();
        toast({
          tone: 'success',
          title: 'Folder deleted',
          detail: `Folder "${target.name}" removed.`,
        });
      } else if (target.kind === 'restore-version') {
        await versions.confirmRestore();
        refreshDocuments();
      } else if (target.kind === 'archive-document') {
        await actions.archiveDocument({ id: target.docId, path: target.name });
      } else if (target.kind === 'delete-document') {
        await actions.deleteDocument({ id: target.docId, path: target.name });
      } else {
        await actions.bulkDelete();
      }
    } catch {
      // Every branch above already toasted its own failure; this only stops the
      // dialog spinning.
    } finally {
      setConfirmBusy(false);
      setPendingConfirm(null);
    }
  }, [pendingConfirm, folders, list, versions, actions, toast, refreshDocuments]);

  const handleUploadComplete = useCallback(
    (doc: DocumentResponse) => {
      prependDocument(doc);
      // An upload moves the document total and the byte total, so the aggregates
      // are refetched here rather than waiting for `onAllCompleted`, which only
      // fires once the whole queue has drained.
      stats.refresh();
      toast({ tone: 'success', title: 'Upload complete', detail: doc.path });
    },
    [prependDocument, stats, toast],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Files"
        description="Enterprise document management, malware defense verification, AI audits, and version tracking."
        actions={
          <DocumentsHeaderActions
            autoOrganizeBusy={actions.autoOrganizeBusy}
            onAutoOrganize={() => void actions.autoOrganize()}
            onUploadFolderTree={folderUpload.open}
            onCreateFolder={() => openCreateFolder(null)}
          />
        }
      />

      <DocumentStatsBar
        totalCount={stats.stats?.totalDocuments}
        totalBytes={stats.stats?.totalBytes}
        cleanCount={stats.stats?.cleanCount}
        scanningCount={stats.stats?.scanningCount}
        quarantinedCount={stats.stats?.quarantinedCount}
        foldersCount={stats.stats?.folderCount}
        activeShares={stats.stats?.activeShareCount}
        loading={stats.loading}
        error={stats.error}
        onRetry={stats.retry}
      />

      <DocumentUploadQueue
        workspaceId={currentWorkspaceId}
        targetFolderId={list.selectedFolderId}
        onUploadComplete={handleUploadComplete}
        onFolderCreated={folders.retry}
        onAllCompleted={refreshDocuments}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <DocumentsFolderRail
          workspaceId={currentWorkspaceId}
          documents={list.documents}
          folders={folders}
          selectedFolderId={list.selectedFolderId}
          onSelectFolder={list.selectFolder}
          onCreateFolder={openCreateFolder}
          onDeleteFolder={(folderId, name) =>
            setPendingConfirm({ kind: 'delete-folder', folderId, name })
          }
          onChanged={() => {
            folders.retry();
            refreshDocuments();
          }}
        />

        <div className="lg:col-span-3 min-w-0 space-y-4">
          {selectedFolderName && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs text-text">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Viewing folder:</span>
                <span className="px-2 py-0.5 rounded bg-surface border border-border font-medium text-primary">
                  {selectedFolderName}
                </span>
                {/* Scope stated, not implied: this number is the server's count for
                    THIS FOLDER, sitting a few pixels below cards that count the whole
                    workspace. "matching" alone left that distinction to be inferred. */}
                <span className="text-text-muted">({list.total} matching in this folder)</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => list.selectFolder(null)}>
                Show All Files
                <XIcon size={14} className="ml-1" />
              </Button>
            </div>
          )}

          <DocumentsToolbar
            category={list.category}
            onCategoryChange={list.setCategory}
            searchValue={list.searchInput}
            onSearchChange={list.onSearchInputChange}
            includeArchived={list.includeArchived}
            onToggleArchived={list.toggleArchived}
            filterNote={categoryFilterNote}
          />

          <DocumentsBulkBar
            count={list.selectionCount}
            selectedBytes={list.selectedBytes}
            busy={actions.bulkBusy}
            onDownload={() => void actions.bulkDownload()}
            onSyncMemory={() => void actions.bulkSyncMemory()}
            onArchive={() => void actions.bulkArchive()}
            onMove={() => setBulkMoveOpen(true)}
            onDelete={() => setPendingConfirm({ kind: 'bulk-delete', count: list.selectionCount })}
            onClear={list.clearSelection}
          />

          <DocumentsResultsPanel
            list={list}
            folders={folders}
            handlers={rowHandlers}
            workspaceId={currentWorkspaceId}
          />
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={Boolean(viewer.document)}
        onClose={viewer.close}
        document={viewer.document}
        content={viewer.content}
        loading={viewer.loading}
        workspaceId={currentWorkspaceId}
      />

      <DocumentShareDialog
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        documentId={shareDoc?.id ?? ''}
        workspaceId={currentWorkspaceId}
        documentName={shareDoc ? getFileName(shareDoc.path) : ''}
        onShareCreated={refreshDocuments}
      />

      <DocumentVersionHistoryModal
        doc={versions.document}
        versions={versions.versions}
        loading={versions.loading}
        error={versions.error}
        busy={versions.busy}
        onClose={versions.close}
        onRetry={() => void versions.reload()}
        onRequestRestore={versions.requestRestore}
        onUploadRevision={versions.uploadRevision}
      />

      <CreateFolderModal
        isOpen={folderModalOpen}
        parentId={folderModalParentId}
        folders={folders.folders}
        onClose={() => setFolderModalOpen(false)}
        onSubmit={submitCreateFolder}
      />

      <RenameDocumentModal
        doc={renaming}
        busy={actions.busy}
        onClose={() => setRenaming(null)}
        onSubmit={async (nextName) => {
          if (!renaming) return;
          await actions.renameDocument(renaming, nextName);
          setRenaming(null);
        }}
      />

      {/* No `onMove`, so `DocumentMoveDialog` performs the move itself from
          `workspaceId` + the chosen destination and reports the outcome through
          `onMoved`. */}
      {moveDoc && (
        <DocumentMoveDialog
          isOpen
          onClose={() => setMoveDoc(null)}
          document={moveDoc}
          workspaceId={currentWorkspaceId}
          folders={folders.folders}
          onMoved={() => {
            toast({
              tone: 'success',
              title: 'Document moved',
              detail: 'Document moved successfully.',
            });
            folders.retry();
            refreshDocuments();
          }}
        />
      )}

      {/* `onMove` IS supplied here, because one dialog call has to move N rows. */}
      {bulkMoveOpen && list.selectionCount > 0 && (
        <DocumentMoveDialog
          isOpen
          onClose={() => setBulkMoveOpen(false)}
          document={bulkSelectionProxy(list.selectionCount, currentWorkspaceId)}
          workspaceId={currentWorkspaceId}
          folders={folders.folders}
          onMove={async (targetFolderId) => {
            try {
              await actions.bulkMove(targetFolderId);
              setBulkMoveOpen(false);
            } catch {
              // `bulkMove` already toasted. Leave the dialog open on its own error
              // so the destination can be changed without re-selecting.
            }
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => void runConfirm()}
        title={pendingConfirm ? confirmCopy(pendingConfirm).title : ''}
        message={pendingConfirm ? confirmCopy(pendingConfirm).message : ''}
        confirmLabel={confirmBusy ? 'Working…' : 'Confirm'}
        loading={confirmBusy}
        variant={pendingConfirm && confirmCopy(pendingConfirm).danger ? 'danger' : 'default'}
      />

      <input
        ref={folderUpload.inputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        aria-hidden="true"
        onChange={folderUpload.handleChange}
      />
    </div>
  );
}

export default DocumentsHub;
