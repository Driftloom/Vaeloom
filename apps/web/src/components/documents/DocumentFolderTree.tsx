'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  Badge,
  Skeleton,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FileTextIcon,
  AlertCircleIcon,
} from '@vaeloom/ui-kit';
import {
  documentApi,
  type FolderResponse,
  type FolderTreeItem,
  type DocumentResponse,
} from '@/lib/api-client';

export interface DocumentFolderTreeProps {
  workspaceId?: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders?: FolderResponse[];
  folderTree?: FolderTreeItem[];
  documents?: DocumentResponse[];
  onCreateFolder?: (parentId?: string | null) => void;
  onDeleteFolder?: (folderId: string, name: string) => void;
  onFolderCreated?: (folder: FolderResponse) => void;
  onFolderDeleted?: (folderId: string) => void;
  className?: string;
}

const FolderIcon: React.FC<{ size?: number; className?: string; open?: boolean }> = ({
  size = 16,
  className = '',
  open = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {open ? (
      <>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M2 10h20" />
      </>
    ) : (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    )}
  </svg>
);

export const DocumentFolderTree: React.FC<DocumentFolderTreeProps> = ({
  workspaceId,
  selectedFolderId,
  onSelectFolder,
  folders: initialFolders,
  folderTree: initialFolderTree,
  documents,
  onCreateFolder,
  onDeleteFolder,
  onFolderCreated,
  onFolderDeleted,
  className = '',
}) => {
  const [folders, setFolders] = useState<FolderResponse[]>(initialFolders ?? []);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>(initialFolderTree ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded folders set for collapsible tree view
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Internal create folder modal state (used when onCreateFolder prop is not supplied)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Internal delete folder confirmation modal state (used when onDeleteFolder prop is not supplied)
  const [deleteTarget, setDeleteTarget] = useState<FolderResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Count documents per folder
  const docCountByFolder = useMemo(() => {
    const counts: Record<string, number> = { root: 0 };
    if (!documents) return counts;

    for (const doc of documents) {
      if (!doc.folder_id) {
        counts['root'] = (counts['root'] ?? 0) + 1;
      } else {
        const fId = String(doc.folder_id);
        counts[fId] = (counts[fId] ?? 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  const totalWorkspaceDocs = documents?.length ?? 0;

  // Refresh folders and tree
  const refreshFolders = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [flat, tree] = await Promise.all([
        documentApi.listFolders(workspaceId),
        documentApi.getFolderTree(workspaceId),
      ]);
      setFolders(flat);
      setFolderTree(tree);
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        flat.forEach((f) => next.add(f.id));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (initialFolders !== undefined) {
      setFolders(initialFolders);
    }
    if (initialFolderTree !== undefined) {
      setFolderTree(initialFolderTree);
    }
    if (initialFolders === undefined && initialFolderTree === undefined && workspaceId) {
      void refreshFolders();
    }
  }, [initialFolders, initialFolderTree, workspaceId, refreshFolders]);

  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleOpenCreateModal = (parentId: string | null = null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onCreateFolder) {
      onCreateFolder(parentId);
      return;
    }
    setNewFolderName('');
    setNewFolderParentId(parentId);
    setCreateError(null);
    setCreateModalOpen(true);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !workspaceId) return;
    setCreateLoading(true);
    setCreateError(null);

    try {
      const created = await documentApi.createFolder(
        workspaceId,
        newFolderName.trim(),
        newFolderParentId,
      );
      setCreateModalOpen(false);
      setNewFolderName('');
      onFolderCreated?.(created);
      await refreshFolders();
      if (newFolderParentId) {
        setExpandedFolderIds((prev) => new Set([...prev, newFolderParentId]));
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteTrigger = (folderId: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onDeleteFolder) {
      onDeleteFolder(folderId, name);
      return;
    }
    setDeleteError(null);
    setDeleteTarget({
      id: folderId,
      workspace_id: workspaceId || '',
      name,
      created_at: '',
    });
  };

  const handleDeleteFolder = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await documentApi.deleteFolder(deleteTarget.id, workspaceId);
      const targetId = deleteTarget.id;
      setDeleteTarget(null);
      if (selectedFolderId === targetId) {
        onSelectFolder(null);
      }
      onFolderDeleted?.(targetId);
      await refreshFolders();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete folder');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Helper to render tree nodes recursively
  const renderTreeItem = (item: FolderTreeItem, depth = 0) => {
    const isSelected = selectedFolderId === item.id;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedFolderIds.has(item.id);
    const count = docCountByFolder[item.id] ?? 0;

    return (
      <div key={item.id} className="space-y-0.5 select-none">
        <div
          onClick={() => onSelectFolder(item.id)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-action/10 text-action border border-action/30'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(item.id, e)}
                className="p-0.5 rounded hover:bg-surface-200 text-text-muted hover:text-text shrink-0"
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            <FolderIcon
              size={15}
              open={isExpanded}
              className={`shrink-0 ${isSelected ? 'text-action' : 'text-text-muted group-hover:text-text'}`}
            />

            <span className="truncate">{item.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-semibold ${
                  isSelected ? 'bg-action/20 text-action' : 'bg-surface-200 text-text-muted'
                }`}
              >
                {count}
              </span>
            )}

            {/* Quick action buttons on hover */}
            <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={(e) => handleOpenCreateModal(item.id, e)}
                className="p-1 rounded text-text-muted hover:text-action hover:bg-surface-200"
                title="Add subfolder"
                aria-label="Add subfolder"
              >
                <PlusIcon size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteTrigger(item.id, item.name, e)}
                className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10"
                title="Delete folder"
                aria-label="Delete folder"
              >
                <TrashIcon size={12} />
              </button>
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5" role="group">
            {item.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Folders Navigation">
      {/* Top Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-text uppercase tracking-wider">Folders</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleOpenCreateModal(null)}
          className="h-7 px-2 text-xs"
          title="Create root folder"
        >
          <PlusIcon size={14} className="mr-1" />
          New Folder
        </Button>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error flex items-start gap-2">
          <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tree */}
      <nav className="space-y-0.5" aria-label="Folders">
        {/* All / Root Folder Selection */}
        <div
          onClick={() => onSelectFolder(null)}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            selectedFolderId === null
              ? 'bg-action/10 text-action border border-action/30'
              : 'text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <FileTextIcon
              size={15}
              className={selectedFolderId === null ? 'text-action' : 'text-text-muted'}
            />
            <span className="truncate">All Documents</span>
          </div>
          {totalWorkspaceDocs > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-semibold ${
                selectedFolderId === null
                  ? 'bg-action/20 text-action'
                  : 'bg-surface-200 text-text-muted'
              }`}
            >
              {totalWorkspaceDocs}
            </span>
          )}
        </div>

        {/* Loading state skeleton */}
        {loading && (
          <div className="space-y-1.5 py-2 px-2">
            <Skeleton className="w-full h-6 rounded-md" />
            <Skeleton className="w-4/5 h-6 rounded-md ml-3" />
            <Skeleton className="w-3/4 h-6 rounded-md" />
          </div>
        )}

        {/* Folder items from tree */}
        {!loading && folderTree.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {folderTree.map((item) => renderTreeItem(item, 0))}
          </div>
        )}

        {/* Fallback flat list if tree is empty but flat folders exist */}
        {!loading && folderTree.length === 0 && folders.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const count = docCountByFolder[folder.id] ?? 0;
              return (
                <div
                  key={folder.id}
                  onClick={() => onSelectFolder(folder.id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-action/10 text-action border border-action/30'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderIcon
                      size={15}
                      className={
                        isSelected ? 'text-action' : 'text-text-muted group-hover:text-text'
                      }
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {count > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] tabular-nums bg-surface-200 text-text-muted font-semibold">
                        {count}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTrigger(folder.id, folder.name, e)}
                      className="hidden group-hover:inline-block p-1 rounded text-text-muted hover:text-error hover:bg-error/10"
                      title="Delete folder"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state when no folders exist */}
        {!loading && folders.length === 0 && (
          <div className="py-4 px-2 text-center text-xs text-text-muted">
            <p>No folders created yet.</p>
            <button
              type="button"
              onClick={() => handleOpenCreateModal(null)}
              className="text-action hover:underline mt-1 inline-block"
            >
              Create your first folder
            </button>
          </div>
        )}
      </nav>

      {/* Internal Create Folder Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={newFolderParentId ? 'Create Subfolder' : 'Create New Folder'}
        size="sm"
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            label="Folder Name"
            placeholder="e.g. Legal Contracts, Resumes, Financials"
            value={newFolderName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
            error={createError ?? undefined}
            autoFocus
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={createLoading}
              disabled={!newFolderName.trim()}
            >
              Create Folder
            </Button>
          </div>
        </form>
      </Modal>

      {/* Internal Delete Folder Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Folder"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Are you sure you want to delete the folder{' '}
            <strong className="text-text font-semibold">{deleteTarget?.name}</strong>? Documents
            inside will remain in your workspace and revert to the root level.
          </p>

          {deleteError && (
            <p className="text-xs text-error bg-error/10 p-2 rounded border border-error/20">
              {deleteError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={deleteLoading}
              onClick={handleDeleteFolder}
            >
              Delete Folder
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
