'use client';

import React from 'react';
import { Badge } from '@vaeloom/ui-kit';

export interface AuditScoreBannerProps {
  qualityScore: number;
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
}

export function getVerdictBadgeVariant(
  verdict: string,
): 'success' | 'primary' | 'warning' | 'error' | 'default' {
  const norm = verdict.toUpperCase();
  if (norm === 'EXCELLENT') return 'success';
  if (norm === 'GOOD') return 'primary';
  if (norm === 'NEEDS_IMPROVEMENT') return 'warning';
  if (norm === 'CRITICAL_ISSUES') return 'error';
  return 'default';
}

export const AuditScoreBanner: React.FC<AuditScoreBannerProps> = ({
  qualityScore,
  verdict,
  totalChecks,
  passedChecks,
  failedChecks,
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface-100 border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div
          role="img"
          aria-label={`Overall Quality Score: ${qualityScore} out of 100, verdict ${verdict.replace(/_/g, ' ')}`}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold tracking-tight border-4 ${
            qualityScore >= 80
              ? 'border-success text-success bg-success/10'
              : qualityScore >= 60
                ? 'border-warning text-warning bg-warning/10'
                : 'border-error text-error bg-error/10'
          }`}
        >
          {qualityScore}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text">Overall Quality Score</span>
            <Badge variant={getVerdictBadgeVariant(verdict)} size="md">
              {verdict.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Passed {passedChecks} of {totalChecks} checks ({failedChecks} warnings / failures)
          </p>
        </div>
      </div>

      {/* Micro stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted divide-x divide-border">
        <div className="pr-4">
          <span className="block font-semibold text-text text-sm tabular-nums">{totalChecks}</span>
          <span>Total Checks</span>
        </div>
        <div className="px-4">
          <span className="block font-semibold text-success text-sm tabular-nums">
            {passedChecks}
          </span>
          <span>Passed</span>
        </div>
        <div className="pl-4">
          <span className="block font-semibold text-error text-sm tabular-nums">
            {failedChecks}
          </span>
          <span>Attention</span>
        </div>
      </div>
    </div>
  );
};
