import React from 'react';
import { SearchField } from '../forms/SearchField';
import { Badge } from '../Badge';
import { XIcon } from '../../icons';

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  categories?: FilterOption[];
  activeCategory?: string;
  onCategoryChange?: (id: string) => void;
  activeTags?: Array<{ id: string; label: string }>;
  onRemoveTag?: (id: string) => void;
  onClearAll?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Filter records...',
  categories,
  activeCategory,
  onCategoryChange,
  activeTags,
  onRemoveTag,
  onClearAll,
  actions,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchField
            value={searchQuery}
            onChange={(val) => onSearchChange(val)}
            onClear={() => onSearchChange('')}
            placeholder={searchPlaceholder}
          />
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {categories && categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange?.(cat.id)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-fg'
                    : 'bg-surface-hover text-text-secondary hover:text-text border border-border'
                }`}
              >
                {cat.label}
                {cat.count !== undefined && (
                  <span
                    className={`ml-1.5 text-2xs ${isActive ? 'text-primary-fg/80' : 'text-text-dim'}`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeTags && activeTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span className="text-text-dim text-2xs uppercase tracking-wider">Active filters:</span>
          {activeTags.map((tag) => (
            <Badge key={tag.id} variant="default" size="sm" className="gap-1 pr-1">
              <span>{tag.label}</span>
              {onRemoveTag && (
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag.id)}
                  className="hover:text-text focus:outline-none"
                  aria-label={`Remove filter ${tag.label}`}
                >
                  <XIcon size={12} />
                </button>
              )}
            </Badge>
          ))}
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-primary hover:underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
