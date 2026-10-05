'use client';

import React from 'react';
import { Card, Badge, Skeleton, EmptyState, ErrorState } from '@vaeloom/ui-kit';
import {
  FileTextIcon,
  DatabaseIcon,
  ShieldIcon,
  UsersIcon,
  ClockIcon,
  AlertTriangleIcon,
} from '@vaeloom/ui-kit';
import { formatBytes } from '@/lib/document-format';

export interface DocumentStats {
  totalDocuments: number;
  totalSizeBytes: number;
  cleanScans: number;
  activeShares: number;
  quarantinedFiles: number;
}

/** Filter keys `onFilterClick` understands. Matches the previous prop type. */
export type DocumentStatsFilter = 'all' | 'clean' | 'quarantined' | 'shared';

export interface DocumentStatsBarProps {
  stats?: Partial<DocumentStats>;
  // Direct flat props passed by Hub components
  totalCount?: number;
  totalBytes?: number;
  cleanCount?: number;
  /**
   * Files whose security scan is still in flight. Renders its own card only when
   * supplied; see the module note on honesty below.
   */
  scanningCount?: number;
  quarantinedCount?: number;
  /** Folder count. Renders its own card only when supplied; see `scanningCount`. */
  foldersCount?: number;
  /** Active cross-workspace shares. See the module note on honesty below. */
  activeShares?: number;
  loading?: boolean;
  /**
   * A load failure message. Supplied by the caller because this component cannot
   * tell a failed fetch from an empty result — `[]` is indistinguishable from a
   * request that never came back. Passing it is what keeps "failed" from
   * rendering as "nothing here".
   */
  error?: string | null;
  onRetry?: () => void;
  onFilterClick?: (filter: DocumentStatsFilter) => void;
  className?: string;
}

/**
 * WHY EVERY CARD IS OPTIONAL, AND WHY NOTHING IS DERIVED HERE ANY MORE.
 *
 * There is no `documents` prop. The bar used to take the current page and sum
 * `metadata.size`, `scanStatus` and the row count over it, while taking the
 * document total from the server's unfiltered count — four cards, two
 * denominators, all captioned as if they described the workspace. Every number
 * now arrives from `GET /documents/stats`, which counts the whole workspace, and
 * a card whose field was not supplied is OMITTED rather than defaulted to 0: "0
 * scanning" and "0 clean" are claims about the workspace, and an absent prop is
 * not a claim.
 *
 * That rule is why the "Active Shares" card was omitted for so long:
 * `activeShares` was hardcoded to `0` on both the empty and the derived branch,
 * so the card always rendered `0` under a "Hierarchy & shares / Organized" badge
 * — a number with nothing behind it. Nothing on `DocumentResponse` or
 * `DocumentMetadata` describes a share, so it cannot be derived client-side
 * either; it only exists on the backend. Now that `stats` supplies it, the card
 * appears — and `foldersCount` no longer borrows the shares value to relabel
 * itself.
 */

/** Visible keyboard indicator; matches the ui-kit Button contract. */
const CARD_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100';

/** Static grid classes — Tailwind cannot see an interpolated class name. */
const GRID_BY_CARD_COUNT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
};
const GRID_FALLBACK = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6';

/**
 * Skeleton width, used before the response arrives and therefore before the card
 * count is knowable. Four is the width of the bar the endpoint can fill
 * (total, storage, clean, quarantined) plus the optional ones.
 */
const LOADING_PLACEHOLDERS = 4;

interface MetricCard {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  badge: React.ReactNode;
  caption: string;
  /** Present only when the metric maps onto an `onFilterClick` filter. */
  filterKey?: DocumentStatsFilter;
}

const count = (value: number): string => value.toLocaleString();

/**
 * Accept only a finite number.
 *
 * `undefined`, `null`, `NaN` and a string all collapse to `undefined`, which is
 * what makes "the server did not send this field" and "the server sent
 * nonsense" behave the same way: no card. Both are handled by the bar rather
 * than by `||` fallbacks, which would silently turn a missing count into `0`.
 */
