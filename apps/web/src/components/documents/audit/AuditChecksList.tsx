'use client';

import React, { useState, useMemo } from 'react';
import { Badge, CheckIcon, AlertTriangleIcon } from '@vaeloom/ui-kit';
import type { DocumentAuditCheckItem } from '@/lib/api-client';

export type CheckFilter = 'all' | 'failed' | 'passed';

export interface AuditChecksListProps {
  checks: DocumentAuditCheckItem[];
  failedChecks: number;
}

const TOGGLE_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100';

export const AuditChecksList: React.FC<AuditChecksListProps> = ({ checks, failedChecks }) => {
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('all');

  const filteredChecks = useMemo(() => {
    if (checkFilter === 'failed') return checks.filter((c) => !c.passed);
    if (checkFilter === 'passed') return checks.filter((c) => c.passed);
    return checks;
  }, [checks, checkFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
          Inspection Checks ({filteredChecks.length})
        </h4>

        {/* Filter controls */}
        <div
          role="group"
          aria-label="Filter inspection checks"
          className="inline-flex rounded-lg border border-border p-0.5 bg-surface-100 text-xs"
        >
          {(['all', 'failed', 'passed'] as CheckFilter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={checkFilter === tab}
              onClick={() => setCheckFilter(tab)}
              className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${TOGGLE_FOCUS} ${
                checkFilter === tab
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab}
              {tab === 'failed' && failedChecks > 0 && (
                <span className="ml-1 text-error font-semibold">({failedChecks})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filteredChecks.length === 0 ? (
        <p role="status" className="text-xs text-text-muted italic py-3 text-center">
          {checks.length === 0
            ? 'This audit reported no individual checks.'
            : 'No checks match the selected filter.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredChecks.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs transition-colors ${
                item.passed ? 'bg-surface-50 border-border-subtle' : 'bg-error/5 border-error/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div
                    aria-hidden="true"
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.passed ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                    }`}
                  >
                    {item.passed ? <CheckIcon size={10} /> : <AlertTriangleIcon size={10} />}
                  </div>
                  <div>
                    <span className="font-semibold text-text">{item.name}</span>
                    <span className="ml-2 text-[10px] text-text-muted uppercase tracking-wider">
                      ({item.category})
                    </span>
                    <p className="text-text-muted mt-1 leading-normal">{item.detail}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right space-y-1">
                  <Badge variant={item.passed ? 'success' : 'error'} size="sm">
                    {item.passed ? 'Passed' : 'Failed'}
                  </Badge>
                  <div
                    className={`font-semibold tabular-nums ${
                      item.passed ? 'text-success' : 'text-error'
                    }`}
                  >
                    {item.passed ? `+${item.score}` : '0'} pts
                  </div>
                </div>
              </div>

              {item.recommendation && (
                <div className="mt-2.5 pt-2 border-t border-border-subtle/50 flex items-start gap-1.5 text-accent text-[11px]">
                  <span className="font-medium shrink-0">Recommendation:</span>
                  <span>{item.recommendation}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
