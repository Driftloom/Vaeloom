'use client';

import React from 'react';
import { Progress } from '@vaeloom/ui-kit';
import type { DocumentAuditCategoryScore } from '@/lib/api-client';

export interface AuditCategoryBreakdownProps {
  categories: Record<string, DocumentAuditCategoryScore>;
}

export function formatCategoryName(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export const AuditCategoryBreakdown: React.FC<AuditCategoryBreakdownProps> = ({ categories }) => {
  const categoryKeys = Object.keys(categories);
  if (categoryKeys.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
        Category Breakdown
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(categories).map(([catKey, catScore]) => {
          const pct = Math.min(100, Math.max(0, Math.round(catScore.score)));
          const progressVariant: 'success' | 'warning' | 'primary' =
            pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'primary';
          const categoryName = formatCategoryName(catKey);

          return (
            <div
              key={catKey}
              className="p-3 rounded-lg bg-surface-50 border border-border-subtle space-y-1.5"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-text">{categoryName}</span>
                <span className="text-text-muted tabular-nums">
                  {catScore.passed}/{catScore.total} passed ({pct}%)
                </span>
              </div>
              <Progress
                value={pct}
                max={100}
                size="sm"
                variant={progressVariant}
                label={`${categoryName} score`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
