'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@vaeloom/ui-kit';

import type { DocumentResponse } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

export interface RenameDocumentModalProps {
  /** The document being renamed, or `null` when the modal is closed. */
  doc: DocumentResponse | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  /** Resolves on success; the caller toasts and refreshes. */
  onSubmit: (nextName: string) => Promise<void>;
}

/**
 * Rename one document.
 *
 * The field is seeded with the current file name INCLUDING its extension,
 * because `documentApi.rename` takes a whole path: stripping the extension here
 * would silently produce `report` from `report.csv`.
 */
export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  doc,
  busy,
  error,
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    setValue(getFileName(doc.path));
    setFailure(null);
  }, [doc]);

  if (!doc) return null;

  const busyState = busy || submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Failed to rename document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Rename ${getFileName(doc.path)}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New File Name"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          error={failure ?? error ?? undefined}
          helperText="Include the extension. The rename replaces the whole document path."
          autoFocus
          required
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
            disabled={!value.trim()}
          >
            Save Name
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameDocumentModal;
