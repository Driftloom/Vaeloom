'use client';

import React from 'react';
import { Alert, EmptyState, ErrorState, Pagination, TabPanel } from '@vaeloom/ui-kit';
import { FileTextIcon } from '@vaeloom/ui-kit';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

import { PAGE_SIZE, type UseDocumentListResult } from '../hooks/useDocumentList';
import type { UseDocumentFoldersResult } from '../hooks/useDocumentFolders';
import { DocumentsTable } from './DocumentsTable';
import type { DocumentRowHandlers } from './DocumentRowActions';
import type { DocumentCategoryId } from './documentCategories';

export interface DocumentsResultsPanelProps {
  list: UseDocumentListResult;
  folders: UseDocumentFoldersResult;
  category: DocumentCategoryId;
  onCategoryChange: (category: DocumentCategoryId) => void;
  /** Rows after the category filter. */
  visibleDocuments: UseDocumentListResult['documents'];
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
 */
export const DocumentsResultsPanel: React.FC<DocumentsResultsPanelProps> = ({
  list,
  folders,
  category,
  onCategoryChange,
  visibleDocuments,
  handlers,
}) => {
  const hasFilters =
    Boolean(list.searchInput.trim()) || category !== 'all' || list.selectedFolderId;

  const clearFilters = () => {
    list.onSearchInputChange('');
    onCategoryChange('all');
    list.selectFolder(null);
  };

  return (
    <TabPanel id={category} activeTab={category}>
      <div className="space-y-3">
        {list.searchTruncated && (
          <Alert
            variant="info"
            description="This search filled one page, so there may be more matches than are shown. Refine the query to narrow it."
          />
        )}

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
        ) : visibleDocuments.length === 0 ? (
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
            documents={visibleDocuments}
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

        {/* Pagination is suppressed during a search because
            `GET /documents/search` answers with a bare array and no total
            (`DocumentSearchParams`), so any page count derived from it would be
            a guess presented as a count. */}
        {!list.searchInput.trim() && (
          <Pagination
            currentPage={list.page}
            totalPages={list.totalPages}
            totalRecords={list.total}
            pageSize={PAGE_SIZE}
            onPageChange={list.setPage}
          />
        )}
      </div>
    </TabPanel>
  );
};

export default DocumentsResultsPanel;
