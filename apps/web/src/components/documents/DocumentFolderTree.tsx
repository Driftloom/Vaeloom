'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Skeleton,
  EmptyState,
  Alert,
  IconButton,
  PlusIcon,
  TrashIcon,
  EditIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FileTextIcon,
} from '@vaeloom/ui-kit';
import {
  documentApi,
  type FolderResponse,
  type FolderTreeItem,
  type DocumentResponse,
} from '@/lib/api-client';

import CreateFolderModal from './parts/CreateFolderModal';
import RenameFolderModal from './parts/RenameFolderModal';
import MoveFolderModal from './parts/MoveFolderModal';
import DeleteFolderModal from './parts/DeleteFolderModal';

export interface DocumentFolderTreeProps {
  workspaceId?: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders?: FolderResponse[];
  folderTree?: FolderTreeItem[];
  documents?: DocumentResponse[];
  onCreateFolder?: (parentId?: string | null) => void;
  onDeleteFolder?: (folderId: string, name: string) => void;
  onRenameFolder?: (folder: FolderResponse) => void;
  onMoveFolder?: (folder: FolderResponse) => void;
  onFolderCreated?: (folder: FolderResponse) => void;
  onFolderDeleted?: (folderId: string) => void;
  onFolderUpdated?: (folder: FolderResponse) => void;
  className?: string;
}

const ROW_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-100';

const ACTIONS_VISIBILITY =
  'flex items-center gap-0.5 shrink-0 ml-1 opacity-0 transition-opacity pointer-events-none ' +
  'group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto';

const CHEVRON_SPACER = 'w-7 shrink-0';

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

const FolderMoveIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 12,
  className = '',
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <path d="m12 11 3 3-3 3" />
    <path d="M9 14h6" />
  </svg>
);

interface FolderRowParams {
  rowId: string | null;
  name: string;
  count: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  indent?: number;
  icon: React.ReactNode;
  expandControl: React.ReactNode;
  actions: React.ReactNode;
}

