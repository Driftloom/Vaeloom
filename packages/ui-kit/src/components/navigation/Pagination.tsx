import React from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import { Button } from '../Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1 && !totalRecords) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted py-3 px-1 ${className}`}
      aria-label="Pagination Navigation"
    >
      <div>
        {totalRecords !== undefined ? (
          <span>
            Showing{' '}
            <strong className="font-mono text-text">
              {Math.min((currentPage - 1) * (pageSize || 10) + 1, totalRecords)}
            </strong>{' '}
            to{' '}
            <strong className="font-mono text-text">
              {Math.min(currentPage * (pageSize || 10), totalRecords)}
            </strong>{' '}
            of <strong className="font-mono text-text">{totalRecords}</strong> results
          </span>
        ) : (
          <span>
            Page <strong className="font-mono text-text">{currentPage}</strong> of{' '}
            <strong className="font-mono text-text">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous Page"
        >
          <ChevronLeftIcon size={14} className="mr-1" />
          Previous
        </Button>

        <span className="font-mono px-2 text-text">
          {currentPage} / {totalPages || 1}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next Page"
        >
          Next
          <ChevronRightIcon size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
