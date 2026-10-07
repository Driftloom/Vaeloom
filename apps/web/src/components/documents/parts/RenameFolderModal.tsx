'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@vaeloom/ui-kit';

import type { FolderResponse } from '@/lib/api-client';

export interface RenameFolderModalProps {
  isOpen: boolean;
  folder: FolderResponse | null;
  error?: string | null;
  onClose: () => void;
  onSubmit: (folderId: string, nextName: string) => Promise<void>;
}

export const RenameFolderModal: React.FC<RenameFolderModalProps> = ({
  isOpen,
  folder,
  error,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !folder) return;
    setName(folder.name);
    setFailure(null);
  }, [isOpen, folder]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!folder) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === folder.name) {
      onClose();
      return;
    }

    setSubmitting(true);
    setFailure(null);
    try {
      await onSubmit(folder.id, trimmed);
      onClose();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Failed to rename folder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen && Boolean(folder)} onClose={onClose} title="Rename Folder" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Folder Name"
          placeholder="e.g. Legal Contracts, Resumes, Financials"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          error={failure ?? error ?? undefined}
          autoFocus
          required
          maxLength={255}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!name.trim() || name.trim() === folder?.name}
          >
            Rename Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameFolderModal;