function metricOf(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Badge variant names, taken from the ui-kit `Badge` contract. */
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

const chip = (variant: BadgeVariant, text: string) => (
  <Badge variant={variant} size="sm">
    {text}
  </Badge>
);

export const DocumentStatsBar: React.FC<DocumentStatsBarProps> = ({
  stats,
  totalCount,
  totalBytes,
  cleanCount,
  scanningCount,
  quarantinedCount,
  foldersCount,
  activeShares,
  loading = false,
  error = null,
  onRetry,
  onFilterClick,
  className = '',
}) => {
  // Flat props win over the `stats` object, and both are optional throughout: a
  // metric with no value anywhere is simply not rendered.
  const metrics = React.useMemo(
    () => ({
      totalDocuments: metricOf(totalCount ?? stats?.totalDocuments),
      totalSizeBytes: metricOf(totalBytes ?? stats?.totalSizeBytes),
      cleanScans: metricOf(cleanCount ?? stats?.cleanScans),
      quarantinedFiles: metricOf(quarantinedCount ?? stats?.quarantinedFiles),
      scanning: metricOf(scanningCount),
      folders: metricOf(foldersCount),
      shares: metricOf(activeShares ?? stats?.activeShares),
    }),
    [
      stats,
      totalCount,
      totalBytes,
      cleanCount,
      scanningCount,
      quarantinedCount,
      foldersCount,
      activeShares,
    ],
  );

  const { totalDocuments, totalSizeBytes, cleanScans, quarantinedFiles } = metrics;

  const cards: MetricCard[] = [];

  if (totalDocuments !== undefined) {
    cards.push({
      id: 'total',
      label: 'Total Documents',
      value: count(totalDocuments),
      icon: <FileTextIcon size={18} className="text-text-muted" />,
      badge: chip('default', 'Active'),
      caption: 'Workspace index',
      filterKey: 'all',
    });
  }

  if (totalSizeBytes !== undefined) {
    cards.push({
      id: 'storage',
      label: 'Storage Used',
      value: formatBytes(totalSizeBytes),
      icon: <DatabaseIcon size={18} className="text-text-muted" />,
      badge: chip('primary', 'Encrypted'),
      caption: 'S3 Object Store',
    });
  }

  if (cleanScans !== undefined) {
    cards.push({
      id: 'clean',
      label: 'Clean Scans',
      value: count(cleanScans),
      icon: <ShieldIcon size={18} className="text-success" />,
      badge: chip('success', 'Verified'),
      caption: 'Malware screened',
      filterKey: 'clean',
    });
  }

  // Only shown when the workspace really has scans in flight.
  if (metrics.scanning !== undefined) {
    cards.push({
      id: 'scanning',
      label: 'Scanning',
      value: count(metrics.scanning),
      icon: <ClockIcon size={18} className="text-warning" />,
      badge: chip(
        metrics.scanning > 0 ? 'warning' : 'default',
        metrics.scanning > 0 ? 'In Progress' : 'Queue Clear',
      ),
      caption: 'Security scan pending',
    });
  }

  // No icon: the ui-kit ships no folder glyph, and borrowing a users/briefcase
  // icon would label the number with the wrong metaphor.
  if (metrics.folders !== undefined) {
    cards.push({
      id: 'folders',
      label: 'Folders',
      value: count(metrics.folders),
      icon: null,
      badge: chip('default', 'Organized'),
      caption: 'Folder hierarchy',
    });
  }

  if (metrics.shares !== undefined) {
    cards.push({
      id: 'shares',
      label: 'Active Shares',
      value: count(metrics.shares),
      icon: <UsersIcon size={18} className="text-info" />,
      badge: chip(
        metrics.shares > 0 ? 'info' : 'default',
        metrics.shares > 0 ? 'Shared Out' : 'Not Shared',
      ),
      caption: 'Cross-workspace shares',
      filterKey: 'shared',
    });
  }

  if (quarantinedFiles !== undefined) {
    cards.push({
      id: 'quarantined',
      label: 'Quarantined / Alerts',
      value: count(quarantinedFiles),
      icon: (
        <AlertTriangleIcon
          size={18}
          className={quarantinedFiles > 0 ? 'text-error' : 'text-text-muted'}
        />
      ),
      badge: chip(
        quarantinedFiles > 0 ? 'error' : 'default',
        quarantinedFiles > 0 ? 'Threat Alert' : 'Zero Threats',
      ),
      caption: quarantinedFiles > 0 ? 'Requires attention' : 'No infected files',
      filterKey: 'quarantined',
    });
  }

  if (loading) {
    // `role="status"` on the container, not just an `aria-label` on a plain div —
    // the previous version put the label on an element with no role, so assistive
    // tech never announced it and a screen-reader user got silent skeletons.
    return (
      <div
        className={`grid ${GRID_BY_CARD_COUNT[LOADING_PLACEHOLDERS] ?? GRID_FALLBACK} gap-3 sm:gap-4 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Loading document metrics…</span>
        {Array.from({ length: LOADING_PLACEHOLDERS }).map((_, i) => (
          <Card key={i} padding="sm" className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-6 h-6 rounded-md" />
            </div>
            <Skeleton className="w-24 h-7" />
            <Skeleton className="w-20 h-4" />
          </Card>
        ))}
      </div>
    );
  }

  // A failed fetch must never be indistinguishable from "nothing here", so the
  // error branch comes before every other branch.
  if (error) {
    return (
      <ErrorState
        title="Could not load document metrics"
        message={error}
        onRetry={onRetry}
        actionText="Retry"
        className={className}
      />
    );
  }

  // An explicitly empty workspace is a real, distinct answer from a failure — but
  // only when there is nothing else worth showing. A workspace can hold folders
  // and shares with zero documents, and collapsing the bar into an empty state
  // would hide counts the server just told us about.
  if (totalDocuments === 0 && cards.length === 1) {
    return (
      <EmptyState
        icon={<FileTextIcon size={24} />}
        title="No documents in this workspace"
        description="Upload a file or create a folder to start building the workspace index. The counters above fill in as documents arrive."
        className={className}
      />
    );
  }

  // The server answered but carried no metric at all. There is nothing honest to
  // render: an empty grid would be invisible, and the cards below are all zeros or
  // absent values. Deliberately silent rather than an invented "all 0".
  if (cards.length === 0) return null;

  const gridClass = GRID_BY_CARD_COUNT[cards.length] ?? GRID_FALLBACK;

  const renderCardBody = (card: MetricCard): React.ReactNode => (
    <>
      <div>
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-xs font-medium text-text-muted truncate">{card.label}</span>
          {card.icon && <div className="p-1 rounded-md bg-surface-100 shrink-0">{card.icon}</div>}
        </div>
        <div className="text-2xl font-bold tracking-tight text-text tabular-nums">{card.value}</div>
      </div>
      <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between gap-1">
        <span className="text-xs text-text-muted truncate">{card.caption}</span>
        {card.badge}
      </div>
    </>
  );

  return (
    <div
      className={`grid ${gridClass} gap-3 sm:gap-4 ${className}`}
      aria-label="Document workspace metrics"
    >
      {cards.map((card) => {
        // `Card` forwards `onClick` onto a plain <div>, so a clickable Card has
        // no role, no tab stop and no key handler. Rather than inherit that, the
        // filterable variant is a real <button> — reachable, operable, and
        // visibly focusable — and the static variant stays a plain Card.
        if (card.filterKey && onFilterClick) {
          const filterKey = card.filterKey;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onFilterClick(filterKey)}
              aria-label={`Filter documents by ${card.label}`}
              className={`flex flex-col justify-between text-left rounded-xl bg-surface border border-border shadow-card p-3 transition-colors hover:bg-surface-hover hover:border-border-strong ${CARD_FOCUS}`}
            >
              {renderCardBody(card)}
            </button>
          );
        }
        return (
          <Card key={card.id} padding="sm" className="flex flex-col justify-between">
            {renderCardBody(card)}
          </Card>
        );
      })}
    </div>
  );
};
