'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@vaeloom/ui-kit';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PageHeader } from '@/components/shared/Page';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { documentApi } from '@/lib/api-client';
import type {
  DocumentResponse,
  FolderResponse,
  FolderTreeItem,
  DocumentVersionResponse,
} from '@/lib/api-client';

import { DocumentStatsBar } from './DocumentStatsBar';
import { DocumentFolderTree } from './DocumentFolderTree';
import { DocumentUploadQueue } from './DocumentUploadQueue';
import { DocumentShareDialog } from './DocumentShareDialog';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { DocumentMoveDialog } from './DocumentMoveDialog';

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatSize(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes ?? 0);
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function docWorkspaceId(d: DocumentResponse, fallbackWsId?: string): string {
  return (
    (d as unknown as Record<string, string>)['workspace_id'] ??
    (d as unknown as Record<string, string>)['workspaceId'] ??
    fallbackWsId ??
    ''
  );
}

type ScanState = 'clean' | 'quarantined' | 'scanning' | 'unknown';

function scanStateOf(scanStatus: DocumentResponse['scan_status']): ScanState {
  if (scanStatus === 'CLEAN') return 'clean';
  if (scanStatus === 'MALICIOUS' || scanStatus === 'REJECTED') return 'quarantined';
  if (scanStatus === 'PENDING') return 'scanning';
  return 'unknown';
}

function documentVersionOf(doc: DocumentResponse): string | null {
  const raw =
    doc.metadata?.['version'] ??
    doc.metadata?.['version_number'] ??
    doc.metadata?.['versionNumber'];
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
}

const CATEGORY_EXTENSIONS: Record<string, Set<string>> = {
  documents: new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'md', 'markdown', 'odt']),
  spreadsheets: new Set(['csv', 'xlsx', 'xls', 'tsv', 'ods']),
  images: new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'tiff']),
  code: new Set([
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'json',
    'yaml',
    'yml',
    'html',
    'css',
    'sql',
    'sh',
    'bash',
  ]),
};

export interface DocumentsHubProps {
  workspaceId?: string;
  basePath?: 'documents' | 'files';
}

