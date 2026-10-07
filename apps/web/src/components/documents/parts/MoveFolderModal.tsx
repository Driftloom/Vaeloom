'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select } from '@vaeloom/ui-kit';

import type { FolderResponse } from '@/lib/api-client';

export interface MoveFolderModalProps {
  isOpen: boolean;
  folder: FolderResponse | null;
  folders: FolderResponse[];
  error?: string | null;
  onClose: () => void;
  onSubmit: (folderId: string, nextParentId: string | null) => Promise<void>;
}

/** Sentinel option value for "workspace root", because a `<select>` value cannot be `null`. */
const ROOT_VALUE = '__root__';
const ROOT_LABEL = 'Workspace root (no parent)';

/**
 * Returns all transitive descendant folder IDs for a given folder.
 * Used to prevent circular folder hierarchy loops (moving parent into child).
 */
export function getDescendantFolderIds(folders: FolderResponse[], folderId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [folderId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const f of folders) {
      if (f.parentId === currentId && !descendants.has(f.id)) {
        descendants.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return descendants;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
  isOpen,
  folder,
  folders,
  error,
  onClose,
  onSubmit,
}) => {
  const initialParent = folder?.parentId ?? ROOT_VALUE;
  const [selectedParent, setSelectedParent] = useState<string>(initialParent);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !folder) return;
    setSelectedParent(folder.parentId ?? ROOT_VALUE);
    setFailure(null);
  }, [isOpen, folder]);

  const eligibleFolders = useMemo(() => {
    if (!folder) return [];
    const descendantIds = getDescendantFolderIds(folders, folder.id);
    // Cannot move a folder into itself or any of its descendants
    return folders.filter((f) => f.id !== folder.id && !descendantIds.has(f.id));
  }, [folders, folder]);

  const currentParentId = folder?.parentId ?? ROOT_VALUE;
  const isUnchanged = selectedParent === currentParentId;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!folder || isUnchanged) return;

    setSubmitting(true);
    setFailure(null);
    try {
      const nextParentId = selectedParent === ROOT_VALUE ? null : selectedParent;
      await onSubmit(folder.id, nextParentId);
      onClose();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Failed to move folder');
    } finally {
      setSubmitting(false);
    }
  };

  const options = [
    { value: ROOT_VALUE, label: ROOT_LABEL },
    ...eligibleFolders.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <Modal
      isOpen={isOpen && Boolean(folder)}
      onClose={onClose}
      title={`Move Folder: ${folder?.name ?? ''}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="New Destination"
          value={selectedParent}
          onChange={setSelectedParent}
          helperText="Folders cannot be moved inside themselves or their own subfolders."
          options={options}
        />

        {failure && <p className="text-xs text-error">{failure}</p>}
        {error && !failure && <p className="text-xs text-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={isUnchanged}
          >
            Move Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default MoveFolderModal;
