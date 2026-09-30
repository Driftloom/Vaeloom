'use client';

import React from 'react';
import { Card, Badge, Skeleton } from '@vaeloom/ui-kit';
import {
  FileTextIcon,
  DatabaseIcon,
  ShieldIcon,
  UsersIcon,
  AlertTriangleIcon,
} from '@vaeloom/ui-kit';
import type { DocumentResponse } from '@/lib/api-client';

export interface DocumentStats {
  totalDocuments: number;
  totalSizeBytes: number;
  cleanScans: number;
  activeShares: number;
  quarantinedFiles: number;
}

export interface DocumentStatsBarProps {
  stats?: Partial<DocumentStats>;
  documents?: DocumentResponse[];
  // Direct flat props passed by Hub components
  totalCount?: number;
  totalBytes?: number;
  cleanCount?: number;
  scanningCount?: number;
  quarantinedCount?: number;
  foldersCount?: number;
  activeShares?: number;
  loading?: boolean;
  onFilterClick?: (filter: 'all' | 'clean' | 'quarantined' | 'shared') => void;
  className?: string;
}

function formatBytes(bytes: unknown): string {
  const n = typeof bytes === 'number' ? bytes : Number(bytes ?? 0);
  if (!n || isNaN(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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
  onFilterClick,
  className = '',
}) => {
  // Compute metrics supporting flat props, stats object, or documents array
  const computedStats: DocumentStats = React.useMemo(() => {
    // If flat props are explicitly passed
    if (totalCount !== undefined || totalBytes !== undefined || cleanCount !== undefined) {
      return {
        totalDocuments: totalCount ?? 0,
        totalSizeBytes: totalBytes ?? 0,
        cleanScans: cleanCount ?? 0,
        activeShares: activeShares ?? foldersCount ?? 0,
        quarantinedFiles: quarantinedCount ?? 0,
      };
    }

    if (stats) {
      return {
        totalDocuments: stats.totalDocuments ?? 0,
        totalSizeBytes: stats.totalSizeBytes ?? 0,
        cleanScans: stats.cleanScans ?? 0,
        activeShares: stats.activeShares ?? 0,
        quarantinedFiles: stats.quarantinedFiles ?? 0,
      };
    }

    if (!documents || documents.length === 0) {
      return {
        totalDocuments: 0,
        totalSizeBytes: 0,
        cleanScans: 0,
        activeShares: 0,
        quarantinedFiles: 0,
      };
    }

    let sizeBytes = 0;
    let clean = 0;
    let quarantined = 0;

    for (const doc of documents) {
      const rawSize =
        doc.metadata?.['size_bytes'] ??
        doc.metadata?.['size'] ??
        (doc as unknown as Record<string, unknown>)['size_bytes'] ??
        0;
      sizeBytes += typeof rawSize === 'number' ? rawSize : Number(rawSize) || 0;

      if (doc.scan_status === 'CLEAN') {
        clean++;
      } else if (doc.scan_status === 'MALICIOUS' || doc.scan_status === 'REJECTED') {
        quarantined++;
      }
    }

    return {
      totalDocuments: documents.length,
      totalSizeBytes: sizeBytes,
      cleanScans: clean,
      activeShares: 0,
      quarantinedFiles: quarantined,
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

  if (loading) {
    return (
      <div
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 ${className}`}
        aria-label="Loading document metrics"
      >
        {Array.from({ length: 5 }).map((_, i) => (
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

  const metricCards = [
    {
      id: 'total',
      label: 'Total Documents',
      value: computedStats.totalDocuments.toLocaleString(),
      icon: <FileTextIcon size={18} className="text-text-muted" />,
      badge: (
        <Badge variant="default" size="sm">
          Active
        </Badge>
      ),
      caption: 'Workspace index',
      clickable: Boolean(onFilterClick),
      onClick: () => onFilterClick?.('all'),
    },
    {
      id: 'storage',
      label: 'Storage Used',
      value: formatBytes(computedStats.totalSizeBytes),
      icon: <DatabaseIcon size={18} className="text-text-muted" />,
      badge: (
        <Badge variant="primary" size="sm">
          Encrypted
        </Badge>
      ),
      caption: 'S3 Object Store',
      clickable: false,
    },
    {
      id: 'clean',
      label: 'Clean Scans',
      value: computedStats.cleanScans.toLocaleString(),
      icon: <ShieldIcon size={18} className="text-success" />,
      badge: (
        <Badge variant="success" size="sm">
          Verified
        </Badge>
      ),
      caption: 'Malware screened',
      clickable: Boolean(onFilterClick),
      onClick: () => onFilterClick?.('clean'),
    },
    {
      id: 'shares',
      label: foldersCount !== undefined ? 'Folders & Shares' : 'Active Shares',
      value: computedStats.activeShares.toLocaleString(),
      icon: <UsersIcon size={18} className="text-info" />,
      badge: (
        <Badge variant="info" size="sm">
          Organized
        </Badge>
      ),
      caption: 'Hierarchy & shares',
      clickable: Boolean(onFilterClick),
      onClick: () => onFilterClick?.('shared'),
    },
    {
      id: 'quarantined',
      label: 'Quarantined / Alerts',
      value: computedStats.quarantinedFiles.toLocaleString(),
      icon: (
        <AlertTriangleIcon
          size={18}
          className={computedStats.quarantinedFiles > 0 ? 'text-error' : 'text-text-muted'}
        />
      ),
      badge: (
        <Badge variant={computedStats.quarantinedFiles > 0 ? 'error' : 'default'} size="sm">
          {computedStats.quarantinedFiles > 0 ? 'Threat Alert' : 'Zero Threats'}
        </Badge>
      ),
      caption: computedStats.quarantinedFiles > 0 ? 'Requires attention' : 'No infected files',
      clickable: Boolean(onFilterClick),
      onClick: () => onFilterClick?.('quarantined'),
    },
  ];

  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 ${className}`}
      role="region"
      aria-label="Document workspace metrics"
    >
      {metricCards.map((card) => {
        const isInteractive = Boolean(card.clickable && card.onClick);
        return (
          <Card
            key={card.id}
            padding="sm"
            hover={isInteractive}
            onClick={card.onClick}
            className={`flex flex-col justify-between transition-colors ${
              isInteractive ? 'cursor-pointer hover:border-action/40' : ''
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs font-medium text-text-muted truncate">{card.label}</span>
                <div className="p-1 rounded-md bg-surface-100 shrink-0">{card.icon}</div>
              </div>
              <div className="text-2xl font-bold tracking-tight text-text tabular-nums">
                {card.value}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between gap-1">
              <span className="text-xs text-text-muted truncate">{card.caption}</span>
              {card.badge}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
