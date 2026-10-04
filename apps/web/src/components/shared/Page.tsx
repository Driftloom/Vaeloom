import React from 'react';

/**
 * Canonical page header.
 *
 * The de-facto workspace standard, encoded once. Before this component was
 * adopted the app carried 29 DISTINCT `<h1>` className strings across ~50
 * pages — `text-3xl font-display font-medium text-text mb-2` (25 uses) was the
 * de-facto winner, but `text-2xl font-bold tracking-tight`, `text-xl
 * sm:text-2xl font-bold` and 26 others competed with it. Six pages rendered
 * their heading up to four times because the header block was copy-pasted into
 * the loading, error, empty and success branches.
 *
 * Structure is standardized; page-specific content is not. A page passes its
 * title, optional description, and optional actions. If you need something the
 * slots do not offer, extend this component rather than hand-rolling an `<h1>`
 * — `page-header-a11y.test.tsx` fails the build when a page drifts from it.
 *
 * FULL-BLEED EXEMPTIONS. Some routes legitimately have no title bar and are
 * documented as such in `docs/frontend/page-patterns.md`: the chat and
 * capabilities panes, the resume/monaco editor, the document viewer, and the
 * redirect stubs. Those keep whatever structure they need.
 */

interface PageHeaderProps {
  /** Single h1 for the page — required. */
  title: string;
  description?: string;
  /** Small uppercase label above the title, e.g. the resource category. */
  eyebrow?: string;
  /** Primary/secondary controls, right-aligned on >=sm, stacked below on mobile. */
  actions?: React.ReactNode;
  /**
   * Navigation rendered above the title. Pass a real <nav aria-label="Breadcrumb">
   * — ui-kit exports an accessible `Breadcrumb`, which is preferred over a
   * hand-rolled one.
   */
  breadcrumb?: React.ReactNode;
  /**
   * Overrides the generated id on the h1. Set this when the page needs
   * `aria-labelledby` to point at its heading.
   */
  titleId?: string;
  className?: string;
}

let seq = 0;

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumb,
  titleId,
  className = '',
}: PageHeaderProps) {
  // SSR-safe deterministic-enough id: React 18's useId would be stricter, but
  // this renders in client components only and a counter is stable per mount.
  const fallbackId = React.useMemo(() => `page-title-${++seq}`, []);
  const headingId = titleId ?? fallbackId;

  return (
    <header className={`space-y-3 ${className}`}>
      {breadcrumb}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="eyebrow mb-1.5 text-text-muted">{eyebrow}</p>}
          <h1 id={headingId} className="text-3xl font-display font-medium text-text tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
