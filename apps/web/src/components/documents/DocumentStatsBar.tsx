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
import type { DocumentResponse } from '@/lib/api-client';
import { formatBytes, scanStateOf } from '@/lib/document-format';

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
  documents?: DocumentResponse[];
  // Direct flat props passed by Hub components
  totalCount?: number;
  totalBytes?: number;
  cleanCount?: number;
  /**
   * Files whose security scan is still in flight. Previously destructured, listed
   * as a `useMemo` dependency and then never read. The card is omitted when the
   * prop is absent rather than defaulting to 0: "0 scanning" is a claim about the
   * workspace and an absent prop is not.
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
 * WHY THE SHARES / FOLDERS / SCANNING CARDS ARE OPTIONAL.
 *
 * `activeShares` was hardcoded to `0` on both the empty and the derived branch, so
 * the "Active Shares" card always rendered `0` while captioned "Hierarchy &
 * shares" with an "Organized" badge — a number with nothing behind it. Nothing on
 * `DocumentResponse` or `DocumentMetadata` describes a share, so it cannot be
 * derived client-side either; it only exists on the backend. The card renders ONLY
 * when a real number is supplied. Relabelling the hardcoded 0 would have been a
 * fabricated number wearing a better hat. `foldersCount` had the mirror-image bug:
 * its presence switched the label to "Folders & Shares" while the value stayed
 * `activeShares`. Both now drive their own labelled cards.
 *
 * `scanningCount` was destructured, listed as a `useMemo` dependency, and never
 * read — ESLint flagged the unused dependency and the number was silently dropped.
 */

/**
 * The size the backend recorded, in bytes. `DocumentMetadata` declares `size`
 * (`len(content)`), not `size_bytes`. There is deliberately no fallback to the
 * legacy key: rows written before the rename carry `size`, because `size` is
 * what the backend has always written (`document_service.py:443`).
 */
