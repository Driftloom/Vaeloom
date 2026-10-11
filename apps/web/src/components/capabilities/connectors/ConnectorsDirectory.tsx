'use client';

import React from 'react';
import { Badge, Button, EmptyState, ErrorState, SearchField } from '@vaeloom/ui-kit';
import {
  CATEGORY_FILTERS,
  type ConnectorCategory,
  type CategoryFilter,
} from '@/lib/connectors-catalog';
import { type CatalogRow, CATEGORY_ICONS, rowId, rowProvider, rowComposioApp } from './types';
import { CatalogCard } from './ConnectorCard';

export interface ConnectorsDirectoryProps {
  fullCatalogList: CatalogRow[];
  filteredCatalog: CatalogRow[];
  topConnectors: CatalogRow[];
  otherConnectors: CatalogRow[];
  activeCategoryFilter: CategoryFilter;
  internalSearch: string;
  onSearchChange: (value: string) => void;
  selectedFilter: ConnectorCategory;
  onFilterChange: (category: ConnectorCategory) => void;
  showAllConnectors: boolean;
  onShowAllConnectorsChange: (show: boolean) => void;
  onResetFilters: () => void;
  effectiveQuery: string;
  composioEnabled: boolean | null;
  composioAppsError: string | null;
  onRetryLoad: () => void;
  isRowConnected: (row: CatalogRow) => boolean;
  busyAction: string | null;
  onSelectRow: (row: CatalogRow) => void;
  onConnectRow: (row: CatalogRow) => void;
}

export function ConnectorsDirectory({
  fullCatalogList,
  filteredCatalog,
  topConnectors,
  otherConnectors,
  activeCategoryFilter,
  internalSearch,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  showAllConnectors,
  onShowAllConnectorsChange,
  onResetFilters,
  effectiveQuery,
  composioEnabled,
  composioAppsError,
  onRetryLoad,
  isRowConnected,
  busyAction,
  onSelectRow,
  onConnectRow,
}: ConnectorsDirectoryProps) {
  const discoverFilterActive =
    showAllConnectors || Boolean(effectiveQuery) || selectedFilter !== 'All';

  return (
    <div className="max-w-7xl mx-auto space-y-6 min-w-0">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border pb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Curated catalog
          </span>
          <span className="text-xs text-text-secondary">
            Showing {filteredCatalog.length} of {fullCatalogList.length}
          </span>
          {composioEnabled === false && (
            <Badge variant="warning" size="sm">
              Composio is switched off on the server
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="w-full sm:w-64">
            <SearchField
              value={internalSearch}
              onChange={onSearchChange}
              onClear={() => onSearchChange('')}
              placeholder="Search this directory"
              aria-label="Search connectors in this directory"
              className="text-xs"
            />
          </div>
          <div className="relative shrink-0">
            <label htmlFor="connector-category" className="sr-only">
              Filter connectors by sector
            </label>
            <select
              id="connector-category"
              value={selectedFilter}
              onChange={(event) => onFilterChange(event.target.value as ConnectorCategory)}
              className="appearance-none bg-surface-elevated border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer font-sans"
            >
              {CATEGORY_FILTERS.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Quick sector filters"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs min-w-0 w-full"
      >
        {CATEGORY_FILTERS.filter((filter) => CATEGORY_ICONS[filter.id]).map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={selectedFilter === filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              selectedFilter === filter.id
                ? 'bg-action text-action-fg shadow-xs font-semibold'
                : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border'
            }`}
          >
            <span className={selectedFilter === filter.id ? 'text-action-fg' : 'text-text-muted'}>
              {CATEGORY_ICONS[filter.id]}
            </span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {composioAppsError && (
        <ErrorState
          title="Composio catalog unavailable"
          message={composioAppsError}
          onRetry={onRetryLoad}
          actionText="Try again"
        />
      )}

      {discoverFilterActive ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2 gap-3">
            <h3 className="text-sm font-semibold text-text">
              {effectiveQuery
                ? `Search results (${filteredCatalog.length})`
                : selectedFilter !== 'All'
                  ? `${activeCategoryFilter.label} (${filteredCatalog.length})`
                  : `All connectors (${filteredCatalog.length})`}
            </h3>
            <Button variant="ghost" size="sm" onClick={onResetFilters}>
              Back to featured
            </Button>
          </div>

          {filteredCatalog.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              description="No connector in the catalog matches this sector and search. Clear the filters to see the full list."
              action={{
                label: 'Clear filters',
                onClick: onResetFilters,
              }}
            />
          ) : (
            <ul role="list" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
              {filteredCatalog.map((row) => (
                <CatalogCard
                  key={rowId(row)}
                  row={row}
                  connected={isRowConnected(row)}
                  builtIn={rowProvider(row) === 'native'}
                  connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                  onSelect={() => onSelectRow(row)}
                  onConnect={() => onConnectRow(row)}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-text">
                Top connectors ({topConnectors.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => onShowAllConnectorsChange(true)}>
                Show all ({fullCatalogList.length})
              </Button>
            </div>
            <ul role="list" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
              {topConnectors.map((row) => (
                <CatalogCard
                  key={rowId(row)}
                  row={row}
                  connected={isRowConnected(row)}
                  builtIn={rowProvider(row) === 'native'}
                  connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                  onSelect={() => onSelectRow(row)}
                  onConnect={() => onConnectRow(row)}
                />
              ))}
            </ul>
          </div>

          {otherConnectors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-text">
                  More integrations &amp; dynamic toolkits ({otherConnectors.length})
                </h3>
              </div>
              <ul role="list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {otherConnectors.map((row) => (
                  <CatalogCard
                    key={rowId(row)}
                    row={row}
                    connected={isRowConnected(row)}
                    builtIn={rowProvider(row) === 'native'}
                    connectBusy={busyAction === `composio-${rowComposioApp(row) ?? ''}`}
                    onSelect={() => onSelectRow(row)}
                    onConnect={() => onConnectRow(row)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
