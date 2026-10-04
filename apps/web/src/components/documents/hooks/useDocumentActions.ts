'use client';

import { useCallback, useState } from 'react';

import { documentApi } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

import type { UseDocumentFoldersResult } from './useDocumentFolders';
import type { UseDocumentListResult } from './useDocumentList';

/**
 * The notification callback, declared structurally so this hook does not depend
 * on the Toast module's types. Tone set matches `useToast`.
 */
export type Notify = (input: {
  tone: 'success' | 'error' | 'info' | 'warning';
  title: string;
  detail?: string;
}) => void;

export interface UseDocumentActionsParams {
  workspaceId: string;
  notify: Notify;
  list: UseDocumentListResult;
  folders: UseDocumentFoldersResult;
}

export interface UseDocumentActionsResult {
  /** A single-document mutation is in flight. */
  busy: boolean;
  /** A bulk mutation is in flight. Disables the whole bulk bar. */
  bulkBusy: boolean;
  autoOrganizeBusy: boolean;
  /** Id of the row whose Memory sync is in flight. */
  syncingDocId: string | null;

  archiveDocument: (doc: { id: string; path: string }) => Promise<void>;
  restoreDocument: (doc: { id: string; path: string }) => Promise<void>;
  deleteDocument: (doc: { id: string; path: string }) => Promise<void>;
  renameDocument: (doc: { id: string; path: string }, nextName: string) => Promise<void>;
  syncMemory: (docId: string, path: string) => Promise<void>;

  bulkDownload: () => Promise<void>;
  bulkArchive: () => Promise<void>;
  bulkDelete: () => Promise<void>;
  bulkSyncMemory: () => Promise<void>;
  bulkMove: (targetFolderId: string | null) => Promise<void>;

  autoOrganize: () => Promise<void>;
}

const message = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

/**
 * Every document mutation, plus the toast each one produces.
 *
 * WHY THE TOASTS LIVE HERE
 *
 * Fifteen handlers each had its own `try/catch/finally` that set two pieces of
 * busy state, called `toast`, and refreshed — and the `finally` blocks did not
 * agree with each other, so `bulkBusy` stayed true after a bulk archive while
 * `confirmBusy` was cleared. One place per operation fixes the shape.
 *
 * Every mutation REFRESHES rather than patching local state. A patch has to guess
 * what the server did; a refresh asks.
 *
 * @param list `useDocumentList`'s result. Supplied rather than created here so
 * the hub and the actions share one list, one selection and one request sequence.
 * @param folders `useDocumentFolders`'s result, for the folder refresh that a
 * move or an auto-organize run implies.
 */
