'use client';

import React from 'react';

import Link from 'next/link';

import { Breadcrumb, Button, type BreadcrumbItem } from '@vaeloom/ui-kit';

import { PageHeader } from '@/components/shared/Page';

/**
 * Shared shell for capability detail subpages (tools / agents / skills /
 * plugins / mcp / connectors). Encodes the workbench skeleton once so every
 * detail page reads the same: header band -> scrollable content column with a
 * section tab strip -> right rail (back control, rail slots, metadata).
 *
 * Canonical classes below are each intended to appear EXACTLY ONCE in a
 * rendered detail page and are asserted as such by
 * `capability-detail-layout.test.tsx` — pages must not duplicate them.
 */
export const CAPABILITY_DETAIL_RAIL_WIDTH = 'w-[350px]';
export const CAPABILITY_DETAIL_RAIL_BORDER = 'border-border-subtle';
export const CAPABILITY_DETAIL_CONTENT_WIDTH = 'max-w-6xl';

export interface CapabilityDetailLayoutProps {
  /** Small uppercase category label above the h1 (renders the .eyebrow utility). */
  eyebrow: string;
  /** Single h1 for the page (PageHeader). */
  title: string;
  description?: string;
  /**href the back control returns to. Rendered as Link -> Button(secondary). */
  backHref: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  /** Metadata lines (typically MetaRow) pinned to the rail, below a divider. */
  meta?: React.ReactNode;
  /** Rail action affordances (e.g. "Chat with Agent"), stacked. */
  actions?: React.ReactNode;
  /** Rail content (e.g. the Enabled switch for tools). */
  rail?: React.ReactNode;
  /**
   * Suppress the shared inspection rail entirely. For subpages whose body is
   * a fuller composite component (e.g. SkillDetailPane) that owns its own
   * secondary pane: hiding the rail keeps the shared chrome (back control,
   * eyebrow, breadcrumbs) without reserving an empty 350px column.
   */
  showRail?: boolean;
  /** Section tab strip rendered above the page content. */
  tabs?: React.ReactNode;
  /** Optional bar pinned under the whole shell. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/** One mono metadata line: uppercase label + optional value. */
export function MetaRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 text-[11px] font-mono text-text-muted ${className}`}
    >
      <span className="uppercase tracking-wider shrink-0">{label}</span>
      {value !== undefined && value !== null && (
        <span className="text-text-secondary truncate text-right">{value}</span>
      )}
    </div>
  );
}

export function CapabilityDetailLayout({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  breadcrumbs,
  meta,
  actions,
  rail,
  showRail = true,
  tabs,
  footer,
  children,
}: CapabilityDetailLayoutProps) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface">
        <PageHeader
          title={title}
          description={description}
          eyebrow={eyebrow}
          breadcrumb={breadcrumbs ? <Breadcrumb items={breadcrumbs} /> : undefined}
        />
      </div>
      <div className="flex-1 min-h-0 flex min-w-0">
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className={`${CAPABILITY_DETAIL_CONTENT_WIDTH} mx-auto space-y-6`}>
            {/* When the rail is suppressed the back control moves to the
                content column so the backHref/backLabel contract still holds. */}
            {!showRail && (
              <div>
                <Link
                  href={backHref}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
                >
                  <Button variant="secondary" size="sm">
                    {backLabel ?? 'Back'}
                  </Button>
                </Link>
              </div>
            )}
            {tabs && <div className="border-b border-border pb-3">{tabs}</div>}
            {children}
          </div>
        </div>
        {showRail && (
          <aside
            className={`${CAPABILITY_DETAIL_RAIL_WIDTH} shrink-0 border-l ${CAPABILITY_DETAIL_RAIL_BORDER} bg-surface flex flex-col overflow-y-auto`}
          >
            <div className="p-4 space-y-4">
              <Link
                href={backHref}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
              >
                <Button variant="secondary" size="sm">
                  {backLabel ?? 'Back'}
                </Button>
              </Link>
              {rail && <div>{rail}</div>}
              {actions && <div className="space-y-2">{actions}</div>}
              {meta && <div className="pt-4 border-t border-border space-y-2">{meta}</div>}
            </div>
          </aside>
        )}
      </div>
      {footer && (
        <div className="shrink-0 border-t border-border bg-surface px-4 sm:px-6 py-3">{footer}</div>
      )}
    </div>
  );
}
