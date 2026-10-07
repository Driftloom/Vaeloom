'use client';

import React from 'react';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { DocumentResponse, FolderResponse } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

import { DocumentShareDialog } from '../DocumentShareDialog';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { DocumentMoveDialog } from '../DocumentMoveDialog';
import { CreateFolderModal } from './CreateFolderModal';
import { DocumentVersionHistoryModal } from './DocumentVersionHistoryModal';
import { RenameDocumentModal } from './RenameDocumentModal';
import { bulkSelectionProxy, confirmCopy, type PendingConfirm } from './documentConfirmations';
import type { useDocumentVersions } from '../hooks/useDocumentVersions';
import type { useDocumentViewer } from '../hooks/useDocumentViewer';

export interface DocumentsModalsProps {
  workspaceId: string;
  viewer: ReturnType<typeof useDocumentViewer>;
  shareDoc: DocumentResponse | null;
  setShareDoc: (doc: DocumentResponse | null) => void;
  versions: ReturnType<typeof useDocumentVersions>;
  folderModalOpen: boolean;
  folderModalParentId: string | null;
  folders: FolderResponse[];
  setFolderModalOpen: (open: boolean) => void;
  submitCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  renaming: DocumentResponse | null;
  setRenaming: (doc: DocumentResponse | null) => void;
  renameBusy: boolean;
  onRenameDocument: (doc: DocumentResponse, nextName: string) => Promise<void>;
  moveDoc: DocumentResponse | null;
  setMoveDoc: (doc: DocumentResponse | null) => void;
  bulkMoveOpen: boolean;
  setBulkMoveOpen: (open: boolean) => void;
  selectionCount: number;
  onBulkMove: (targetFolderId: string | null) => Promise<void>;
  pendingConfirm: PendingConfirm | null;
  setPendingConfirm: (confirm: PendingConfirm | null) => void;
  confirmBusy: boolean;
  runConfirm: () => Promise<void>;
  onDocumentMoved: () => void;
  refreshDocuments: () => void;
}

export function DocumentsModals({
  workspaceId,
  viewer,
  shareDoc,
  setShareDoc,
  versions,
  folderModalOpen,
  folderModalParentId,
  folders,
  setFolderModalOpen,
  submitCreateFolder,
  renaming,
  setRenaming,
  renameBusy,
  onRenameDocument,
  moveDoc,
  setMoveDoc,
  bulkMoveOpen,
  setBulkMoveOpen,
  selectionCount,
  onBulkMove,
  pendingConfirm,
  setPendingConfirm,
  confirmBusy,
  runConfirm,
  onDocumentMoved,
  refreshDocuments,
}: DocumentsModalsProps) {
  const { toast } = useToast();

  return (
    <>
      <DocumentPreviewModal
        isOpen={Boolean(viewer.document)}
        onClose={viewer.close}
        document={viewer.document}
        content={viewer.content}
        loading={viewer.loading}
        workspaceId={workspaceId}
      />

      <DocumentShareDialog
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        documentId={shareDoc?.id ?? ''}
        workspaceId={workspaceId}
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
        folders={folders}
        onClose={() => setFolderModalOpen(false)}
        onSubmit={submitCreateFolder}
      />

      <RenameDocumentModal
        doc={renaming}
        busy={renameBusy}
        onClose={() => setRenaming(null)}
        onSubmit={async (nextName) => {
          if (!renaming) return;
          await onRenameDocument(renaming, nextName);
          setRenaming(null);
        }}
      />

      {/* No onMove, so DocumentMoveDialog moves directly from workspaceId + destination */}
      {moveDoc && (
        <DocumentMoveDialog
          isOpen
          onClose={() => setMoveDoc(null)}
          document={moveDoc}
          workspaceId={workspaceId}
          folders={folders}
          onMoved={() => {
            toast({
              tone: 'success',
              title: 'Document moved',
              detail: 'Document moved successfully.',
            });
            onDocumentMoved();
            refreshDocuments();
          }}
        />
      )}

      {/* onMove IS supplied here, because one dialog call has to move N rows. */}
      {bulkMoveOpen && selectionCount > 0 && (
        <DocumentMoveDialog
          isOpen
          onClose={() => setBulkMoveOpen(false)}
          document={bulkSelectionProxy(selectionCount, workspaceId)}
          workspaceId={workspaceId}
          folders={folders}
          onMove={async (targetFolderId) => {
            try {
              await onBulkMove(targetFolderId);
              setBulkMoveOpen(false);
            } catch {
              // bulkMove already toasted. Leave the dialog open so destination can be changed
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
    </>
  );
}
