'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  Button,
  Input,
  Skeleton,
  EmptyState,
  Alert,
  IconButton,
  PlusIcon,
  TrashIcon,
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

/**
 * Visible keyboard indicator for the custom row buttons.
 *
 * `focus-visible` (not `focus`) is deliberate and matches `Button`/`IconButton`
 * in the ui-kit: the global `:focus-visible` outline in globals.css is the
 * keyboard indicator, and a bare `focus:` ring duplicated it on every mouse
 * click.
 */
const ROW_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-100';

/**
 * Per-row action container.
 *
 * Previously `hidden group-hover:flex`, which is an ACCESSIBILITY FAILURE and not
 * merely a cosmetic one: `display:none` removes the buttons from the tab order
 * and from the accessibility tree, so `focus-within` could never fire because
 * focus could never land inside. Opacity is used instead — it keeps the buttons
 * focusable and exposed while making them invisible, and `focus-within` reveals
 * them the moment keyboard focus enters. `pointer-events-none` stops the
 * invisible strip from swallowing clicks meant for the row behind it.
 */
const ACTIONS_VISIBILITY =
  'flex items-center gap-0.5 shrink-0 ml-1 opacity-0 transition-opacity pointer-events-none ' +
  'group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto';

/** Fixed-width spacer so leaf rows stay aligned with rows that have a chevron. */
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

/** Parameters for {@link renderFolderRow}; see the implementation for the layout. */
interface FolderRowParams {
  /** `null` is the synthetic "All Documents" root. */
  rowId: string | null;
  name: string;
  count: number;
  isSelected: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  /** Tree depth; drives the only inline style in this file. `undefined` = no indent. */
  indent?: number;
  icon: React.ReactNode;
  /** Disclosure toggle, or a spacer for leaf rows. */
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

  // Scoped to the <nav> so ArrowUp/ArrowDown only ever walk folder rows.
  const navRef = useRef<HTMLElement>(null);

  // Count documents per folder
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

  const toggleExpand = (folderId: string, e: React.SyntheticEvent) => {
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

  const handleOpenCreateModal = (parentId: string | null = null, e?: React.SyntheticEvent) => {
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

  /**
   * Move focus to the next/previous VISIBLE row.
   *
   * Visibility is read from the DOM rather than recomputed from state: collapsed
   * children are not rendered at all, so `querySelectorAll` in document order is
   * by construction the list of rows a sighted user can see. Recomputing the
   * flattened tree in state would be a second source of truth that could drift
   * from what actually rendered.
   */
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
        // A native <button> already activates on Enter/Space, so this handler is
        // only here to make the activation explicit and testable.
        // `preventDefault` suppresses the synthesized click, so `onSelectFolder`
        // fires exactly once per key press instead of twice.
        event.preventDefault();
        onSelectFolder(folderId);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        // Without this the whole page scrolls under a keyboard user who is
        // arrowing through the tree.
        event.preventDefault();
        moveRowFocus(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
      }
    },
    [moveRowFocus, onSelectFolder],
  );

  /**
   * One selectable folder row.
   *
   * The row is a real `<button>` rather than a `<div onClick>`: it is in the tab
   * order, exposes button semantics to assistive tech, and fires on Enter/Space
   * natively. The per-row action buttons are SIBLINGS of that button, not
   * children — nested interactive content inside a `<button>` is invalid HTML and
   * screen readers flatten it into a single unreadable control.
   */
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

  // Helper to render tree nodes recursively
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
              onClick={(e) => toggleExpand(item.id, e)}
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
                onClick={(e) => handleOpenCreateModal(item.id, e)}
              >
                <PlusIcon size={12} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                className="shrink-0 text-text-muted hover:text-error hover:bg-error/10"
                aria-label={`Delete folder ${item.name}`}
                title="Delete folder"
                onClick={(e) => handleDeleteTrigger(item.id, item.name, e)}
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
        <Alert
          variant="danger"
          description={`Could not load folders. ${error}`}
          className="text-xs"
        />
      )}

      {/* Navigation Tree */}
      <nav ref={navRef} className="space-y-0.5" aria-label="Folders">
        {/* All / Root Folder Selection */}
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

        {/* Loading state skeleton */}
        {loading && (
          <div className="space-y-1.5 py-2 px-2" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading folders…</span>
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
                    <IconButton
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-text-muted hover:text-error hover:bg-error/10"
                      aria-label={`Delete folder ${folder.name}`}
                      title="Delete folder"
                      onClick={(e) => handleDeleteTrigger(folder.id, folder.name, e)}
                    >
                      <TrashIcon size={12} />
                    </IconButton>
                  ),
                })}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Empty state when no folders exist */}
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

          {deleteError && <Alert variant="danger" description={deleteError} />}

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
