'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@vaeloom/ui-kit';

import type { FolderResponse } from '@/lib/api-client';

export interface CreateFolderModalProps {
  isOpen: boolean;
  /**
   * The folder the new one goes inside, or `null` for the workspace root.
   *
   * This is the value the folder tree's per-row "add subfolder" button supplies.
   * It used to be a `useState` that nothing ever set to anything but `null`, so
   * the modal could not create a subfolder and the tree's subfolder affordance
   * led nowhere.
   */
  parentId: string | null;
  /** Every folder in the workspace, so the parent can be changed here too. */
  folders: FolderResponse[];
  /** A submit failure. Rendered on the field rather than only as a toast. */
  error?: string | null;
  onClose: () => void;
  /** Resolves on success; the caller toasts and refreshes. */
  onSubmit: (name: string, parentId: string | null) => Promise<void>;
}

/** Sentinel option value for "workspace root", because a `<select>` value cannot be `null`. */
const ROOT_VALUE = '__root__';

const ROOT_LABEL = 'Workspace root';

/**
 * Create a folder, optionally nested.
 *
 * `Modal` supplies Escape, the focus trap and focus restoration — verified
 * against `packages/ui-kit/src/components/Modal.tsx`, which focuses the first
 * focusable child on open, cycles Tab inside the dialog, and returns focus to
 * `previouslyFocused` on unmount. Nothing here re-implements any of that.
 */
export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  parentId,
  folders,
  error,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string>(parentId ?? ROOT_VALUE);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Re-seed from props whenever the modal opens, so the parent follows whichever
  // tree row the user clicked rather than whatever the last invocation used.
  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setParent(parentId ?? ROOT_VALUE);
    setFailure(null);
  }, [isOpen, parentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await onSubmit(trimmed, parent === ROOT_VALUE ? null : parent);
    } catch (err) {
      // Kept in the field as well as in the toast: a submission that failed with
      // the modal still open has to say so where the user is looking.
      setFailure(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  const busyState = submitting;
  const parentName =
    folders.find((folder) => folder.id === parentId)?.name ??
    (parentId ? 'the selected folder' : ROOT_LABEL);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={parentId ? 'Create Subfolder' : 'Create New Folder'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Folder Name"
          placeholder="e.g. Legal Contracts, Resumes, Financials"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={failure ?? error ?? undefined}
          autoFocus
          required
          maxLength={255}
        />

        <Select
          label="Location"
          value={parent}
          onChange={setParent}
          helperText={`Nested inside ${parentName}. The backend rejects a '/' or '\\' in a folder name.`}
          options={[
            { value: ROOT_VALUE, label: ROOT_LABEL },
            ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
          ]}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busyState}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={busyState}
            disabled={!name.trim()}
          >
            Create Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateFolderModal;
