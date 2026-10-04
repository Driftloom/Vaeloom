'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { documentApi, type DocumentResponse, type DocumentVersionResponse } from '@/lib/api-client';
import { docWorkspaceId, type WorkspaceScoped } from '@/lib/document-format';

function workspaceOf(doc: DocumentResponse, fallback: string): string {
  return docWorkspaceId(doc as unknown as WorkspaceScoped & Record<string, unknown>, fallback);
}

export interface UseDocumentVersionsResult {
  /** The document whose revisions are open, or `null` when the modal is closed. */
  document: DocumentResponse | null;
  versions: DocumentVersionResponse[];
  loading: boolean;
  /** Set by a failed load. Distinguishes "failed" from "no revisions". */
  error: string | null;
  /** A load or mutation is in flight; disables the row buttons. */
  busy: boolean;

  open: (doc: DocumentResponse) => Promise<void>;
  close: () => void;
  reload: () => Promise<void>;
  /** Uploads a new revision and reloads the list. Rejects on failure. */
  uploadRevision: (file: File) => Promise<DocumentVersionResponse>;
  /**
   * Arms a restore for a revision. The confirmation dialog lives in the hub, so
   * this only records WHICH revision is pending.
   */
  requestRestore: (versionNumber: number) => void;
  /** Performs the armed restore. Resolves immediately when nothing is armed. */
  confirmRestore: () => Promise<void>;
}

/**
 * Revision history for one document.
 *
 * The pending restore lives in a REF, not in state. The confirmation dialog is
 * owned by the hub, so the only thing that has to survive between "arm" and
 * "confirm" is the revision number and the document it belongs to — and by then
 * the modal may already have been closed, which must not retarget the restore at
 * whatever document is open next.
 *
 * @param workspaceId Fallback workspace for documents that do not carry one.
 */
export function useDocumentVersions(workspaceId: string): UseDocumentVersionsResult {
  const [document, setDocument] = useState<DocumentResponse | null>(null);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestId = useRef(0);
  /**
   * The document the pending restore applies to. Held in a ref because a
   * restore is confirmed by a CLICK on the shared ConfirmDialog, and by then the
   * `document` state may have been cleared by closing the modal — which must not
   * silently retarget the restore at the next document opened.
   */
  const restoreTarget = useRef<{ id: string; version: number } | null>(null);

  const load = useCallback(
    async (doc: DocumentResponse) => {
      const id = (requestId.current += 1);
      setLoading(true);
      setError(null);
      try {
        const rows = await documentApi.listVersions(doc.id, workspaceOf(doc, workspaceId));
        if (id !== requestId.current) return;
        setVersions(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load revisions');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [workspaceId],
  );

  const open = useCallback(
    async (doc: DocumentResponse) => {
      setDocument(doc);
      restoreTarget.current = null;
      setVersions([]);
      await load(doc);
    },
    [load],
  );

  const close = useCallback(() => {
    requestId.current += 1;
    setDocument(null);
    setVersions([]);
    setError(null);
    setLoading(false);
    restoreTarget.current = null;
  }, []);

  useEffect(() => {
    // A workspace switch invalidates anything in flight.
    close();
  }, [workspaceId, close]);

  const reload = useCallback(async () => {
    if (!document) return;
    await load(document);
  }, [document, load]);

  const uploadRevision = useCallback(
    async (file: File) => {
      if (!document) throw new Error('No document selected.');
      if (!workspaceId) throw new Error('No workspace selected.');
      setBusy(true);
      try {
        const created = await documentApi.createVersion(document.id, workspaceId, file);
        await load(document);
        return created;
      } finally {
        setBusy(false);
      }
    },
    [document, workspaceId, load],
  );

  const requestRestore = useCallback(
    (versionNumber: number) => {
      restoreTarget.current = { id: document?.id ?? '', version: versionNumber };
    },
    [document],
  );

  const confirmRestore = useCallback(async () => {
    const target = restoreTarget.current;
    if (!target || !workspaceId) return;
    restoreTarget.current = null;
    setBusy(true);
    try {
      const updated = await documentApi.restoreVersion(target.id, target.version, workspaceId);
      // The restore rewrites the active revision, so the table row behind the
      // modal is now stale.
      setDocument(updated);
      await load(updated);
    } finally {
      setBusy(false);
    }
  }, [workspaceId, load]);

  return {
    document,
    versions,
    loading,
    error,
    busy,
    open,
    close,
    reload,
    uploadRevision,
    requestRestore,
    confirmRestore,
  };
}
