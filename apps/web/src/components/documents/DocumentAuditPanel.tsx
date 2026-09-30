'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Badge,
  Button,
  Progress,
  Spinner,
  CopyIcon,
  CheckIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  SparklesIcon,
  RefreshCwIcon,
} from '@vaeloom/ui-kit';
import {
  documentApi,
  type DocumentAuditResponse,
  type DocumentAuditCheckItem,
  type DocumentAuditCategoryScore,
} from '@/lib/api-client';

export interface DocumentAuditPanelProps {
  documentId: string;
  workspaceId: string;
  initialAudit?: DocumentAuditResponse | null;
  onAuditComplete?: (audit: DocumentAuditResponse) => void;
  className?: string;
}

type CheckFilter = 'all' | 'failed' | 'passed';

function getVerdictBadgeVariant(
  verdict: string,
): 'success' | 'primary' | 'warning' | 'error' | 'default' {
  const norm = verdict.toUpperCase();
  if (norm === 'EXCELLENT') return 'success';
  if (norm === 'GOOD') return 'primary';
  if (norm === 'NEEDS_IMPROVEMENT') return 'warning';
  if (norm === 'CRITICAL_ISSUES') return 'error';
  return 'default';
}

function formatCategoryName(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export const DocumentAuditPanel: React.FC<DocumentAuditPanelProps> = ({
  documentId,
  workspaceId,
  initialAudit = null,
  onAuditComplete,
  className = '',
}) => {
  const [audit, setAudit] = useState<DocumentAuditResponse | null>(initialAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkFilter, setCheckFilter] = useState<CheckFilter>('all');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialAudit) {
      setAudit(initialAudit);
    }
  }, [initialAudit]);

  const runAudit = useCallback(async () => {
    if (!documentId || !workspaceId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await documentApi.audit(documentId, workspaceId);
      setAudit(res);
      onAuditComplete?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute document quality audit.');
    } finally {
      setLoading(false);
    }
  }, [documentId, workspaceId, onAuditComplete]);

  const handleCopyRecommendation = useCallback((text: string, index: number) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  // Safe extraction supporting snake_case and camelCase
  const qualityScore = Math.round(audit?.qualityScore ?? audit?.quality_score ?? 0);
  const verdict = audit?.verdict ?? 'UNKNOWN';
  const totalChecks = audit?.totalChecks ?? audit?.total_checks ?? (audit?.checks?.length || 0);
  const passedChecks =
    audit?.passedChecks ??
    audit?.passed_checks ??
    audit?.checks?.filter((c) => c.passed).length ??
    0;
  const failedChecks =
    audit?.failedChecks ??
    audit?.failed_checks ??
    audit?.checks?.filter((c) => !c.passed).length ??
    0;

  const checks: DocumentAuditCheckItem[] = audit?.checks ?? [];
  const categories: Record<string, DocumentAuditCategoryScore> = audit?.categories ?? {};
  const recommendations: string[] = audit?.recommendations ?? [];

  const filteredChecks = React.useMemo(() => {
    if (checkFilter === 'failed') return checks.filter((c) => !c.passed);
    if (checkFilter === 'passed') return checks.filter((c) => c.passed);
    return checks;
  }, [checks, checkFilter]);

  return (
    <Card className={`space-y-6 ${className}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <SparklesIcon size={20} className="text-accent" />
            <h3 className="text-lg font-semibold text-text">AI Document Quality Audit</h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Deterministic rule engines & LLM semantic parseability checks
          </p>
        </div>

        <Button
          variant={audit ? 'outline' : 'primary'}
          size="sm"
          loading={loading}
          onClick={runAudit}
          className="shrink-0"
        >
          {loading ? (
            'Running Audit...'
          ) : audit ? (
            <>
              <RefreshCwIcon size={14} className="mr-1.5" />
              Re-run Audit
            </>
          ) : (
            <>
              <SparklesIcon size={14} className="mr-1.5" />
              Run AI Audit
            </>
          )}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-error/10 border border-error/20 text-error flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Audit Failed</p>
              <p className="text-xs text-error/90 mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={runAudit}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state without prior audit */}
      {loading && !audit && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-text">Auditing Document Quality...</p>
          <p className="text-xs text-text-muted max-w-sm">
            Scanning 50+ semantic heuristics, formatting constraints, prompt-injection risks, and
            ATS compatibility.
          </p>
        </div>
      )}

      {/* Empty State before any audit */}
      {!audit && !loading && !error && (
        <div className="py-10 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <SparklesIcon size={24} />
          </div>
          <h4 className="text-sm font-semibold text-text">No Audit Results Yet</h4>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Analyze this document against industry ATS parsers, readability heuristics, section
            structure, and executive voice requirements.
          </p>
          <Button variant="primary" size="md" onClick={runAudit} className="mt-2">
            <SparklesIcon size={16} className="mr-2" />
            Run Comprehensive Audit
          </Button>
        </div>
      )}

      {/* Active Audit Results */}
      {audit && (
        <div className="space-y-6">
          {/* Top Score Banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-surface-100 border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold tracking-tight border-4 ${
                  qualityScore >= 80
                    ? 'border-success text-success bg-success/10'
                    : qualityScore >= 60
                      ? 'border-warning text-warning bg-warning/10'
                      : 'border-error text-error bg-error/10'
                }`}
                aria-label={`Overall Quality Score: ${qualityScore} out of 100`}
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
                <span className="block font-semibold text-text text-sm tabular-nums">
                  {totalChecks}
                </span>
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

          {/* Category Breakdown Bars */}
          {Object.keys(categories).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                Category Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(categories).map(([catKey, catScore]) => {
                  const pct = Math.min(100, Math.max(0, Math.round(catScore.score)));
                  const progressVariant: 'success' | 'warning' | 'primary' =
                    pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'primary';

                  return (
                    <div
                      key={catKey}
                      className="p-3 rounded-lg bg-surface-50 border border-border-subtle space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-text">{formatCategoryName(catKey)}</span>
                        <span className="text-text-muted tabular-nums">
                          {catScore.passed}/{catScore.total} passed ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} max={100} size="sm" variant={progressVariant} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actionable AI Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SparklesIcon size={16} className="text-accent" />
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                  AI Actionable Recommendations ({recommendations.length})
                </h4>
              </div>

              <div className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-accent/10 text-accent font-semibold flex items-center justify-center shrink-0 text-[10px]">
                        {idx + 1}
                      </span>
                      <p className="text-text leading-relaxed mt-0.5">{rec}</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyRecommendation(rec, idx)}
                      className="shrink-0 h-7 px-2 text-xs"
                      title="Copy recommendation"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <CheckIcon size={12} className="text-success mr-1" />
                          <span className="text-success">Copied</span>
                        </>
                      ) : (
                        <>
                          <CopyIcon size={12} className="text-text-muted mr-1" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checks List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                Inspection Checks ({filteredChecks.length})
              </h4>

              {/* Filter controls */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-100 text-xs">
                {(['all', 'failed', 'passed'] as CheckFilter[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setCheckFilter(tab)}
                    className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
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
              <p className="text-xs text-text-muted italic py-3 text-center">
                No checks match the selected filter.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredChecks.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border text-xs transition-colors ${
                      item.passed
                        ? 'bg-surface-50 border-border-subtle'
                        : 'bg-error/5 border-error/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {item.passed ? (
                          <div className="w-4 h-4 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0 mt-0.5">
                            <CheckIcon size={10} />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-error/20 text-error flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangleIcon size={10} />
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-text">{item.name}</span>
                          <span className="ml-2 text-[10px] text-text-muted uppercase tracking-wider">
                            ({item.category})
                          </span>
                          <p className="text-text-muted mt-1 leading-normal">{item.detail}</p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            item.passed ? 'text-success' : 'text-error'
                          }`}
                        >
                          {item.passed ? `+${item.score}` : '0'} pts
                        </span>
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
        </div>
      )}
    </Card>
  );
};
