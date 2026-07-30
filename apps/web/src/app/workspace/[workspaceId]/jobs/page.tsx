'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { schedulerApi } from '@/lib/api-client';
import type { JobResponse } from '@/lib/api-client';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Jobs</h1>
          <p className="text-text-muted">Scheduled jobs and automation tasks.</p>
        </header>
        <LoadingSpinner text="Loading jobs..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Jobs</h1>
          <p className="text-text-muted">Scheduled jobs and automation tasks.</p>
        </header>
        <ErrorState title="Failed to load jobs" message={error} onRetry={fetchJobs} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Jobs</h1>
        <p className="text-text-muted">Scheduled jobs and automation tasks.</p>
      </header>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs found" description="Scheduled automation tasks will appear here once configured." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="card flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-display text-text">{job.name}</h2>
                  <p className="text-text-muted text-sm">{job.type}</p>
                </div>
                <span className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[job.status] || 'border-border text-text-muted bg-surface'}`}>
                  {job.status.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-text-muted">
                {job.cron && (
                  <div>
                    <span className="font-mono text-primary text-xs uppercase tracking-wider block mb-1">Schedule</span>
                    <span className="font-mono">{job.cron}</span>
                  </div>
                )}
                {job.last_run_at && (
                  <div>
                    <span className="font-mono text-primary text-xs uppercase tracking-wider block mb-1">Last Run</span>
                    <span>{formatDate(job.last_run_at)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-xs text-text-muted">Created {formatDate(job.created_at)}</span>
                {job.next_run_at && (
                  <span className="text-xs text-primary">Next: {formatDate(job.next_run_at)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
