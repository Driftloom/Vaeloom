import React from 'react';

/**
 * Canonical page header (Phase 02A / F-23).
 *
 * Standardizes page title (single h1), description, and action area with
 * responsive stacking. Pages keep contextual content; the structure is what
 * is standardized. The previous dead implementation used text-2xl bold,
 * which contradicted the de-facto workspace standard
 * (`text-3xl font-display font-medium`) — this version matches it.
 */

interface PageHeaderProps {
  /** Single h1 for the page — required. */
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 ${className}`}
    >
      <div>
        <h1 className="text-3xl font-display font-medium text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
