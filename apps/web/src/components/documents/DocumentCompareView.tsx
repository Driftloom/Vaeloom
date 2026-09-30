'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Badge,
  Button,
  Select,
  Spinner,
  AlertCircleIcon,
  SparklesIcon,
  RefreshCwIcon,
} from '@vaeloom/ui-kit';
import {
  documentApi,
  type DocumentCompareResponse,
  type DocumentVersionResponse,
} from '@/lib/api-client';

export interface DocumentCompareViewProps {
  documentId: string;
  workspaceId: string;
  versions?: DocumentVersionResponse[];
  initialVersionA?: number;
  initialVersionB?: number;
  className?: string;
}

type DiffDisplayMode = 'unified' | 'side-by-side';

export const DocumentCompareView: React.FC<DocumentCompareViewProps> = ({
  documentId,
  workspaceId,
  versions: initialVersions,
  initialVersionA,
  initialVersionB,
  className = '',
}) => {
  const [versions, setVersions] = useState<DocumentVersionResponse[]>(initialVersions ?? []);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionA, setVersionA] = useState<number>(initialVersionA ?? 1);
  const [versionB, setVersionB] = useState<number>(initialVersionB ?? 2);
  const [compareData, setCompareData] = useState<DocumentCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffDisplayMode>('unified');

  // Load versions if not provided
  useEffect(() => {
    if (initialVersions && initialVersions.length > 0) {
      setVersions(initialVersions);
      return;
    }

    if (!documentId || !workspaceId) return;

    let mounted = true;
    setLoadingVersions(true);
    documentApi
      .listVersions(documentId, workspaceId)
      .then((data) => {
        if (!mounted) return;
        setVersions(data);
        if (data.length >= 2) {
          const sorted = [...data].sort((a, b) => {
            const vA = a.versionNumber ?? a.version_number ?? 0;
            const vB = b.versionNumber ?? b.version_number ?? 0;
            return vA - vB;
          });
          const firstVer =
            sorted[sorted.length - 2]?.versionNumber ??
            sorted[sorted.length - 2]?.version_number ??
            1;
          const secondVer =
            sorted[sorted.length - 1]?.versionNumber ??
            sorted[sorted.length - 1]?.version_number ??
            2;
          setVersionA(firstVer);
          setVersionB(secondVer);
        }
      })
      .catch(() => {
        // Best effort
      })
      .finally(() => {
        if (mounted) setLoadingVersions(false);
      });

    return () => {
      mounted = false;
    };
  }, [documentId, workspaceId, initialVersions]);

  const executeCompare = useCallback(
    async (vA: number, vB: number) => {
      if (!documentId || !workspaceId || vA === vB) return;
      setLoading(true);
      setError(null);

      try {
        const res = await documentApi.compare(documentId, vA, vB, workspaceId);
        setCompareData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to compare document versions');
        setCompareData(null);
      } finally {
        setLoading(false);
      }
    },
    [documentId, workspaceId],
  );

  useEffect(() => {
    if (versionA && versionB && versionA !== versionB) {
      void executeCompare(versionA, versionB);
    }
  }, [versionA, versionB, executeCompare]);

  const versionOptions = React.useMemo(() => {
    if (versions.length === 0) {
      return [
        { value: '1', label: 'Version 1' },
        { value: '2', label: 'Version 2' },
      ];
    }
    return versions.map((v) => {
      const num = v.versionNumber ?? v.version_number ?? 1;
      const dateStr = v.createdAt || v.created_at;
      const formatted = dateStr
        ? new Date(dateStr).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      return {
        value: String(num),
        label: `Version ${num}${formatted ? ` (${formatted})` : ''}`,
      };
    });
  }, [versions]);

  // Derived compare values supporting snake_case / camelCase
  const similarityRatio = Math.round(
    (compareData?.similarityRatio ?? compareData?.similarity_ratio ?? 0) * 100,
  );
  const wordCountA = compareData?.wordCountA ?? compareData?.word_count_a ?? 0;
  const wordCountB = compareData?.wordCountB ?? compareData?.word_count_b ?? 0;
  const wordDelta =
    compareData?.wordCountDelta ?? compareData?.word_count_delta ?? wordCountB - wordCountA;
  const additionsCount =
    compareData?.additionsCount ??
    compareData?.additions_count ??
    compareData?.additions?.length ??
    0;
  const deletionsCount =
    compareData?.deletionsCount ??
    compareData?.deletions_count ??
    compareData?.deletions?.length ??
    0;
  const summaryText = compareData?.summary || '';
  const diffSnippet = compareData?.diffSnippet ?? compareData?.diff_snippet ?? '';

  const renderDiffSnippet = () => {
    if (!diffSnippet) {
      return (
        <div className="p-8 text-center text-xs text-text-muted italic bg-surface-100 rounded-lg border border-border-subtle">
          No textual differences found between Version {versionA} and Version {versionB}.
        </div>
      );
    }

    const lines = diffSnippet.split('\n');

    if (diffMode === 'side-by-side') {
      const originalLines: string[] = [];
      const modifiedLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
          continue;
        }
        if (line.startsWith('-')) {
          originalLines.push(line.substring(1));
        } else if (line.startsWith('+')) {
          modifiedLines.push(line.substring(1));
        } else {
          originalLines.push(line.startsWith(' ') ? line.substring(1) : line);
          modifiedLines.push(line.startsWith(' ') ? line.substring(1) : line);
        }
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs overflow-x-auto rounded-lg border border-border bg-surface-200 p-2">
          {/* Version A Column */}
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-text-muted pb-1 border-b border-border mb-1 px-2">
              Version {versionA} (Base)
            </div>
            {originalLines.map((line, i) => (
              <div
                key={`orig-${i}`}
                className="px-2 py-0.5 rounded bg-error/10 text-error-hover whitespace-pre-wrap break-all"
              >
                {line || '\u00A0'}
              </div>
            ))}
          </div>

          {/* Version B Column */}
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-text-muted pb-1 border-b border-border mb-1 px-2">
              Version {versionB} (Target)
            </div>
            {modifiedLines.map((line, i) => (
              <div
                key={`mod-${i}`}
                className="px-2 py-0.5 rounded bg-success/10 text-success whitespace-pre-wrap break-all"
              >
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Unified Diff Display
    return (
      <div className="font-mono text-xs overflow-x-auto rounded-lg border border-border bg-surface-100 p-3 max-h-[500px] overflow-y-auto space-y-0.5">
        {lines.map((line, idx) => {
          let lineBg = 'text-text-muted';
          let indicator = ' ';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineBg = 'bg-success/10 text-success px-1 rounded';
            indicator = '+';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineBg = 'bg-error/10 text-error px-1 rounded';
            indicator = '-';
          } else if (line.startsWith('@@')) {
            lineBg = 'text-accent font-semibold py-1 bg-surface-200 px-1 rounded';
          }

          return (
            <div
              key={idx}
              className={`whitespace-pre-wrap break-all flex items-start gap-2 ${lineBg}`}
            >
              <span className="select-none text-[10px] text-text-muted/60 w-8 text-right shrink-0">
                {idx + 1}
              </span>
              <span className="select-none w-3 font-bold shrink-0">
                {indicator !== ' ' ? indicator : ''}
              </span>
              <span className="flex-1">{indicator !== ' ' ? line.substring(1) : line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className={`space-y-6 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h3 className="text-lg font-semibold text-text">Version Comparison Diff</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Cross-revision delta analysis, similarity metrics, and AI summary
          </p>
        </div>

        {/* Diff Mode Toggle */}
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-100 text-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setDiffMode('unified')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              diffMode === 'unified'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Unified Diff
          </button>
          <button
            type="button"
            onClick={() => setDiffMode('side-by-side')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              diffMode === 'side-by-side'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {/* Version Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end p-4 rounded-xl bg-surface-100 border border-border">
        <div className="md:col-span-2">
          <Select
            label="Base Version (A)"
            options={versionOptions}
            value={String(versionA)}
            onChange={(val) => setVersionA(Number(val))}
            disabled={loading || loadingVersions}
          />
        </div>

        <div className="hidden md:flex justify-center items-center pb-2 text-text-muted font-bold">
          ➔
        </div>

        <div className="md:col-span-2">
          <Select
            label="Compare Against (B)"
            options={versionOptions}
            value={String(versionB)}
            onChange={(val) => setVersionB(Number(val))}
            disabled={loading || loadingVersions}
          />
        </div>
      </div>

      {/* Same Version Notice */}
      {versionA === versionB && (
        <div className="p-4 rounded-lg bg-surface-100 border border-border text-center text-xs text-text-muted">
          Select two distinct versions above to compute delta diff and metrics.
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-error/10 border border-error/20 text-error flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertCircleIcon size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Comparison Failed</p>
              <p className="text-xs text-error/90 mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => executeCompare(versionA, versionB)}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-text">
            Synthesizing Version Diff (v{versionA} vs v{versionB})...
          </p>
          <p className="text-xs text-text-muted">
            Computing semantic distance and word level modifications.
          </p>
        </div>
      )}

      {/* Comparison Stats & Content */}
      {compareData && !loading && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card padding="sm" className="space-y-1">
              <span className="text-xs text-text-muted">Similarity Ratio</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-text tabular-nums">{similarityRatio}%</span>
                <Badge
                  variant={
                    similarityRatio >= 80
                      ? 'success'
                      : similarityRatio >= 50
                        ? 'warning'
                        : 'primary'
                  }
                  size="sm"
                >
                  {similarityRatio >= 80 ? 'High Match' : 'Substantial Edit'}
                </Badge>
              </div>
            </Card>

            <Card padding="sm" className="space-y-1">
              <span className="text-xs text-text-muted">Word Count Delta</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xl font-bold tabular-nums ${
                    wordDelta > 0 ? 'text-success' : wordDelta < 0 ? 'text-error' : 'text-text'
                  }`}
                >
                  {wordDelta > 0 ? `+${wordDelta}` : wordDelta}
                </span>
                <span className="text-xs text-text-muted">
                  (v{versionA}: {wordCountA} ➔ v{versionB}: {wordCountB})
                </span>
              </div>
            </Card>

            <Card padding="sm" className="space-y-1">
              <span className="text-xs text-text-muted">Additions</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-success tabular-nums">
                  +{additionsCount}
                </span>
                <Badge variant="success" size="sm">
                  Lines/Chunks
                </Badge>
              </div>
            </Card>

            <Card padding="sm" className="space-y-1">
              <span className="text-xs text-text-muted">Deletions</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-error tabular-nums">-{deletionsCount}</span>
                <Badge variant="error" size="sm">
                  Removed
                </Badge>
              </div>
            </Card>
          </div>

          {/* AI Summary Callout */}
          {summaryText && (
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-1.5">
              <div className="flex items-center gap-2">
                <SparklesIcon size={16} className="text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  AI Diff Synthesis
                </span>
              </div>
              <p className="text-xs text-text leading-relaxed">{summaryText}</p>
            </div>
          )}

          {/* Additions & Deletions Highlights */}
          {((compareData.additions && compareData.additions.length > 0) ||
            (compareData.deletions && compareData.deletions.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {compareData.additions && compareData.additions.length > 0 && (
                <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-2">
                  <span className="font-semibold text-success flex items-center gap-1">
                    Key Additions ({compareData.additions.length})
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-text-muted max-h-36 overflow-y-auto">
                    {compareData.additions.map((item, idx) => (
                      <li key={idx} className="truncate">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {compareData.deletions && compareData.deletions.length > 0 && (
                <div className="p-3 rounded-lg border border-error/30 bg-error/5 space-y-2">
                  <span className="font-semibold text-error flex items-center gap-1">
                    Key Deletions ({compareData.deletions.length})
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-text-muted max-h-36 overflow-y-auto">
                    {compareData.deletions.map((item, idx) => (
                      <li key={idx} className="truncate">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Diff Snippet Visualization */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-text uppercase tracking-wider">
                Raw Content Comparison
              </span>
              <span className="text-xs text-text-muted">
                {diffMode === 'unified' ? 'Unified view' : 'Side-by-side view'}
              </span>
            </div>
            {renderDiffSnippet()}
          </div>
        </div>
      )}
    </Card>
  );
};
