'use client';

import { useEffect, useRef, useState } from 'react';

import { documentApi } from '@/lib/api-client';

/** Latest revision per document, as returned by `POST /documents/versions/batch`. */
export interface DocumentVersionMeta {
  latestVersion: number;
  versionCount: number;
}

/**
 * Latest revision numbers for a page of documents, in one request.
 *
 * The backend stores no revision on the document row, so the list needs
 * `DocumentVersion.versionNumber` from somewhere. Fetching it per row is an N+1 on
 * the hot path, which is why the batch endpoint exists; this hook issues exactly
 * one call per distinct page of ids and ignores results for rows that have since
 * been replaced.
 *
 * A failure here is deliberately non-fatal: the table renders an em dash in the
 * Version cell rather than blocking the document list, because a missing revision
 * number must not cost the user the ability to open, preview, or delete a file.
 */
export function useBatchDocumentVersions(
  workspaceId: string | undefined,
  documentIds: readonly string[],
): { versionsByDocumentId: Record<string, DocumentVersionMeta> } {
  const [versionsByDocumentId, setVersionsByDocumentId] = useState<
    Record<string, DocumentVersionMeta>
  >({});
  // Guards against a slower earlier response overwriting a newer one.
  const requestSeq = useRef(0);

  const key = documentIds.join(',');

  useEffect(() => {
    if (!workspaceId || documentIds.length === 0) {
      setVersionsByDocumentId({});
      return;
    }

    const seq = ++requestSeq.current;
    let cancelled = false;

    documentApi
      .batchVersions([...documentIds], workspaceId)
      .then((res) => {
        if (cancelled || seq !== requestSeq.current) return;
        setVersionsByDocumentId(res.versions ?? {});
      })
      .catch(() => {
        if (cancelled || seq !== requestSeq.current) return;
        // Leave the map empty; the Version column falls back to PLACEHOLDER.
        setVersionsByDocumentId({});
      });

    return () => {
      cancelled = true;
    };
    // `key` is a stable serialisation of documentIds, so this effect re-runs on a
    // page change without depending on the array's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return { versionsByDocumentId };
}
