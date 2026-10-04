'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, Button, Checkbox, DataTable, Spinner, type ColumnDef } from '@vaeloom/ui-kit';
import { FileTextIcon } from '@vaeloom/ui-kit';

import type { DocumentResponse, FolderResponse } from '@/lib/api-client';
import {
  extensionOf,
  formatDate,
  formatSize,
  getFileName,
  isInlinePreviewable,
  PLACEHOLDER,
  scanStateOf,
  type ScanState,
} from '@/lib/document-format';

import { DocumentRowActions, type DocumentRowHandlers } from './DocumentRowActions';
import { isVaultNote } from './documentCategories';

/**
 * The revision number the ingestion pipeline recorded on a row.
 *
 * `metadata` has an index signature because different pipelines write different
 * keys, and the revision has been spelled three ways over the life of the
 * feature, so all three are read. `null` means "the backend never told us",
 * which the cell renders as text rather than as a revision of `0`.
 */
function documentVersionOf(doc: DocumentResponse): string | null {
  const raw =
    doc.metadata?.['version'] ??
    doc.metadata?.['version_number'] ??
    doc.metadata?.['versionNumber'];
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
}

/** The `metadata.size` value as a positive byte count, or `null` when unknown. */
function sizeBytesOf(doc: DocumentResponse): number | null {
  const raw = doc.metadata?.size ?? doc.metadata?.['size_bytes'];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Badge variant and label for each scan state that HAS a verdict.
 *
 * `'unknown'` is absent, and the cell renders plain text for it instead of a
 * badge: a coloured pill next to "no verdict was recorded" lends an absence the
 * authority of a verdict.
 */
const SCAN_BADGE: Record<
  Exclude<ScanState, 'unknown'>,
  { variant: 'success' | 'warning' | 'error'; label: string }
> = {
  clean: { variant: 'success', label: 'Clean' },
  scanning: { variant: 'warning', label: 'Scanning' },
  quarantined: { variant: 'error', label: 'Quarantined' },
};

export interface DocumentsTableProps {
  documents: DocumentResponse[];
  folders: FolderResponse[];
  selectedIds: ReadonlySet<string>;
  handlers: DocumentRowHandlers;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onToggleSelectOne: (id: string) => void;
  onToggleSelectAll: () => void;
  /** Replaces the table entirely while the first load for this workspace runs. */
  loading: boolean;
  /** Rows are on screen and a newer request is in flight. */
  refreshing: boolean;
  className?: string;
}

/**
 * The documents table.
 *
 * `DataTable` rather than a hand-rolled `<table>`: the raw table shipped no
 * `<caption>`, no `aria-sort`, and a bare `<input type="checkbox">` in the header
 * with nothing to associate it with.
 *
 * THE SELECT-ALL CHECKBOX IS NOT IN THE HEADER
 *
 * `ColumnDef.header` is a `string`, so the header cell can only render text — a
 * header checkbox would have to be an unlabelled `<input>` outside the accessible
 * name of anything. It is rendered above the table instead, as a real labelled
 * control that says how many rows it covers ("Select all 50 documents on this
 * page"). That is the fact the header checkbox was silently leaving out.
 */
export const DocumentsTable: React.FC<DocumentsTableProps> = ({
  documents,
  folders,
  selectedIds,
  handlers,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectOne,
  onToggleSelectAll,
  loading,
  refreshing,
  className = '',
}) => {
  const columns: ColumnDef<DocumentResponse>[] = [
    {
      key: 'select',
      header: 'Select',
      className: 'w-12',
      render: (_value, doc) => {
        const fileName = getFileName(doc.path);
        return (
          <Checkbox
            checked={selectedIds.has(doc.id)}
            onChange={() => onToggleSelectOne(doc.id)}
            aria-label={`Select ${fileName}`}
          />
        );
      },
    },
    {
      key: 'name',
      header: 'Name',
      render: (_value, doc) => {
        const fileName = getFileName(doc.path) || PLACEHOLDER;
        const ext = extensionOf(doc.path);
        const vault = isVaultNote(doc, folders);
        const previewable = isInlinePreviewable(doc.detectedMimeType ?? null, null, doc.type, {
          path: doc.path,
        });
        const tags = Array.isArray(doc.metadata?.tags) ? doc.metadata.tags : [];

        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* `title` carries the FULL name so a long one is readable on hover;
                  the button's accessible name stays exactly the file name, which
                  `e2e/files-chat.spec.ts` matches with `exact: true`. */}
              <button
                type="button"
                onClick={() => handlers.onPreview(doc)}
                title={
                  previewable
                    ? `${fileName} — opens a preview`
                    : `${fileName} — no inline preview; the file must be downloaded`
                }
                className="font-medium text-text hover:text-action transition-colors text-left truncate max-w-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {fileName}
              </button>

              {ext && (
                <Badge variant="mono" size="sm" className="shrink-0">
                  {ext}
                </Badge>
              )}

              <Link
                href={`/workspace/${handlers.workspaceId}/${handlers.basePath}/${doc.id}`}
                className="text-[10px] text-text-dim hover:text-action shrink-0 transition-colors"
                title="Open the document detail page"
                aria-label={`Open details for ${fileName}`}
              >
                details
              </Link>

              {vault && (
                <Badge
                  variant="info"
                  size="sm"
                  className="shrink-0"
                  title="Synchronized with the workspace vault"
                >
                  Vault Synced
                </Badge>
              )}

              {doc.metadata?.syncStatus === 'synced' || vault ? (
                <Link
                  href={`/workspace/${handlers.workspaceId}/memory?query=${encodeURIComponent(fileName)}`}
                  className="inline-flex items-center gap-1 text-[10px] text-action hover:bg-action/10 border border-action/25 px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors"
                  title="Indexed in Memory. Open it in the Memory graph."
                >
                  Memory Synced
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={handlers.syncingDocId === doc.id}
                  onClick={() => handlers.onSyncMemory(doc)}
                  className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-action bg-surface hover:bg-surface-hover border border-border px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  title="Index this document into workspace Memory"
                >
                  {handlers.syncingDocId === doc.id ? (
                    <Spinner size="sm" className="w-2.5 h-2.5" />
                  ) : null}
                  Sync Memory
                </button>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-border/70 text-text-muted font-medium"
                  >
                    #{tag}
                  </span>
                ))}
                {tags.length > 3 && (
                  <span className="text-[10px] text-text-dim">+{tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'security',
      header: 'Security',
      render: (_value, doc) => {
        const state = scanStateOf(doc.scanStatus);
        if (state === 'unknown') {
          return <span className="text-text-dim text-xs">Not reported</span>;
        }
        const { variant, label } = SCAN_BADGE[state];
        return (
          <Badge variant={variant} size="sm">
            {label}
          </Badge>
        );
      },
    },
    {
      key: 'version',
      header: 'Version',
      render: (_value, doc) => {
        const version = documentVersionOf(doc);
        if (!version) return <span className="text-text-dim text-xs">Not reported</span>;
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 font-mono text-xs"
            title="View revision history"
            onClick={() => handlers.onOpenVersions(doc)}
          >
            v{version}
          </Button>
        );
      },
    },
    {
      key: 'size',
      header: 'Size',
      className: 'font-mono text-text-muted',
      render: (_value, doc) => formatSize(sizeBytesOf(doc)),
    },
    {
      key: 'updated',
      header: 'Updated',
      className: 'text-text-muted',
      render: (_value, doc) => formatDate(doc.updatedAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (_value, doc) => <DocumentRowActions doc={doc} handlers={handlers} />,
    },
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Checkbox
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected && !allVisibleSelected}
          onChange={onToggleSelectAll}
          aria-label={`Select all ${documents.length} documents on this page`}
        />
        <span className="text-[11px] text-text-muted">
          {refreshing ? 'Refreshing…' : `${documents.length} on this page`}
        </span>
      </div>

      {/* `aria-busy` on the table's container, not only the text above it, so a
          screen reader is told the region is being replaced rather than only
          being shown a sentence that says so. */}
      <div aria-busy={loading || refreshing || undefined}>
        <DataTable
          columns={columns}
          data={documents}
          keyExtractor={(row) => row.id}
          loading={loading}
          skeletonRows={5}
          emptyIcon={<FileTextIcon size={24} />}
          emptyMessage="No documents on this page"
        />
      </div>
    </div>
  );
};

export default DocumentsTable;
