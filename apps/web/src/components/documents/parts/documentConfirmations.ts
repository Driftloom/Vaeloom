import type { DocumentResponse } from '@/lib/api-client';

/**
 * The non-rendering model behind the hub's dialogs: what a pending destructive
 * action looks like, the copy it is confirmed with, and the synthetic document a
 * BULK move hands to a dialog that only understands one document.
 *
 * These are plain functions and types rather than JSX so they can be asserted on
 * directly, and so `DocumentsHub` stays a wiring layer.
 */

/**
 * The one destructive action awaiting confirmation.
 *
 * A discriminated union whose arms are constructed in exactly one place each,
 * immediately beside the `ConfirmDialog` that consumes them. The previous
 * `DocumentsHub` declared a `'delete-folder'` arm that `setPendingConfirm` was
 * never called with anywhere in the file, so that arm — and the whole
 * `handleDeleteFolder` function behind it — was unreachable code.
 */
export type PendingConfirm =
  | { kind: 'delete-folder'; folderId: string; name: string }
  | { kind: 'restore-version'; version: number }
  | { kind: 'archive-document'; docId: string; name: string }
  | { kind: 'delete-document'; docId: string; name: string }
  | { kind: 'bulk-delete'; count: number };

/**
 * Dialog copy for one pending confirmation.
 *
 * A `switch`, not a `Record<kind, { title: (c) => string }>`: a record keyed by
 * the union cannot narrow its argument, so every arm would have to read fields
 * that do not exist on all members — which is how the old
 * `pendingConfirm?.name` chain ended with an `else` that served "Archive
 * document" for any state it did not recognise.
 */
export function confirmCopy(pending: PendingConfirm): {
  title: string;
  message: string;
  danger: boolean;
} {
  switch (pending.kind) {
    case 'delete-folder':
      return {
        title: 'Delete folder',
        message: `Delete folder "${pending.name}"? Documents inside it will move back to the workspace root.`,
        danger: true,
      };
    case 'restore-version':
      return {
        title: 'Restore version',
        message: `Restore version ${pending.version}? This creates a new active revision.`,
        danger: false,
      };
    case 'archive-document':
      return {
        title: 'Archive document',
        message: `Archive "${pending.name}"? You can restore it later.`,
        danger: true,
      };
    case 'delete-document':
      return {
        title: 'Permanently delete document',
        message: `Permanently delete "${pending.name}"? The file is removed from storage and cannot be undone.`,
        danger: true,
      };
    case 'bulk-delete':
      return {
        title: 'Permanently delete selected documents',
        message: `Permanently delete ${pending.count} selected document(s)? They are removed from storage and cannot be undone.`,
        danger: true,
      };
  }
}

/** Sentinel id for the object handed to the move dialog for a BULK move. */
export const BULK_SELECTION_ID = 'bulk-selection';

/**
 * A stand-in "document" for `DocumentMoveDialog` when several rows are selected.
 *
 * `DocumentMoveDialog` takes one `document: DocumentResponse` and reads four
 * fields from it: `id` (only when no `onMove` is supplied), `path` (the heading
 * and the current-location line), `folderId` (the "Current" badge) and
 * `workspaceId`. The previous implementation fabricated a full
 * `DocumentResponse` with `type: 'folder'`, `status: 'AVAILABLE'` and
 * `scanStatus: 'CLEAN'` — an object that type-checks as a real document and
 * asserts a security verdict about a file that does not exist.
 *
 * This one claims only what it can:
 *  - `status` and `scanStatus` are OMITTED. Both are optional on the interface
 *    and both would be fabrications here.
 *  - `type` is `'collection'`, deliberately NOT a value from the backend's
 *    `EXTENSION_MAP`, because it is not a file format.
 *  - `path` states what it is and contains no `/`, so `getFileName` renders it
 *    verbatim as the dialog's heading.
 *
 * The selection size is carried in `path` only. It is deliberately NOT placed in
 * `metadata`: that bag models what the ingestion pipeline persists, and seeding
 * it with a UI-only key would put a fabricated field on something the dialog
 * renders as though it came from the server.
 *
 * `folderId` is `null` rather than the currently-filtered folder: "the folder
 * these documents are collectively in" is not a thing, and pre-selecting a
 * destination would arm a "Move Here" that is a no-op.
 */
export function bulkSelectionProxy(count: number, workspaceId: string): DocumentResponse {
  return {
    id: BULK_SELECTION_ID,
    workspaceId,
    path: `${count} selected document${count === 1 ? '' : 's'} (bulk move)`,
    folderId: null,
    type: 'collection',
    metadata: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
}
