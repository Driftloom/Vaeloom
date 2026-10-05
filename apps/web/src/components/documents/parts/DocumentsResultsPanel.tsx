'use client';

import React from 'react';
import { EmptyState, ErrorState, Pagination, TabPanel } from '@vaeloom/ui-kit';
import { FileTextIcon } from '@vaeloom/ui-kit';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

import type { UseDocumentListResult } from '../hooks/useDocumentList';
import type { UseDocumentFoldersResult } from '../hooks/useDocumentFolders';
import { DocumentsTable } from './DocumentsTable';
import type { DocumentRowHandlers } from './DocumentRowActions';

export interface DocumentsResultsPanelProps {
  list: UseDocumentListResult;
  folders: UseDocumentFoldersResult;
  handlers: DocumentRowHandlers;
}

/**
 * Everything below the toolbar: the category's tab panel, and inside it exactly
 * one of loading / error / empty / the table.
 *
 * WHY A `TabPanel` WRAPS THE TABLE
 *
 * `Tabs` stamps `aria-controls="tabpanel-<id>"` on every tab. Without a panel
 * carrying that id, every one of the six tabs points at nothing — a dangling ID
 * reference that assistive tech cannot resolve, and that the category strip needs
 * in order to describe what each tab controls.
 *
 * WHY REFETCHING KEEPS THE ROWS
 *
 * The old guard was `loading && documents.length === 0`, so a refetch rendered
 * the table with no indication that anything was happening: flipping a folder or
 * clearing the archive looked instantaneous even when the request took seconds,
 * and a stale page looked current. `refreshing` is now a separate signal that
 * keeps the rows and marks the region `aria-busy` with a visible note.
 *
 * WHY PAGINATION IS NO LONGER SUPPRESSED DURING A SEARCH
 *
 * It was hidden because `GET /documents/search` answered with a bare array, so
 * any page count would have been a guess — and a search that filled one page was
 * announced as possibly truncated. The search response now carries `total`, so
 * the same `Pagination` that serves the list serves the search, `total` is the
 * real match count, and page 2 requests `offset=50` instead of being unreachable.
 *
 * There is no client-side category filter here any more: `list.documents` is
 * exactly what the server sent for the active `category`, so the panel renders
 * `list.documents` rather than a filtered copy of it.
 */
export const DocumentsResultsPanel: React.FC<DocumentsResultsPanelProps> = ({
  list,
  folders,
  handlers,
}) => {
  const hasFilters =
    Boolean(list.searchInput.trim()) || list.category !== 'all' || list.selectedFolderId;

  const clearFilters = () => {
    list.onSearchInputChange('');
    list.setCategory('all');
    list.selectFolder(null);
  };

  return (
    <TabPanel id={list.category} activeTab={list.category}>
      <div className="space-y-3">
        {list.loading && list.documents.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2">
            <LoadingSpinner size="lg" text="Loading documents…" />
          </div>
        ) : list.error ? (
          <ErrorState
            title="Failed to load files"
            message={list.error}
            onRetry={list.retry}
            actionText="Retry"
          />
        ) : list.documents.length === 0 ? (
          <EmptyState
            icon={<FileTextIcon size={24} />}
            title="No documents found"
            description={
              list.searchInput.trim()
                ? 'Try a different search query, or clear the filters.'
                : list.selectedFolderId
                  ? 'This folder has no documents yet. Upload one, or show all files.'
                  : 'Upload documents to get started.'
            }
            action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <DocumentsTable
            documents={list.documents}
            folders={folders.folders}
            selectedIds={list.selectedIds}
            handlers={handlers}
            allVisibleSelected={list.allVisibleSelected}
            someVisibleSelected={list.someVisibleSelected}
            onToggleSelectOne={list.toggleSelectOne}
            onToggleSelectAll={list.toggleSelectAllVisible}
            loading={list.loading}
            refreshing={list.refreshing}
          />
        )}

        <Pagination
          currentPage={list.page}
          totalPages={list.totalPages}
          totalRecords={list.total}
          pageSize={list.pageSize}
          onPageChange={list.setPage}
        />
      </div>
    </TabPanel>
  );
};

export default DocumentsResultsPanel;
