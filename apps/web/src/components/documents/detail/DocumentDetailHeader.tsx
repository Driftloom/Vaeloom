'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb, Button, DownloadIcon } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { PLACEHOLDER, formatDate, formatSize } from '@/lib/document-format';

export interface DocumentDetailHeaderProps {
  fileName: string;
  type: string;
  size: number;
  createdAt: string;
  currentRevision: number | null;
  workspaceId: string;
  basePath: string;
  blobUrl: string | null;
  docId: string;
  onBack: () => void;
  onMove: () => void;
  onShare: () => void;
  onAuditTab: () => void;
  onCompareTab: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const DocumentDetailHeader: React.FC<DocumentDetailHeaderProps> = ({
  fileName,
  type,
  size,
  createdAt,
  currentRevision,
  workspaceId,
  basePath,
  blobUrl,
  docId,
  onBack,
  onMove,
  onShare,
  onAuditTab,
  onCompareTab,
  onArchive,
  onDelete,
}) => {
  return (
    <PageHeader
      title={fileName}
      description={[
        type ? type.toUpperCase() : 'FILE',
        formatSize(size),
        `Created ${formatDate(createdAt)}`,
        currentRevision === null ? `Revision ${PLACEHOLDER}` : `Rev v${currentRevision}`,
      ].join(' · ')}
      breadcrumb={
        <Breadcrumb
          items={[
            {
              label: `Workspace ${basePath === 'files' ? 'Files' : 'Documents'}`,
              href: `/workspace/${workspaceId}/${basePath}`,
            },
            { label: fileName, current: true },
          ]}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onBack}>
            Back
          </Button>

          {blobUrl && (
            <a
              href={blobUrl}
              download={fileName}
              aria-label={`Download ${fileName}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium bg-action text-action-fg hover:bg-action-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <DownloadIcon size={14} />
              <span>Download</span>
            </a>
          )}

          <Link
            href={`/workspace/${workspaceId}/chat?docId=${docId}&docName=${encodeURIComponent(fileName)}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border border-border bg-surface-hover text-text hover:bg-surface-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Chat
          </Link>

          <Button type="button" variant="secondary" size="sm" onClick={onMove}>
            Move
          </Button>

          <Button type="button" variant="secondary" size="sm" onClick={onShare}>
            Share
          </Button>

          <Button type="button" variant="secondary" size="sm" onClick={onAuditTab}>
            AI Audit
          </Button>

          <Button type="button" variant="secondary" size="sm" onClick={onCompareTab}>
            Compare
          </Button>

          <Button type="button" variant="secondary" size="sm" onClick={onArchive}>
            Archive
          </Button>

          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      }
    />
  );
};
