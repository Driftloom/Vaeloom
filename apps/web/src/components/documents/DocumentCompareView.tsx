'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Badge,
  Button,
  Select,
  Spinner,
  Alert,
  EmptyState,
  ErrorState,
  AlertCircleIcon,
  SparklesIcon,
} from '@vaeloom/ui-kit';
import {
  documentApi,
  type DocumentCompareResponse,
  type DocumentVersionResponse,
} from '@/lib/api-client';
import { formatDate, PLACEHOLDER } from '@/lib/document-format';

export interface DocumentCompareViewProps {
  documentId: string;
  workspaceId: string;
  versions?: DocumentVersionResponse[];
  initialVersionA?: number;
  initialVersionB?: number;
  className?: string;
}

type DiffDisplayMode = 'unified' | 'side-by-side';

/** Visible keyboard indicator; matches the ui-kit Button/IconButton contract. */
const TOGGLE_FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100';

type DiffLineKind = 'added' | 'removed' | 'hunk' | 'unchanged';

interface ClassifiedDiffLine {
  text: string;
  kind: DiffLineKind;
}

/**
 * Classify one line of a unified diff.
 *
 * `+++`/`---` file headers are folded into `hunk` rather than dropped so the
 * line numbers the table renders stay aligned with the raw snippet the backend
 * produced.
 */
function classifyDiffLine(line: string): ClassifiedDiffLine {
  if (line.startsWith('@@')) return { text: line, kind: 'hunk' };
  if (line.startsWith('+++') || line.startsWith('---')) return { text: line, kind: 'hunk' };
  if (line.startsWith('+')) return { text: line.substring(1), kind: 'added' };
  if (line.startsWith('-')) return { text: line.substring(1), kind: 'removed' };
  return { text: line.startsWith(' ') ? line.substring(1) : line, kind: 'unchanged' };
}

const DIFF_ROW_STYLE: Record<DiffLineKind, string> = {
  added: 'bg-success/10 text-success',
  removed: 'bg-error/10 text-error',
  hunk: 'text-accent font-semibold bg-surface-200',
  unchanged: 'text-text-muted',
};

const DIFF_ROW_GLYPH: Record<DiffLineKind, string> = {
  added: '+',
  removed: '-',
  hunk: '',
  unchanged: '',
};

/** Screen-reader word for a diff row's change column. */
const DIFF_ROW_WORD: Record<DiffLineKind, string> = {
  added: 'Added',
  removed: 'Removed',
  hunk: 'Hunk header',
  unchanged: 'Unchanged',
};

/**
 * Unified diff as a real `<table>`.
 *
 * It was three sibling `<div>`s per line, so the line number, the +/- glyph and
 * the content were three unlabelled runs of text with no relationship between
 * them. A table with a caption and column headers keeps the line-number ↔
 * content pairing that sighted users get from the fixed-width gutter.
 */
