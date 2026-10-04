'use client';

import React, { useRef, useState } from 'react';
import { Alert, Badge, Button, ErrorState, Modal } from '@vaeloom/ui-kit';
import { UploadIcon } from '@vaeloom/ui-kit';

import type { DocumentResponse, DocumentVersionResponse } from '@/lib/api-client';
import { formatDate, formatSize, getFileName } from '@/lib/document-format';

export interface DocumentVersionHistoryModalProps {
  doc: DocumentResponse | null;
  versions: DocumentVersionResponse[];
  loading: boolean;
  /** A failed revision load. Distinct from "this document has no revisions". */
  error: string | null;
  /** A load or mutation is in flight. */
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onRequestRestore: (versionNumber: number) => void;
  /** Rejects on failure; the caller toasts. */
  onUploadRevision: (file: File) => Promise<unknown>;
}

/**
 * Revision history for one document.
 *
 * THE HIDDEN FILE INPUT
 *
 * `className="hidden"` + `aria-hidden="true"`, driven by the visible
 * "Upload Revision" button. A visually hidden input with no accessible name is
 * announced as an unlabelled file chooser; `aria-hidden` plus a named trigger is
 * the arrangement `DocumentUploadQueue` already uses, so the two file pickers on
 * this screen behave identically.
 */
export const DocumentVersionHistoryModal: React.FC<DocumentVersionHistoryModalProps> = ({
  doc,
  versions,
  loading,
  error,
  busy,
  onClose,
  onRetry,
  onRequestRestore,
  onUploadRevision,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!doc) return null;

  const fileName = getFileName(doc.path);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      await onUploadRevision(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload revision');
    } finally {
      // Reset so re-selecting the same file fires `change` again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Version History - ${fileName}`} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
          <span className="text-xs text-text-muted">
            Manage revisions or restore an earlier one.
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-hidden="true"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon size={14} className="mr-1.5" />
              Upload Revision
            </Button>
          </div>
        </div>

        {uploadError && <Alert variant="danger" description={uploadError} />}

        {error ? (
          /* A failed load must not render as "no revisions" — the previous
             version caught the rejection, showed a toast, and left the empty
             list below, so a 500 was indistinguishable from a first revision. */
          <ErrorState
            title="Could not load revisions"
            message={error}
            onRetry={onRetry}
            actionText="Retry"
          />
        ) : loading ? (
          <div className="py-8 flex justify-center" role="status" aria-live="polite">
            <span className="sr-only">Loading revisions…</span>
            <span
              aria-hidden="true"
              className="inline-block w-6 h-6 rounded-full border-2 border-border border-t-action animate-spin"
            />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-text-muted p-4 text-center">
            No revision history recorded for this document yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
            {versions.map((version) => {
              const number = version.versionNumber ?? 0;
              return (
                <li
                  key={version.id}
                  className="p-3 flex items-center justify-between gap-3 text-xs bg-surface/30"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-text flex items-center gap-2">
                      <Badge variant="mono" size="sm">
                        v{number}
                      </Badge>
                      Revision {number}
                    </p>
                    <p className="text-[11px] text-text-dim mt-0.5">
                      Created {formatDate(version.createdAt)}
                      {version.sizeBytes ? ` · ${formatSize(version.sizeBytes)}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRequestRestore(number)}
                  >
                    Restore
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default DocumentVersionHistoryModal;
