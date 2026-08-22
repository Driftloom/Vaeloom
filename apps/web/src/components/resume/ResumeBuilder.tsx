'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { resumeApi, agentApi, type ResumeResponse } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ProvenanceBadge } from '@/components/shared/ProvenanceBadge';
import { ConfidenceMeter } from '@/components/shared/ConfidenceMeter';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { Modal } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function renderContent(content: Record<string, unknown>): string {
  const sections: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (key === 'name') {
      sections.unshift(String(value));
    } else if (key === 'email' || key === 'phone') {
      sections.push(String(value));
    } else if (Array.isArray(value)) {
      sections.push(`\n${key.toUpperCase()}`);
      for (const item of value) {
        if (typeof item === 'string') {
          sections.push(`  ${item}`);
        } else if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const parts = Object.entries(obj)
            .filter(([k]) => k !== 'source_document_id' && k !== 'is_inferred')
            .map(([, v]) => String(v ?? ''));
          if (parts.length) {
            const inferred = obj['is_inferred'] === true ? ' [inferred]' : '';
            sections.push(`  ${parts.join(' - ')}${inferred}`);
          }
        }
      }
    } else if (typeof value === 'string' && !['name', 'email', 'phone'].includes(key)) {
      sections.push(`${key}: ${value}`);
    }
  }
  return sections.join('\n');
}

function getTrustStats(content: Record<string, unknown>) {
  let inferred = 0;
  let total = 0;
  const sources = new Set<string>();
  for (const value of Object.values(content)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          total++;
          const obj = item as Record<string, unknown>;
          if (obj['is_inferred'] === true) inferred++;
          if (typeof obj['source_document_id'] === 'string')
            sources.add(obj['source_document_id'] as string);
        }
      }
    }
  }
  return { inferred, total, sources: Array.from(sources) };
}

