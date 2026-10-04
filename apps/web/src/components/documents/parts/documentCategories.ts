/**
 * The category taxonomy for the documents list.
 *
 * WHY THE CATEGORY SET LIVES IN THE CLIENT
 *
 * `GET /documents` has no category parameter, and it cannot grow one from the
 * data it already serves. `Document.metadata.category` is a free-form string
 * written ad hoc by the `categorize_document` tool (`tools/executor.py:919`) —
 * `vault_note`, `finance`, `resume`, whatever the tool decided — so it cannot
 * enumerate a stable set of buckets, and a bucket derived from it would change
 * meaning between workspaces. The category tabs are therefore a product-level
 * taxonomy expressed in the UI and applied to the rows already fetched. The
 * SERVER-side narrowing that matters for scale is the folder filter, which is a
 * real query parameter and is applied there.
 *
 * WHY THE BUCKETS ARE DERIVED FROM `previewKind`
 *
 * The old `CATEGORY_EXTENSIONS` table re-listed ~35 extensions in this file and
 * had already drifted from the merged classifier in `@/lib/document-format`: it
 * put `rtf` in documents (correct by accident), omitted `avif`, and listed `tsv`
 * only under spreadsheets while `previewKind` classifies it as `csv`. Rather than
 * move the drift, the buckets now ask the one shared classifier:
 * `previewKind(detectedMimeType, ext, type, { path })`. Two supplements remain
 * because `previewKind` deliberately answers `'none'` for Office zip containers
 * — they are not renderable, which is true and does not make them spreadsheets.
 */

import { extensionOf, previewKind, type PreviewKind } from '@/lib/document-format';
import type { DocumentResponse, FolderResponse } from '@/lib/api-client';

export type DocumentCategoryId =
  'all' | 'vault_notes' | 'documents' | 'spreadsheets' | 'images' | 'code';

export interface DocumentCategory {
  id: DocumentCategoryId;
  label: string;
}

/** The tab order shown in the toolbar. `all` and `vault_notes` are not extensions. */
export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  { id: 'all', label: 'All Files' },
  { id: 'vault_notes', label: 'Vault Notes' },
  { id: 'documents', label: 'Documents' },
  { id: 'spreadsheets', label: 'Spreadsheets' },
  { id: 'images', label: 'Images' },
  { id: 'code', label: 'Code' },
] as const;

/**
 * The folder name that marks a row as a vault note.
 *
 * Name-based, not id-based, because the id is a workspace-generated UUID and no
 * two workspaces agree on it. Kept as a single exported constant so the match
 * below is the only place it is written.
 */
export const VAULT_NOTES_FOLDER_NAME = 'Vault Notes';

/**
 * Buckets for the preview kinds that carry one.
 *
 * `previewKind` folds `csv` and `tsv` together, so the spreadsheet bucket needs
 * no extension list of its own.
 */
const KIND_TO_CATEGORY: Partial<Record<PreviewKind, DocumentCategoryId>> = {
  markdown: 'documents',
  text: 'documents',
  pdf: 'documents',
  csv: 'spreadsheets',
  image: 'images',
  code: 'code',
};

/**
 * Office / word-processor binaries. `previewKind` returns `'none'` for every one
 * of them, which is a statement about inline rendering and says nothing about
 * which tab the file belongs on.
 */
const SHEET_EXTENSIONS: ReadonlySet<string> = new Set(['xlsx', 'xls', 'xlsm', 'ods', 'numbers']);
const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  'doc',
  'docx',
  'odt',
  'ppt',
  'pptx',
  'odp',
  'key',
  'pages',
]);

/**
 * Whether a row is a vault note.
 *
 * Three signals, in the order the backend can actually produce them: the
 * `category` the categoriser wrote, the `type` it wrote, and the name of the
 * folder the row currently lives in. All three are checked because none is
 * guaranteed — `metadata.category` is absent on anything never categorised.
 */
export function isVaultNote(doc: DocumentResponse, folders: readonly FolderResponse[]): boolean {
  if (doc.metadata?.category === 'vault_note' || doc.type === 'vault_note') return true;
  const folderName = folders.find((folder) => folder.id === doc.folderId)?.name;
  return folderName === VAULT_NOTES_FOLDER_NAME;
}

/**
 * The bucket a row belongs to, or `null` when it cannot be classified.
 *
 * A `null` here is not a hole in the UI: {@link matchesCategory} files such a
 * row under `documents` so that no document becomes unreachable from every tab.
 */
export function categoryOf(doc: DocumentResponse): DocumentCategoryId | null {
  const kind = previewKind(doc.detectedMimeType ?? null, null, doc.type, { path: doc.path });
  const fromKind = KIND_TO_CATEGORY[kind];
  if (fromKind) return fromKind;

  const ext = extensionOf(doc.path);
  if (SHEET_EXTENSIONS.has(ext)) return 'spreadsheets';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'documents';
  return null;
}

/**
 * Whether a row passes the active category filter.
 *
 * @param category The active tab. `'all'` matches everything.
 * @param folders The workspace folders, needed only to resolve vault notes by
 * folder name.
 */
export function matchesCategory(
  doc: DocumentResponse,
  category: DocumentCategoryId,
  folders: readonly FolderResponse[],
): boolean {
  if (category === 'all') return true;
  if (category === 'vault_notes') return isVaultNote(doc, folders);
  // An unclassifiable file lands in `documents` rather than in no tab at all:
  // the previous behaviour hid it from Documents, Spreadsheets, Images AND Code
  // while still showing it under All Files, so a workspace full of extensionless
  // rows looked empty on every specific tab.
  return (categoryOf(doc) ?? 'documents') === category;
}
