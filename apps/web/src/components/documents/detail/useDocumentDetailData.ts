'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { documentApi } from '@/lib/api-client';
import type {
  DocumentResponse,
  DocumentAction,
  DocumentVersionResponse,
  DocumentShareResponse,
} from '@/lib/api-client';
import { extensionOf } from '@/lib/document-format';
import { useToast } from '@/components/shared/Toast';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const UPLOAD_SIZE_LIMIT = '100 MB';

export function useDocumentDetailData(
  workspaceId: string,
  documentId: string,
  basePath = 'documents',
) {
  const router = useRouter();
  const { toast } = useToast();

  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [undoBusyId, setUndoBusyId] = useState<string | null>(null);

  const [shares, setShares] = useState<DocumentShareResponse[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sharesError, setSharesError] = useState<string | null>(null);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);

  const [syncingMemory, setSyncingMemory] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagBusy, setTagBusy] = useState(false);

  const blobUrlRef = useRef<string | null>(null);

  const setAndTrackBlobUrl = useCallback((newUrl: string | null) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = newUrl;
    setBlobUrl(newUrl);
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const fetchDocAndContent = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setLoading(true);
    setError(null);
    setContentError(null);

    try {
      const docData = await documentApi.getById(documentId, workspaceId);
      setDoc(docData);
      setTags(docData.metadata?.tags || []);

      try {
        const blob = await documentApi.getContent(documentId, workspaceId, true);
        const url = URL.createObjectURL(blob);
        setAndTrackBlobUrl(url);

        const lowerType = (docData.type || '').toLowerCase();
        const pathExt = extensionOf(docData.path);
        const textExtensions = [
          'txt',
          'md',
          'json',
          'csv',
          'yaml',
          'yml',
          'xml',
          'html',
          'js',
          'ts',
          'jsx',
          'tsx',
          'py',
        ];
        if (
          textExtensions.includes(lowerType) ||
          textExtensions.includes(pathExt) ||
          blob.type.startsWith('text/')
        ) {
          const text = await blob.text();
          setTextContent(text);
        } else {
          setTextContent(null);
        }
      } catch (err) {
        setContentError(err instanceof Error ? err.message : 'Could not load document preview');
        setTextContent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, documentId, setAndTrackBlobUrl]);

  const fetchVersions = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const data = await documentApi.listVersions(documentId, workspaceId);
      setVersions(data);
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : 'Failed to load revisions');
    } finally {
      setVersionsLoading(false);
    }
  }, [workspaceId, documentId]);

  const fetchActions = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await documentApi.actions(documentId, workspaceId);
      setActions(data.actions || []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load audit history');
    } finally {
      setHistoryLoading(false);
    }
  }, [workspaceId, documentId]);

  const fetchShares = useCallback(async () => {
    if (!workspaceId || !documentId) return;
    setSharesLoading(true);
    setSharesError(null);
    try {
      const data = await documentApi.listShares(documentId, workspaceId);
      setShares(data);
    } catch (err) {
      setSharesError(err instanceof Error ? err.message : 'Failed to load sharing information');
    } finally {
      setSharesLoading(false);
    }
  }, [workspaceId, documentId]);

  useEffect(() => {
    void fetchDocAndContent();
    void fetchActions();
    void fetchVersions();
    void fetchShares();
  }, [fetchDocAndContent, fetchActions, fetchVersions, fetchShares]);

  const handleSyncMemory = async () => {
    if (!workspaceId || !documentId || !doc) return;
    setSyncingMemory(true);
    try {
      await documentApi.syncMemory(documentId, workspaceId);
      toast({ tone: 'success', title: 'Memory synced', detail: 'Document ingested into memory.' });
      setDoc((prev) =>
        prev ? { ...prev, metadata: { ...prev.metadata, syncStatus: 'synced' } } : null,
      );
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync failed',
        detail: err instanceof Error ? err.message : 'Memory integration error',
      });
    } finally {
      setSyncingMemory(false);
    }
  };

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId || !documentId) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        tone: 'error',
        title: 'File too large',
        detail: `Revisions must be smaller than ${UPLOAD_SIZE_LIMIT}. This file is ${Math.round(file.size / (1024 * 1024))} MB.`,
      });
      return;
    }

    setVersionBusy(true);
    try {
      await documentApi.createVersion(documentId, workspaceId, file);
      toast({ tone: 'success', title: 'Revision uploaded', detail: `Uploaded ${file.name}` });
      await fetchVersions();
      await fetchDocAndContent();
      if (versionFileInputRef.current) versionFileInputRef.current.value = '';
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Upload failed',
        detail: err instanceof Error ? err.message : 'Could not upload revision',
      });
    } finally {
      setVersionBusy(false);
    }
  };

  const handleRollbackConfirm = async (versionNumber: number) => {
    if (!workspaceId || !documentId) return;
    try {
      await documentApi.restoreVersion(documentId, versionNumber, workspaceId);
      toast({
        tone: 'success',
        title: 'Revision restored',
        detail: `Rolled back to revision ${versionNumber}.`,
      });
      await fetchVersions();
      await fetchDocAndContent();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Restore failed',
        detail: err instanceof Error ? err.message : 'Could not restore revision',
      });
    }
  };

  const handleArchive = async () => {
    if (!workspaceId || !documentId) return;
    try {
      await documentApi.archive(documentId, workspaceId);
      toast({ tone: 'success', title: 'Archived', detail: 'Document moved to archive.' });
      router.push(`/workspace/${workspaceId}/${basePath}`);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Archive failed',
        detail: err instanceof Error ? err.message : 'Could not archive document',
      });
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !documentId) return;
    try {
      await documentApi.delete(documentId, workspaceId);
      toast({ tone: 'success', title: 'Deleted', detail: 'Document deleted permanently.' });
      router.push(`/workspace/${workspaceId}/${basePath}`);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Could not delete document',
      });
    }
  };

  const handleShareRevoke = async (shareId: string) => {
    if (!workspaceId || !documentId) return;
    setRevokeBusyId(shareId);
    try {
      await documentApi.revokeShare(shareId, workspaceId, documentId);
      toast({ tone: 'success', title: 'Share revoked', detail: 'Access removed.' });
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Revoke failed',
        detail: err instanceof Error ? err.message : 'Could not revoke access',
      });
      void fetchShares();
    } finally {
      setRevokeBusyId(null);
    }
  };

  const handleUndoAction = async (actionId: string) => {
    if (!workspaceId || !documentId) return;
    setUndoBusyId(actionId);
    try {
      await documentApi.undo(actionId, workspaceId);
      toast({
        tone: 'success',
        title: 'Action undone',
        detail: 'Operation successfully reverted.',
      });
      await fetchActions();
      await fetchDocAndContent();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Undo failed',
        detail: err instanceof Error ? err.message : 'Could not undo action',
      });
    } finally {
      setUndoBusyId(null);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!clean || tags.includes(clean) || !doc) return;
    setTagBusy(true);
    const updated = [...tags, clean];
    try {
      await documentApi.updateTags(doc.id, workspaceId, updated);
      setTags(updated);
      setDoc((prev) => (prev ? { ...prev, metadata: { ...prev.metadata, tags: updated } } : null));
      setNewTagInput('');
      toast({ tone: 'success', title: 'Tag added', detail: `#${clean}` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to add tag',
        detail: err instanceof Error ? err.message : 'Error adding tag',
      });
    } finally {
      setTagBusy(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!doc) return;
    setTagBusy(true);
    const updated = tags.filter((t) => t !== tagToRemove);
    try {
      await documentApi.updateTags(doc.id, workspaceId, updated);
      setTags(updated);
      setDoc((prev) => (prev ? { ...prev, metadata: { ...prev.metadata, tags: updated } } : null));
      toast({ tone: 'success', title: 'Tag removed', detail: `#${tagToRemove}` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to remove tag',
        detail: err instanceof Error ? err.message : 'Error removing tag',
      });
    } finally {
      setTagBusy(false);
    }
  };

  return {
    doc,
    setDoc,
    blobUrl,
    textContent,
    contentError,
    loading,
    error,
    versions,
    versionsLoading,
    versionsError,
    versionBusy,
    versionFileInputRef,
    actions,
    historyLoading,
    historyError,
    undoBusyId,
    shares,
    sharesLoading,
    sharesError,
    revokeBusyId,
    syncingMemory,
    tags,
    newTagInput,
    setNewTagInput,
    tagBusy,
    fetchDocAndContent,
    fetchVersions,
    fetchActions,
    fetchShares,
    handleSyncMemory,
    handleUploadVersion,
    handleRollbackConfirm,
    handleArchive,
    handleDelete,
    handleShareRevoke,
    handleUndoAction,
    handleAddTag,
    handleRemoveTag,
  };
}