export const DocumentFolderTree: React.FC<DocumentFolderTreeProps> = ({
  workspaceId,
  selectedFolderId,
  onSelectFolder,
  folders: initialFolders,
  folderTree: initialFolderTree,
  documents,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveFolder,
  onFolderCreated,
  onFolderDeleted,
  onFolderUpdated,
  className = '',
}) => {
  const [folders, setFolders] = useState<FolderResponse[]>(initialFolders ?? []);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>(initialFolderTree ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Modal states for internal handlers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<FolderResponse | null>(null);
  const [moveTarget, setMoveTarget] = useState<FolderResponse | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FolderResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const navRef = useRef<HTMLElement>(null);

  const docCountByFolder = useMemo(() => {
    const counts: Record<string, number> = { root: 0 };
    if (!documents) return counts;

    for (const doc of documents) {
      if (!doc.folderId) {
        counts['root'] = (counts['root'] ?? 0) + 1;
      } else {
        const fId = String(doc.folderId);
        counts[fId] = (counts[fId] ?? 0) + 1;
      }
    }
    return counts;
  }, [documents]);

  const totalWorkspaceDocs = documents?.length ?? 0;

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
    if (initialFolders !== undefined) setFolders(initialFolders);
    if (initialFolderTree !== undefined) setFolderTree(initialFolderTree);
    if (initialFolders === undefined && initialFolderTree === undefined && workspaceId) {
      void refreshFolders();
    }
  }, [initialFolders, initialFolderTree, workspaceId, refreshFolders]);

  const toggleExpand = (folderId: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleOpenCreateModal = (parentId: string | null = null, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (onCreateFolder) {
      onCreateFolder(parentId);
      return;
    }
    setCreateParentId(parentId);
    setCreateModalOpen(true);
  };

  const handleOpenRenameModal = (
    target: FolderResponse | FolderTreeItem,
    e?: React.SyntheticEvent,
  ) => {
    e?.stopPropagation();
    const folderResp: FolderResponse = {
      id: target.id,
      workspaceId: workspaceId || '',
      name: target.name,
      parentId: target.parentId ?? null,
      createdAt: '',
      updatedAt: '',
    };
    if (onRenameFolder) {
      onRenameFolder(folderResp);
      return;
    }
    setRenameTarget(folderResp);
  };

  const handleOpenMoveModal = (
    target: FolderResponse | FolderTreeItem,
    e?: React.SyntheticEvent,
  ) => {
    e?.stopPropagation();
    const folderResp: FolderResponse = {
      id: target.id,
      workspaceId: workspaceId || '',
      name: target.name,
      parentId: target.parentId ?? null,
      createdAt: '',
      updatedAt: '',
    };
    if (onMoveFolder) {
      onMoveFolder(folderResp);
      return;
    }
    setMoveTarget(folderResp);
  };

  const handleDeleteTrigger = (folderId: string, name: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (onDeleteFolder) {
      onDeleteFolder(folderId, name);
      return;
    }
    setDeleteError(null);
    setDeleteTarget({
      id: folderId,
      workspaceId: workspaceId || '',
      name,
      createdAt: '',
      updatedAt: '',
    });
  };

  const handleInternalCreate = async (name: string, parentId: string | null) => {
    if (!workspaceId) return;
    const created = await documentApi.createFolder(workspaceId, name, parentId);
    setCreateModalOpen(false);
    onFolderCreated?.(created);
    await refreshFolders();
    if (parentId) {
      setExpandedFolderIds((prev) => new Set([...prev, parentId]));
    }
  };

  const handleInternalRename = async (folderId: string, nextName: string) => {
    if (!workspaceId) return;
    const updated = await documentApi.updateFolder(folderId, workspaceId, nextName);
    setRenameTarget(null);
    onFolderUpdated?.(updated);
    await refreshFolders();
  };

  const handleInternalMove = async (folderId: string, nextParentId: string | null) => {
    if (!workspaceId) return;
    const updated = await documentApi.updateFolder(folderId, workspaceId, undefined, nextParentId);
    setMoveTarget(null);
    onFolderUpdated?.(updated);
    await refreshFolders();
  };

  const handleInternalDelete = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await documentApi.deleteFolder(deleteTarget.id, workspaceId);
      const targetId = deleteTarget.id;
      setDeleteTarget(null);
      if (selectedFolderId === targetId) onSelectFolder(null);
      onFolderDeleted?.(targetId);
      await refreshFolders();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete folder');
    } finally {
      setDeleteLoading(false);
    }
  };

  const moveRowFocus = useCallback((from: HTMLButtonElement, delta: 1 | -1) => {
    const nav = navRef.current;
    if (!nav) return;
    const rows = Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-folder-row]'));
    const index = rows.indexOf(from);
    if (index === -1) return;
    rows[index + delta]?.focus();
  }, []);

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, folderId: string | null) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        onSelectFolder(folderId);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveRowFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
      }
    },
    [moveRowFocus, onSelectFolder],
  );

  const renderFolderRow = ({
    rowId,
    name,
    count,
    isSelected,
    isExpanded,
    hasChildren,
    indent,
    icon,
    expandControl,
    actions,
  }: FolderRowParams): React.ReactElement => {
    const accessibleName = count > 0 ? `${name}, ${count} document${count === 1 ? '' : 's'}` : name;

    return (
      <div
        className="group flex items-center rounded-lg text-xs font-medium transition-colors"
        style={indent === undefined ? undefined : { paddingLeft: `${indent * 12 + 4}px` }}
      >
        {expandControl}
        <button
          type="button"
          data-folder-row=""
          data-folder-id={rowId ?? 'root'}
          aria-current={isSelected ? 'true' : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-label={accessibleName}
          onClick={() => onSelectFolder(rowId)}
          onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => handleRowKeyDown(e, rowId)}
          className={`flex items-center justify-between gap-1.5 flex-1 min-w-0 py-1.5 pl-1.5 pr-2 rounded-lg border text-left ${ROW_FOCUS} ${
            isSelected
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'border-transparent text-text-muted hover:text-text hover:bg-surface-hover'
          }`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {icon}
            <span className="truncate">{name}</span>
          </span>
          {count > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-semibold shrink-0 ${
                isSelected ? 'bg-primary/20 text-primary' : 'bg-surface-200 text-text-muted'
              }`}
            >
              {count}
            </span>
          )}
        </button>
        <div className={ACTIONS_VISIBILITY}>{actions}</div>
      </div>
    );
  };

  const renderTreeItem = (item: FolderTreeItem, depth = 0): React.ReactElement => {
    const isSelected = selectedFolderId === item.id;
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const isExpanded = expandedFolderIds.has(item.id);
    const count = docCountByFolder[item.id] ?? 0;

    return (
      <div key={item.id} className="space-y-0.5 select-none">
        {renderFolderRow({
          rowId: item.id,
          name: item.name,
          count,
          isSelected,
          isExpanded,
          hasChildren,
          indent: depth,
          icon: (
            <FolderIcon
              size={15}
              open={isExpanded}
              className={`shrink-0 ${isSelected ? 'text-action' : 'text-text-muted'}`}
            />
          ),
          expandControl: hasChildren ? (
            <IconButton
              variant="ghost"
              size="sm"
              className="shrink-0"
              aria-expanded={isExpanded}
              aria-label={
                isExpanded ? `Collapse folder ${item.name}` : `Expand folder ${item.name}`
              }
              onClick={(e: React.MouseEvent) => toggleExpand(item.id, e)}
            >
              {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
            </IconButton>
          ) : (
            <span className={CHEVRON_SPACER} aria-hidden="true" />
          ),
          actions: (
            <>
              <IconButton
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label={`Add subfolder to ${item.name}`}
                title="Add subfolder"
                onClick={(e: React.MouseEvent) => handleOpenCreateModal(item.id, e)}
              >
                <PlusIcon size={12} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                className="shrink-0 text-text-muted hover:text-text hover:bg-surface-hover"
                aria-label={`Rename folder ${item.name}`}
                title="Rename folder"
                onClick={(e: React.MouseEvent) => handleOpenRenameModal(item, e)}
              >
                <EditIcon size={12} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                className="shrink-0 text-text-muted hover:text-text hover:bg-surface-hover"
                aria-label={`Move folder ${item.name}`}
                title="Move folder"
                onClick={(e: React.MouseEvent) => handleOpenMoveModal(item, e)}
              >
                <FolderMoveIcon size={12} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                className="shrink-0 text-text-muted hover:text-error hover:bg-error/10"
                aria-label={`Delete folder ${item.name}`}
                title="Delete folder"
                onClick={(e: React.MouseEvent) => handleDeleteTrigger(item.id, item.name, e)}
              >
                <TrashIcon size={12} />
              </IconButton>
            </>
          ),
        })}

        {hasChildren && isExpanded && (
          <div className="space-y-0.5" role="group" aria-label={`Contents of folder ${item.name}`}>
            {item.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
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
        <Alert
          variant="danger"
          description={`Could not load folders. ${error}`}
          className="text-xs"
        />
      )}

      <nav ref={navRef} className="space-y-0.5" aria-label="Folders">
        {renderFolderRow({
          rowId: null,
          name: 'All Documents',
          count: totalWorkspaceDocs,
          isSelected: selectedFolderId === null,
          isExpanded: false,
          hasChildren: false,
          indent: 0,
          icon: (
            <FileTextIcon
              size={15}
              className={selectedFolderId === null ? 'text-action' : 'text-text-muted'}
            />
          ),
          expandControl: <span className={CHEVRON_SPACER} aria-hidden="true" />,
          actions: <></>,
        })}

        {loading && (
          <div className="space-y-1.5 py-2 px-2" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading folders…</span>
            <Skeleton className="w-full h-6 rounded-md" />
            <Skeleton className="w-4/5 h-6 rounded-md ml-3" />
            <Skeleton className="w-3/4 h-6 rounded-md" />
          </div>
        )}

        {!loading && folderTree.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {folderTree.map((item) => renderTreeItem(item, 0))}
          </div>
        )}

        {!loading && folderTree.length === 0 && folders.length > 0 && (
          <div className="space-y-0.5 pt-1">
            {folders.map((folder) => (
              <React.Fragment key={folder.id}>
                {renderFolderRow({
                  rowId: folder.id,
                  name: folder.name,
                  count: docCountByFolder[folder.id] ?? 0,
                  isSelected: selectedFolderId === folder.id,
                  isExpanded: false,
                  hasChildren: false,
                  icon: (
                    <FolderIcon
                      size={15}
                      className={selectedFolderId === folder.id ? 'text-action' : 'text-text-muted'}
                    />
                  ),
                  expandControl: <span className={CHEVRON_SPACER} aria-hidden="true" />,
                  actions: (
                    <>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        aria-label={`Add subfolder to ${folder.name}`}
                        title="Add subfolder"
                        onClick={(e: React.MouseEvent) => handleOpenCreateModal(folder.id, e)}
                      >
                        <PlusIcon size={12} />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-text-muted hover:text-text hover:bg-surface-hover"
                        aria-label={`Rename folder ${folder.name}`}
                        title="Rename folder"
                        onClick={(e: React.MouseEvent) => handleOpenRenameModal(folder, e)}
                      >
                        <EditIcon size={12} />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-text-muted hover:text-text hover:bg-surface-hover"
                        aria-label={`Move folder ${folder.name}`}
                        title="Move folder"
                        onClick={(e: React.MouseEvent) => handleOpenMoveModal(folder, e)}
                      >
                        <FolderMoveIcon size={12} />
                      </IconButton>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-text-muted hover:text-error hover:bg-error/10"
                        aria-label={`Delete folder ${folder.name}`}
                        title="Delete folder"
                        onClick={(e: React.MouseEvent) =>
                          handleDeleteTrigger(folder.id, folder.name, e)
                        }
                      >
                        <TrashIcon size={12} />
                      </IconButton>
                    </>
                  ),
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        {!loading && folders.length === 0 && folderTree.length === 0 && (
          <EmptyState
            icon={<FileTextIcon size={24} />}
            title="No folders yet"
            description="Folders group documents so you can browse and filter them. Create your first folder to get started."
            action={{
              label: 'Create your first folder',
              onClick: () => handleOpenCreateModal(null),
            }}
            className="py-6 px-4"
          />
        )}
      </nav>

      <CreateFolderModal
        isOpen={createModalOpen}
        parentId={createParentId}
        folders={folders}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleInternalCreate}
      />

      <RenameFolderModal
        isOpen={Boolean(renameTarget)}
        folder={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleInternalRename}
      />

      <MoveFolderModal
        isOpen={Boolean(moveTarget)}
        folder={moveTarget}
        folders={folders}
        onClose={() => setMoveTarget(null)}
        onSubmit={handleInternalMove}
      />

      <DeleteFolderModal
        isOpen={Boolean(deleteTarget)}
        folder={deleteTarget}
        loading={deleteLoading}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleInternalDelete}
      />
    </div>
  );
};

export default DocumentFolderTree;
