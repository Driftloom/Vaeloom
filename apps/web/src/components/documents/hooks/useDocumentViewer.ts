'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { documentApi, type DocumentResponse } from '@/lib/api-client';
import {
  docWorkspaceId,
  mimeForExtension,
  previewKind,
  type PreviewKind,
  type WorkspaceScoped,
} from '@/lib/document-format';

import type { DocumentPreviewContent } from '../DocumentPreviewModal';

/**
 * `docWorkspaceId` takes an index-signature type so it can also read the legacy
 * snake_case key, and `DocumentResponse` is an interface with no index
 * signature, so it is not structurally assignable. The cast is confined here
 * rather than repeated at each call site, and the lookup still goes through the
 * tested helper.
 */
function workspaceOf(doc: DocumentResponse, fallback: string): string {
  return docWorkspaceId(doc as unknown as WorkspaceScoped & Record<string, unknown>, fallback);
}

/** Preview kinds whose bytes are read as text and handed to the text renderer. */
const TEXT_KINDS: ReadonlySet<PreviewKind> = new Set<PreviewKind>([
  'markdown',
  'text',
  'code',
  'csv',
]);

export interface UseDocumentViewerResult {
  document: DocumentResponse | null;
  content: DocumentPreviewContent | null;
  loading: boolean;
  error: string | null;
  open: (doc: DocumentResponse) => Promise<void>;
  close: () => void;
}

/**
 * Fetches a document's bytes and builds the blob URL the preview modal renders.
 *
 * THE CLASSIFICATION IS NOT COMPUTED HERE
 *
 * The old implementation decided three separate things from its own hardcoded
 * extension lists: the MIME type to re-wrap the blob with, whether to read the
 * blob as text, and an `unsupported` flag it passed to `DocumentPreviewModal`.
 * `DocumentPreviewModal` then ignored that flag and re-derived the same answer
 * through `previewKind`, so a document the hub called unsupported could be
 * previewed anyway and one it called previewable could be told it was not.
 *
 * This hook asks `previewKind` once and uses the single verdict: it decides
 * whether the text is read, and nothing else. `mimeForExtension` supplies the
 * re-wrapped MIME type only when the object store returned the useless
 * `application/octet-stream`, which it does for most `.md` and `.csv` objects
 * and which would otherwise make a browser refuse to render the blob.
 *
 * Blob URLs are revoked on replace, on close and on unmount; the previous
 * version kept a second `viewerContent?.url` ref that duplicated the one
 * `URL.createObjectURL` call, so half its cleanup paths revoked the same URL
 * twice and leaked the other.
 *
 * @param workspaceId Fallback workspace for documents that do not carry one.
 */
export function useDocumentViewer(workspaceId: string): UseDocumentViewerResult {
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [content, setContent] = useState<DocumentPreviewContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The one live blob URL. Single source of truth for revocation. */
  const urlRef = useRef<string | null>(null);
  const requestId = useRef(0);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => revoke, [revoke]);

  const open = useCallback(
    async (doc: DocumentResponse) => {
      const id = (requestId.current += 1);
      revoke();
      setDocument(doc);
      setContent(null);
      setError(null);
      setLoading(true);

      try {
        const raw = await documentApi.getContent(doc.id, workspaceOf(doc, workspaceId));
        if (id !== requestId.current) return;

        const kind = previewKind(doc.detectedMimeType ?? null, null, doc.type, { path: doc.path });
        // The store's own content type wins when it is specific; `null` from
        // `mimeForExtension` means "extension unknown", in which case the blob
        // keeps whatever it arrived with rather than being given an invented one.
        const declared = mimeForExtension(doc.path);
        const storeType = raw.type && raw.type !== 'application/octet-stream' ? raw.type : null;
        const blob = new Blob([await raw.arrayBuffer()], {
          type: storeType ?? declared ?? raw.type ?? 'application/octet-stream',
        });
        if (id !== requestId.current) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const text = TEXT_KINDS.has(kind) ? await blob.text() : undefined;
        if (id !== requestId.current) {
          URL.revokeObjectURL(url);
          return;
        }

        // `text === undefined` is the discriminator, so an EMPTY text file still
        // arrives as `{ url, text: '' }` rather than as a preview with no text.
        setContent(text === undefined ? { url } : { url, text });
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Could not fetch document content');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [workspaceId, revoke],
  );

  const close = useCallback(() => {
    // Invalidate any in-flight fetch so its `.then` cannot reopen content behind
    // a closed modal.
    requestId.current += 1;
    revoke();
    setDocument(null);
    setContent(null);
    setError(null);
    setLoading(false);
  }, [revoke]);

  return { document, content, loading, error, open, close };
}
