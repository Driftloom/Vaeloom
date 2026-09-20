'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
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
              return (
                <th
                  key={col.key}
                  scope="col"
                  onClick={() => handleHeaderClick(col)}
                  className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted ${
                    col.sortable ? 'cursor-pointer select-none hover:text-text' : ''
                  } ${col.headerClassName || ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="flex flex-col text-2xs leading-none">
                        <svg
                          className={`w-3 h-3 ${isSorted && sortDir === 'asc' ? 'text-action' : 'text-text-muted/40'}`}
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
                    )}
                  </div>
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
                    const rawVal = (row as any)[col.key];
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
