'use client';

import React, { useMemo } from 'react';
import {
  Badge,
  Button,
  ClockIcon,
  DataTable,
  EmptyState,
  FileTextIcon,
  Panel,
  type ColumnDef,
} from '@vaeloom/ui-kit';
import type { DocumentVersionResponse } from '@/lib/api-client';
import { PLACEHOLDER, formatSize } from '@/lib/document-format';
import { formatDateTime } from './formatDateTime';
import { LoadablePanel } from './LoadablePanel';

export interface DocumentRevisionsPanelProps {
  fileName: string;
  versions: DocumentVersionResponse[];
  versionsLoading: boolean;
  versionsError: string | null;
  onRetry: () => void;
  versionBusy: boolean;
  uploadSizeLimit: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUploadRevision: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRestorePrompt: (versionNumber: number) => void;
}

export const DocumentRevisionsPanel: React.FC<DocumentRevisionsPanelProps> = ({
  fileName,
  versions,
  versionsLoading,
  versionsError,
  onRetry,
  versionBusy,
  uploadSizeLimit,
  fileInputRef,
  onUploadRevision,
  onRestorePrompt,
}) => {
  const revisionColumns = useMemo<ColumnDef<DocumentVersionResponse>[]>(
    () => [
      {
        key: 'versionNumber',
        header: 'Revision',
        render: (_value, row) => (
          <Badge variant="primary" size="sm" className="font-mono">
            v{row.versionNumber}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Uploaded',
        render: (_value, row) => (
          <span className="text-xs text-text-muted">{formatDateTime(row.createdAt)}</span>
        ),
      },
      {
        key: 'sizeBytes',
        header: 'Size',
        render: (_value, row) => (
          <span className="font-mono text-xs">{formatSize(row.sizeBytes)}</span>
        ),
      },
      {
        key: 'checksum',
        header: 'Checksum',
        render: (_value, row) => (
          <span className="font-mono text-xs text-text-dim" title={row.checksum ?? undefined}>
            {row.checksum ? `${row.checksum.slice(0, 12)}…` : PLACEHOLDER}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Action',
        render: (_value, row) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`Restore revision ${row.versionNumber} of ${fileName}`}
            onClick={() => onRestorePrompt(row.versionNumber)}
          >
            Restore
          </Button>
        ),
      },
    ],
    [fileName, onRestorePrompt],
  );

  return (
    <div className="space-y-4">
      <Panel padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Document Revisions</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Every update creates an immutable revision record with a SHA256 checksum and instant
              rollback. Revisions are capped at {uploadSizeLimit} per file.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={versionBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {!versionBusy && <FileTextIcon size={14} />}
            {versionBusy ? 'Uploading' : 'Upload Revision'}
          </Button>
          <label htmlFor="document-version-upload" className="sr-only">
            Upload a new revision of {fileName}
          </label>
          <input
            id="document-version-upload"
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onUploadRevision}
          />
        </div>
      </Panel>

      <LoadablePanel
        loading={versionsLoading}
        error={versionsError}
        onRetry={onRetry}
        label="revisions"
      >
        {versions.length === 0 ? (
          <EmptyState
            icon={<ClockIcon size={24} />}
            title="No previous revisions"
            description="The current file is the initial revision of this document."
          />
        ) : (
          <DataTable<DocumentVersionResponse>
            columns={revisionColumns}
            data={versions}
            keyExtractor={(row) => row.id}
            emptyMessage="No revisions to show"
            loading={false}
            skeletonRows={3}
          />
        )}
      </LoadablePanel>
    </div>
  );
};
