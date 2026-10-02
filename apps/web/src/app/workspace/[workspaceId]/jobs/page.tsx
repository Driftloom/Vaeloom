'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { PageHeader } from '@/components/shared/Page';
import { agentApi, applicationApi, opportunityApi } from '@/lib/api-client';
import type { OpportunityMatchResult } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

type MatchMetricKey =
  'cosineSimilarity' | 'decayWeightedConfidence' | 'networkProximity' | 'skillGapPenalty';

/**
 * Read a PIOS metric only when the server actually sent a number.
 *
 * F-02 (same rule as memory/page.tsx:186): the match metrics used to fall back
 * to 0.85 / 1.0 / 0, so a server that returned no `metrics` at all rendered
 * "85.0% Half-Life Model" and "1.00x Graph Boost" as if they had been measured.
 * Responses are camelCased by the api client's `transformKeys`, so the camelCase
 * key is the only one that can ever be populated. Returns null when absent so
 * the caller can render an explicit "not reported" instead of a plausible number.
 */
function readMatchMetric(metrics: unknown, key: MatchMetricKey): number | null {
  if (!metrics || typeof metrics !== 'object') return null;
  const raw = (metrics as Record<string, unknown>)[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

const NOT_REPORTED = 'not reported';

export default function JobsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [active, setActive] = useState('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    summary: string;
    proposals?: Array<{ title: string; detail?: string }>;
    questions?: string[];
  } | null>(null);
  const [saved, setSaved] = useState<Array<{ title: string; detail?: string }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`vaeloom.savedJobs.${workspaceId ?? 'default'}`);
      return raw ? (JSON.parse(raw) as Array<{ title: string; detail?: string }>) : [];
    } catch {
      return [];
    }
  });

  // PIOS Opportunity Matcher State
  const [matcherTitle, setMatcherTitle] = useState('Senior AI Systems Engineer');
  const [matcherCompany, setMatcherCompany] = useState('Anthropic / OpenAI');
  const [matcherType, setMatcherType] = useState('job');
  const [matcherSkills, setMatcherSkills] = useState(
    'Python, FastAPI, LLM, Vector Search, Kubernetes',
  );
  const [matcherDesc, setMatcherDesc] = useState(
    'Architect sovereign AI agent systems with local context and deterministic policy gates.',
  );
  const [matcherNetworkCount, setMatcherNetworkCount] = useState(3);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<OpportunityMatchResult | null>(null);

  // Proposal match cache for inline search cards
  const [proposalMatches, setProposalMatches] = useState<Record<string, OpportunityMatchResult>>(
    {},
  );
  const [matchingProposal, setMatchingProposal] = useState<string | null>(null);

  // Saved jobs: durable backend via POST /workspaces/{id}/applications (draft), localStorage as offline fallback
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const apps = await applicationApi.list(workspaceId);
        // Map backend applications (status draft/saved) to saved jobs
        const mapped = (apps as unknown as Array<Record<string, unknown>>)
          .filter(
            (a) =>
              (a as Record<string, unknown>)['status'] === 'draft' ||
              ((a as Record<string, unknown>)['metadata'] as Record<string, unknown>)?.['saved'],
          )
          .map((a) => ({
            title: String(
              (a as Record<string, unknown>)['job_external_id'] ??
                ((a as Record<string, unknown>)['metadata'] as Record<string, unknown>)?.[
                  'title'
                ] ??
                '',
            ),
            detail: String(
              ((a as Record<string, unknown>)['metadata'] as Record<string, unknown>)?.['detail'] ??
                '',
            ),
          }))
          .filter((s) => s.title);
        if (!cancelled && mapped.length > 0)
          setSaved((prev) => (prev.length === 0 ? mapped : prev));
      } catch {}
      try {
        const raw = localStorage.getItem(`vaeloom.savedJobs.${workspaceId}`);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Array<{ title: string; detail?: string }>;
          if (parsed.length > 0) setSaved((prev) => (prev.length === 0 ? parsed : prev));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    try {
      localStorage.setItem(`vaeloom.savedJobs.${workspaceId}`, JSON.stringify(saved));
    } catch {}
  }, [saved, workspaceId]);

  const handleSearch = useCallback(async () => {
    if (!workspaceId || !query.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = (await agentApi.chat({
        workspaceId,
        message: `search jobs: ${query.trim()}`,
        agentName: 'job_search',
      })) as Record<string, unknown>;
      const r = res as {
        result?: { summary?: string; proposals?: unknown[]; questions?: string[] };
        reply?: string;
      };
      if (r.result) {
        setSearchResult({
          summary: r.result.summary ?? '',
          proposals: (
            r.result.proposals as Array<{
              title?: string;
              action?: string;
              detail?: string;
              description?: string;
            }>
          )?.map((p) => ({
            title: String(p.title ?? p.action ?? 'Opportunity'),
            detail: String(p.detail ?? p.description ?? ''),
          })),
          questions: r.result.questions,
        });
      } else if (r.reply) {
        setSearchResult({ summary: String(r.reply) });
      } else if (typeof res === 'string') {
        setSearchResult({ summary: res as string });
      } else {
        setSearchResult({ summary: JSON.stringify(res).slice(0, 2000) });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Search failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSearching(false);
    }
  }, [workspaceId, query, toast]);

  const handleSave = useCallback(
    async (item: { title: string; detail?: string }) => {
      if (!workspaceId) {
        toast({
          tone: 'error',
          title: 'Save failed',
          detail: 'A workspace context is required to save a job.',
        });
        return;
      }
      setSaved((prev) => (prev.some((s) => s.title === item.title) ? prev : [...prev, item]));
      try {
        // Durable backend record: POST /workspaces/{id}/applications draft
        await applicationApi.create(workspaceId, {
          job_external_id: item.title,
          platform: 'saved',
          status: 'draft',
          metadata: { title: item.title, detail: item.detail ?? '', saved: true },
        } as unknown as Record<string, unknown>);
        toast({ tone: 'success', title: 'Saved', detail: item.title });
      } catch (err) {
        // Roll the optimistic local add back so the list matches the server.
        setSaved((prev) => prev.filter((s) => s.title !== item.title));
        toast({
          tone: 'error',
          title: 'Save failed',
          detail:
            `${item.title} was not saved to this workspace. ${err instanceof Error ? err.message : ''}`.trim(),
        });
      }
    },
    [toast, workspaceId],
  );

  const handleReject = useCallback(
    async (title: string) => {
      if (!workspaceId) {
        toast({
          tone: 'error',
          title: 'Remove failed',
          detail: 'A workspace context is required to update a saved job.',
        });
        return;
      }
      const removed = saved.find((s) => s.title === title);
      setSaved((prev) => prev.filter((s) => s.title !== title));
      try {
        // Best-effort backend remove: set outcome to rejected
        const apps = await applicationApi.list(workspaceId);
        const hit = (apps as unknown as Array<Record<string, unknown>>).find(
          (a) =>
            (a as Record<string, unknown>)['job_external_id'] === title ||
            ((a as Record<string, unknown>)['metadata'] as Record<string, unknown>)?.['title'] ===
              title,
        );
        const hitId = (hit as unknown as Record<string, unknown> | undefined)?.['id'];
        if (hitId) {
          await applicationApi.updateOutcome(workspaceId, String(hitId), { status: 'rejected' });
        }
        toast({ tone: 'info', title: 'Removed', detail: title });
      } catch (err) {
        setSaved((prev) => (removed ? [...prev, removed] : prev));
        toast({
          tone: 'error',
          title: 'Remove failed',
          detail:
            `${title} was not removed from this workspace. ${err instanceof Error ? err.message : ''}`.trim(),
        });
      }
    },
    [saved, toast, workspaceId],
  );

  const handleApply = useCallback(
    async (title: string) => {
      if (!workspaceId) return;
      try {
        await agentApi.chat({
          workspaceId,
          message: `apply to ${title}`,
          agentName: 'application',
        });
        toast({
          tone: 'success',
          title: 'Application started',
          detail: `${title} — check Approvals for approval or Applications for status`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Apply failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [workspaceId, toast],
  );

  const handleRunMatch = useCallback(async () => {
    if (!workspaceId) return;
    setMatching(true);
    try {
      const skillsArray = matcherSkills
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await opportunityApi.match(
        {
          title: matcherTitle.trim() || 'Role',
          company: matcherCompany.trim() || 'Target Co',
          type: matcherType,
          requiredSkills: skillsArray,
          description: matcherDesc.trim() || undefined,
        },
        matcherNetworkCount,
      );
      setMatchResult(res);
      const score = res.matchScore ?? (res as any).match_score ?? 0;
      toast({
        tone: 'success',
        title: 'Match Analyzed',
        detail: `PIOS Match Score: ${Math.round(score * 100)}%`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Matching Failed',
        detail: err instanceof Error ? err.message : 'Could not compute opportunity match.',
      });
    } finally {
      setMatching(false);
    }
  }, [
    workspaceId,
    matcherTitle,
    matcherCompany,
    matcherType,
    matcherSkills,
    matcherDesc,
    matcherNetworkCount,
    toast,
  ]);

  const handleMatchProposal = useCallback(
    async (title: string, detail?: string) => {
      if (!workspaceId) return;
      setMatchingProposal(title);
      try {
        const res = await opportunityApi.match({
          title,
          company: 'Opportunity',
          description: detail,
          requiredSkills: [title],
        });
        setProposalMatches((prev) => ({ ...prev, [title]: res }));
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Inline Match Failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setMatchingProposal(null);
      }
    },
    [workspaceId, toast],
  );

  const matchMetrics = useMemo(
    () => ({
      cosine: readMatchMetric(matchResult?.metrics, 'cosineSimilarity'),
      decay: readMatchMetric(matchResult?.metrics, 'decayWeightedConfidence'),
      proximity: readMatchMetric(matchResult?.metrics, 'networkProximity'),
      gapPenalty: readMatchMetric(matchResult?.metrics, 'skillGapPenalty'),
    }),
    [matchResult],
  );

  const tabs = [
    { id: 'search', label: 'Job Search' },
    { id: 'matcher', label: 'PIOS Matcher' },
    { id: 'saved', label: `Saved${saved.length ? ` (${saved.length})` : ''}` },
  ];

  return (
    <div className="flex flex-col min-h-full space-y-6">
      <PageHeader
        title="Jobs"
        description="Search ranked roles (via Job Search agent), evaluate capability alignment with PIOS Matcher, and manage saved opportunities."
      />

      <Tabs tabs={tabs} activeTab={active} onChange={setActive} />

      <TabPanel id="search" activeTab={active}>
        <div className="card mb-6">
          <div className="flex gap-2">
            {/* A placeholder is not an accessible name (WCAG 3.3.2 / 4.1.2).
                axe does not flag placeholder-only inputs, so this needs an
                explicit label. */}
            <label htmlFor="job-search-query" className="sr-only">
              Search jobs
            </label>
            <input
              id="job-search-query"
              type="search"
              aria-label="Search jobs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="e.g. Product Manager in Berlin, React frontend, ML engineer…"
              className="flex-1 min-h-11 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="min-h-11 rounded-full btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          <p className="text-xs text-text-dim mt-2">
            Powered by the Job Search agent — results include match explanation and fit summary.
          </p>
        </div>

        {searching && <LoadingSpinner text="Searching jobs…" />}
        {!searching && searchResult && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-medium text-text mb-2">Results</h3>
              <p className="text-sm text-text-muted whitespace-pre-wrap">
                {searchResult.summary || 'No summary returned — try a different query.'}
              </p>
              {searchResult.questions && searchResult.questions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {searchResult.questions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(q)}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchResult.proposals && searchResult.proposals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResult.proposals.map((p, i) => {
                  const isSaved = saved.some((s) => s.title === p.title);
                  const piosMatch = proposalMatches[p.title];
                  const isMatching = matchingProposal === p.title;

                  return (
                    <div key={i} className="card flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-text">{p.title}</h4>
                          {piosMatch ? (
                            (() => {
                              const pScore =
                                piosMatch.matchScore ?? (piosMatch as any).match_score ?? 0;
                              return (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium border ${
                                    pScore >= 0.75
                                      ? 'bg-success/15 text-success border-success/30'
                                      : pScore >= 0.5
                                        ? 'bg-warning/15 text-warning border-warning/30'
                                        : 'bg-error/15 text-error border-error/30'
                                  }`}
                                  title="PIOS matcher_core score"
                                >
                                  {Math.round(pScore * 100)}% Fit
                                </span>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => handleMatchProposal(p.title, p.detail)}
                              disabled={isMatching}
                              className="text-xs px-2 py-0.5 rounded-full bg-surface-200 hover:bg-surface-hover text-text-muted hover:text-text border border-border transition-colors shrink-0"
                            >
                              {isMatching ? 'Matching…' : '⚡ PIOS Fit'}
                            </button>
                          )}
                        </div>

                        {p.detail && <p className="text-sm text-text-muted mt-1">{p.detail}</p>}

                        {/* Inline PIOS Explanation */}
                        {piosMatch && (
                          <div className="mt-3 p-2.5 rounded-lg bg-surface-200/70 border border-border text-xs space-y-2">
                            <p className="text-text-dim leading-relaxed">
                              <span className="font-medium text-text">Why You:</span>{' '}
                              {typeof piosMatch.whyYou === 'string'
                                ? piosMatch.whyYou
                                : (piosMatch.whyYou as any)?.rationale ||
                                  (piosMatch.whyYou as any)?.headline ||
                                  ''}
                            </p>
                            {(
                              piosMatch.matchedSkills ||
                              (piosMatch as any).matchingSkills ||
                              (piosMatch as any).matching_skills ||
                              []
                            ).length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-2xs text-text-muted">Matched:</span>
                                {(
                                  piosMatch.matchedSkills ||
                                  (piosMatch as any).matchingSkills ||
                                  (piosMatch as any).matching_skills ||
                                  []
                                ).map((ms: any, idx: number) => {
                                  const name = typeof ms === 'string' ? ms : ms?.name || 'Skill';
                                  const tier =
                                    typeof ms === 'object'
                                      ? ms?.validationTier || ms?.tier || 'V1'
                                      : 'V1';
                                  return (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 text-2xs"
                                    >
                                      {name} ({tier})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {(piosMatch.missingSkills || (piosMatch as any).missing_skills || [])
                              .length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-2xs text-text-muted">Gaps:</span>
                                {(
                                  piosMatch.missingSkills ||
                                  (piosMatch as any).missing_skills ||
                                  []
                                ).map((gs: any, idx: number) => {
                                  const gapName =
                                    typeof gs === 'string'
                                      ? gs
                                      : gs?.name || gs?.skill_name || 'Skill Gap';
                                  return (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded bg-surface-300/30 text-text-muted border border-border text-2xs"
                                    >
                                      {gapName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => void handleSave(p)}
                          disabled={isSaved}
                          className={`flex-1 rounded-full text-xs py-1.5 ${isSaved ? 'bg-success/15 text-success border border-success/30' : 'btn-primary'}`}
                        >
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button
                          onClick={() => void handleReject(p.title)}
                          className="flex-1 rounded-full border border-border text-xs py-1.5"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApply(p.title)}
                          className="flex-1 rounded-full border border-primary/40 text-xs text-primary hover:bg-primary/10"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                No structured proposals returned — the summary above contains the ranked matches.
                Save interesting roles from the summary and use Apply to start an approval-gated
                application (you will get a deep link after approval).
              </p>
            )}
          </div>
        )}
        {!searching && !searchResult && (
          <EmptyState
            title="Search for jobs"
            description="Enter a role, stack or location and run the Job Search agent. Results are ranked with match explanations; save/reject persists locally, and Apply requires approval."
          />
        )}
      </TabPanel>

      <TabPanel id="matcher" activeTab={active}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Opportunity Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-text">Opportunity Definition</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  PIOS Engine
                </span>
              </div>
              <p className="text-xs text-text-muted mb-4">
                Define an opportunity to evaluate against your Human Capability Graph using the PIOS{' '}
                <code className="text-text font-mono text-2xs">matcher_core</code> algorithm.
              </p>

              {/* Quick Presets */}
              <div className="mb-4">
                <label className="text-xs font-medium text-text-muted mb-1.5 block">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'AI Architect',
                      title: 'Senior AI Systems Architect',
                      company: 'Autonomous Systems Corp',
                      skills: 'Python, PyTorch, Distributed Systems, FastAPI, Vector Search',
                      desc: 'Build sovereign multiscale agentic runtime systems with deterministic policy gates.',
                    },
                    {
                      label: 'Fullstack Dev',
                      title: 'Founding Fullstack Engineer',
                      company: 'Driftloom Labs',
                      skills: 'TypeScript, Next.js, React, Tailwind CSS, PostgreSQL',
                      desc: 'Design and deploy resilient local-first cognitive interfaces and real-time workspaces.',
                    },
                    {
                      label: 'LLM Researcher',
                      title: 'LLM Systems Researcher',
                      company: 'Cortex Frontier',
                      skills: 'Python, LLM, Model Distillation, Prompt Engineering, Evaluation',
                      desc: 'Research 2-round cross-read agent consensus protocols and truth hierarchy resolution.',
                    },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setMatcherTitle(preset.title);
                        setMatcherCompany(preset.company);
                        setMatcherSkills(preset.skills);
                        setMatcherDesc(preset.desc);
                      }}
                      className="text-xs px-2 py-1 rounded-md bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text block mb-1">
                    Role or Project Title
                  </label>
                  <input
                    value={matcherTitle}
                    onChange={(e) => setMatcherTitle(e.target.value)}
                    placeholder="e.g. Lead AI Platform Engineer"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-text block mb-1">
                      Company / Organization
                    </label>
                    <input
                      value={matcherCompany}
                      onChange={(e) => setMatcherCompany(e.target.value)}
                      placeholder="e.g. Anthropic"
                      className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text block mb-1">Type</label>
                    <select
                      value={matcherType}
                      onChange={(e) => setMatcherType(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text focus:outline-none focus:border-primary"
                    >
                      <option value="job">Job</option>
                      <option value="hackathon">Hackathon</option>
                      <option value="research">Research Fellowship</option>
                      <option value="oss">Open Source</option>
                      <option value="cofounder">Co-founder</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-text block mb-1">
                    Required Skills (comma-separated)
                  </label>
                  <input
                    value={matcherSkills}
                    onChange={(e) => setMatcherSkills(e.target.value)}
                    placeholder="Python, FastAPI, Vector Search, Distributed Systems"
                    className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text block mb-1">
                    Description / Problem Context
                  </label>
                  <textarea
                    rows={3}
                    value={matcherDesc}
                    onChange={(e) => setMatcherDesc(e.target.value)}
                    placeholder="Describe the opportunity expectations..."
                    className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text block mb-1">
                    Knowledge Graph Proximity (Connected Entities: {matcherNetworkCount})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={matcherNetworkCount}
                    onChange={(e) => setMatcherNetworkCount(parseInt(e.target.value, 10))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-2xs text-text-dim">
                    <span>0 (Cold)</span>
                    <span>5 (1-hop mutuals)</span>
                    <span>10 (Dense cluster)</span>
                  </div>
                </div>

                <button
                  onClick={handleRunMatch}
                  disabled={matching || !matcherTitle.trim()}
                  className="w-full py-2.5 px-4 rounded-xl font-medium text-xs bg-action text-action-fg hover:bg-action/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {matching ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Evaluating Capability Graph…
                    </>
                  ) : (
                    '⚡ Run PIOS Capability Match'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Match Analysis Breakdown */}
          <div className="lg:col-span-7">
            {matchResult ? (
              <div className="space-y-4">
                {/* Score & Verdict Banner */}
                <div className="card bg-gradient-to-br from-surface to-surface-200 border-primary/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-text-dim">
                        PIOS Alignment Score
                      </span>
                      <h3 className="text-2xl font-bold text-text mt-0.5">{matchResult.title}</h3>
                      <p className="text-xs text-text-muted">
                        {matchResult.company} • {matchResult.type}
                      </p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const mScore =
                          matchResult.matchScore ?? (matchResult as any).match_score ?? 0;
                        return (
                          <>
                            <div
                              className={`text-3xl font-extrabold font-mono ${
                                mScore >= 0.75
                                  ? 'text-success'
                                  : mScore >= 0.5
                                    ? 'text-warning'
                                    : 'text-error'
                              }`}
                            >
                              {Math.round(mScore * 100)}%
                            </div>
                            <span className="text-2xs text-text-dim">
                              {mScore >= 0.75
                                ? 'High Demonstrated Fit'
                                : mScore >= 0.5
                                  ? 'Emerging Capability Alignment'
                                  : 'Skill Gap Exceeds Threshold'}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Why You Narrative */}
                  <div className="mt-4 p-3 rounded-lg bg-background/80 border border-border">
                    <h4 className="text-xs font-semibold text-text flex items-center gap-1.5 mb-1.5">
                      <span>💡</span> Why You (Natural Language Grounding)
                    </h4>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {typeof matchResult.whyYou === 'string'
                        ? matchResult.whyYou
                        : (matchResult.whyYou as any)?.rationale ||
                          (matchResult.whyYou as any)?.headline ||
                          'Match grounded in demonstrated workspace capabilities.'}
                    </p>
                  </div>
                </div>

                {/* 4-Dimensional Mathematical Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="card p-3 text-center">
                    <span className="text-2xs text-text-dim block mb-1">Cosine Similarity</span>
                    <span
                      className={`text-base font-mono font-bold ${matchMetrics.cosine === null ? 'text-text-muted' : 'text-text'}`}
                    >
                      {matchMetrics.cosine === null
                        ? '—'
                        : `${(matchMetrics.cosine * 100).toFixed(1)}%`}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">
                      {matchMetrics.cosine === null
                        ? `Semantic Fit (${NOT_REPORTED})`
                        : 'Semantic Fit'}
                    </span>
                  </div>
                  <div className="card p-3 text-center">
                    <span className="text-2xs text-text-dim block mb-1">Recency Decay</span>
                    <span
                      className={`text-base font-mono font-bold ${matchMetrics.decay === null ? 'text-text-muted' : 'text-success'}`}
                    >
                      {matchMetrics.decay === null
                        ? '—'
                        : `${(matchMetrics.decay * 100).toFixed(1)}%`}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">
                      {matchMetrics.decay === null
                        ? `Half-Life Model (${NOT_REPORTED})`
                        : 'Half-Life Model'}
                    </span>
                  </div>
                  <div className="card p-3 text-center">
                    <span className="text-2xs text-text-dim block mb-1">Network Proximity</span>
                    <span
                      className={`text-base font-mono font-bold ${matchMetrics.proximity === null ? 'text-text-muted' : 'text-primary'}`}
                    >
                      {matchMetrics.proximity === null
                        ? '—'
                        : `${matchMetrics.proximity.toFixed(2)}x`}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">
                      {matchMetrics.proximity === null
                        ? `Graph Boost (${NOT_REPORTED})`
                        : 'Graph Boost'}
                    </span>
                  </div>
                  <div className="card p-3 text-center">
                    <span className="text-2xs text-text-dim block mb-1">Skill Gap Penalty</span>
                    <span
                      className={`text-base font-mono font-bold ${matchMetrics.gapPenalty === null ? 'text-text-muted' : 'text-error'}`}
                    >
                      {matchMetrics.gapPenalty === null
                        ? '—'
                        : `-${(matchMetrics.gapPenalty * 100).toFixed(1)}%`}
                    </span>
                    <span className="text-xs text-text-muted block mt-0.5">
                      {matchMetrics.gapPenalty === null
                        ? `Missing Bounds (${NOT_REPORTED})`
                        : 'Missing Bounds'}
                    </span>
                  </div>
                </div>

                {/* Capability Mapping */}
                <div className="card space-y-3">
                  <h4 className="text-xs font-semibold text-text">
                    Demonstrated Capability Mapping
                  </h4>

                  {(
                    matchResult.matchedSkills ||
                    (matchResult as any).matchingSkills ||
                    (matchResult as any).matching_skills ||
                    []
                  ).length > 0 ? (
                    <div>
                      <span className="text-xs font-medium text-text-muted block mb-1.5">
                        Matched Capabilities (
                        {
                          (
                            matchResult.matchedSkills ||
                            (matchResult as any).matchingSkills ||
                            (matchResult as any).matching_skills ||
                            []
                          ).length
                        }
                        )
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(
                          matchResult.matchedSkills ||
                          (matchResult as any).matchingSkills ||
                          (matchResult as any).matching_skills ||
                          []
                        ).map((ms: any, idx: number) => {
                          const name = typeof ms === 'string' ? ms : ms?.name || 'Skill';
                          const tier =
                            typeof ms === 'object' ? ms?.validationTier || ms?.tier || 'V1' : 'V1';
                          const decay =
                            typeof ms === 'object'
                              ? ms?.decayStatus || ms?.decay_status || 'fresh'
                              : 'fresh';
                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200 border border-border text-xs"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-success" />
                              <span className="font-medium text-text">{name}</span>
                              <span className="text-xs font-mono px-1 rounded bg-info/15 text-info border border-info/30">
                                {tier}
                              </span>
                              <span className="text-xs text-text-dim">{decay}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      No exact capability overlap detected yet.
                    </p>
                  )}

                  {(matchResult.missingSkills || (matchResult as any).missing_skills || []).length >
                    0 && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs font-medium text-text-muted block mb-1.5">
                        Skill Gaps (
                        {
                          (matchResult.missingSkills || (matchResult as any).missing_skills || [])
                            .length
                        }
                        )
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          matchResult.missingSkills ||
                          (matchResult as any).missing_skills ||
                          []
                        ).map((gs: any, idx: number) => {
                          const gapName =
                            typeof gs === 'string' ? gs : gs?.name || gs?.skill_name || 'Skill Gap';
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-surface-300/40 text-text-muted border border-border text-xs"
                            >
                              {gapName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-3 flex gap-2">
                    <button
                      onClick={() =>
                        void handleSave({
                          title: matchResult.title || 'Role',
                          detail:
                            typeof matchResult.whyYou === 'string'
                              ? matchResult.whyYou
                              : (matchResult.whyYou as any)?.rationale ||
                                (matchResult.whyYou as any)?.headline ||
                                '',
                        })
                      }
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors"
                    >
                      Save to Opportunities
                    </button>
                    <button
                      onClick={() => handleApply(matchResult.title || 'Role')}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-action text-action-fg hover:bg-action/90 transition-colors"
                    >
                      Apply with Agent
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 border-dashed">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl mb-3">
                  ⚡
                </div>
                <h3 className="text-base font-semibold text-text mb-1">PIOS Opportunity Engine</h3>
                <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
                  Instead of generic job searches, PIOS reverse-matches your demonstrated
                  capabilities, validation tiers (V0–V4), and memory recency half-life against
                  external roles.
                </p>
                <div className="text-xs font-mono text-text-dim bg-surface-200 px-3 py-1.5 rounded-lg border border-border">
                  matcher_core = cosine × proximity × decay − gap_penalty
                </div>
              </div>
            )}
          </div>
        </div>
      </TabPanel>

      <TabPanel id="saved" activeTab={active}>
        {saved.length === 0 ? (
          <EmptyState
            title="No saved jobs"
            description="Save roles from the Job Search tab — they persist here. Apply requires approval and will give you a deep link to the application."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saved.map((s) => (
              <div key={s.title} className="card">
                <h4 className="font-medium text-text">{s.title}</h4>
                {s.detail && <p className="text-sm text-text-muted mt-1">{s.detail}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleApply(s.title)}
                    className="flex-1 rounded-full btn-primary text-xs py-1.5"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => void handleReject(s.title)}
                    className="flex-1 rounded-full border border-border text-xs py-1.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabPanel>
    </div>
  );
}
