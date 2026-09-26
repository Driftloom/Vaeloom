'use client';

import React from 'react';

import { Skeleton } from './Skeleton';
import { MIN_TOUCH_TARGET } from './layout/touchTarget';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  // `value` stays `any` on purpose: narrowing it to `unknown` breaks every
  // existing `render: (val: string) => ...` call site under strictFunctionTypes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  sortBy,
  sortDir,
  onSort,
  emptyMessage = 'No data available',
  emptyIcon,
  loading = false,
  skeletonRows = 5,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const handleHeaderClick = (col: ColumnDef<T>) => {
    if (col.sortable && onSort) {
      onSort(col.key);
    }
  };

  return (
    <div
      className={`w-full overflow-x-auto rounded-lg border border-border bg-surface ${className}`}
    >
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-50/50">
            {columns.map((col) => {
              const isSorted = sortBy === col.key;
              const ariaSort = !col.sortable
                ? undefined
                : !isSorted || !sortDir
                  ? 'none'
                  : sortDir === 'desc'
                    ? 'descending'
                    : 'ascending';
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted ${col.headerClassName || ''}`}
                >
                  {col.sortable ? (
                    // A <th> with only onClick is unreachable by keyboard and
                    // exposes no sort state to assistive tech, so the control is
                    // a real button and the state lives on aria-sort.
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(col)}
                      className={`inline-flex items-center gap-1.5 uppercase tracking-wider text-left rounded hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${MIN_TOUCH_TARGET}`}
                    >
                      <span>{col.header}</span>
                      <span className="flex flex-col text-2xs leading-none" aria-hidden="true">
                        <svg
                          className={`w-3 h-3 ${
                            isSorted && sortDir === 'asc' ? 'text-action' : 'text-text-muted/40'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`}>
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-text-muted">
                <div className="flex flex-col items-center justify-center gap-2">
                  {emptyIcon && <div className="text-text-dim text-xl">{emptyIcon}</div>}
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => {
              const key = keyExtractor(row, rIdx);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-hover' : 'hover:bg-surface-50/40'
                  }`}
                >
                  {columns.map((col) => {
                    const rawVal = (row as Record<string, React.ReactNode>)[col.key];
                    const content = col.render ? col.render(rawVal, row, rIdx) : rawVal;
                    return (
                      <td key={col.key} className={`py-3 px-4 text-text ${col.className || ''}`}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
