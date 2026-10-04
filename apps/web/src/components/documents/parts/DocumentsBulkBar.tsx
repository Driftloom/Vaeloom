'use client';

import React from 'react';
import { Button } from '@vaeloom/ui-kit';
import { DownloadIcon, RefreshCwIcon, TrashIcon } from '@vaeloom/ui-kit';
import { formatBytes } from '@/lib/document-format';

export interface DocumentsBulkBarProps {
  /** Number of selected rows. Renders nothing at zero. */
  count: number;
  /**
   * Sum of the selected rows' known sizes, or `null` when none has one.
   *
   * `null` omits the figure. The previous bar had no size at all; showing
   * `formatBytes(0)` for "unknown" would print "0 B", which reads as "these files
   * are empty" rather than "we were not told how big they are".
   */
  selectedBytes: number | null;
  busy: boolean;
  onDownload: () => void;
  onSyncMemory: () => void;
  onArchive: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClear: () => void;
  className?: string;
}

/**
 * The bulk-action bar that appears once at least one row is selected.
 *
 * The count is rendered as the exact string `{n} document(s) selected`, which
 * `e2e/files-chat.spec.ts` matches on; changing the wording breaks that
 * assertion, so it is not reworded here.
 *
 * `Button` rather than raw `<button className="btn-secondary">`: the raw buttons
 * had no `loading` state, so a bulk request left the controls clickable and
 * fired again, and no `disabled` styling while a request was in flight.
 */
export const DocumentsBulkBar: React.FC<DocumentsBulkBarProps> = ({
  count,
  selectedBytes,
  busy,
  onDownload,
  onSyncMemory,
  onArchive,
  onMove,
  onDelete,
  onClear,
  className = '',
}) => {
  if (count === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur-sm ${className}`}
    >
      <span className="text-xs font-semibold text-text">
        {count} document(s) selected
        {selectedBytes !== null && (
          <span className="ml-2 font-mono font-normal text-text-muted">
            {formatBytes(selectedBytes)}
          </span>
        )}
      </span>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onDownload}>
          <DownloadIcon size={14} className="mr-1.5" />
          Download (.zip)
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onSyncMemory}
          title="Index the selected documents into workspace Memory"
        >
          <RefreshCwIcon size={14} className={`mr-1.5 ${busy ? 'animate-spin' : ''}`} />
          Sync to Memory
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onArchive}
          className="text-warning hover:bg-warning/10 hover:border-warning/30"
        >
          Archive Selected
        </Button>

        <Button variant="outline" size="sm" disabled={busy} onClick={onMove}>
          Move Selected
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onDelete}
          className="text-error hover:bg-error/10 hover:border-error/30"
        >
          <TrashIcon size={14} className="mr-1.5" />
          Delete Selected
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          Clear
        </Button>
      </div>
    </div>
  );
};

export default DocumentsBulkBar;
