/**
 * The category taxonomy for the documents list.
 *
 * WHY THE SET OF CATEGORIES LIVES IN THE CLIENT BUT THE FILTERING DOES NOT
 *
 * These are two separate things and they used to be conflated in one comment:
 *
 *  - WHICH BUCKETS EXIST is a product decision with no server-side source. No
 *    endpoint enumerates categories, and the stored data cannot produce a stable
 *    set: `Document.metadata.category` is a free-form string written ad hoc by the
 *    `categorize_document` tool (`tools/executor.py:919`) — `vault_note`,
 *    `finance`, `resume`, whatever the tool decided — so a bucket derived from it
 *    would mean something different in every workspace. The six ids below are
 *    therefore declared here and sent to the server as `?category=`, which is the
 *    only place the list knows about them.
 *
 *  - WHICH ROWS MATCH is decided by the server. `GET /documents` takes
 *    `category` (`DocumentListParams`), exactly as it takes `folder_id`, and the
 *    client no longer filters. Filtering a single page in the browser could only
 *    ever match rows that happened to be on that page, so a category with 300
 *    matches would show "1 of 50 rows on this page match" — true, and useless.
 *    The UI used to say as much in a caption, because the narrower row set was
 *    accompanied by the unfiltered server total in the same bar.
 *
 * `isVaultNote` stays, and it is NOT a filter: the table uses it to badge a row
 * that is mirrored from the workspace vault, which is a fact about one row rather
 * than a query over many.
 */

import type { DocumentResponse, FolderResponse } from '@/lib/api-client';

export type DocumentCategoryId =
  'all' | 'vault_notes' | 'documents' | 'spreadsheets' | 'images' | 'code';

export interface DocumentCategory {
  id: DocumentCategoryId;
  label: string;
}

/**
 * The tab order shown in the toolbar, and the ids sent as `?category=`.
 *
 * `'all'` is a UI sentinel for "do not filter" and is never sent: `useDocumentList`
 * turns it into an absent parameter, which `encodeParams` drops so the route sees
 * its `None` default. Every other id goes over the wire verbatim, so the server
 * has to recognise exactly these spellings — `vault_notes`,
 * `documents`, `spreadsheets`, `images`, `code`.
 */
export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  { id: 'all', label: 'All Files' },
  { id: 'vault_notes', label: 'Vault Notes' },
  { id: 'documents', label: 'Documents' },
  { id: 'spreadsheets', label: 'Spreadsheets' },
  { id: 'images', label: 'Images' },
  { id: 'code', label: 'Code' },
] as const;

/** The label for a category id, or the id itself if it is not in the taxonomy. */
export function categoryLabel(id: DocumentCategoryId): string {
  return DOCUMENT_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/**
 * The folder name that marks a row as a vault note.
 *
 * Name-based, not id-based, because the id is a workspace-generated UUID and no
 * two workspaces agree on it. Kept as a single exported constant so the match
 * below is the only place it is written.
 */
export const VAULT_NOTES_FOLDER_NAME = 'Vault Notes';

/**
 * Whether a row is a vault note.
 *
 * Three signals, in the order the backend can actually produce them: the
 * `category` the categoriser wrote, the `type` it wrote, and the name of the
 * folder the row currently lives in. All three are checked because none is
 * guaranteed — `metadata.category` is absent on anything never categorised.
 *
 * Used for the row's "Vault Synced" badge, NOT for filtering. The `vault_notes`
 * tab is a server query; this is a per-row marker the server does not send as a
 * boolean.
 */
export function isVaultNote(doc: DocumentResponse, folders: readonly FolderResponse[]): boolean {
  if (doc.metadata?.category === 'vault_note' || doc.type === 'vault_note') return true;
  const folderName = folders.find((folder) => folder.id === doc.folderId)?.name;
  return folderName === VAULT_NOTES_FOLDER_NAME;
}