function documentSizeBytes(doc: DocumentResponse): number {
  const raw = doc.metadata?.size ?? null;
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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

/** Badge variant names, taken from the ui-kit `Badge` contract. */
type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

const chip = (variant: BadgeVariant, text: string) => (
  <Badge variant={variant} size="sm">
    {text}
  </Badge>
);

export const DocumentStatsBar: React.FC<DocumentStatsBarProps> = ({
  stats,
  documents,
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
  // Compute metrics supporting flat props, stats object, or documents array.
  const computed = React.useMemo(() => {
    const derived = {
      totalDocuments: 0,
      totalSizeBytes: 0,
      cleanScans: 0,
      scanning: 0,
      quarantinedFiles: 0,
    };

    if (documents) {
      derived.totalDocuments = documents.length;
      for (const doc of documents) {
        derived.totalSizeBytes += documentSizeBytes(doc);
        // `scanStateOf` is the case-insensitive mapper; the previous
        // `doc.scanStatus === 'CLEAN'` string compares classified every
        // lowercase row (which the backend does write) as neither clean nor
        // quarantined, so both badges silently dropped to 0.
        const state = scanStateOf(doc.scanStatus);
        if (state === 'clean') derived.cleanScans += 1;
        else if (state === 'quarantined') derived.quarantinedFiles += 1;
        else if (state === 'scanning') derived.scanning += 1;
      }
    }

    const totalDocuments = totalCount ?? stats?.totalDocuments ?? derived.totalDocuments;
    const totalSizeBytes = totalBytes ?? stats?.totalSizeBytes ?? derived.totalSizeBytes;
    const cleanScans = cleanCount ?? stats?.cleanScans ?? derived.cleanScans;
    const quarantinedFiles =
      quarantinedCount ?? stats?.quarantinedFiles ?? derived.quarantinedFiles;

    return {
      totalDocuments,
      totalSizeBytes,
      cleanScans,
      quarantinedFiles,
      // Derived-only, and only trusted when no explicit count was supplied.
      scanning: scanningCount ?? derived.scanning,
      scanningProvided: scanningCount !== undefined,
      foldersProvided: foldersCount !== undefined,
      sharesProvided: activeShares !== undefined || stats?.activeShares !== undefined,
      shares: activeShares ?? stats?.activeShares ?? 0,
      folders: foldersCount ?? 0,
      /** An explicitly supplied source of truth exists, so 0 means "really 0". */
      hasDataSource:
        totalCount !== undefined ||
        documents !== undefined ||
        stats !== undefined ||
        totalBytes !== undefined,
    };
  }, [
    stats,
    documents,
    totalCount,
    totalBytes,
    cleanCount,
    scanningCount,
    quarantinedCount,
    foldersCount,
    activeShares,
  ]);

  const { totalDocuments, totalSizeBytes, cleanScans, quarantinedFiles } = computed;

  const cards: MetricCard[] = [
    {
      id: 'total',
      label: 'Total Documents',
      value: count(totalDocuments),
      icon: <FileTextIcon size={18} className="text-text-muted" />,
      badge: chip('default', 'Active'),
      caption: 'Workspace index',
      filterKey: 'all',
    },
    {
      id: 'storage',
      label: 'Storage Used',
      value: formatBytes(totalSizeBytes),
      icon: <DatabaseIcon size={18} className="text-text-muted" />,
      badge: chip('primary', 'Encrypted'),
      caption: 'S3 Object Store',
    },
    {
      id: 'clean',
      label: 'Clean Scans',
      value: count(cleanScans),
      icon: <ShieldIcon size={18} className="text-success" />,
      badge: chip('success', 'Verified'),
      caption: 'Malware screened',
      filterKey: 'clean',
    },
  ];

  // Only shown when the workspace really has scans in flight.
  if (computed.scanningProvided) {
    cards.push({
      id: 'scanning',
      label: 'Scanning',
      value: count(computed.scanning),
      icon: <ClockIcon size={18} className="text-warning" />,
      badge: chip(
        computed.scanning > 0 ? 'warning' : 'default',
        computed.scanning > 0 ? 'In Progress' : 'Queue Clear',
      ),
      caption: 'Security scan pending',
    });
  }

  // No icon: the ui-kit ships no folder glyph, and borrowing a users/briefcase
  // icon would label the number with the wrong metaphor.
  if (computed.foldersProvided) {
    cards.push({
      id: 'folders',
      label: 'Folders',
      value: count(computed.folders),
      icon: null,
      badge: chip('default', 'Organized'),
      caption: 'Folder hierarchy',
    });
  }

  if (computed.sharesProvided) {
    cards.push({
      id: 'shares',
      label: 'Active Shares',
      value: count(computed.shares),
      icon: <UsersIcon size={18} className="text-info" />,
      badge: chip(
        computed.shares > 0 ? 'info' : 'default',
        computed.shares > 0 ? 'Shared Out' : 'Not Shared',
      ),
      caption: 'Cross-workspace shares',
      filterKey: 'shared',
    });
  }

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

  if (loading) {
    // `role="status"` on the container, not just an `aria-label` on a plain div —
    // the previous version put the label on an element with no role, so assistive
    // tech never announced it and a screen-reader user got silent skeletons.
    const loadingCount = cards.length;
    return (
      <div
        className={`grid ${GRID_BY_CARD_COUNT[loadingCount] ?? GRID_FALLBACK} gap-3 sm:gap-4 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Loading document metrics…</span>
        {Array.from({ length: loadingCount }).map((_, i) => (
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

  // An explicitly empty workspace is a real, distinct answer from a failure.
  if (computed.hasDataSource && totalDocuments === 0) {
    return (
      <EmptyState
        icon={<FileTextIcon size={24} />}
        title="No documents in this workspace"
        description="Upload a file or create a folder to start building the workspace index. The counters above fill in as documents arrive."
        className={className}
      />
    );
  }

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