export function DocumentsHub({
  workspaceId: propWorkspaceId,
  basePath = 'documents',
}: DocumentsHubProps) {
  const params = useParams();
  const router = useRouter();
  const currentWorkspaceId =
    propWorkspaceId ?? (params?.['workspaceId'] as string | undefined) ?? '';
  const { toast } = useToast();

  const versionFileInputRef = useRef<HTMLInputElement>(null);

  // Documents State
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  // Selection & Bulk State
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Folders State
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [autoOrganizeBusy, setAutoOrganizeBusy] = useState(false);
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Version History Modal
  const [versionDoc, setVersionDoc] = useState<DocumentResponse | null>(null);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);

  // Document Sharing Modal
  const [shareDoc, setShareDoc] = useState<DocumentResponse | null>(null);

  // Document Move Modal
  const [moveDoc, setMoveDoc] = useState<DocumentResponse | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // Document Content Viewer
  const [viewer, setViewer] = useState<DocumentResponse | null>(null);
  const [viewerContent, setViewerContent] = useState<{
    url: string;
    text?: string;
    unsupported?: boolean;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerUrlRef = useRef<string | null>(null);

  // Rename
  const [renaming, setRenaming] = useState<DocumentResponse | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  // Confirmation dialogs
  const [pendingConfirm, setPendingConfirm] = useState<
    | { kind: 'delete-folder'; folderId: string; name: string }
    | { kind: 'restore-version'; version: number }
    | { kind: 'archive-document'; docId: string; name: string }
    | { kind: 'delete-document'; docId: string; name: string }
    | { kind: 'bulk-delete' }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
    };
  }, [viewerContent?.url]);

  // Fetch Folders
  const fetchFolders = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const [flatList, tree] = await Promise.all([
        documentApi.listFolders(currentWorkspaceId),
        documentApi.getFolderTree(currentWorkspaceId),
      ]);
      setFolders(flatList);
      setFolderTree(tree);
    } catch {
      // Best-effort folder load
    }
  }, [currentWorkspaceId]);

  // Fetch Documents
  const fetchDocuments = useCallback(
    async (includeArchived = showArchived, pageNum = page, folderId = selectedFolderId) => {
      if (!currentWorkspaceId) return;
      setLoading(true);
      setError(null);
      try {
        if (searchQuery.trim()) {
          const searchResults = await documentApi.search(
            currentWorkspaceId,
            searchQuery.trim(),
            folderId || undefined,
          );
          setDocuments(searchResults);
          setTotal(searchResults.length);
        } else {
          const res = await documentApi.list({
            workspace_id: currentWorkspaceId,
            include_archived: includeArchived,
            page: pageNum,
            page_size: PAGE_SIZE,
          });
          let docs =
            res?.documents ?? (res as unknown as { items?: DocumentResponse[] })?.items ?? [];
          if (folderId) {
            docs = docs.filter((d) => d.folder_id === folderId);
          }
          setDocuments(docs);
          setTotal(res?.total ?? docs.length);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    },
    [currentWorkspaceId, showArchived, page, selectedFolderId, searchQuery],
  );

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    void fetchDocuments(showArchived, page, selectedFolderId);
  }, [fetchDocuments, showArchived, page, selectedFolderId]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments(showArchived, 1, selectedFolderId);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchDocuments, showArchived, selectedFolderId]);

  // Bulk Operations
  const toggleSelectAll = useCallback(() => {
    if (selectedDocIds.size === documents.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
    }
  }, [documents, selectedDocIds]);

  const toggleSelectDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDownload = useCallback(async () => {
    if (!currentWorkspaceId || !selectedDocIds.size) return;
    setBulkBusy(true);
    try {
      const blob = await documentApi.bulkDownload(currentWorkspaceId, Array.from(selectedDocIds));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documents_export_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        tone: 'success',
        title: 'Download ready',
        detail: `${selectedDocIds.size} files downloaded as zip.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Bulk download failed',
        detail: err instanceof Error ? err.message : 'Error creating archive',
      });
    } finally {
      setBulkBusy(false);
    }
  }, [currentWorkspaceId, selectedDocIds, toast]);

  const handleBulkArchive = useCallback(async () => {
    if (!currentWorkspaceId || !selectedDocIds.size) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selectedDocIds).map((id) => documentApi.archive(id, currentWorkspaceId)),
      );
      toast({
        tone: 'success',
        title: 'Archived',
        detail: `${selectedDocIds.size} documents moved to archive.`,
      });
      setSelectedDocIds(new Set());
      void fetchDocuments();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Bulk archive failed',
        detail: err instanceof Error ? err.message : 'Error archiving documents',
      });
    } finally {
      setBulkBusy(false);
    }
  }, [currentWorkspaceId, selectedDocIds, fetchDocuments, toast]);

  // Create Folder
  const handleCreateFolder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFolderName.trim() || !currentWorkspaceId) return;
      setFolderBusy(true);
      try {
        await documentApi.createFolder(
          currentWorkspaceId,
          newFolderName.trim(),
          newFolderParentId || undefined,
        );
        toast({
          tone: 'success',
          title: 'Folder created',
          detail: `Folder "${newFolderName}" created.`,
        });
        setNewFolderName('');
        setNewFolderParentId(null);
        setNewFolderOpen(false);
        void fetchFolders();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to create folder',
          detail: err instanceof Error ? err.message : 'Error creating folder',
        });
      } finally {
        setFolderBusy(false);
      }
    },
    [newFolderName, currentWorkspaceId, newFolderParentId, fetchFolders, toast],
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string, name: string) => {
      if (!currentWorkspaceId) return;
      setConfirmBusy(true);
      try {
        await documentApi.deleteFolder(folderId, currentWorkspaceId);
        toast({
          tone: 'success',
          title: 'Folder deleted',
          detail: `Folder "${name}" was removed.`,
        });
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        void fetchFolders();
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete folder failed',
          detail: err instanceof Error ? err.message : 'Error deleting folder',
        });
      } finally {
        setConfirmBusy(false);
        setPendingConfirm(null);
      }
    },
    [currentWorkspaceId, selectedFolderId, fetchFolders, fetchDocuments, toast],
  );

  // Auto-Organize files into smart folders
  const handleAutoOrganize = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setAutoOrganizeBusy(true);
    try {
      const res = await documentApi.autoOrganize(currentWorkspaceId);
      if (res.organized_count > 0) {
        toast({
          tone: 'success',
          title: 'Auto-Organize Complete',
          detail: `Organized ${res.organized_count} document(s) into smart folders: ${res.folders_created.join(', ') || 'existing categories'}.`,
        });
      } else {
        toast({
          tone: 'info',
          title: 'All files organized',
          detail: 'No unorganized documents found in workspace.',
        });
      }
      void fetchFolders();
      void fetchDocuments();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Auto-organize failed',
        detail: err instanceof Error ? err.message : 'Error organizing files',
      });
    } finally {
      setAutoOrganizeBusy(false);
    }
  }, [currentWorkspaceId, fetchFolders, fetchDocuments, toast]);

  // Synchronize a single document into Memory Store
  const handleSyncMemory = useCallback(
    async (doc: DocumentResponse) => {
      if (!currentWorkspaceId) return;
      setSyncingDocId(doc.id);
      try {
        const res = await documentApi.syncMemory(doc.id, currentWorkspaceId);
        toast({
          tone: 'success',
          title: 'Synced to Memory',
          detail: `Document "${getFileName(doc.path)}" is indexed into workspace memory.`,
        });
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  metadata: {
                    ...(d.metadata || {}),
                    sync_status: 'synced',
                    memory_id: res.memoryId,
                    synced_at: new Date().toISOString(),
                  },
                }
              : d,
          ),
        );
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Memory sync failed',
          detail: err instanceof Error ? err.message : 'Error syncing document to memory',
        });
      } finally {
        setSyncingDocId(null);
      }
    },
    [currentWorkspaceId, toast],
  );

  // Bulk Synchronize all selected documents into Memory
  const handleBulkSyncMemory = useCallback(async () => {
    if (!currentWorkspaceId || selectedDocIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await documentApi.bulkSyncMemory(currentWorkspaceId, Array.from(selectedDocIds));
      toast({
        tone: 'success',
        title: 'Bulk Memory Sync Complete',
        detail: `Successfully indexed ${res.syncedCount} document(s) into Memory.`,
      });
      void fetchDocuments();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Bulk memory sync failed',
        detail: err instanceof Error ? err.message : 'Error syncing documents to memory',
      });
    } finally {
      setBulkBusy(false);
    }
  }, [currentWorkspaceId, selectedDocIds, fetchDocuments, toast]);

  // Upload an entire folder hierarchy
  const handleFolderUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !currentWorkspaceId) return;

      const fileList = Array.from(files);
      toast({
        tone: 'info',
        title: 'Folder Upload Started',
        detail: `Uploading ${fileList.length} files with directory hierarchy...`,
      });

      const folderMap = new Map<string, string>();

      async function getOrCreatePath(parts: string[]): Promise<string | null> {
        let currentParent: string | null = selectedFolderId || null;
        let accumulated = currentParent ? `${currentParent}:` : '';
        for (const part of parts) {
          if (!part.trim()) continue;
          accumulated += `/${part.trim()}`;
          if (folderMap.has(accumulated)) {
            currentParent = folderMap.get(accumulated)!;
            continue;
          }
          try {
            const created = await documentApi.createFolder(
              currentWorkspaceId,
              part.trim(),
              currentParent,
            );
            currentParent = created.id;
            folderMap.set(accumulated, created.id);
          } catch {
            try {
              const list = await documentApi.listFolders(
                currentWorkspaceId,
                currentParent || undefined,
              );
              const found = list.find((f) => f.name.toLowerCase() === part.trim().toLowerCase());
              if (found) {
                currentParent = found.id;
                folderMap.set(accumulated, found.id);
              }
            } catch {
              // fallback
            }
          }
        }
        return currentParent;
      }

      let successCount = 0;
      for (const file of fileList) {
        try {
          const relativePath = file.webkitRelativePath || file.name;
          let targetFolder: string | null = selectedFolderId || null;
          if (relativePath.includes('/')) {
            const parts = relativePath.split('/');
            parts.pop(); // remove file name
            targetFolder = await getOrCreatePath(parts);
          }
          await documentApi.upload(file, currentWorkspaceId, targetFolder);
          successCount++;
        } catch (err) {
          console.error('Failed to upload file from folder:', file.name, err);
        }
      }

      toast({
        tone: 'success',
        title: 'Folder Upload Complete',
        detail: `Successfully uploaded ${successCount} of ${fileList.length} files.`,
      });
      if (folderInputRef.current) folderInputRef.current.value = '';
      void fetchFolders();
      void fetchDocuments();
    },
    [currentWorkspaceId, selectedFolderId, fetchFolders, fetchDocuments, toast],
  );

  // Versions Modal
  const openVersions = useCallback(
    async (doc: DocumentResponse) => {
      setVersionDoc(doc);
      setVersionsLoading(true);
      try {
        const vList = await documentApi.listVersions(
          doc.id,
          docWorkspaceId(doc, currentWorkspaceId),
        );
        setVersions(vList);
      } catch {
        toast({ tone: 'error', title: 'Error', detail: 'Failed to load versions' });
      } finally {
        setVersionsLoading(false);
      }
    },
    [currentWorkspaceId, toast],
  );

  const handleUploadVersion = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !versionDoc || !currentWorkspaceId) return;
      setVersionBusy(true);
      try {
        const newVer = await documentApi.createVersion(versionDoc.id, currentWorkspaceId, file);
        toast({
          tone: 'success',
          title: 'New version uploaded',
          detail: `Version ${newVer.versionNumber ?? newVer.version_number} added.`,
        });
        const vList = await documentApi.listVersions(versionDoc.id, currentWorkspaceId);
        setVersions(vList);
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to upload version',
          detail: err instanceof Error ? err.message : 'Error uploading version',
        });
      } finally {
        setVersionBusy(false);
        if (versionFileInputRef.current) versionFileInputRef.current.value = '';
      }
    },
    [versionDoc, currentWorkspaceId, fetchDocuments, toast],
  );

  const handleRestoreVersion = useCallback(
    async (vNum: number) => {
      if (!versionDoc || !currentWorkspaceId) return;
      setVersionBusy(true);
      try {
        const updated = await documentApi.restoreVersion(versionDoc.id, vNum, currentWorkspaceId);
        toast({
          tone: 'success',
          title: 'Version restored',
          detail: `Active document now at revision ${vNum}`,
        });
        setVersionDoc(updated);
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Restore version failed',
          detail: err instanceof Error ? err.message : 'Error restoring version',
        });
      } finally {
        setVersionBusy(false);
        setConfirmBusy(false);
        setPendingConfirm(null);
      }
    },
    [versionDoc, currentWorkspaceId, fetchDocuments, toast],
  );

  // Viewer Modal
  const openViewer = useCallback(
    async (doc: DocumentResponse) => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
      setViewer(doc);
      setViewerContent(null);
      setViewerLoading(true);
      try {
        const rawBlob = await documentApi.getContent(
          doc.id,
          docWorkspaceId(doc, currentWorkspaceId),
          true,
        );
        const ext = (doc.path.split('.').pop() || '').toLowerCase();
        let resolvedMime = rawBlob.type || 'application/octet-stream';
        if (ext === 'pdf') resolvedMime = 'application/pdf';
        else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)) {
          resolvedMime =
            ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        } else if (
          [
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
            'tsx',
            'py',
          ].includes(ext)
        ) {
          resolvedMime =
            ext === 'json'
              ? 'application/json'
              : ext === 'csv'
                ? 'text/csv'
                : ext === 'html'
                  ? 'text/html'
                  : 'text/plain';
        }
        const typedBlob = new Blob([await rawBlob.arrayBuffer()], { type: resolvedMime });
        const url = URL.createObjectURL(typedBlob);
        viewerUrlRef.current = url;
        const type = (doc.type || '').toLowerCase();
        const textTypes = new Set([
          'text',
          'markdown',
          'csv',
          'json',
          'html',
          'xml',
          'yaml',
          'code',
        ]);
        const imageTypes = new Set([
          'image',
          'png',
          'jpg',
          'jpeg',
          'webp',
          'gif',
          'svg',
          'bmp',
          'ico',
        ]);

        if (
          textTypes.has(type) ||
          [
            'txt',
            'md',
            'json',
            'csv',
            'yaml',
            'yml',
            'xml',
            'html',
            'py',
            'js',
            'ts',
            'tsx',
          ].includes(ext)
        ) {
          const text = await typedBlob.text();
          setViewerContent({ url, text });
        } else if (
          imageTypes.has(type) ||
          ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext) ||
          ext === 'pdf' ||
          type === 'pdf'
        ) {
          setViewerContent({ url });
        } else {
          setViewerContent({ url, unsupported: true });
        }
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Preview failed',
          detail: err instanceof Error ? err.message : 'Could not fetch content',
        });
      } finally {
        setViewerLoading(false);
      }
    },
    [currentWorkspaceId, viewerContent?.url, toast],
  );

  // Single Delete (permanent)
  const handleDeleteDoc = useCallback(
    async (docId: string, name: string) => {
      if (!currentWorkspaceId) return;
      setConfirmBusy(true);
      try {
        await documentApi.delete(docId, currentWorkspaceId);
        toast({ tone: 'success', title: 'Deleted', detail: `${name} permanently deleted.` });
        setSelectedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        void fetchDocuments();
        void fetchFolders();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete failed',
          detail: err instanceof Error ? err.message : 'Error deleting document',
        });
      } finally {
        setConfirmBusy(false);
        setPendingConfirm(null);
      }
    },
    [currentWorkspaceId, fetchDocuments, fetchFolders, toast],
  );

  // Bulk Delete (permanent)
  const handleBulkDelete = useCallback(async () => {
    if (!currentWorkspaceId || !selectedDocIds.size) return;
    setBulkBusy(true);
    setConfirmBusy(true);
    try {
      const res = await documentApi.bulkDelete(currentWorkspaceId, Array.from(selectedDocIds));
      toast({
        tone: 'success',
        title: 'Deleted',
        detail: `${res.deleted_count} document(s) permanently deleted.`,
      });
      setSelectedDocIds(new Set());
      void fetchDocuments();
      void fetchFolders();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Bulk delete failed',
        detail: err instanceof Error ? err.message : 'Error deleting documents',
      });
    } finally {
      setBulkBusy(false);
      setConfirmBusy(false);
      setPendingConfirm(null);
    }
  }, [currentWorkspaceId, selectedDocIds, fetchDocuments, fetchFolders, toast]);

  // Single Archive
  const handleArchiveDoc = useCallback(
    async (docId: string, name: string) => {
      if (!currentWorkspaceId) return;
      setConfirmBusy(true);
      try {
        await documentApi.archive(docId, currentWorkspaceId);
        toast({ tone: 'success', title: 'Archived', detail: `${name} moved to archive.` });
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Archive failed',
          detail: err instanceof Error ? err.message : 'Error archiving document',
        });
      } finally {
        setConfirmBusy(false);
        setPendingConfirm(null);
      }
    },
    [currentWorkspaceId, fetchDocuments, toast],
  );

  // Single Restore
  const handleRestoreDoc = useCallback(
    async (docId: string, name: string) => {
      if (!currentWorkspaceId) return;
      try {
        await documentApi.restore(docId, currentWorkspaceId);
        toast({ tone: 'success', title: 'Restored', detail: `${name} restored to workspace.` });
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Restore failed',
          detail: err instanceof Error ? err.message : 'Error restoring document',
        });
      }
    },
    [currentWorkspaceId, fetchDocuments, toast],
  );

  // Rename Doc
  const handleRenameDoc = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!renaming || !renameValue.trim() || !currentWorkspaceId) return;
      setRenameBusy(true);
      try {
        await documentApi.rename(renaming.id, currentWorkspaceId, renameValue.trim());
        toast({ tone: 'success', title: 'Renamed', detail: `Document renamed to ${renameValue}.` });
        setRenaming(null);
        setRenameValue('');
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Rename failed',
          detail: err instanceof Error ? err.message : 'Error renaming document',
        });
      } finally {
        setRenameBusy(false);
      }
    },
    [renaming, renameValue, currentWorkspaceId, fetchDocuments, toast],
  );

  // Filtered documents by category
  const filteredDocuments = useMemo(() => {
    const list = documents || [];
    if (selectedCategory === 'all') return list;
    if (selectedCategory === 'vault_notes') {
      return list.filter((d) => {
        const cat = d.metadata?.['category'];
        const isVault = cat === 'vault_note' || d.type === 'vault_note';
        const inVaultFolder = folders.find((f) => f.id === d.folder_id)?.name === 'Vault Notes';
        return isVault || inVaultFolder;
      });
    }
    const allowed = CATEGORY_EXTENSIONS[selectedCategory];
    if (!allowed) return list;
    return list.filter((d) => {
      const ext = d.path.split('.').pop()?.toLowerCase() ?? '';
      return allowed.has(ext) || allowed.has(d.type?.toLowerCase());
    });
  }, [documents, selectedCategory, folders]);

  return (
    <div className="space-y-6">
      {/* Primary Page Header — H1 "Workspace Files" is guaranteed for E2E tests */}
      <PageHeader
        title="Workspace Files"
        description="Enterprise document management, malware defense verification, AI audits, and version tracking."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoOrganize}
              disabled={autoOrganizeBusy}
              className="btn-secondary text-sm flex items-center gap-2 hover:border-primary/50 text-text transition-colors"
              title="Automatically categorize unorganized files into smart folders with clean names"
            >
              <svg
                className={`w-4 h-4 text-primary ${autoOrganizeBusy ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <span>{autoOrganizeBusy ? 'Organizing...' : 'Auto-Organize Files'}</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="btn-secondary text-sm flex items-center gap-2 hover:border-primary/50 text-text transition-colors"
              title="Upload an entire directory structure with automatic nested folder creation"
            >
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>Upload Folder</span>
            </button>

            <button
              type="button"
              onClick={() => setNewFolderOpen(true)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>New Folder</span>
            </button>
          </div>
        }
      />

      {/* Integrated Stats Bar */}
      <DocumentStatsBar documents={documents} />

      {/* Integrated Upload Queue & Drag-and-Drop Area (Includes accessible input[type="file"] & folder support) */}
      <DocumentUploadQueue
        workspaceId={currentWorkspaceId}
        targetFolderId={selectedFolderId}
        onUploadComplete={(newDoc) => {
          setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
          toast({ tone: 'success', title: 'Upload complete', detail: newDoc.path });
        }}
        onFolderCreated={() => void fetchFolders()}
        onAllCompleted={() => void fetchDocuments()}
      />

      {/* Main Workspace Layout (Folders Sidebar + Document Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Folders Rail */}
        <div className="lg:col-span-1 p-4 rounded-xl border border-border/70 bg-surface/40 backdrop-blur-sm">
          <DocumentFolderTree
            workspaceId={currentWorkspaceId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(fId) => setSelectedFolderId(fId)}
            folders={folders}
            folderTree={folderTree}
            documents={documents}
            onFolderCreated={() => void fetchFolders()}
            onFolderDeleted={() => {
              void fetchFolders();
              void fetchDocuments();
            }}
          />
        </div>

        {/* Document Content Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Folder Filter Banner */}
          {selectedFolderId && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs text-text">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-primary shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span className="font-semibold">Viewing folder:</span>
                <span className="px-2 py-0.5 rounded bg-surface border border-border font-medium text-primary">
                  {folders.find((f) => f.id === selectedFolderId)?.name || 'Selected Folder'}
                </span>
                <span className="text-text-muted">({filteredDocuments.length} files)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="text-primary hover:underline font-medium text-xs flex items-center gap-1"
              >
                <span>Show All Files</span>
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          )}

          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border/70 bg-surface/40">
            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Files' },
                { id: 'vault_notes', label: 'Vault Notes' },
                { id: 'documents', label: 'Documents' },
                { id: 'spreadsheets', label: 'Spreadsheets' },
                { id: 'images', label: 'Images' },
                { id: 'code', label: 'Code' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCategory(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === id
                      ? 'bg-primary text-primary-fg shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover/60'
                  }`}
                >
                  {id === 'vault_notes' && (
                    <svg
                      className="w-3 h-3 text-purple-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <polygon
                        points="12,2 20,9 17,21 7,21 4,9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Search Input & Archive Toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <svg
                  className="w-4 h-4 absolute left-3 top-2.5 text-text-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workspace files..."
                  aria-label="Search workspace files"
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowArchived((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showArchived
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-surface text-text-muted border-border hover:text-text'
                }`}
                title={showArchived ? 'Hide archived files' : 'Show archived files'}
              >
                {showArchived ? 'Archived: On' : 'Archived'}
              </button>
            </div>
          </div>

          {/* Bulk Selection Bar — MUST render exact string "{n} document(s) selected" */}
          {selectedDocIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur-sm">
              <span className="text-xs font-semibold text-text">
                {selectedDocIds.size} document(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkDownload}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Download (.zip)
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkSyncMemory}
                  className="btn-secondary text-xs px-3 py-1.5 text-primary hover:bg-primary/10 hover:border-primary/40 flex items-center gap-1.5"
                  title="Index selected documents into Memory"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-primary ${bulkBusy ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Sync to Memory</span>
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkArchive}
                  className="btn-secondary text-xs px-3 py-1.5 text-warning hover:bg-warning/10 hover:border-warning/30"
                >
                  Archive Selected
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setBulkMoveOpen(true)}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  title="Move selected documents to a folder"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  Move Selected
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setPendingConfirm({ kind: 'bulk-delete' })}
                  className="btn-secondary text-xs px-3 py-1.5 text-error hover:bg-error/10 hover:border-error/30 flex items-center gap-1.5"
                  title="Permanently delete selected documents"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDocIds(new Set())}
                  className="text-xs text-text-muted hover:text-text px-2 py-1"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="rounded-xl border border-border/70 overflow-hidden bg-surface/30">
            {loading && documents.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center gap-2">
                <LoadingSpinner size="lg" text="Loading documents..." />
              </div>
            ) : error ? (
              <div role="alert" className="p-8 text-center text-error space-y-2">
                <p className="font-semibold text-sm">Failed to load files</p>
                <p className="text-xs text-error/80">{error}</p>
                <button
                  type="button"
                  onClick={() => void fetchDocuments()}
                  className="btn-secondary text-xs mt-2"
                >
                  Retry
                </button>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm font-semibold text-text">No documents found</p>
                <p className="text-xs text-text-muted">
                  {searchQuery
                    ? 'Try a different search query or filter.'
                    : 'Upload documents to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated/70 border-b border-border/60 text-text-muted">
                    <tr>
                      <th scope="col" className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all documents"
                          checked={
                            selectedDocIds.size === filteredDocuments.length &&
                            filteredDocuments.length > 0
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                      </th>
                      <th scope="col" className="p-3 font-semibold">
                        Name
                      </th>
                      <th scope="col" className="p-3 font-semibold hidden sm:table-cell">
                        Security
                      </th>
                      <th scope="col" className="p-3 font-semibold hidden md:table-cell">
                        Version
                      </th>
                      <th scope="col" className="p-3 font-semibold hidden sm:table-cell">
                        Size
                      </th>
                      <th scope="col" className="p-3 font-semibold hidden lg:table-cell">
                        Updated
                      </th>
                      <th scope="col" className="p-3 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredDocuments.map((doc) => {
                      const fileName = getFileName(doc.path);
                      const isSelected = selectedDocIds.has(doc.id);
                      const scanState = scanStateOf(doc.scan_status);
                      const docVersion = documentVersionOf(doc);
                      const size = (doc.metadata as Record<string, unknown> | undefined)?.['size'];
                      const isArchived = Boolean(doc.deleted_at);
                      const isVaultNote =
                        doc.metadata?.['category'] === 'vault_note' ||
                        doc.type === 'vault_note' ||
                        folders.find((f) => f.id === doc.folder_id)?.name === 'Vault Notes';

                      return (
                        <tr
                          key={doc.id}
                          className={`hover:bg-surface-hover/40 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          {/* Checkbox — labeled for tests */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Select ${fileName}`}
                              checked={isSelected}
                              onChange={() => toggleSelectDoc(doc.id)}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                          </td>

                          {/* Name cell with button for e2e content fetch + detail link */}
                          <td className="p-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* Clicking the fileName button opens preview viewer and fetches /content */}
                              <button
                                type="button"
                                onClick={() => openViewer(doc)}
                                className="font-medium text-text hover:text-primary transition-colors text-left truncate max-w-xs"
                              >
                                {fileName}
                              </button>

                              {/* Link to Document Detail Page */}
                              <Link
                                href={`/workspace/${currentWorkspaceId}/${basePath}/${doc.id}`}
                                className="p-1 rounded text-text-dim hover:text-primary transition-colors"
                                title="Open Document Details"
                                aria-label={`Open details for ${fileName}`}
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </Link>

                              {/* Vault Synced badge */}
                              {isVaultNote && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono shrink-0 shadow-sm"
                                  title="Synchronized with Obsidian Vault"
                                >
                                  <svg
                                    className="w-3 h-3 text-purple-400"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <polygon
                                      points="12,2 20,9 17,21 7,21 4,9"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                  Vault Synced
                                </span>
                              )}

                              {/* Memory Sync status badge */}
                              {doc.metadata?.['sync_status'] === 'synced' || isVaultNote ? (
                                <Link
                                  href={`/workspace/${currentWorkspaceId}/memory?query=${encodeURIComponent(fileName)}`}
                                  className="inline-flex items-center gap-1 text-[10px] text-primary/90 hover:text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors"
                                  title="Dynamically indexed in Memory. Click to view in Memory."
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  Memory Synced
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  disabled={syncingDocId === doc.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleSyncMemory(doc);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-primary bg-surface hover:bg-surface-hover border border-border px-1.5 py-0.5 rounded font-mono shrink-0 transition-colors disabled:opacity-50"
                                  title="Click to sync document into Memory"
                                >
                                  <svg
                                    className={`w-2.5 h-2.5 ${syncingDocId === doc.id ? 'animate-spin' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  <span>
                                    {syncingDocId === doc.id ? 'Syncing...' : 'Sync Memory'}
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Tags display */}
                            {Array.isArray(doc.metadata?.['tags']) &&
                              (doc.metadata['tags'] as string[]).length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {(doc.metadata['tags'] as string[]).slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface border border-border/70 text-text-muted font-medium"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                  {(doc.metadata['tags'] as string[]).length > 3 && (
                                    <span className="text-[10px] text-text-dim">
                                      +{(doc.metadata['tags'] as string[]).length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                            {/* Mobile metadata summary when table columns are hidden on small screens */}
                            <div className="flex sm:hidden items-center gap-2 text-[11px] text-text-dim mt-1">
                              <span>{formatSize(size)}</span>
                              <span>•</span>
                              <span
                                className={
                                  scanState === 'clean'
                                    ? 'text-success'
                                    : scanState === 'quarantined'
                                      ? 'text-error'
                                      : scanState === 'scanning'
                                        ? 'text-warning'
                                        : 'text-text-dim'
                                }
                              >
                                {scanState === 'clean'
                                  ? 'Clean'
                                  : scanState === 'quarantined'
                                    ? 'Quarantined'
                                    : scanState === 'scanning'
                                      ? 'Scanning'
                                      : 'Unscanned'}
                              </span>
                              <span>•</span>
                              <span>{formatDate(doc.updated_at)}</span>
                            </div>
                          </td>

                          {/* Security Status */}
                          <td className="p-3 hidden sm:table-cell">
                            {scanState === 'clean' && (
                              <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full font-medium">
                                <span aria-hidden="true">✓</span> Clean
                              </span>
                            )}
                            {scanState === 'scanning' && (
                              <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full font-medium">
                                <span aria-hidden="true">◌</span> Scanning
                              </span>
                            )}
                            {scanState === 'quarantined' && (
                              <span className="inline-flex items-center gap-1 text-xs text-error bg-error/10 border border-error/30 px-2 py-0.5 rounded-full font-medium">
                                <span aria-hidden="true">⚠</span> Quarantined
                              </span>
                            )}
                            {scanState === 'unknown' && (
                              <span className="text-text-dim text-xs">Not reported</span>
                            )}
                          </td>

                          {/* Version */}
                          <td className="p-3 hidden md:table-cell">
                            {docVersion ? (
                              <button
                                type="button"
                                onClick={() => openVersions(doc)}
                                className="font-mono text-xs px-2 py-0.5 rounded bg-surface-200 text-text hover:bg-surface-active"
                                title="View Version History"
                              >
                                v{docVersion}
                              </button>
                            ) : (
                              <span className="text-text-dim text-xs">Not reported</span>
                            )}
                          </td>

                          {/* Size */}
                          <td className="p-3 font-mono text-text-muted hidden sm:table-cell">
                            {formatSize(size)}
                          </td>

                          {/* Updated */}
                          <td className="p-3 text-text-muted hidden lg:table-cell">
                            {formatDate(doc.updated_at)}
                          </td>

                          {/* Quick Actions Icons */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Preview Action */}
                              <button
                                type="button"
                                onClick={() => openViewer(doc)}
                                className="p-1.5 text-text-muted hover:text-text rounded hover:bg-surface-active"
                                title="Preview Document"
                                aria-label={`View ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>

                              {/* Share Action */}
                              <button
                                type="button"
                                onClick={() => setShareDoc(doc)}
                                className="p-1.5 text-text-muted hover:text-text rounded hover:bg-surface-active"
                                title="Share Document"
                                aria-label={`Share ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                  />
                                </svg>
                              </button>

                              {/* Direct Detail Link */}
                              <Link
                                href={`/workspace/${currentWorkspaceId}/${basePath}/${doc.id}`}
                                className="p-1.5 text-text-muted hover:text-text rounded hover:bg-surface-active"
                                title="Open Subpage"
                                aria-label={`Detail for ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </Link>

                              {/* Chat with Document (@document) */}
                              <Link
                                href={`/workspace/${currentWorkspaceId}/chat?docId=${doc.id}&docName=${encodeURIComponent(fileName)}`}
                                className="p-1.5 text-text-muted hover:text-primary rounded hover:bg-primary/10 transition-colors"
                                title="Chat with Document (@document)"
                                aria-label={`Chat with ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                              </Link>

                              {/* Sync with Memory */}
                              <button
                                type="button"
                                disabled={syncingDocId === doc.id}
                                onClick={() => void handleSyncMemory(doc)}
                                className="p-1.5 text-text-muted hover:text-primary rounded hover:bg-primary/10 transition-colors"
                                title="Sync with Memory"
                                aria-label={`Sync ${fileName} to Memory`}
                              >
                                <svg
                                  className={`w-4 h-4 text-primary ${syncingDocId === doc.id ? 'animate-spin' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                              </button>

                              {/* More (Rename) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setRenaming(doc);
                                  setRenameValue(fileName);
                                }}
                                className="p-1.5 text-text-muted hover:text-text rounded hover:bg-surface-active"
                                title="Rename File"
                                aria-label={`Rename ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>

                              {/* Move to Folder */}
                              <button
                                type="button"
                                onClick={() => setMoveDoc(doc)}
                                className="p-1.5 text-text-muted hover:text-text rounded hover:bg-surface-active"
                                title="Move to Folder"
                                aria-label={`Move ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                  />
                                </svg>
                              </button>

                              {/* Archive or Restore */}
                              {isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreDoc(doc.id, fileName)}
                                  className="p-1.5 text-success hover:text-success-hover rounded hover:bg-success/10"
                                  title="Restore Document"
                                  aria-label={`Restore ${fileName}`}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingConfirm({
                                      kind: 'archive-document',
                                      docId: doc.id,
                                      name: fileName,
                                    })
                                  }
                                  className="p-1.5 text-text-muted hover:text-warning rounded hover:bg-warning/10"
                                  title="Archive Document"
                                  aria-label={`Archive ${fileName}`}
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                    />
                                  </svg>
                                </button>
                              )}

                              {/* Permanent Delete Action */}
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingConfirm({
                                    kind: 'delete-document',
                                    docId: doc.id,
                                    name: fileName,
                                  })
                                }
                                className="p-1.5 text-text-muted hover:text-error rounded hover:bg-error/10"
                                title="Delete Document permanently"
                                aria-label={`Delete ${fileName}`}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(viewer)}
        onClose={() => setViewer(null)}
        document={viewer}
        content={viewerContent}
        loading={viewerLoading}
        workspaceId={currentWorkspaceId}
      />

      {/* Integrated Document Share Dialog */}
      <DocumentShareDialog
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        documentId={shareDoc?.id ?? ''}
        workspaceId={currentWorkspaceId}
        documentName={shareDoc ? getFileName(shareDoc.path) : ''}
        onShareCreated={() => void fetchDocuments()}
      />

      {/* Version History Modal */}
      {versionDoc && (
        <Modal
          isOpen={Boolean(versionDoc)}
          onClose={() => setVersionDoc(null)}
          title={`Version History - ${getFileName(versionDoc.path)}`}
          size="lg"
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-xs text-text-muted">Manage revisions or compare changes</span>
              <button
                type="button"
                onClick={() => versionFileInputRef.current?.click()}
                disabled={versionBusy}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Upload Revision
              </button>
              <input
                ref={versionFileInputRef}
                type="file"
                className="hidden"
                onChange={handleUploadVersion}
              />
            </div>

            {versionsLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" text="Loading versions..." />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-text-muted p-4 text-center">No revision history found.</p>
            ) : (
              <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
                {versions.map((v) => {
                  const num = v.versionNumber ?? v.version_number ?? 0;
                  const date = v.createdAt ?? v.created_at;
                  return (
                    <div
                      key={v.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs bg-surface/30"
                    >
                      <div>
                        <p className="font-semibold text-text">Version {num}</p>
                        <p className="text-[11px] text-text-dim">
                          Created {date ? new Date(date).toLocaleString() : '—'}
                          {v.sizeBytes && ` · ${formatSize(v.sizeBytes)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingConfirm({ kind: 'restore-version', version: num })}
                        disabled={versionBusy}
                        className="btn-secondary text-xs px-2.5 py-1"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Create Folder Modal */}
      {newFolderOpen && (
        <Modal
          isOpen={newFolderOpen}
          onClose={() => setNewFolderOpen(false)}
          title="Create New Folder"
        >
          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="folder-name-input"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                Folder Name
              </label>
              <input
                id="folder-name-input"
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Legal, Contracts, Resumes"
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-text"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={folderBusy || !newFolderName.trim()}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {folderBusy ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Rename Document Modal */}
      {renaming && (
        <Modal
          isOpen={Boolean(renaming)}
          onClose={() => setRenaming(null)}
          title={`Rename ${getFileName(renaming.path)}`}
        >
          <form onSubmit={handleRenameDoc} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="rename-input"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                New File Name
              </label>
              <input
                id="rename-input"
                type="text"
                required
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-text"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameBusy || !renameValue.trim()}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {renameBusy ? 'Renaming...' : 'Save Name'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Single Document Move Dialog */}
      {moveDoc && (
        <DocumentMoveDialog
          isOpen={Boolean(moveDoc)}
          onClose={() => setMoveDoc(null)}
          document={moveDoc}
          workspaceId={currentWorkspaceId}
          folders={folders}
          onMoved={(_targetFolderId, _newPath) => {
            toast({
              tone: 'success',
              title: 'Document moved',
              detail: 'Document moved successfully.',
            });
            void fetchFolders();
            void fetchDocuments();
          }}
        />
      )}

      {/* Bulk Move Dialog */}
      {bulkMoveOpen && (
        <DocumentMoveDialog
          isOpen={bulkMoveOpen}
          onClose={() => setBulkMoveOpen(false)}
          document={{
            id: 'bulk-placeholder',
            workspace_id: currentWorkspaceId,
            path: `${selectedDocIds.size} Selected Documents`,
            folder_id: selectedFolderId,
            type: 'folder',
            status: 'AVAILABLE',
            scan_status: 'CLEAN',
            metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          }}
          workspaceId={currentWorkspaceId}
          folders={folders}
          onMove={async (targetFolderId) => {
            setBulkBusy(true);
            try {
              await Promise.all(
                Array.from(selectedDocIds).map((id) =>
                  documentApi.move(id, currentWorkspaceId, targetFolderId),
                ),
              );
              toast({
                tone: 'success',
                title: 'Documents moved',
                detail: `Moved ${selectedDocIds.size} document(s) successfully.`,
              });
              setSelectedDocIds(new Set());
              void fetchFolders();
              void fetchDocuments();
            } catch (err) {
              toast({
                tone: 'error',
                title: 'Bulk move failed',
                detail: err instanceof Error ? err.message : 'Error moving documents',
              });
            } finally {
              setBulkBusy(false);
            }
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm?.kind === 'delete-folder') {
            void handleDeleteFolder(pendingConfirm.folderId, pendingConfirm.name);
          } else if (pendingConfirm?.kind === 'restore-version') {
            void handleRestoreVersion(pendingConfirm.version);
          } else if (pendingConfirm?.kind === 'archive-document') {
            void handleArchiveDoc(pendingConfirm.docId, pendingConfirm.name);
          } else if (pendingConfirm?.kind === 'delete-document') {
            void handleDeleteDoc(pendingConfirm.docId, pendingConfirm.name);
          } else if (pendingConfirm?.kind === 'bulk-delete') {
            void handleBulkDelete();
          } else {
            setPendingConfirm(null);
          }
        }}
        title={
          pendingConfirm?.kind === 'delete-folder'
            ? 'Delete folder'
            : pendingConfirm?.kind === 'restore-version'
              ? 'Restore version'
              : pendingConfirm?.kind === 'delete-document'
                ? 'Permanently delete document'
                : pendingConfirm?.kind === 'bulk-delete'
                  ? 'Permanently delete selected documents'
                  : 'Archive document'
        }
        message={
          pendingConfirm?.kind === 'delete-folder'
            ? `Delete folder "${pendingConfirm.name}"? Documents inside it will move to workspace root.`
            : pendingConfirm?.kind === 'restore-version'
              ? `Restore version ${pendingConfirm.version}? This creates a new active revision.`
              : pendingConfirm?.kind === 'delete-document'
                ? `Are you sure you want to permanently delete "${pendingConfirm.name}"? This will remove the file from storage and cannot be undone.`
                : pendingConfirm?.kind === 'bulk-delete'
                  ? `Are you sure you want to permanently delete ${selectedDocIds.size} document(s)? This will remove them from storage and cannot be undone.`
                  : `Archive document "${pendingConfirm?.name}"? You can restore it later.`
        }
        confirmLabel={confirmBusy ? 'Working...' : 'Confirm'}
        variant={
          pendingConfirm?.kind === 'delete-folder' ||
          pendingConfirm?.kind === 'archive-document' ||
          pendingConfirm?.kind === 'delete-document' ||
          pendingConfirm?.kind === 'bulk-delete'
            ? 'danger'
            : 'default'
        }
      />

      {/* Hidden input for directory upload (placed at bottom so DocumentUploadQueue input is primary) */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderUpload}
      />
    </div>
  );
}
export default DocumentsHub;
