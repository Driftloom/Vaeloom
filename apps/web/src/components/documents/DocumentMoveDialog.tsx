'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Badge,
  Spinner,
  Radio,
  Alert,
  FileTextIcon,
  CheckIcon,
} from '@vaeloom/ui-kit';
import { documentApi, type DocumentResponse, type FolderResponse } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

export interface DocumentMoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentResponse | null;
  workspaceId?: string;
  folders?: FolderResponse[];
  onMove?: (targetFolderId: string | null) => Promise<unknown> | void;
  onMoved?: (targetFolderId: string | null, newPath: string) => void;
}

/**
 * Synthetic radio value for "no folder".
 *
 * A radio `<input>` needs a non-empty `value`, so `null` is encoded as a sentinel
 * and decoded again in `folderIdForValue`.
 */
const ROOT_VALUE = '__root__';

/** Native radio-group name. Radios sharing a `name` get native semantics: */
const RADIO_GROUP = 'move-destination-folder';

const folderIdForValue = (value: string): string | null => (value === ROOT_VALUE ? null : value);

const valueForFolderId = (folderId: string | null): string => folderId ?? ROOT_VALUE;

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

/** Row chrome for one destination option; the radio itself supplies the control. */
function optionRowClasses(isSelected: boolean): string {
  return `flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
    isSelected
      ? 'bg-action/10 text-action border-action/30'
      : 'text-text-muted hover:text-text hover:bg-surface-100 border-transparent'
  }`;
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
  const effectiveWorkspaceId = propWorkspaceId || document?.workspaceId || '';

  const [folders, setFolders] = useState<FolderResponse[]>(initialFolders ?? []);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!effectiveWorkspaceId || !isOpen || initialFolders !== undefined) return;
    setLoadingFolders(true);
    setFoldersError(null);
    try {
      setFolders(await documentApi.listFolders(effectiveWorkspaceId));
    } catch (err) {
      // Previously swallowed, which made a failed request look exactly like a
      // workspace with no folders.
      setFoldersError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setLoadingFolders(false);
    }
  }, [effectiveWorkspaceId, isOpen, initialFolders]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      const currentFolderId = document?.folderId ? String(document.folderId) : null;
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
  const currentFolderId = document.folderId ? String(document.folderId) : null;
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const isTargetSameAsCurrent = selectedFolderId === currentFolderId;
  const hasDestination = Boolean(onMove) || Boolean(effectiveWorkspaceId);

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTargetSameAsCurrent) return;

    if (!hasDestination) {
      setError('This document cannot be moved because no workspace is available for the move.');
      return;
    }

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
          <div
            aria-hidden="true"
            className="p-2 rounded-md bg-surface-200 text-text-muted shrink-0"
          >
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

        {/* Destination Selection.
            `<fieldset>`/`<legend>` replaces a bare `<label>` that had no `htmlFor`:
            it names the whole group natively, which is what a group caption is
            for — a `<label>` is for a single control. */}
        <fieldset className="border-0 p-0 m-0">
          <legend className="text-xs font-semibold text-text uppercase tracking-wider mb-2">
            Select Destination Folder
          </legend>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 border border-border rounded-lg p-2 bg-surface-50">
            <div
              role="radiogroup"
              aria-label="Destination folder"
              aria-busy={loadingFolders || undefined}
            >
              {/* Root workspace option */}
              <div className={optionRowClasses(selectedFolderId === null)}>
                <Radio
                  name={RADIO_GROUP}
                  value={ROOT_VALUE}
                  checked={selectedFolderId === null}
                  onChange={() => setSelectedFolderId(null)}
                  className="min-w-0 flex-1"
                  label={
                    <span className="flex items-center gap-2 min-w-0">
                      <FileTextIcon
                        size={16}
                        className={selectedFolderId === null ? 'text-action' : 'text-text-muted'}
                      />
                      <span className="truncate">Root Workspace (No folder)</span>
                    </span>
                  }
                />
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
                  <div key={folder.id} className={optionRowClasses(isSelected)}>
                    <Radio
                      name={RADIO_GROUP}
                      value={folder.id}
                      checked={isSelected}
                      onChange={() => setSelectedFolderId(folder.id)}
                      className="min-w-0 flex-1"
                      label={
                        <span className="flex items-center gap-2 min-w-0">
                          <FolderIcon
                            size={16}
                            className={isSelected ? 'text-action' : 'text-text-muted'}
                          />
                          <span className="truncate">{folder.name}</span>
                        </span>
                      }
                    />
                    {isCurrent && (
                      <Badge variant="default" size="sm">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}

              {loadingFolders && (
                <p
                  className="flex items-center gap-2 p-2 text-[11px] text-text-muted"
                  role="status"
                >
                  <Spinner size="sm" />
                  Loading folders…
                </p>
              )}

              {foldersError && (
                <Alert variant="danger" description={`Could not load folders. ${foldersError}`} />
              )}

              {!loadingFolders && !foldersError && folders.length === 0 && (
                <p role="status" className="p-2 text-[11px] text-text-muted italic">
                  This workspace has no folders yet. Choose Root Workspace, or create a folder first
                  and reopen this dialog.
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {error && <Alert variant="danger" description={error} />}

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
            disabled={isTargetSameAsCurrent || !hasDestination}
            title={
              isTargetSameAsCurrent
                ? 'The document is already in this folder'
                : !hasDestination
                  ? 'No workspace is available for this move'
                  : undefined
            }
          >
            <CheckIcon size={14} className="mr-1.5" />
            Move Here
          </Button>
        </div>
      </form>
    </Modal>
  );
};
