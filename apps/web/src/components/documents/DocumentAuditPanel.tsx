'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Spinner,
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

import { AuditScoreBanner } from './audit/AuditScoreBanner';
import { AuditCategoryBreakdown } from './audit/AuditCategoryBreakdown';
import { AuditRecommendations } from './audit/AuditRecommendations';
import { AuditChecksList } from './audit/AuditChecksList';

export interface DocumentAuditPanelProps {
  documentId: string;
  workspaceId: string;
  /**
   * A pre-fetched audit to render immediately.
   *
   * The only current caller (`DocumentDetailView`) does not pass this, so every
   * mount starts in the "No Audit Results Yet" empty state and stays there until
   * the user runs an audit. That is deliberate: an audit is an expensive
   * user-initiated action, not something to fire on mount. The prop path is kept
   * correct for a caller that does have a result in hand — `audit` is seeded from
   * it and re-synced whenever the reference changes, and `onAuditComplete` fires
   * on every successful run.
   */
  initialAudit?: DocumentAuditResponse | null;
  onAuditComplete?: (audit: DocumentAuditResponse) => void;
  className?: string;
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

  // Safe extraction from transformKeys-normalized DocumentAuditResponse
  const qualityScore = Math.round(audit?.qualityScore ?? 0);
  const verdict = audit?.verdict ?? 'UNKNOWN';
  const totalChecks = audit?.totalChecks ?? (audit?.checks?.length || 0);
  const passedChecks = audit?.passedChecks ?? audit?.checks?.filter((c) => c.passed).length ?? 0;
  const failedChecks = audit?.failedChecks ?? audit?.checks?.filter((c) => !c.passed).length ?? 0;

  const checks: DocumentAuditCheckItem[] = React.useMemo(() => audit?.checks ?? [], [audit]);
  const categories: Record<string, DocumentAuditCategoryScore> = audit?.categories ?? {};
  const recommendations: string[] = audit?.recommendations ?? [];

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
            Deterministic rule engines &amp; LLM semantic parseability checks
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
        <div
          className="py-12 flex flex-col items-center justify-center text-center space-y-3"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
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
          <AuditScoreBanner
            qualityScore={qualityScore}
            verdict={verdict}
            totalChecks={totalChecks}
            passedChecks={passedChecks}
            failedChecks={failedChecks}
          />

          <AuditCategoryBreakdown categories={categories} />

          <AuditRecommendations recommendations={recommendations} />

          <AuditChecksList checks={checks} failedChecks={failedChecks} />
        </div>
      )}
    </Card>
  );
};
