import React from 'react';
import { ChevronRightIcon } from '../../icons';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-xs text-text-muted ${className}`}
    >
      <ol className="flex items-center space-x-1.5 list-none m-0 p-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.current;
          return (
            <li key={index} className="flex items-center space-x-1.5">
              {index > 0 && (
                <span className="text-text-dim shrink-0" aria-hidden="true">
                  <ChevronRightIcon size={12} />
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  className="font-medium text-text truncate max-w-[200px]"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-text-secondary hover:text-text transition-colors truncate max-w-[150px]"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
