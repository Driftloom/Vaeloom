'use client';

import React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  ClockIcon,
  FileTextIcon,
  FormField,
  IconButton,
  Panel,
  RefreshCwIcon,
  ShieldIcon,
  Tooltip,
  XIcon,
} from '@vaeloom/ui-kit';
import { formatDate, formatSize, type ScanState } from '@/lib/document-format';
import { formatDateTime } from './formatDateTime';

export interface DocumentFactsPanelProps {
  scanState: ScanState;
  scanCopy: { label: string; variant: 'success' | 'error' | 'info' | 'default' };
  scanDetail: string;
  scanResult: string | null;
  isSynced: boolean;
  syncingMemory: boolean;
  onSyncMemory: () => void;
  ext: string;
  type: string;
  size: number;
  updatedAt: string;
  docId: string;
  deletedAt: string | null;
  workspaceId: string;
  fileName: string;
  tags: string[];
  tagBusy: boolean;
  newTagInput: string;
  onNewTagInputChange: (val: string) => void;
  onAddTag: (e: React.FormEvent) => void;
  onRemoveTag: (tag: string) => void;
  uploadSizeLimit: string;
  bulkUploadFileLimit: number;
}

export const DocumentFactsPanel: React.FC<DocumentFactsPanelProps> = ({
  scanState,
  scanCopy,
  scanDetail,
  scanResult,
  isSynced,
  syncingMemory,
  onSyncMemory,
  ext,
  type,
  size,
  updatedAt,
  docId,
  deletedAt,
  workspaceId,
  fileName,
  tags,
  tagBusy,
  newTagInput,
  onNewTagInputChange,
  onAddTag,
  onRemoveTag,
  uploadSizeLimit,
  bulkUploadFileLimit,
}) => {
  return (
    <Panel padding="sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* The upload-check verdict */}
          <Tooltip content={scanDetail}>
            <Badge variant={scanCopy.variant} size="sm">
              <ShieldIcon size={12} />
              {scanCopy.label}
            </Badge>
          </Tooltip>
          {scanState === 'quarantined' && scanResult && (
            <Badge variant="error" size="sm" role="status">
              {scanResult}
            </Badge>
          )}

          <Badge variant={isSynced ? 'success' : 'default'} size="sm">
            {isSynced ? 'Memory Synced' : 'Memory Integration'}
          </Badge>

          <Badge variant="mono" size="sm">
            {ext || type || 'file'}
          </Badge>
          <Badge variant="default" size="sm" className="font-mono">
            {formatSize(size)}
          </Badge>
          <Badge variant="default" size="sm">
            <ClockIcon size={12} />
            Updated {formatDateTime(updatedAt)}
          </Badge>
          <Badge variant="mono" size="sm">
            <FileTextIcon size={12} />
            {docId.slice(0, 8)}
          </Badge>
          {deletedAt && (
            <Badge variant="warning" size="sm" role="status">
              Archived {formatDate(deletedAt)}
            </Badge>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={syncingMemory}
            onClick={onSyncMemory}
          >
            {!syncingMemory && <RefreshCwIcon size={14} />}
            {syncingMemory ? 'Syncing' : isSynced ? 'Re-sync Memory' : 'Sync with Memory'}
          </Button>

          <Link
            href={`/workspace/${workspaceId}/memory?query=${encodeURIComponent(fileName)}`}
            className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium border border-border bg-surface text-text-muted hover:text-text hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            View in Memory
          </Link>
        </div>

        {/* Tag editor */}
        <div className="flex flex-wrap items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-text-muted">Tags</span>
            {tags.length === 0 && <span className="text-xs text-text-dim">none yet</span>}
            {tags.map((tag) => (
              <Badge key={tag} variant="mono" size="sm">
                <span>#{tag}</span>
                <IconButton
                  type="button"
                  aria-label={`Remove tag #${tag}`}
                  variant="ghost"
                  size="sm"
                  disabled={tagBusy}
                  onClick={() => onRemoveTag(tag)}
                  className="h-4 w-4"
                >
                  <XIcon size={10} />
                </IconButton>
              </Badge>
            ))}
          </div>

          <form onSubmit={onAddTag} className="inline-flex items-end gap-1">
            <FormField label="Add tag" htmlFor="document-tag-input">
              <input
                id="document-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => onNewTagInputChange(e.target.value)}
                placeholder="new-tag"
                disabled={tagBusy}
                className="px-2 py-0.5 text-xs rounded-md bg-surface border border-border/70 text-text placeholder:text-text-dim focus:outline-none focus:border-primary w-24"
              />
            </FormField>
            <Button type="submit" variant="primary" size="sm" disabled={tagBusy}>
              Add
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-dim">
        Uploads are accepted up to {uploadSizeLimit} per file, and up to {bulkUploadFileLimit} files
        per bulk upload.
      </p>
    </Panel>
  );
};
