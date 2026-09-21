'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Modal } from '@vaeloom/ui-kit';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/Toast';
import { documentApi, agentApi, temporalApi } from '@/lib/api-client';
import type {
  DocumentResponse,
  DocumentAction,
  TemporalWorkflowStatus,
  FolderResponse,
  FolderTreeItem,
  DocumentVersionResponse,
  DocumentShareResponse,
} from '@/lib/api-client';
import { DiffViewer } from '@/components/shared/DiffViewer';

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

function docWorkspaceId(d: DocumentResponse): string {
  return (
    (d as unknown as Record<string, string>)['workspace_id'] ??
    (d as unknown as Record<string, string>)['workspaceId'] ??
    ''
  );
}

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'clean' | 'quarantined' | 'error';
  error?: string;
  doc?: DocumentResponse;
}

const TEXT_TYPES = new Set(['text', 'markdown', 'csv', 'json', 'html', 'xml', 'yaml']);
const IMAGE_TYPES = new Set(['image', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

export default function WorkspaceFilesPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Documents State
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 25;

  // Selection & Bulk State
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Multi-file Upload Queue (Zero Silent Drops)
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  // Folders State
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  // Version History Drawer/Modal
  const [versionDoc, setVersionDoc] = useState<DocumentResponse | null>(null);
  const [versions, setVersions] = useState<DocumentVersionResponse[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);

  // Document Sharing Modal
  const [shareDoc, setShareDoc] = useState<DocumentResponse | null>(null);
  const [shares, setShares] = useState<DocumentShareResponse[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [sharePermission, setSharePermission] = useState('READ');
  const [shareExpiresAt, setShareExpiresAt] = useState('');
  const [shareBusy, setShareBusy] = useState(false);

  // Document Content Viewer
  const [viewer, setViewer] = useState<DocumentResponse | null>(null);
  const [viewerContent, setViewerContent] = useState<{
    url: string;
    text?: string;
    unsupported?: boolean;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerUrlRef = useRef<string | null>(null);

  // Rename & History
  const [renaming, setRenaming] = useState<DocumentResponse | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [history, setHistory] = useState<DocumentResponse | null>(null);
  const [actions, setActions] = useState<DocumentAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Ingestion tracking
  const [ingestMap, setIngestMap] = useState<
    Record<string, TemporalWorkflowStatus | { status: string; error?: string }>
  >({});
  const [ingestBusy, setIngestBusy] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
    };
  }, [viewerContent?.url]);

  // Fetch Folders
  const fetchFolders = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [flatList, tree] = await Promise.all([
        documentApi.listFolders(workspaceId),
        documentApi.getFolderTree(workspaceId),
      ]);
      setFolders(flatList);
      setFolderTree(tree);
    } catch {
      // Best-effort folder load
    }
  }, [workspaceId]);

  // Fetch Documents
  const fetchDocuments = useCallback(
    async (includeArchived = showArchived, pageNum = page, folderId = selectedFolderId) => {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);
      try {
        if (searchQuery.trim()) {
          const searchResults = await documentApi.search(
            workspaceId,
            searchQuery.trim(),
            folderId || undefined,
          );
          setDocuments(searchResults);
          setTotal(searchResults.length);
        } else {
          const res = await documentApi.list({
            workspace_id: workspaceId,
            include_archived: includeArchived,
            page: pageNum,
            page_size: PAGE_SIZE,
          });
          let docs = res.documents;
          if (folderId) {
            docs = docs.filter((d) => d.folder_id === folderId);
          }
          setDocuments(docs);
          setTotal(res.total);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, showArchived, page, selectedFolderId, searchQuery],
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

  // Multi-File Queue Processor (Zero Silent Drops)
  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const newItems: QueueItem[] = list.map((f) => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file: f,
      name: f.name,
      size: f.size,
      progress: 0,
      status: 'queued',
    }));
    setUploadQueue((prev) => [...prev, ...newItems]);
    setAriaAnnouncement(`Added ${list.length} file(s) to the upload queue.`);
  }, []);

  useEffect(() => {
    if (!workspaceId || isUploading) return;
    const nextItem = uploadQueue.find((q) => q.status === 'queued');
    if (!nextItem) return;

    setIsUploading(true);
    const runUpload = async () => {
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'uploading', progress: 5 } : q)),
      );
      try {
        const doc = await documentApi.uploadWithProgress(nextItem.file, workspaceId, (percent) => {
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === nextItem.id ? { ...q, progress: percent } : q)),
          );
        });

        const scanStatus = doc.scan_status === 'MALICIOUS' ? 'quarantined' : 'clean';
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === nextItem.id ? { ...q, status: scanStatus, progress: 100, doc } : q,
          ),
        );
        setDocuments((prev) => [doc, ...prev]);
        setAriaAnnouncement(`Upload complete: ${doc.path}`);
        toast({ tone: 'success', title: 'Upload complete', detail: doc.path });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'error', error: msg } : q)),
        );
        setAriaAnnouncement(`Upload failed for ${nextItem.name}: ${msg}`);
        toast({ tone: 'error', title: 'Upload failed', detail: `${nextItem.name}: ${msg}` });
      } finally {
        setIsUploading(false);
      }
    };
    void runUpload();
  }, [uploadQueue, isUploading, workspaceId, toast]);

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
    if (!workspaceId || !selectedDocIds.size) return;
    setBulkBusy(true);
    try {
      const blob = await documentApi.bulkDownload(workspaceId, Array.from(selectedDocIds));
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
  }, [workspaceId, selectedDocIds, toast]);

  const handleBulkArchive = useCallback(async () => {
    if (!workspaceId || !selectedDocIds.size) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selectedDocIds).map((id) => documentApi.archive(id, workspaceId)),
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
  }, [workspaceId, selectedDocIds, fetchDocuments, toast]);

  // Folder Operations
  const handleCreateFolder = useCallback(async () => {
    if (!workspaceId || !newFolderName.trim()) return;
    setFolderBusy(true);
    try {
      await documentApi.createFolder(workspaceId, newFolderName.trim(), newFolderParentId);
      toast({ tone: 'success', title: 'Folder created', detail: newFolderName.trim() });
      setNewFolderName('');
      setNewFolderParentId(null);
      setNewFolderOpen(false);
      void fetchFolders();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Create folder failed',
        detail: err instanceof Error ? err.message : 'Error creating folder',
      });
    } finally {
      setFolderBusy(false);
    }
  }, [workspaceId, newFolderName, newFolderParentId, fetchFolders, toast]);

  const handleDeleteFolder = useCallback(
    async (folderId: string, name: string) => {
      if (!workspaceId || !confirm(`Are you sure you want to delete folder "${name}"?`)) return;
      try {
        await documentApi.deleteFolder(folderId, workspaceId);
        toast({ tone: 'success', title: 'Folder deleted', detail: name });
        if (selectedFolderId === folderId) setSelectedFolderId(null);
        void fetchFolders();
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete folder failed',
          detail: err instanceof Error ? err.message : 'Error deleting folder',
        });
      }
    },
    [workspaceId, selectedFolderId, fetchFolders, fetchDocuments, toast],
  );

  // Version Operations
  const openVersions = useCallback(
    async (doc: DocumentResponse) => {
      setVersionDoc(doc);
      setVersions([]);
      setVersionsLoading(true);
      try {
        const res = await documentApi.listVersions(doc.id, docWorkspaceId(doc));
        setVersions(res);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to load versions',
          detail: err instanceof Error ? err.message : 'Error loading history',
        });
      } finally {
        setVersionsLoading(false);
      }
    },
    [toast],
  );

  const handleUploadVersion = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !versionDoc || !workspaceId) return;
      setVersionBusy(true);
      try {
        const newV = await documentApi.createVersion(versionDoc.id, workspaceId, file);
        toast({
          tone: 'success',
          title: 'New version uploaded',
          detail: `Version ${newV.version_number}`,
        });
        const updatedList = await documentApi.listVersions(versionDoc.id, workspaceId);
        setVersions(updatedList);
        void fetchDocuments();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Version upload failed',
          detail: err instanceof Error ? err.message : 'Error uploading revision',
        });
      } finally {
        setVersionBusy(false);
        if (versionFileInputRef.current) versionFileInputRef.current.value = '';
      }
    },
    [versionDoc, workspaceId, fetchDocuments, toast],
  );

  const handleRestoreVersion = useCallback(
    async (vNum: number) => {
      if (!versionDoc || !workspaceId) return;
      if (!confirm(`Restore document to Version ${vNum}?`)) return;
      setVersionBusy(true);
      try {
        const updated = await documentApi.restoreVersion(versionDoc.id, vNum, workspaceId);
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
      }
    },
    [versionDoc, workspaceId, fetchDocuments, toast],
  );

  // Share Operations
  const openShareModal = useCallback(
    async (doc: DocumentResponse) => {
      setShareDoc(doc);
      setShares([]);
      setSharesLoading(true);
      try {
        const res = await documentApi.listShares(doc.id, docWorkspaceId(doc));
        setShares(res);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Failed to load shares',
          detail: err instanceof Error ? err.message : 'Error loading shares',
        });
      } finally {
        setSharesLoading(false);
      }
    },
    [toast],
  );

  const handleCreateShare = useCallback(async () => {
    if (!shareDoc || !workspaceId || !targetWorkspaceId.trim()) return;
    setShareBusy(true);
    try {
      const newShare = await documentApi.createShare(
        shareDoc.id,
        workspaceId,
        targetWorkspaceId.trim(),
        sharePermission,
        shareExpiresAt ? new Date(shareExpiresAt).toISOString() : null,
      );
      toast({
        tone: 'success',
        title: 'Document shared',
        detail: `Permission: ${newShare.permission}`,
      });
      setShares((prev) => [...prev, newShare]);
      setTargetWorkspaceId('');
      setShareExpiresAt('');
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sharing failed',
        detail: err instanceof Error ? err.message : 'Error granting share',
      });
    } finally {
      setShareBusy(false);
    }
  }, [shareDoc, workspaceId, targetWorkspaceId, sharePermission, shareExpiresAt, toast]);

  const handleRevokeShare = useCallback(
    async (shareId: string) => {
      if (!shareDoc || !workspaceId) return;
      try {
        await documentApi.revokeShare(shareId, workspaceId, shareDoc.id);
        toast({ tone: 'success', title: 'Share revoked' });
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Revoke failed',
          detail: err instanceof Error ? err.message : 'Error revoking share',
        });
      }
    },
    [shareDoc, workspaceId, toast],
  );

  // Viewer
  const openViewer = useCallback(
    async (doc: DocumentResponse) => {
      if (viewerUrlRef.current) URL.revokeObjectURL(viewerUrlRef.current);
      if (viewerContent?.url) URL.revokeObjectURL(viewerContent.url);
      setViewer(doc);
      setViewerContent(null);
      setViewerLoading(true);
      try {
        const blob = await documentApi.getContent(doc.id, docWorkspaceId(doc));
        const url = URL.createObjectURL(blob);
        viewerUrlRef.current = url;
        const type = doc.type.toLowerCase();
        if (TEXT_TYPES.has(type)) {
          const text = await blob.text();
          setViewerContent({ url, text });
        } else if (IMAGE_TYPES.has(type) || type === 'pdf') {
          setViewerContent({ url });
        } else {
          setViewerContent({ url, unsupported: true });
        }
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Preview failed',
          detail: err instanceof Error ? err.message : 'Error loading preview',
        });
      } finally {
        setViewerLoading(false);
      }
    },
    [viewerContent?.url, toast],
  );

  // Filter by Category
  const filteredDocuments = useMemo(() => {
    if (selectedCategory === 'all') return documents;
    return documents.filter((d) => {
      const t = d.type.toLowerCase();
      if (selectedCategory === 'documents')
        return ['pdf', 'docx', 'doc', 'text', 'markdown'].includes(t);
      if (selectedCategory === 'spreadsheets') return ['xlsx', 'csv'].includes(t);
      if (selectedCategory === 'images') return IMAGE_TYPES.has(t);
      return true;
    });
  }, [documents, selectedCategory]);

  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId);
  }, [folders, selectedFolderId]);

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Screen Reader ARIA Live Region */}
      <div aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>

      {/* Header & Main Controls */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl font-display font-medium text-text tracking-tight">
            Workspace Files
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Enterprise document storage with zero-trust quarantine, revision history, and
            cross-workspace sharing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNewFolderOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-surface text-text hover:bg-surface-hover transition-colors"
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
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            New Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Upload Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) enqueueFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {/* Drag & Drop Dropzone (Multi-file queue with Zero Silent Drops) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag files here or click to select"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) enqueueFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-primary bg-primary/5 shadow-inner scale-[0.99]'
            : 'border-border/60 hover:border-primary/50 hover:bg-surface-hover/30'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-base font-medium text-text">
            Drop files here to upload to{' '}
            {currentFolder ? `"${currentFolder.name}"` : 'root workspace'}
          </p>
          <p className="text-xs text-text-muted max-w-md">
            Drag multiple files or folders. Automatic magic-byte inspection, executable blocklist,
            and zero silent drops.
          </p>
        </div>
      </div>

      {/* Multi-File Upload Queue Tracker */}
      {uploadQueue.length > 0 && (
        <div className="bg-surface border border-border/70 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Upload Queue ({uploadQueue.filter((q) => q.status === 'clean').length}/
              {uploadQueue.length} completed)
            </h3>
            <button
              type="button"
              onClick={() => setUploadQueue([])}
              className="text-xs text-text-muted hover:text-text"
            >
              Clear Queue
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-background border border-border/50"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-4">
                  <span className="font-mono text-text truncate max-w-[200px]">{item.name}</span>
                  <span className="text-text-muted shrink-0">({formatSize(item.size)})</span>
                  {item.status === 'uploading' && (
                    <div className="w-24 bg-border/40 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  {item.status === 'queued' && <span className="text-text-muted">Queued...</span>}
                  {item.status === 'uploading' && (
                    <span className="text-primary font-medium">{item.progress}%</span>
                  )}
                  {item.status === 'clean' && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                      ✓ Clean
                    </span>
                  )}
                  {item.status === 'quarantined' && (
                    <span className="inline-flex items-center gap-1 text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                      ⚠ Quarantined
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      Error: {item.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Layout: Folders Sidebar + Documents Table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Folders Navigation Column */}
        <div className="bg-surface border border-border/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Directories
            </span>
            <button
              type="button"
              onClick={() => {
                setNewFolderParentId(selectedFolderId);
                setNewFolderOpen(true);
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              + Subfolder
            </button>
          </div>

          <nav aria-label="Folder Navigation" className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedFolderId === null
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text hover:bg-surface-hover'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Root Workspace
              </span>
              <span className="text-xs text-text-muted">{documents.length}</span>
            </button>

            {folders.map((f) => (
              <div
                key={f.id}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFolderId === f.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text hover:bg-surface-hover'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className="flex items-center gap-2 flex-1 text-left truncate"
                >
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0"
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
                  <span className="truncate">{f.name}</span>
                </button>
                <button
                  type="button"
                  title="Delete Folder"
                  onClick={() => handleDeleteFolder(f.id, f.name)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 p-1 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </nav>
        </div>

        {/* Documents Content Column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Breadcrumbs & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border/60 rounded-xl p-3">
            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="hover:text-primary transition-colors"
              >
                Root
              </button>
              {currentFolder && (
                <>
                  <span>/</span>
                  <span className="font-semibold text-text">{currentFolder.name}</span>
                </>
              )}
            </div>

            {/* Full-text Live Search */}
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                aria-label="Search documents full-text"
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-text placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <svg
                className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Bulk Operations Toolbar */}
          {selectedDocIds.size > 0 && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
              <span className="text-xs font-medium text-primary">
                {selectedDocIds.size} document(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkDownload}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-surface-hover text-text transition-colors"
                >
                  Download (.zip)
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleBulkArchive}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-surface border border-border hover:bg-red-500/10 hover:text-red-600 text-text transition-colors"
                >
                  Archive Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDocIds(new Set())}
                  className="px-2 py-1 text-xs text-text-muted hover:text-text"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Documents Table */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <ErrorState
              title="Failed to load documents"
              message={error}
              onRetry={() => {
                void fetchDocuments();
              }}
            />
          ) : filteredDocuments.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No matching documents' : 'No documents in this folder'}
              description={
                searchQuery
                  ? 'Try adjusting your search terms or clearing the filter.'
                  : 'Upload files above to begin collaborating securely.'
              }
            />
          ) : (
            <div className="bg-surface border border-border/60 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-surface-hover/30 text-text-muted text-xs uppercase tracking-wider">
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
                    <th scope="col" className="p-3 font-semibold">
                      Security
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      Version
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      Size
                    </th>
                    <th scope="col" className="p-3 font-semibold">
                      Updated
                    </th>
                    <th scope="col" className="p-3 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredDocuments.map((doc) => {
                    const isSelected = selectedDocIds.has(doc.id);
                    const scanStatus = doc.scan_status || 'CLEAN';

                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-surface-hover/40 transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${doc.path}`}
                            checked={isSelected}
                            onChange={() => toggleSelectDoc(doc.id)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openViewer(doc)}
                              className="font-medium text-text hover:text-primary transition-colors text-left truncate max-w-xs"
                            >
                              {getFileName(doc.path)}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          {scanStatus === 'CLEAN' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                              ✓ Clean
                            </span>
                          )}
                          {scanStatus === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                              ◌ Scanning
                            </span>
                          )}
                          {scanStatus === 'MALICIOUS' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">
                              ⚠ Quarantined
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => openVersions(doc)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                          >
                            v1
                          </button>
                        </td>
                        <td className="p-3 text-xs text-text-muted">
                          {formatSize(doc.metadata?.['size'])}
                        </td>
                        <td className="p-3 text-xs text-text-muted">
                          {formatDate(doc.updated_at || doc.created_at)}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openViewer(doc)}
                              className="p-1 text-text-muted hover:text-text rounded"
                              title="View Document"
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
                            <button
                              type="button"
                              onClick={() => openShareModal(doc)}
                              className="p-1 text-text-muted hover:text-text rounded"
                              title="Share Document"
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

      {/* New Folder Modal */}
      {newFolderOpen && (
        <Modal
          isOpen={newFolderOpen}
          onClose={() => setNewFolderOpen(false)}
          title="Create New Folder"
        >
          <div className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="folder-name-input"
                className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1"
              >
                Folder Name
              </label>
              <input
                id="folder-name-input"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Invoices, Specifications"
                className="w-full text-sm p-2.5 rounded-lg bg-background border border-border text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-text hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={folderBusy || !newFolderName.trim()}
                onClick={handleCreateFolder}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Create Folder
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Version History Drawer / Modal */}
      {versionDoc && (
        <Modal
          isOpen={Boolean(versionDoc)}
          onClose={() => setVersionDoc(null)}
          title={`Version History — ${getFileName(versionDoc.path)}`}
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <p className="text-xs text-text-muted">Revisions are tracked and immutable.</p>
              <button
                type="button"
                onClick={() => versionFileInputRef.current?.click()}
                disabled={versionBusy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
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
              <div className="py-10 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-text">Version {v.version_number}</div>
                      <div className="text-text-muted">
                        {formatDate(v.created_at)} • {formatSize(v.size_bytes)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={versionBusy}
                      onClick={() => handleRestoreVersion(v.version_number)}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-border hover:bg-surface-hover"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Sharing Modal */}
      {shareDoc && (
        <Modal
          isOpen={Boolean(shareDoc)}
          onClose={() => setShareDoc(null)}
          title={`Share Document — ${getFileName(shareDoc.path)}`}
        >
          <div className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="target-workspace-input"
                className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1"
              >
                Target Workspace ID
              </label>
              <input
                id="target-workspace-input"
                type="text"
                value={targetWorkspaceId}
                onChange={(e) => setTargetWorkspaceId(e.target.value)}
                placeholder="UUID of workspace to grant access"
                className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="share-permission-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1"
                >
                  Permission
                </label>
                <select
                  id="share-permission-select"
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-text"
                >
                  <option value="READ">Read Only</option>
                  <option value="READ_WRITE">Read &amp; Edit</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="share-expiration-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-1"
                >
                  Expiration (Optional)
                </label>
                <input
                  id="share-expiration-input"
                  type="date"
                  value={shareExpiresAt}
                  onChange={(e) => setShareExpiresAt(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-background border border-border text-text"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={shareBusy || !targetWorkspaceId.trim()}
                onClick={handleCreateShare}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Grant Access
              </button>
            </div>

            {/* Active Shares */}
            <div className="border-t border-border/40 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Active Shares
              </span>
              {sharesLoading ? (
                <div className="py-4 flex justify-center">
                  <LoadingSpinner size="sm" />
                </div>
              ) : shares.length === 0 ? (
                <p className="text-xs text-text-muted mt-2">
                  Not shared with any other workspaces.
                </p>
              ) : (
                <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto">
                  {shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded bg-background text-xs border border-border/40"
                    >
                      <span className="font-mono text-text truncate max-w-[200px]">
                        {s.target_workspace_id}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted">{s.permission}</span>
                        <button
                          type="button"
                          onClick={() => handleRevokeShare(s.id)}
                          className="text-red-500 hover:text-red-600 font-medium"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Content Preview Modal */}
      {viewer && (
        <Modal
          isOpen={Boolean(viewer)}
          onClose={() => setViewer(null)}
          title={getFileName(viewer.path)}
        >
          <div className="min-h-[300px] flex items-center justify-center p-4">
            {viewerLoading ? (
              <LoadingSpinner size="lg" />
            ) : viewerContent?.text ? (
              <pre className="w-full max-h-96 overflow-auto p-4 rounded-lg bg-background font-mono text-xs text-text">
                {viewerContent.text}
              </pre>
            ) : viewerContent?.url && !viewerContent.unsupported ? (
              <iframe
                src={viewerContent.url}
                title="Document Preview"
                className="w-full h-96 rounded-lg border border-border"
              />
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-text-muted">Preview not available for this format.</p>
                {viewerContent?.url && (
                  <a
                    href={viewerContent.url}
                    download={getFileName(viewer.path)}
                    className="inline-block px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
                  >
                    Download File
                  </a>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
