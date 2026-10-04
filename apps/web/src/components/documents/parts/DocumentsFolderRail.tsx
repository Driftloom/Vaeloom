'use client';

import React from 'react';
import { Alert, Button } from '@vaeloom/ui-kit';

import type { DocumentResponse } from '@/lib/api-client';

import type { UseDocumentFoldersResult } from '../hooks/useDocumentFolders';
import { DocumentFolderTree } from '../DocumentFolderTree';

export interface DocumentsFolderRailProps {
  workspaceId: string;
  /** Needed for the tree's empty state and its own fetch fallback. */
  documents: DocumentResponse[];
  folders: UseDocumentFoldersResult;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onChanged: () => void;
}

/**
 * The folders rail.
 *
 * THE ERROR ALERT BELOW IS NOT REDUNDANT
 *
 * `DocumentFolderTree` has its own internal `error` state, but it only ever sets
 * it when IT fetches — and here it is handed both `folders` and `folderTree`, so
 * it never fetches and its error can never fire. The rail's requester therefore
 * has to report the failure itself.
 *
 * The TREE ITSELF IS NOT RENDERED ON FAILURE. Supplied with `folders=[]` and
 * `folderTree=[]`, it would render its "No folders yet" empty state next to the
 * error — two contradictory claims, one of them certain. A failed request means
 * we do not know how many folders there are, so the screen says exactly that.
 *
 * `onCreateFolder` / `onDeleteFolder` are supplied, which is what routes the
 * tree's per-row add-subfolder and delete affordances to the hub's own modal and
 * confirmation. Without them the tree opens its internal ones and the hub's
 * `newFolderParentId` can only ever be `null` — the subfolder control used to
 * exist in the tree and lead nowhere.
 */
export const DocumentsFolderRail: React.FC<DocumentsFolderRailProps> = ({
  workspaceId,
  documents,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onChanged,
}) => (
  <div className="lg:col-span-1 p-4 rounded-xl border border-border/70 bg-surface/40 backdrop-blur-sm space-y-3">
    {folders.error ? (
      <Alert variant="danger" description={`Could not load folders. ${folders.error}`}>
        <Button variant="outline" size="sm" className="mt-2" onClick={folders.retry}>
          Retry folders
        </Button>
      </Alert>
    ) : (
      <DocumentFolderTree
        workspaceId={workspaceId}
        selectedFolderId={selectedFolderId}
        onSelectFolder={onSelectFolder}
        folders={folders.folders}
        folderTree={folders.folderTree}
        documents={documents}
        onCreateFolder={onCreateFolder}
        onDeleteFolder={onDeleteFolder}
        onFolderCreated={onChanged}
        onFolderDeleted={onChanged}
      />
    )}
  </div>
);

export default DocumentsFolderRail;