const UnifiedDiffTable: React.FC<{ lines: ClassifiedDiffLine[] }> = ({ lines }) => (
  <div className="font-mono text-xs overflow-auto rounded-lg border border-border bg-surface-100 p-3 max-h-[500px]">
    <table className="w-full border-collapse">
      <caption className="sr-only">
        Unified diff between the two selected versions. Each row gives the line number, whether the
        line was added or removed, and the line content.
      </caption>
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-text-muted">
          <th scope="col" className="w-10 text-right font-normal pr-2">
            Line
          </th>
          <th scope="col" className="w-6 text-center font-normal">
            <span className="sr-only">Change</span>
          </th>
          <th scope="col" className="text-left font-normal">
            Content
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr key={idx} className={DIFF_ROW_STYLE[line.kind]}>
            <td className="align-top select-none text-[10px] text-text-muted/60 text-right pr-2 tabular-nums">
              {idx + 1}
            </td>
            <td className="align-top select-none text-center font-bold w-4">
              <span aria-hidden="true">{DIFF_ROW_GLYPH[line.kind]}</span>
              <span className="sr-only">{DIFF_ROW_WORD[line.kind]}</span>
            </td>
            <td className="align-top whitespace-pre-wrap break-all">{line.text || ' '}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/**
 * Side-by-side diff as a two-column `<table>` with one row per aligned pair.
 *
 * The previous version rendered two independent vertical stacks in two column
 * divs, so the base line and the target line that share a row were never related
 * in the DOM — the visual "side by side" did not exist for a screen reader, and
 * the two stacks drifted out of alignment as soon as one side had more lines.
 */
const SideBySideDiffTable: React.FC<{
  left: string[];
  right: string[];
  versionA: number;
  versionB: number;
}> = ({ left, right, versionA, versionB }) => {
  const rowCount = Math.max(left.length, right.length);
  const rows = Array.from({ length: rowCount }, (_, i) => ({ left: left[i], right: right[i] }));

  return (
    <div className="overflow-auto rounded-lg border border-border bg-surface-200 p-2">
      <table className="w-full border-collapse font-mono text-xs table-fixed">
        <caption className="sr-only">
          Side-by-side diff. The left column is version {versionA} and the right column is version{' '}
          {versionB}; each row pairs one line from each version.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="text-[11px] font-bold text-text-muted px-2 py-1 border-b border-border mb-1 text-left"
            >
              Version {versionA} (Base)
            </th>
            <th
              scope="col"
              className="text-[11px] font-bold text-text-muted px-2 py-1 border-b border-border mb-1 text-left"
            >
              Version {versionB} (Target)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ left: l, right: r }, i) => (
            <tr key={i}>
              <td
                className={`align-top px-2 py-0.5 whitespace-pre-wrap break-all ${
                  l === undefined ? 'bg-surface-100' : 'bg-error/10 text-error'
                }`}
              >
                {l ?? ''}
                {l !== undefined && <span className="sr-only"> (removed in this comparison)</span>}
              </td>
              <td
                className={`align-top px-2 py-0.5 whitespace-pre-wrap break-all ${
                  r === undefined ? 'bg-surface-100' : 'bg-success/10 text-success'
                }`}
              >
                {r ?? ''}
                {r !== undefined && <span className="sr-only"> (added in this comparison)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const DocumentCompareView: React.FC<DocumentCompareViewProps> = ({
  documentId,
  workspaceId,
  versions: initialVersions,
  initialVersionA,
  initialVersionB,
  className = '',
}) => {
  const [versions, setVersions] = useState<DocumentVersionResponse[]>(initialVersions ?? []);
  // Starts "loading" when no version data was handed in, so the first paint is a
  // loading state rather than a flash of "no version history".
  const [loadingVersions, setLoadingVersions] = useState(
    initialVersions === undefined || initialVersions.length === 0,
  );
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionA, setVersionA] = useState<number | null>(initialVersionA ?? null);
  const [versionB, setVersionB] = useState<number | null>(initialVersionB ?? null);
  const [compareData, setCompareData] = useState<DocumentCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<DiffDisplayMode>('unified');

  // Load versions if not provided (an empty array counts as "not provided": the
  // caller is still loading, and inventing options for it would be a lie).
  const fetchVersions = useCallback(async () => {
    if (!documentId || !workspaceId) {
      setLoadingVersions(false);
      return;
    }
    setLoadingVersions(true);
    setVersionsError(null);
    try {
      setVersions(await documentApi.listVersions(documentId, workspaceId));
    } catch (err) {
      // Previously swallowed with `.catch(() => {})`, which made a failed
      // request indistinguishable from a document that genuinely has no versions.
      setVersionsError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoadingVersions(false);
    }
  }, [documentId, workspaceId]);

  useEffect(() => {
    if (initialVersions && initialVersions.length > 0) {
      setVersions(initialVersions);
      setLoadingVersions(false);
      return;
    }
    void fetchVersions();
  }, [initialVersions, fetchVersions]);

  const sortedVersions = React.useMemo(
    () => [...versions].sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0)),
    [versions],
  );

  /** The two newest versions — the default comparison pair. */
  const newestPair = React.useMemo(() => {
    const last = sortedVersions[sortedVersions.length - 1];
    const secondLast = sortedVersions[sortedVersions.length - 2];
    return { a: secondLast?.versionNumber ?? null, b: last?.versionNumber ?? null };
  }, [sortedVersions]);

  // Reconcile the selected pair against the versions that actually exist, so a
  // stale or invented selection cannot leave a `<Select>` showing no match.
  useEffect(() => {
    if (sortedVersions.length === 0) return;
    const numbers = new Set(sortedVersions.map((v) => v.versionNumber));
    const nextA = versionA !== null && numbers.has(versionA) ? versionA : newestPair.a;
    const nextB = versionB !== null && numbers.has(versionB) ? versionB : newestPair.b;
    if (nextA !== null && nextA !== versionA) setVersionA(nextA);
    if (nextB !== null && nextB !== versionB) setVersionB(nextB);
  }, [sortedVersions, newestPair, versionA, versionB]);

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

  const canCompare = sortedVersions.length >= 2 && versionA !== null && versionB !== null;

  /** The pair currently being compared, or null when the selection is unusable. */
  const activePair =
    canCompare && versionA !== versionB ? { a: versionA as number, b: versionB as number } : null;

  // Changing either selection auto-runs the comparison. The `role="status"`
  // region below announces "Comparing vA with vB", which is what makes that
  // implicit behaviour legible instead of a silent refetch.
  useEffect(() => {
    if (!canCompare || versionA === versionB) return;
    void executeCompare(versionA, versionB);
  }, [canCompare, versionA, versionB, executeCompare]);

  const versionOptions = React.useMemo(
    () =>
      sortedVersions.map((v) => {
        const num = v.versionNumber ?? 1;
        // `formatDate` cannot emit "Invalid Date"; the inline
        // `toLocaleDateString` could, for a row whose `created_at` is unparseable.
        const formatted = formatDate(v.createdAt, {
          options: {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          },
        });
        return {
          value: String(num),
          label: formatted === '—' ? `Version ${num}` : `Version ${num} (${formatted})`,
        };
      }),
    [sortedVersions],
  );

  const similarityRatio = Math.round((compareData?.similarityRatio ?? 0) * 100);
  const wordCountA = compareData?.wordCountA ?? 0;
  const wordCountB = compareData?.wordCountB ?? 0;
  const wordDelta = compareData?.wordCountDelta ?? wordCountB - wordCountA;
  const additionsCount = compareData?.additionsCount ?? compareData?.additions?.length ?? 0;
  const deletionsCount = compareData?.deletionsCount ?? compareData?.deletions?.length ?? 0;
  const summaryText = compareData?.summary || '';
  const diffSnippet = compareData?.diffSnippet ?? '';

  const renderDiffSnippet = (vA: number, vB: number): React.ReactNode => {
    if (!diffSnippet) {
      return (
        <div
          className="p-8 text-center text-xs text-text-muted italic bg-surface-100 rounded-lg border border-border-subtle"
          role="status"
        >
          No textual differences found between Version {vA} and Version {vB}.
        </div>
      );
    }

    const classified = diffSnippet.split('\n').map(classifyDiffLine);

    if (diffMode === 'side-by-side') {
      const originalLines: string[] = [];
      const modifiedLines: string[] = [];
      for (const line of classified) {
        if (line.kind === 'hunk') continue;
        if (line.kind === 'removed') originalLines.push(line.text);
        else if (line.kind === 'added') modifiedLines.push(line.text);
        else {
          originalLines.push(line.text);
          modifiedLines.push(line.text);
        }
      }
      return (
        <SideBySideDiffTable
          left={originalLines}
          right={modifiedLines}
          versionA={vA}
          versionB={vB}
        />
      );
    }

    return <UnifiedDiffTable lines={classified} />;
  };

  const modeButton = (mode: DiffDisplayMode, label: string): React.ReactElement => {
    const active = diffMode === mode;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setDiffMode(mode)}
        className={`px-3 py-1 rounded-md font-medium transition-colors ${TOGGLE_FOCUS} ${
          active ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
        }`}
      >
        {label}
      </button>
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
        <div
          role="group"
          aria-label="Diff display mode"
          className="inline-flex rounded-lg border border-border p-0.5 bg-surface-100 text-xs self-start md:self-auto"
        >
          {modeButton('unified', 'Unified Diff')}
          {modeButton('side-by-side', 'Side-by-Side')}
        </div>
      </div>

      {loadingVersions && (
        <div
          className="py-12 flex flex-col items-center justify-center text-center space-y-3"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner size="lg" />
          <p className="text-sm font-medium text-text">Loading version history...</p>
        </div>
      )}

      {!loadingVersions && versionsError && (
        <ErrorState
          title="Could not load version history"
          message={versionsError}
          onRetry={() => void fetchVersions()}
          actionText="Retry"
          className="my-0"
        />
      )}

      {!loadingVersions && !versionsError && sortedVersions.length === 0 && (
        <EmptyState
          icon={<SparklesIcon size={24} />}
          title="No version history yet"
          description="This document has no saved revisions, so there is nothing to compare. A comparison appears once the document has two or more versions."
        />
      )}

      {!loadingVersions && !versionsError && sortedVersions.length === 1 && (
        <Alert
          variant="info"
          description={`Only one version (v${sortedVersions[0]?.versionNumber ?? PLACEHOLDER}) is available, so there is nothing to compare it against yet. Save another version to enable a comparison.`}
        />
      )}

      {!loadingVersions && !versionsError && sortedVersions.length >= 2 && (
        <>
          {/* Version Selectors Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end p-4 rounded-xl bg-surface-100 border border-border">
            <div className="md:col-span-2">
              <Select
                label="Base Version (A)"
                options={versionOptions}
                value={versionA === null ? '' : String(versionA)}
                onChange={(val: string) => setVersionA(Number(val))}
                disabled={loading || loadingVersions}
              />
            </div>

            <div className="hidden md:flex justify-center items-center pb-2 text-text-muted font-bold">
              <span aria-hidden="true">➔</span>
              <span className="sr-only">compared with</span>
            </div>

            <div className="md:col-span-2">
              <Select
                label="Compare Against (B)"
                options={versionOptions}
                value={versionB === null ? '' : String(versionB)}
                onChange={(val: string) => setVersionB(Number(val))}
                disabled={loading || loadingVersions}
              />
            </div>
          </div>

          {/* Same Version Notice */}
          {versionA !== null && versionA === versionB && (
            <div
              role="status"
              className="p-4 rounded-lg bg-surface-100 border border-border text-center text-xs text-text-muted"
            >
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
              {activePair && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => executeCompare(activePair.a, activePair.b)}
                >
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Loading state. role="status" announces the version pair being compared,
              which is the only signal that changing a selector auto-triggers a
              comparison. */}
          {loading && (
            <div
              className="py-12 flex flex-col items-center justify-center text-center space-y-3"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Spinner size="lg" />
              <p className="text-sm font-medium text-text">
                Synthesizing Version Diff (v{versionA} vs v{versionB})...
              </p>
              <p className="text-xs text-text-muted">
                Computing semantic distance and word level modifications.
              </p>
            </div>
          )}

          {/* Comparison Stats & Content. Gated on `activePair` so stale results are
              never shown against a selection that can no longer produce them. */}
          {compareData && activePair && !loading && !error && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card padding="sm" className="space-y-1">
                  <span className="text-xs text-text-muted">Similarity Ratio</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-text tabular-nums">
                      {similarityRatio}%
                    </span>
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
                    <span className="text-xl font-bold text-error tabular-nums">
                      -{deletionsCount}
                    </span>
                    <Badge variant="error" size="sm">
                      Removed
                    </Badge>
                  </div>
                </Card>
              </div>

              {summaryText && (
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <SparklesIcon size={16} className="text-accent" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-accent">
                      AI Diff Synthesis
                    </h4>
                  </div>
                  <p className="text-xs text-text leading-relaxed">{summaryText}</p>
                </div>
              )}

              {((compareData.additions && compareData.additions.length > 0) ||
                (compareData.deletions && compareData.deletions.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {compareData.additions && compareData.additions.length > 0 && (
                    <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-2">
                      <h4 className="font-semibold text-success">
                        Key Additions ({compareData.additions.length})
                      </h4>
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
                      <h4 className="font-semibold text-error">
                        Key Deletions ({compareData.deletions.length})
                      </h4>
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

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                    Raw Content Comparison
                  </h4>
                  <span className="text-xs text-text-muted">
                    {diffMode === 'unified' ? 'Unified view' : 'Side-by-side view'}
                  </span>
                </div>
                {renderDiffSnippet(activePair.a, activePair.b)}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
