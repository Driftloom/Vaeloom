'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  documentApi,
  type AutoOrganizeResponse,
  type FolderResponse,
  type FolderTreeItem,
} from '@/lib/api-client';

export interface UseDocumentFoldersResult {
  folders: FolderResponse[];
  folderTree: FolderTreeItem[];
  loading: boolean;
  /**
   * A load failure, surfaced to the user.
   *
   * The previous implementation ended its `try` with `catch { /* best-effort
   * folder load *\/ }`, so a rejected folder request left the rail rendering
   * `DocumentFolderTree`'s "No folders yet" empty state — a confident claim that
   * the workspace has no folders, produced by a failed request. `[]` and "the
   * network is down" are now different states with different rendering.
   */
  error: string | null;
  /** Re-run the folder load. Wired to the retry button in the error state. */
  retry: () => void;

  /** Resolves with the created folder. Rejects; the caller reports the toast. */
  createFolder: (name: string, parentId: string | null) => Promise<FolderResponse>;
  /** Rejects; the caller reports the toast. */
  deleteFolder: (folderId: string) => Promise<void>;
  /** Resolves with the renamed folder. Rejects; the caller reports the toast. */
  renameFolder: (folderId: string, name: string) => Promise<FolderResponse>;
  /** Moves folder to another parent or root (`null`). Rejects on cycle or error. */
  moveFolder: (folderId: string, parentId: string | null) => Promise<FolderResponse>;
  /** General update method for folder name and/or parent. */
  updateFolder: (
    folderId: string,
    name?: string,
    parentId?: string | null,
  ) => Promise<FolderResponse>;
  /** Rejects; the caller reports the toast. */
  autoOrganize: () => Promise<AutoOrganizeResponse>;
}

/**
 * The workspace's folder list and its tree, plus the folder mutations.
 *
 * Mutations REJECT rather than swallowing. The toast policy (wording, tone,
 * whether an error is even user-visible) belongs to the component that owns
 * `useToast`; a data hook that both called `toast` and threw would make it
 * impossible for the caller to choose. Every mutation also refreshes, so the
 * rail cannot show a folder that was never created.
 *
 * @param workspaceId The workspace to query. `''` disables every request.
 */
export function useDocumentFolders(workspaceId: string): UseDocumentFoldersResult {
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setFolders([]);
      setFolderTree([]);
      setError(null);
      setLoading(false);
      return;
    }

    const id = (requestId.current += 1);
    setLoading(true);
    setError(null);

    try {
      // `Promise.all` over two GETs. If either fails the whole load fails: a
      // folder list with no tree behind it would make the rail render the flat
      // fallback, which is a different-looking screen for the same data.
      const [flat, tree] = await Promise.all([
        documentApi.listFolders(workspaceId),
        documentApi.getFolderTree(workspaceId),
      ]);
      if (id !== requestId.current) return;
      setFolders(Array.isArray(flat) ? flat : []);
      setFolderTree(Array.isArray(tree) ? tree : []);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      if (!workspaceId) throw new Error('No workspace selected.');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('A folder name is required.');
      const created = await documentApi.createFolder(workspaceId, trimmed, parentId);
      await refresh();
      return created;
    },
    [workspaceId, refresh],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!workspaceId) throw new Error('No workspace selected.');
      await documentApi.deleteFolder(folderId, workspaceId);
      await refresh();
    },
    [workspaceId, refresh],
  );

  const updateFolder = useCallback(
    async (folderId: string, name?: string, parentId?: string | null) => {
      if (!workspaceId) throw new Error('No workspace selected.');
      const trimmedName = name !== undefined ? name.trim() : undefined;
      if (name !== undefined && !trimmedName) throw new Error('Folder name cannot be empty.');
      const updated = await documentApi.updateFolder(folderId, workspaceId, trimmedName, parentId);
      await refresh();
      return updated;
    },
    [workspaceId, refresh],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      return updateFolder(folderId, name, undefined);
    },
    [updateFolder],
  );

  const moveFolder = useCallback(
    async (folderId: string, parentId: string | null) => {
      return updateFolder(folderId, undefined, parentId);
    },
    [updateFolder],
  );

  const autoOrganize = useCallback(async () => {
    if (!workspaceId) throw new Error('No workspace selected.');
    const response = await documentApi.autoOrganize(workspaceId);
    await refresh();
    return response;
  }, [workspaceId, refresh]);

  return {
    folders,
    folderTree,
    loading,
    error,
    retry: () => void refresh(),
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    updateFolder,
    autoOrganize,
  };
}
