'use client';

import React from 'react';
import { Alert, Button, Modal } from '@vaeloom/ui-kit';

import type { FolderResponse } from '@/lib/api-client';

export interface DeleteFolderModalProps {
  isOpen: boolean;
  folder: FolderResponse | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  isOpen,
  folder,
  loading,
  error,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen && Boolean(folder)} onClose={onClose} title="Delete Folder" size="sm">
      <div className="space-y-4">
        <p className="text-xs text-text-muted leading-relaxed">
          Are you sure you want to delete the folder{' '}
          <strong className="text-text font-semibold">{folder?.name}</strong>? Documents inside will
          remain in your workspace and revert to the root level.
        </p>

        {error && <Alert variant="danger" description={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            Delete Folder
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteFolderModal;
