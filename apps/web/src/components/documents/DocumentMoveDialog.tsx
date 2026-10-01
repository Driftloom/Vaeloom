'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Badge,
  Spinner,
  FileTextIcon,
  AlertCircleIcon,
  CheckIcon,
} from '@vaeloom/ui-kit';
import { documentApi, type DocumentResponse, type FolderResponse } from '@/lib/api-client';

export interface DocumentMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
  workspaceId?: string;
  folders?: FolderResponse[];
  onMove?: (targetFolderId: string | null) => Promise<unknown> | void;
  onMoved?: (targetFolderId: string | null, newPath: string) => void;
}

const FolderIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
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
  </svg>
);

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export const DocumentMoveDialog: React.FC<DocumentMoveDialogProps> = ({
  isOpen,
  onClose,
  document,
  workspaceId: propWorkspaceId,
  folders: initialFolders,
  onMove,
  onMoved,
}) => {
  const effectiveWorkspaceId =
    propWorkspaceId ||
    document?.workspace_id ||
    (document as unknown as Record<string, string>)?.['workspaceId'] ||
    '';

  const [folders, setFolders] = useState<FolderResponse[]>(initialFolders ?? []);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!effectiveWorkspaceId || !isOpen || initialFolders !== undefined) return;
    setLoadingFolders(true);
    try {
      const data = await documentApi.listFolders(effectiveWorkspaceId);
      setFolders(data);
    } catch {
      // Best-effort
    } finally {
      setLoadingFolders(false);
    }
  }, [effectiveWorkspaceId, isOpen, initialFolders]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      const currentFolderId = document?.folder_id ? String(document.folder_id) : null;
      setSelectedFolderId(currentFolderId);

      if (initialFolders === undefined) {
        void fetchFolders();
      } else {
        setFolders(initialFolders);
      }
    }
  }, [isOpen, document, initialFolders, fetchFolders]);

  if (!document) return null;

  const fileName = getFileName(document.path);
  const currentFolderId = document.folder_id ? String(document.folder_id) : null;
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const isTargetSameAsCurrent = selectedFolderId === currentFolderId;

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTargetSameAsCurrent) return;

    setMoveLoading(true);
    setError(null);

    try {
      if (onMove) {
        await onMove(selectedFolderId);
      } else if (effectiveWorkspaceId) {
        await documentApi.move(document.id, effectiveWorkspaceId, selectedFolderId);
        const targetFolder = folders.find((f) => f.id === selectedFolderId);
        const newPath = targetFolder ? `${targetFolder.name}/${fileName}` : fileName;
        onMoved?.(selectedFolderId, newPath);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move document');
    } finally {
      setMoveLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move Document" size="md">
      <form onSubmit={handleMove} className="space-y-4">
        {/* Document Current Info */}
        <div className="p-3 rounded-lg bg-surface-100 border border-border flex items-center gap-3">
          <div className="p-2 rounded-md bg-surface-200 text-text-muted shrink-0">
            <FileTextIcon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text truncate">{fileName}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Current Location:{' '}
              <span className="font-medium text-text">
                {currentFolder ? currentFolder.name : 'Root Workspace'}
              </span>
            </p>
          </div>
        </div>

        {/* Destination Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text uppercase tracking-wider">
              Select Destination Folder
            </label>
            {loadingFolders && <Spinner size="sm" />}
          </div>

          <div
            className="space-y-1.5 max-h-60 overflow-y-auto pr-1 border border-border rounded-lg p-2 bg-surface-50"
            role="radiogroup"
            aria-label="Destination Folder"
          >
            {/* Root workspace option */}
            <div
              onClick={() => setSelectedFolderId(null)}
              role="radio"
              aria-checked={selectedFolderId === null}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelectedFolderId(null);
                }
              }}
              className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedFolderId === null
                  ? 'bg-action/10 text-action border border-action/30'
                  : 'text-text-muted hover:text-text hover:bg-surface-100 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileTextIcon
                  size={16}
                  className={selectedFolderId === null ? 'text-action' : 'text-text-muted'}
                />
                <span>Root Workspace (No folder)</span>
              </div>

              {currentFolderId === null && (
                <Badge variant="default" size="sm">
                  Current
                </Badge>
              )}
            </div>

            {/* Folder list */}
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const isCurrent = currentFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedFolderId(folder.id);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-action/10 text-action border border-action/30'
                      : 'text-text-muted hover:text-text hover:bg-surface-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderIcon
                      size={16}
                      className={isSelected ? 'text-action' : 'text-text-muted'}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>

                  {isCurrent && (
                    <Badge variant="default" size="sm">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error flex items-start gap-2"
          >
            <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={moveLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={moveLoading}
            disabled={isTargetSameAsCurrent}
          >
            <CheckIcon size={14} className="mr-1.5" />
            Move Here
          </Button>
        </div>
      </form>
    </Modal>
  );
};