export function useDocumentActions({
  workspaceId,
  notify,
  list,
  folders,
}: UseDocumentActionsParams): UseDocumentActionsResult {
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [autoOrganizeBusy, setAutoOrganizeBusy] = useState(false);
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);

  const { refresh, selectionCount, clearSelection, selectedIds, dropDocuments } = list;

  const requireWorkspace = useCallback(() => {
    if (!workspaceId) throw new Error('No workspace selected.');
    return workspaceId;
  }, [workspaceId]);

  const archiveDocument = useCallback(
    async (doc: { id: string; path: string }) => {
      const ws = requireWorkspace();
      setBusy(true);
      try {
        await documentApi.archive(doc.id, ws);
        notify({
          tone: 'success',
          title: 'Archived',
          detail: `${getFileName(doc.path)} moved to archive.`,
        });
        refresh();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Archive failed',
          detail: message(err, 'Error archiving document'),
        });
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [requireWorkspace, notify, refresh],
  );

  const restoreDocument = useCallback(
    async (doc: { id: string; path: string }) => {
      const ws = requireWorkspace();
      setBusy(true);
      try {
        await documentApi.restore(doc.id, ws);
        notify({
          tone: 'success',
          title: 'Restored',
          detail: `${getFileName(doc.path)} restored to the workspace.`,
        });
        refresh();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Restore failed',
          detail: message(err, 'Error restoring document'),
        });
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [requireWorkspace, notify, refresh],
  );

  const deleteDocument = useCallback(
    async (doc: { id: string; path: string }) => {
      const ws = requireWorkspace();
      setBusy(true);
      try {
        await documentApi.delete(doc.id, ws);
        notify({
          tone: 'success',
          title: 'Deleted',
          detail: `${getFileName(doc.path)} permanently deleted.`,
        });
        // Drop the row locally as well as refreshing: the list is the selection's
        // scope, and a row that no longer exists must not stay actionable.
        dropDocuments([doc.id]);
        refresh();
        folders.retry();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Delete failed',
          detail: message(err, 'Error deleting document'),
        });
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [requireWorkspace, notify, refresh, folders, dropDocuments],
  );

  const renameDocument = useCallback(
    async (doc: { id: string; path: string }, nextName: string) => {
      const ws = requireWorkspace();
      setBusy(true);
      try {
        await documentApi.rename(doc.id, ws, nextName.trim());
        notify({ tone: 'success', title: 'Renamed', detail: `Document renamed to ${nextName}.` });
        refresh();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Rename failed',
          detail: message(err, 'Error renaming document'),
        });
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [requireWorkspace, notify, refresh],
  );

  const syncMemory = useCallback(
    async (docId: string, path: string) => {
      const ws = requireWorkspace();
      setSyncingDocId(docId);
      try {
        await documentApi.syncMemory(docId, ws);
        notify({
          tone: 'success',
          title: 'Synced to Memory',
          detail: `"${getFileName(path)}" is indexed into workspace memory.`,
        });
        refresh();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Memory sync failed',
          detail: message(err, 'Error syncing to memory'),
        });
      } finally {
        setSyncingDocId(null);
      }
    },
    [requireWorkspace, notify, refresh],
  );

  const bulkDownload = useCallback(async () => {
    const ws = requireWorkspace();
    if (selectionCount === 0) return;
    setBulkBusy(true);
    try {
      const blob = await documentApi.bulkDownload(ws, Array.from(selectedIds));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `documents_export_${Date.now()}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notify({
        tone: 'success',
        title: 'Download ready',
        detail: `${selectionCount} file(s) downloaded as a zip.`,
      });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Bulk download failed',
        detail: message(err, 'Error creating archive'),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [requireWorkspace, selectionCount, selectedIds, notify]);

  const bulkArchive = useCallback(async () => {
    const ws = requireWorkspace();
    if (selectionCount === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => documentApi.archive(id, ws)));
      notify({
        tone: 'success',
        title: 'Archived',
        detail: `${selectionCount} document(s) moved to archive.`,
      });
      clearSelection();
      refresh();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Bulk archive failed',
        detail: message(err, 'Error archiving documents'),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [requireWorkspace, selectionCount, selectedIds, clearSelection, refresh, notify]);

  const bulkDelete = useCallback(async () => {
    const ws = requireWorkspace();
    if (selectionCount === 0) return;
    setBulkBusy(true);
    try {
      const response = await documentApi.bulkDelete(ws, Array.from(selectedIds));
      const removed = Array.isArray(response?.documentIds)
        ? response.documentIds
        : Array.from(selectedIds);
      notify({
        tone: 'success',
        title: 'Deleted',
        detail: `${response?.deletedCount ?? removed.length} document(s) permanently deleted.`,
      });
      dropDocuments(removed);
      clearSelection();
      refresh();
      folders.retry();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Bulk delete failed',
        detail: message(err, 'Error deleting documents'),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [
    requireWorkspace,
    selectionCount,
    selectedIds,
    dropDocuments,
    clearSelection,
    refresh,
    folders,
    notify,
  ]);

  const bulkSyncMemory = useCallback(async () => {
    const ws = requireWorkspace();
    if (selectionCount === 0) return;
    setBulkBusy(true);
    try {
      const response = await documentApi.bulkSyncMemory(ws, Array.from(selectedIds));
      notify({
        tone: 'success',
        title: 'Bulk Memory Sync Complete',
        detail: `Indexed ${response?.syncedCount ?? 0} document(s) into Memory.`,
      });
      refresh();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Bulk memory sync failed',
        detail: message(err, 'Error syncing to memory'),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [requireWorkspace, selectionCount, selectedIds, refresh, notify]);

  const bulkMove = useCallback(
    async (targetFolderId: string | null) => {
      const ws = requireWorkspace();
      if (selectionCount === 0) return;
      setBulkBusy(true);
      try {
        await Promise.all(
          Array.from(selectedIds).map((id) => documentApi.move(id, ws, targetFolderId)),
        );
        notify({
          tone: 'success',
          title: 'Documents moved',
          detail: `Moved ${selectionCount} document(s).`,
        });
        clearSelection();
        refresh();
        folders.retry();
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Bulk move failed',
          detail: message(err, 'Error moving documents'),
        });
        throw err;
      } finally {
        setBulkBusy(false);
      }
    },
    [requireWorkspace, selectionCount, selectedIds, clearSelection, refresh, folders, notify],
  );

  const autoOrganize = useCallback(async () => {
    const ws = requireWorkspace();
    setAutoOrganizeBusy(true);
    try {
      const response = await folders.autoOrganize();
      if (response.organizedCount > 0) {
        notify({
          tone: 'success',
          title: 'Auto-Organize Complete',
          detail:
            `Organized ${response.organizedCount} document(s) into smart folders: ` +
            `${response.foldersCreated.join(', ') || 'existing categories'}.`,
        });
      } else {
        notify({
          tone: 'info',
          title: 'All files organized',
          detail: 'No unorganized documents found in this workspace.',
        });
      }
      refresh();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Auto-organize failed',
        detail: message(err, 'Error organizing files'),
      });
    } finally {
      setAutoOrganizeBusy(false);
    }
  }, [requireWorkspace, folders, refresh, notify]);

  return {
    busy,
    bulkBusy,
    autoOrganizeBusy,
    syncingDocId,
    archiveDocument,
    restoreDocument,
    deleteDocument,
    renameDocument,
    syncMemory,
    bulkDownload,
    bulkArchive,
    bulkDelete,
    bulkSyncMemory,
    bulkMove,
    autoOrganize,
  };
}
