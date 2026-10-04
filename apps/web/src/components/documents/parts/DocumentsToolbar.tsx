'use client';

import React from 'react';
import { SearchField, Switch, Tabs } from '@vaeloom/ui-kit';

import { DOCUMENT_CATEGORIES, type DocumentCategoryId } from './documentCategories';

export interface DocumentsToolbarProps {
  category: DocumentCategoryId;
  onCategoryChange: (category: DocumentCategoryId) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  includeArchived: boolean;
  onToggleArchived: () => void;
  /**
   * A sentence explaining what the active category did to the visible rows.
   *
   * Rendered only while a specific category is selected, because that is the
   * only case where the filter silently narrows what is on screen.
   */
  filterNote?: string | null;
  className?: string;
}

/**
 * Category tabs, the search field and the archived-files switch.
 *
 * THE CATEGORY STRIP IS A REAL TABLIST NOW
 *
 * It was six `<button>`s with no `role`, no `aria-selected` and no relationship
 * to the list they filter. `Tabs` gives it `role="tablist"` / `role="tab"`, a
 * roving tabindex, arrow-key navigation, and `aria-controls` pointing at the
 * `TabPanel` in `DocumentsHub` that wraps the table — so the selected state is
 * announced and the tabs are operable without a pointer.
 *
 * The archived-files control is a `Switch` (`role="switch"` + `aria-checked`)
 * rather than a button carrying only a `title`. It is a filter toggle, the
 * switch role is what that is, and a `title` is not an accessible name.
 */
export const DocumentsToolbar: React.FC<DocumentsToolbarProps> = ({
  category,
  onCategoryChange,
  searchValue,
  onSearchChange,
  includeArchived,
  onToggleArchived,
  filterNote,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border border-border/70 bg-surface/40">
      {/* `overflow-x-auto` so six tabs stay reachable at 320px instead of forcing
          the page itself to scroll sideways (the `responsive overflow` e2e gate
          allows at most 2px of page-level scroll). */}
      <div className="overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
        <Tabs
          tabs={DOCUMENT_CATEGORIES.map(({ id, label }) => ({ id, label }))}
          activeTab={category}
          onTabChange={(id) => onCategoryChange(id as DocumentCategoryId)}
          variant="pills"
          size="sm"
          ariaLabel="Document categories"
        />
      </div>

      <div className="flex items-center gap-3">
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search workspace files…"
          aria-label="Search workspace files"
          className="sm:w-60"
        />
        <Switch
          checked={includeArchived}
          onChange={onToggleArchived}
          label="Archived"
          className="shrink-0"
        />
      </div>
    </div>

    {filterNote && (
      <p role="status" className="px-1 text-[11px] text-text-muted">
        {filterNote}
      </p>
    )}
  </div>
);

export default DocumentsToolbar;
