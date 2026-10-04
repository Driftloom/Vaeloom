'use client';

import React from 'react';
import { Button } from '@vaeloom/ui-kit';
import { SparklesIcon, UploadIcon } from '@vaeloom/ui-kit';

export interface DocumentsHeaderActionsProps {
  autoOrganizeBusy: boolean;
  onAutoOrganize: () => void;
  onUploadFolderTree: () => void;
  onCreateFolder: () => void;
}

/**
 * The three page-level actions in the header.
 *
 * `Button` rather than `<button className="btn-secondary">`: the raw buttons
 * ignored `loading`, so Auto-Organize showed "Organizing…" as text while the
 * control itself stayed fully enabled and a second click fired a second
 * workspace-wide reorganisation. `Button` also supplies the `focus-visible`
 * ring the `.btn-*` aliases only approximate.
 */
export const DocumentsHeaderActions: React.FC<DocumentsHeaderActionsProps> = ({
  autoOrganizeBusy,
  onAutoOrganize,
  onUploadFolderTree,
  onCreateFolder,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      loading={autoOrganizeBusy}
      onClick={onAutoOrganize}
      title="Categorize unorganized files into smart folders with clean names"
    >
      <SparklesIcon size={14} className="mr-1.5" />
      Auto-Organize Files
    </Button>

    {/* Named "Upload Folder Tree" rather than "Upload Folder":
        `DocumentUploadQueue` ships its own folder picker with that exact
        accessible name. Two identically named controls that do different things
        is ambiguous for anyone navigating by name, and this one is specifically
        the control that recreates the directory hierarchy. */}
    <Button
      variant="outline"
      size="sm"
      onClick={onUploadFolderTree}
      title="Upload a directory and recreate its folder hierarchy"
    >
      <UploadIcon size={14} className="mr-1.5" />
      Upload Folder Tree
    </Button>

    <Button variant="outline" size="sm" onClick={onCreateFolder}>
      New Folder
    </Button>
  </div>
);

export default DocumentsHeaderActions;
