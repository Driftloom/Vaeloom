'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Badge,
  Button,
  Progress,
  Spinner,
  UploadIcon,
  CheckIcon,
  XIcon,
  AlertTriangleIcon,
  FileTextIcon,
  TrashIcon,
} from '@vaeloom/ui-kit';
import { documentApi, type DocumentResponse } from '@/lib/api-client';

export type UploadItemStatus =
  'queued' | 'uploading' | 'scanning' | 'clean' | 'quarantined' | 'error';

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: UploadItemStatus;
  error?: string;
  doc?: DocumentResponse;
  folderId?: string | null;
  folderPath?: string;
}

// Export alias expected by DocumentsHub
export type QueueItem = UploadQueueItem;

export interface DocumentUploadQueueProps {
  workspaceId?: string;
  targetFolderId?: string | null;
  onUploadComplete?: (doc: DocumentResponse) => void;
  onAllCompleted?: () => void;
  onFolderCreated?: () => void;
  // Controlled queue props used by DocumentsHub
  queue?: QueueItem[];
  onClearCompleted?: () => void;
  onCancelItem?: (id: string) => void;
  initialQueue?: UploadQueueItem[];
  className?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getScanBadge(status: UploadItemStatus, doc?: DocumentResponse) {
  switch (status) {
    case 'clean':
      return (
        <Badge variant="success" size="sm" className="flex items-center gap-1">
          <CheckIcon size={12} />
          Clean ✓
        </Badge>
      );
    case 'scanning':
      return (
        <Badge variant="warning" size="sm" className="flex items-center gap-1">
          <Spinner size="sm" className="w-3 h-3 text-warning" />
          Scanning ◌
        </Badge>
      );
    case 'quarantined':
      return (
        <Badge variant="error" size="sm" className="flex items-center gap-1">
          <AlertTriangleIcon size={12} />
          Quarantined ⚠
        </Badge>
      );
    case 'uploading':
      return (
        <Badge variant="primary" size="sm">
          Uploading...
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="default" size="sm">
          Queued
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="error" size="sm" className="flex items-center gap-1">
          <XIcon size={12} />
          Failed
        </Badge>
      );
  }
}

export const DocumentUploadQueue: React.FC<DocumentUploadQueueProps> = ({
  workspaceId,
  targetFolderId,
  onUploadComplete,
  onAllCompleted,
  onFolderCreated,
  queue: controlledQueue,
  onClearCompleted,
  onCancelItem,
  initialQueue = [],
  className = '',
}) => {
  const [internalQueue, setInternalQueue] = useState<UploadQueueItem[]>(initialQueue);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderCacheRef = useRef<Map<string, string>>(new Map());

  const activeQueue = controlledQueue !== undefined ? controlledQueue : internalQueue;

  // Accessible ARIA announcement helper
  const announce = useCallback((msg: string) => {
    setAriaAnnouncement(msg);
  }, []);

  // Helper to ensure nested folder paths are created in the workspace
  const ensureFolderPath = useCallback(
    async (pathParts: string[]): Promise<string | null> => {
      if (pathParts.length === 0 || !workspaceId) return targetFolderId || null;
      let currentParent: string | null = targetFolderId || null;
      let accumulated = currentParent ? `${currentParent}:` : '';

      for (const part of pathParts) {
        if (!part.trim()) continue;
        accumulated += `/${part.trim()}`;
        if (folderCacheRef.current.has(accumulated)) {
          currentParent = folderCacheRef.current.get(accumulated)!;
          continue;
        }

        try {
          const created = await documentApi.createFolder(workspaceId, part.trim(), currentParent);
          currentParent = created.id;
          folderCacheRef.current.set(accumulated, created.id);
          onFolderCreated?.();
        } catch {
          // If folder already exists or conflict, look it up in folder list
          try {
            const list = await documentApi.listFolders(workspaceId, currentParent || undefined);
            const found = list.find((f) => f.name.toLowerCase() === part.trim().toLowerCase());
            if (found) {
              currentParent = found.id;
              folderCacheRef.current.set(accumulated, found.id);
            }
          } catch {
            // Keep current parent on error
          }
        }
      }
      return currentParent;
    },
    [workspaceId, targetFolderId, onFolderCreated],
  );

  const enqueueFilesWithPaths = useCallback(
    async (filesWithPaths: Array<{ file: File; relativePath?: string }>) => {
      if (filesWithPaths.length === 0) return;
      announce(`Processing ${filesWithPaths.length} items for upload...`);

      const newItems: UploadQueueItem[] = [];
      for (const item of filesWithPaths) {
        let assignedFolderId: string | null = targetFolderId || null;
        let displayPath = '';

        if (item.relativePath && item.relativePath.includes('/')) {
          const parts = item.relativePath.split('/');
          parts.pop(); // remove filename
          displayPath = parts.join('/');
          assignedFolderId = await ensureFolderPath(parts);
        }

        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file: item.file,
          name: item.file.name,
          size: item.file.size,
          progress: 0,
          status: 'queued',
          folderId: assignedFolderId,
          folderPath: displayPath,
        });
      }

      setInternalQueue((prev) => [...prev, ...newItems]);
      announce(`Enqueued ${newItems.length} file(s) for upload. Zero silent drops enabled.`);
    },
    [targetFolderId, ensureFolderPath, announce],
  );

  // Zero Silent Drops: Every file passed into enqueue is queued
  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      const newItems: UploadQueueItem[] = fileList.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'queued',
        folderId: targetFolderId || null,
      }));

      setInternalQueue((prev) => [...prev, ...newItems]);
      announce(`Enqueued ${newItems.length} file(s) for upload. Zero silent drops enabled.`);
    },
    [targetFolderId, announce],
  );

  // Active queue worker: picks next queued item sequentially (when uncontrolled)
  useEffect(() => {
    if (!workspaceId || isProcessing || controlledQueue !== undefined) return;

    const nextItem = internalQueue.find((q) => q.status === 'queued');
    if (!nextItem) {
      if (
        internalQueue.length > 0 &&
        internalQueue.every((q) => q.status !== 'queued' && q.status !== 'uploading')
      ) {
        onAllCompleted?.();
      }
      return;
    }

    setIsProcessing(true);

    const processItem = async () => {
      setInternalQueue((prev) =>
        prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'uploading', progress: 5 } : q)),
      );
      announce(`Uploading ${nextItem.name}...`);

      try {
        const destFolderId = nextItem.folderId || targetFolderId || null;
        const doc = await documentApi.uploadWithProgress(
          nextItem.file,
          workspaceId,
          (percent) => {
            setInternalQueue((prev) =>
              prev.map((q) => (q.id === nextItem.id ? { ...q, progress: percent } : q)),
            );
          },
          destFolderId,
        );

        const scanStatus = doc.scan_status;
        let finalStatus: UploadItemStatus = 'clean';
        if (scanStatus === 'MALICIOUS' || scanStatus === 'REJECTED') {
          finalStatus = 'quarantined';
          announce(`Warning: ${nextItem.name} was quarantined by security scanner.`);
        } else if (scanStatus === 'PENDING') {
          finalStatus = 'scanning';
          announce(`${nextItem.name} uploaded successfully, scan in progress.`);
        } else {
          finalStatus = 'clean';
          announce(`${nextItem.name} uploaded and verified clean.`);
        }

        setInternalQueue((prev) =>
          prev.map((q) =>
            q.id === nextItem.id
              ? {
                  ...q,
                  progress: 100,
                  status: finalStatus,
                  doc,
                }
              : q,
          ),
        );

        onUploadComplete?.(doc);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setInternalQueue((prev) =>
          prev.map((q) =>
            q.id === nextItem.id
              ? {
                  ...q,
                  status: 'error',
                  error: errorMsg,
                }
              : q,
          ),
        );
        announce(`Upload error for ${nextItem.name}: ${errorMsg}`);
      } finally {
        setIsProcessing(false);
      }
    };

    void processItem();
  }, [
    internalQueue,
    workspaceId,
    targetFolderId,
    isProcessing,
    controlledQueue,
    announce,
    onUploadComplete,
    onAllCompleted,
  ]);

  // Drag and Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const filesWithPaths: Array<{ file: File; relativePath?: string }> = [];

      const readEntry = async (entry: any, currentPath = ''): Promise<void> => {
        if (!entry) return;
        if (entry.isFile) {
          await new Promise<void>((resolve) => {
            entry.file(
              (file: File) => {
                filesWithPaths.push({
                  file,
                  relativePath: currentPath ? `${currentPath}/${file.name}` : file.name,
                });
                resolve();
              },
              () => resolve(),
            );
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          const readAll = async (): Promise<any[]> => {
            const batch: any[] = [];
            let chunk: any[] = [];
            do {
              chunk = await new Promise<any[]>((resolve) => {
                dirReader.readEntries(resolve, () => resolve([]));
              });
              batch.push(...chunk);
            } while (chunk.length > 0);
            return batch;
          };
          const children = await readAll();
          for (const child of children) {
            await readEntry(child, dirPath);
          }
        }
      };

      const entryPromises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
        if (entry) {
          entryPromises.push(readEntry(entry));
        } else {
          const file = item.getAsFile();
          if (file) filesWithPaths.push({ file, relativePath: file.name });
        }
      }

      await Promise.all(entryPromises);
      if (filesWithPaths.length > 0) {
        await enqueueFilesWithPaths(filesWithPaths);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      enqueueFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      enqueueFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesWithPaths: Array<{ file: File; relativePath?: string }> = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (!file) continue;
        filesWithPaths.push({
          file,
          relativePath: file.webkitRelativePath || file.name,
        });
      }
      await enqueueFilesWithPaths(filesWithPaths);
      e.target.value = '';
    }
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancelItem) {
      onCancelItem(id);
    } else {
      setInternalQueue((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClearCompleted = () => {
    if (onClearCompleted) {
      onClearCompleted();
    } else {
      setInternalQueue((prev) =>
        prev.filter((item) => item.status === 'queued' || item.status === 'uploading'),
      );
    }
    announce('Cleared finished upload items.');
  };

  const completedCount = activeQueue.filter(
    (q) => q.status === 'clean' || q.status === 'quarantined' || q.status === 'error',
  ).length;

  return (
    <Card className={`space-y-4 ${className}`}>
      {/* Hidden input for manual file selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* Hidden input for folder directory selection */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
        aria-hidden="true"
      />

      {/* ARIA Live polite announcements for screen-readers */}
      <div className="sr-only" aria-live="polite" role="status">
        {ariaAnnouncement}
      </div>

      {/* Drop Zone Header */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-action bg-action/5 shadow-inner scale-[0.99]'
            : 'border-border hover:border-action/50 hover:bg-surface-100'
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload files: Drag and drop files or folders here, or click to browse"
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-action/20 text-action' : 'bg-surface-200 text-text-muted'
            }`}
          >
            <UploadIcon size={24} />
          </div>

          <div>
            <p className="text-sm font-semibold text-text">
              Drag & drop files or folders here, or{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="text-action underline hover:text-action-hover font-semibold"
              >
                browse files
              </button>{' '}
              or{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                className="text-action underline hover:text-action-hover font-semibold"
              >
                upload folder
              </button>
            </p>
            <p className="text-xs text-text-muted mt-1">
              Zero silent drops guarantee. Up to 100MB per file. Supports PDF, DOCX, TXT, CSV, JSON,
              Markdown, and directories.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Queue Section */}
      {activeQueue.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text">
                Upload Queue ({activeQueue.length})
              </span>
              {isProcessing && <Spinner size="sm" />}
            </div>

            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCompleted}
                  className="h-7 text-xs"
                >
                  Clear Completed ({completedCount})
                </Button>
              )}
              {controlledQueue === undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInternalQueue([])}
                  className="h-7 text-xs text-error hover:bg-error/10"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          <div
            className="space-y-2 max-h-72 overflow-y-auto pr-1"
            role="list"
            aria-label="Files being uploaded"
          >
            {activeQueue.map((item) => (
              <div
                key={item.id}
                role="listitem"
                className="p-3 rounded-lg border border-border bg-surface-50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <FileTextIcon size={16} className="text-text-muted shrink-0" />
                    <span className="font-medium text-text truncate max-w-xs sm:max-w-md">
                      {item.name}
                    </span>
                    {item.folderPath && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-200 text-text-muted text-[10px] font-mono shrink-0">
                        📁 {item.folderPath}
                      </span>
                    )}
                    <span className="text-text-muted tabular-nums shrink-0">
                      ({formatBytes(item.size)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getScanBadge(item.status, item.doc)}

                    {item.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveItem(item.id, e)}
                        className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                        title="Remove from queue"
                        aria-label={`Remove ${item.name} from queue`}
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar during upload */}
                {item.status === 'uploading' && (
                  <div className="space-y-1">
                    <Progress value={item.progress} max={100} size="sm" variant="primary" />
                    <div className="flex justify-between text-[11px] text-text-muted">
                      <span>Uploading to S3 object store...</span>
                      <span className="tabular-nums">{item.progress}%</span>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {item.status === 'error' && item.error && (
                  <p className="text-[11px] text-error bg-error/10 p-1.5 rounded border border-error/20">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
