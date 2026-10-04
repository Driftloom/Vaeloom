'use client';

import React from 'react';
import Link from 'next/link';
import { IconButton } from '@vaeloom/ui-kit';
import {
  ArrowDownIcon,
  ClockIcon,
  DatabaseIcon,
  DownloadIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeIcon,
  RefreshCwIcon,
  SparklesIcon,
  TrashIcon,
  UsersIcon,
} from '@vaeloom/ui-kit';

import type { DocumentResponse } from '@/lib/api-client';
import { getFileName } from '@/lib/document-format';

/**
 * Everything the action strip needs from the hub.
 *
 * Grouped rather than passed as ten loose props so the strip cannot be wired to
 * the wrong handler for one action — which is exactly the class of bug the
 * previous strip invited, since each `<button>` closed over its own copy.
 */
export interface DocumentRowHandlers {
  workspaceId: string;
  /** `'documents'` or `'files'`; decides the detail-route segment. */
  basePath: 'documents' | 'files';
  /** Id of the row whose Memory sync is in flight, for the per-row spinner. */
  syncingDocId: string | null;
  onPreview: (doc: DocumentResponse) => void;
  onShare: (doc: DocumentResponse) => void;
  onOpenVersions: (doc: DocumentResponse) => void;
  onSyncMemory: (doc: DocumentResponse) => void;
  onRename: (doc: DocumentResponse) => void;
  onMove: (doc: DocumentResponse) => void;
  onArchive: (doc: DocumentResponse) => void;
  onRestore: (doc: DocumentResponse) => void;
  onDelete: (doc: DocumentResponse) => void;
}

export interface DocumentRowActionsProps {
  doc: DocumentResponse;
  handlers: DocumentRowHandlers;
}

/**
 * The per-row action strip.
 *
 * ICONS
 *
 * The ui-kit ships no folder, speech-bubble or archive-box glyph, so the nearest
 * metaphor is used (down-arrow-into-tray for archive, `SparklesIcon` for the
 * assistant chat) and `aria-label` carries the real name. Because every control
 * is named with the FILE it acts on, the icon is purely decorative and a
 * screen-reader user is never told "trash icon, button".
 *
 * `IconButton` rather than a raw `<button>`: the raw ones were 28x28 with no
 * `disabled` styling, so an in-flight Memory sync was indistinguishable from an
 * idle one and double-clicking fired two syncs.
 */
export const DocumentRowActions: React.FC<DocumentRowActionsProps> = ({ doc, handlers }) => {
  const fileName = getFileName(doc.path);
  const syncing = handlers.syncingDocId === doc.id;

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`View ${fileName}`}
        title="Preview document"
        onClick={() => handlers.onPreview(doc)}
      >
        <EyeIcon size={14} />
      </IconButton>

      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Share ${fileName}`}
        title="Share document"
        onClick={() => handlers.onShare(doc)}
      >
        <UsersIcon size={14} />
      </IconButton>

      <Link
        href={`/workspace/${handlers.workspaceId}/${handlers.basePath}/${doc.id}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-200 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100"
        title="Open the document detail page"
        aria-label={`Detail for ${fileName}`}
      >
        <ExternalLinkIcon size={14} />
      </Link>

      <Link
        href={`/workspace/${handlers.workspaceId}/chat?docId=${doc.id}&docName=${encodeURIComponent(fileName)}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-200 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100"
        title="Chat with this document"
        aria-label={`Chat with ${fileName}`}
      >
        <SparklesIcon size={14} />
      </Link>

      <IconButton
        variant="ghost"
        size="sm"
        loading={syncing}
        disabled={syncing}
        aria-label={`Sync ${fileName} to Memory`}
        title="Index this document into workspace Memory"
        onClick={() => handlers.onSyncMemory(doc)}
      >
        <DatabaseIcon size={14} />
      </IconButton>

      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Version history for ${fileName}`}
        title="Version history"
        onClick={() => handlers.onOpenVersions(doc)}
      >
        <ClockIcon size={14} />
      </IconButton>

      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Rename ${fileName}`}
        title="Rename file"
        onClick={() => handlers.onRename(doc)}
      >
        <EditIcon size={14} />
      </IconButton>

      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Move ${fileName}`}
        title="Move to another folder"
        onClick={() => handlers.onMove(doc)}
      >
        <ArrowDownIcon size={14} />
      </IconButton>

      {/* `deletedAt` is the archived signal: the backend soft-deletes and stamps
          it, and it is the only field that distinguishes the two states. */}
      {doc.deletedAt ? (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={`Restore ${fileName}`}
          title="Restore from archive"
          onClick={() => handlers.onRestore(doc)}
        >
          <RefreshCwIcon size={14} />
        </IconButton>
      ) : (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={`Archive ${fileName}`}
          title="Move to archive"
          onClick={() => handlers.onArchive(doc)}
        >
          <DownloadIcon size={14} />
        </IconButton>
      )}

      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`Delete ${fileName}`}
        title="Delete permanently"
        className="hover:text-error hover:bg-error/10"
        onClick={() => handlers.onDelete(doc)}
      >
        <TrashIcon size={14} />
      </IconButton>
    </div>
  );
};

export default DocumentRowActions;
