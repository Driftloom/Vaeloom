'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { schedulerApi, agentApi } from '@/lib/api-client';
import type { JobResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

type Proposal = {
  title: string;
  detail?: string;
  matchScore: number | null;
  location: string;
  remote: boolean;
  salary: string;
};

function MatchBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        Low Match
      </span>
    );
  }
  if (score >= 80) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        {score}% — Strong Match
      </span>
    );
  }
  if (score >= 60) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
        <span className="h-2 w-2 rounded-full bg-blue-400" />
        {score}% — Good Match
      </span>
    );
  }
  if (score >= 40) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
        <span className="h-2 w-2 rounded-full bg-yellow-400" />
        {score}% — Partial Match
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className="h-2 w-2 rounded-full bg-gray-400" />
      {score}% — Low Match
    </span>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const statusStyles: Record<string, string> = {
  active: 'border-green-500/50 text-green-400 bg-green-950/20',
  paused: 'border-yellow-500/50 text-yellow-400 bg-yellow-950/20',
  completed: 'border-primary/50 text-primary bg-primary/10',
  failed: 'border-red-500/50 text-red-400 bg-red-950/20',
};

export default function JobsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [active, setActive] = useState('search');
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    summary: string;
    proposals?: Proposal[];
    questions?: string[];
  } | null>(null);
  const [saved, setSaved] = useState<Proposal[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`vaeloom.savedJobs.${workspaceId ?? 'default'}`);
      return raw ? (JSON.parse(raw) as Proposal[]) : [];
    } catch {
      return [];
    }
  });
  const [filterLocation, setFilterLocation] = useState('');
  const [filterRemoteOnly, setFilterRemoteOnly] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<JobResponse | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(`vaeloom.savedJobs.${workspaceId}`);
      if (raw) setSaved(JSON.parse(raw) as Proposal[]);
    } catch {}
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    try {
      localStorage.setItem(`vaeloom.savedJobs.${workspaceId}`, JSON.stringify(saved));
    } catch {}
  }, [saved, workspaceId]);

  const fetchJobs = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await schedulerApi.listJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
          proposals: (r.result.proposals as Array<Record<string, unknown>>)?.map((p) => ({
            title: String(p['title'] ?? p['action'] ?? 'Opportunity'),
            detail: String(p['detail'] ?? p['description'] ?? ''),
            matchScore:
              typeof p['matchScore'] === 'number'
                ? p['matchScore']
                : typeof p['match_score'] === 'number'
                  ? p['match_score']
                  : null,
            location: String(p['location'] ?? ''),
            remote: Boolean(p['remote']),
            salary: String(p['salary'] ?? ''),
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
    (item: Proposal) => {
      setSaved((prev) => (prev.some((s) => s.title === item.title) ? prev : [...prev, item]));
      toast({ tone: 'success', title: 'Saved', detail: item.title });
    },
    [toast],
  );

  const handleReject = useCallback(
    (title: string) => {
      setSaved((prev) => prev.filter((s) => s.title !== title));
      toast({ tone: 'info', title: 'Removed', detail: title });
    },
    [toast],
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

  const handleJobAction = useCallback(
    async (job: JobResponse, action: 'pause' | 'resume' | 'trigger' | 'delete') => {
      if (action === 'delete') {
        setDeleteTarget(job);
        return;
      }
      try {
        if (action === 'pause') await schedulerApi.pauseJob(job.id);
        if (action === 'resume') await schedulerApi.resumeJob(job.id);
        if (action === 'trigger') await schedulerApi.triggerJob(job.id);
        toast({
          tone: 'success',
          title: action === 'trigger' ? 'Triggered' : action === 'pause' ? 'Paused' : 'Resumed',
          detail: job.name,
        });
        await fetchJobs();
      } catch (err) {
        toast({
          tone: 'error',
          title: `${action} failed`,
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [fetchJobs, toast],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await schedulerApi.deleteJob(deleteTarget.id);
      toast({ tone: 'success', title: 'Deleted', detail: deleteTarget.name });
      await fetchJobs();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchJobs, toast]);

  const filteredProposals = useMemo(() => {
    if (!searchResult?.proposals) return [];
    return searchResult.proposals.filter((p) => {
      if (filterRemoteOnly && !p.remote) return false;
      if (filterLocation && !p.location.toLowerCase().includes(filterLocation.toLowerCase()))
        return false;
      return true;
    });
  }, [searchResult, filterLocation, filterRemoteOnly]);

  const toggleDetails = useCallback((index: number) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const tabs = [
    { id: 'search', label: 'Job Search' },
    { id: 'schedule', label: `Scheduled${jobs.length ? ` (${jobs.length})` : ''}` },
    { id: 'saved', label: `Saved${saved.length ? ` (${saved.length})` : ''}` },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Jobs</h1>
        <p className="text-text-muted">
          Search ranked roles (via Job Search agent), save/reject, and apply with approval.
          Scheduled automations are below.
        </p>
      </header>

      <Tabs tabs={tabs} activeTab={active} onChange={setActive} />

      <TabPanel id="search" activeTab={active}>
        <div className="card mb-6">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="e.g. Product Manager in Berlin, React frontend, ML engineer…"
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
              aria-label="Job search query"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="rounded-full bg-white px-5 py-2 text-sm text-black disabled:opacity-40"
              aria-label="Search jobs"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <input
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              placeholder="Filter by location…"
              className="rounded-full border border-border bg-background px-4 py-1.5 text-xs outline-none focus:border-primary w-48"
              aria-label="Filter proposals by location"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterRemoteOnly}
                onChange={(e) => setFilterRemoteOnly(e.target.checked)}
                className="rounded border-border accent-primary"
                aria-label="Show remote jobs only"
              />
              Remote only
            </label>
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
            {filteredProposals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProposals.map((p, i) => {
                  const isSaved = saved.some((s) => s.title === p.title);
                  const isExpanded = expandedDetails.has(i);
                  return (
                    <div key={i} className="card">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-text">{p.title}</h4>
                        <MatchBadge score={p.matchScore} />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-text-dim">
                        {p.location && <span>{p.location}</span>}
                        {p.remote && <span className="text-green-400">Remote</span>}
                        {p.salary && <span>{p.salary}</span>}
                      </div>
                      {p.detail && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleDetails(i)}
                            className="text-xs text-primary hover:underline"
                            aria-label={
                              isExpanded
                                ? `Hide details for ${p.title}`
                                : `Show details for ${p.title}`
                            }
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? 'Hide Details' : 'Details'}
                          </button>
                          {isExpanded && (
                            <p className="text-sm text-text-muted mt-1 whitespace-pre-wrap">
                              {p.detail}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleSave(p)}
                          disabled={isSaved}
                          className={`flex-1 rounded-full text-xs py-1.5 ${isSaved ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white text-black'}`}
                          aria-label={isSaved ? `${p.title} is saved` : `Save ${p.title}`}
                        >
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button
                          onClick={() => handleReject(p.title)}
                          className="flex-1 rounded-full border border-border text-xs py-1.5"
                          aria-label={`Reject ${p.title}`}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApply(p.title)}
                          className="flex-1 rounded-full border border-primary/40 text-xs text-primary hover:bg-primary/10"
                          aria-label={`Apply to ${p.title}`}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : searchResult.proposals && searchResult.proposals.length > 0 ? (
              <p className="text-sm text-text-muted">
                No proposals match the current filters. Try adjusting your location or remote
                filter.
              </p>
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

      <TabPanel id="schedule" activeTab={active}>
        {loading ? (
          <LoadingSpinner text="Loading jobs..." />
        ) : error ? (
          <ErrorState title="Failed to load jobs" message={error} onRetry={fetchJobs} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs found"
            description="Scheduled automation tasks will appear here once configured."
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <div key={job.id} className="card flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-display text-text">{job.name}</h2>
                    <p className="text-text-muted text-sm">{job.type}</p>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[job.status] || 'border-border text-text-muted bg-surface'}`}
                  >
                    {job.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-text-muted">
                  {job.cron && (
                    <div>
                      <span className="font-mono text-primary text-xs uppercase tracking-wider block mb-1">
                        Schedule
                      </span>
                      <span className="font-mono">{job.cron}</span>
                    </div>
                  )}
                  {job.last_run_at && (
                    <div>
                      <span className="font-mono text-primary text-xs uppercase tracking-wider block mb-1">
                        Last Run
                      </span>
                      <span>{formatDate(job.last_run_at)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  <span className="text-xs text-text-muted">
                    Created {formatDate(job.created_at)}
                  </span>
                  {job.next_run_at && (
                    <span className="text-xs text-primary">
                      Next: {formatDate(job.next_run_at)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.status === 'active' ? (
                    <button
                      onClick={() => handleJobAction(job, 'pause')}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                      aria-label={`Pause job ${job.name}`}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJobAction(job, 'resume')}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                      aria-label={`Resume job ${job.name}`}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={() => handleJobAction(job, 'trigger')}
                    className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                    aria-label={`Trigger job ${job.name} now`}
                  >
                    Trigger now
                  </button>
                  <button
                    onClick={() => handleJobAction(job, 'delete')}
                    className="rounded-full border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    aria-label={`Delete job ${job.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-text">{s.title}</h4>
                  <MatchBadge score={s.matchScore} />
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-text-dim">
                  {s.location && <span>{s.location}</span>}
                  {s.remote && <span className="text-green-400">Remote</span>}
                  {s.salary && <span>{s.salary}</span>}
                </div>
                {s.detail && <p className="text-sm text-text-muted mt-1">{s.detail}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleApply(s.title)}
                    className="flex-1 rounded-full bg-white text-black text-xs py-1.5"
                    aria-label={`Apply to ${s.title}`}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => handleReject(s.title)}
                    className="flex-1 rounded-full border border-border text-xs py-1.5"
                    aria-label={`Remove ${s.title} from saved`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabPanel>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Job"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