export function ResumeBuilder({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [generating, setGenerating] = useState(false);
  const [targetRole, setTargetRole] = useState('');
  const [diffPair, setDiffPair] = useState<{
    oldText: string;
    newText: string;
    title: string;
  } | null>(null);
  const [atsScores, setAtsScores] = useState<Record<string, number>>({});
  const [atsLoading, setAtsLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resumeApi.list(workspaceId);
      setResumes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const masterResume = resumes.find((r) => r.variant_type === 'master');
  const variants = resumes.filter((r) => r.variant_type !== 'master');

  const handleGenerate = async () => {
    const sourceId = masterResume?.id ?? resumes[0]?.id;
    if (!sourceId) return;
    setGenerating(true);
    try {
      await resumeApi.generate(sourceId, {
        variant_type: targetRole ? 'tailored' : 'generic',
        ...(targetRole && { target_role: targetRole }),
      });
      toast({
        tone: 'success',
        title: 'Variant generated',
        detail: targetRole || 'Generic variant',
      });
      setTargetRole('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variant');
    } finally {
      setGenerating(false);
    }
  };

  const handleAts = async (resume: ResumeResponse) => {
    setAtsLoading(resume.id);
    try {
      const res = (await agentApi.chat({
        workspaceId,
        message: `ats score for resume ${resume.id}`,
        agentName: 'ats',
      })) as Record<string, unknown>;
      const result = (res as { result?: { summary?: string } })?.result;
      const text =
        result?.summary ?? (res as { reply?: string })?.reply ?? JSON.stringify(res).slice(0, 200);
      const match = text.match(/(\d{1,3})\s*%|score[^0-9]*(\d{1,3})/i);
      // F-02: never fabricate a score. If the agent response does not contain
      // a parseable score, surface an honest unavailable state instead.
      if (!match) {
        setAtsScores((m) => {
          const next = { ...m };
          delete next[resume.id];
          return next;
        });
        toast({
          tone: 'info',
          title: 'ATS score unavailable',
          detail: 'The ATS agent did not return a numeric score. Response kept below for review.',
        });
        return;
      }
      const score = Math.min(100, Math.max(0, parseInt(match[1] ?? match[2] ?? '0', 10)));
      setAtsScores((m) => ({ ...m, [resume.id]: score }));
      toast({ tone: 'success', title: 'ATS score', detail: `${score} â€” ${text.slice(0, 120)}` });
    } catch (err) {
      setAtsScores((m) => {
        const next = { ...m };
        delete next[resume.id];
        return next;
      });
      toast({
        tone: 'error',
        title: 'ATS check failed',
        detail:
          err instanceof Error
            ? err.message
            : 'The ATS agent is unavailable. No score was produced.',
      });
    } finally {
      setAtsLoading(null);
    }
  };

  const handleDownload = (resume: ResumeResponse) => {
    const blob = new Blob([JSON.stringify(resume.content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-${resume.variant_type}-v${resume.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDiff = (a: ResumeResponse, b: ResumeResponse) => {
    setDiffPair({
      oldText: renderContent(a.content as Record<string, unknown>),
      newText: renderContent(b.content as Record<string, unknown>),
      title: `${a.variant_type} v${a.version} â†’ ${b.variant_type} v${b.version}`,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">
            Review your master resume, generate tailored variants, and export.
          </p>
        </header>
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Loading resumes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
        </header>
        <ErrorState title="Failed to load resumes" message={error} onRetry={fetchData} />
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">
            Build your master resume and generate tailored variants.
          </p>
        </header>
        <EmptyState
          title="No resumes yet"
          description="Upload documents so the Resume Agent can build your master resume from extracted experience."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">
            Review your master resume, generate tailored variants, and export.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full lg:w-auto">
          <div className="flex-1 sm:flex-none">
            <label
              htmlFor="target-role"
              className="block text-xs font-mono text-text-muted mb-1 uppercase tracking-wider"
            >
              Target Role
            </label>
            <input
              id="target-role"
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="bg-surface border border-border text-text rounded px-3 py-2 text-sm w-full sm:w-64"
            />
          </div>
          <button
            className="btn-primary h-[38px] shrink-0"
            onClick={handleGenerate}
            disabled={generating || resumes.length === 0}
          >
            {generating ? 'Generatingâ€¦' : 'Generate Variant'}
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {masterResume &&
            (() => {
              const stats = getTrustStats(masterResume.content as Record<string, unknown>);
              const ats = atsScores[masterResume.id];
              return (
                <div className="card border-accent/30 bg-accent/5 flex-1 flex flex-col p-0 overflow-hidden">
                  <div className="px-6 py-3 border-b border-accent/20 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display font-medium text-text">Master Resume</h2>
                      <p className="text-xs text-text-muted font-mono">
                        v{masterResume.version} &middot; {formatDate(masterResume.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ProvenanceBadge
                          label="Master"
                          confidence={
                            stats.total ? 1 - stats.inferred / Math.max(stats.total, 1) : 1
                          }
                        />
                        {stats.inferred > 0 && (
                          <span className="rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning">
                            Inferred {stats.inferred}/{stats.total}
                          </span>
                        )}
                        {stats.sources.length > 0 && (
                          <span className="rounded-full bg-success/10 border border-success/30 px-2 py-0.5 text-xs text-success">
                            {stats.sources.length} source docs
                          </span>
                        )}
                        <span className="text-xs text-text-dim font-mono">
                          {stats.inferred
                            ? 'user-confirmed vs inferred distinct â€” verify inferred lines'
                            : 'all lines user-confirmed'}
                        </span>
                      </div>
                      {typeof ats === 'number' && (
                        <ConfidenceMeter value={ats / 100} label={`ATS ${ats}`} />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleAts(masterResume)}
                        disabled={atsLoading === masterResume.id}
                        className="btn-secondary text-xs !px-3 !py-1.5 disabled:opacity-40"
                      >
                        {atsLoading === masterResume.id
                          ? 'Scoringâ€¦'
                          : ats
                            ? `ATS ${ats}`
                            : 'ATS Score'}
                      </button>
                      <button
                        onClick={() => handleDownload(masterResume)}
                        className="btn-ghost border border-border text-xs !px-3 !py-1.5"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <pre className="flex-1 bg-transparent text-text p-6 overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
                    {renderContent(masterResume.content as Record<string, unknown>) || 'No content'}
                  </pre>
                  <p className="px-6 pb-3 text-xs text-text-dim">
                    Lines marked [inferred] need review. Sources linked via Files viewer by Source
                    ID in raw payload.
                  </p>
                </div>
              );
            })()}

          {!masterResume && (
            <div className="card flex-1 flex flex-col p-6">
              <p className="text-text-muted text-sm">
                No master resume found. Variants are shown below.
              </p>
            </div>
          )}
        </div>

        {variants.length > 0 && (
          <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
            <h3 className="font-mono text-sm text-text-muted uppercase tracking-wider">
              Variants ({variants.length})
            </h3>
            <div className="flex flex-col gap-2 lg:overflow-y-auto lg:max-h-[60vh]">
              {variants.map((v) => {
                const ats = atsScores[v.id];
                const st = getTrustStats(v.content as Record<string, unknown>);
                return (
                  <div key={v.id} className="card p-3 border-border/50 text-sm flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-text capitalize">{v.variant_type}</div>
                        <div className="text-xs text-text-muted font-mono mt-1">
                          v{v.version} &middot; {formatDate(v.created_at)}
                        </div>
                      </div>
                      {typeof ats === 'number' && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-mono ${ats >= 80 ? 'bg-success/10 text-success border-success/30' : ats >= 60 ? 'bg-warning/10 text-warning border-warning/30' : 'bg-error/10 text-error border-error/30'}`}
                        >
                          ATS {ats}
                        </span>
                      )}
                    </div>
                    {st.inferred > 0 && (
                      <span className="text-xs text-warning">Inferred {st.inferred} lines</span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => handleAts(v)}
                        disabled={atsLoading === v.id}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover disabled:opacity-40"
                      >
                        {atsLoading === v.id ? 'â€¦' : 'ATS'}
                      </button>
                      <button
                        onClick={() => handleDownload(v)}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                      >
                        Download
                      </button>
                      {masterResume && (
                        <button
                          onClick={() => openDiff(masterResume, v)}
                          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"
                        >
                          Diff
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>
      <Modal
        isOpen={Boolean(diffPair)}
        onClose={() => setDiffPair(null)}
        title={diffPair?.title ?? 'Diff'}
        size="lg"
      >
        {diffPair && <DiffViewer oldText={diffPair.oldText} newText={diffPair.newText} />}
      </Modal>
    </div>
  );
}
