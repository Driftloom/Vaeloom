'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { applicationApi } from '@/lib/api-client';
import type { ApplicationResponse, ApplicationUpdateOutcomeRequest } from '@/lib/api-client';
import type { StatusVariant } from '@/components/shared/StatusBadge';

const columns = [
  { id: 'draft', title: 'Draft' },
  { id: 'shortlisted', title: 'Shortlisted' },
  { id: 'tailoring', title: 'Tailoring' },
  { id: 'submitted', title: 'Submitted' },
  { id: 'interviewing', title: 'Interviewing' },
  { id: 'resolved', title: 'Offer / Rejected' },
];

const statusVariant: Record<string, StatusVariant> = {
  draft: 'neutral',
  shortlisted: 'info',
  tailoring: 'warning',
  submitted: 'info',
  interviewing: 'success',
  resolved: 'success',
  rejected: 'error',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAppTitle(app: ApplicationResponse): string {
  if (app.metadata?.['title']) return String(app.metadata['title']);
  if (app.job_external_id) return `Job ${app.job_external_id}`;
  return 'Untitled Application';
}

function getAppCompany(app: ApplicationResponse): string {
  if (app.metadata?.['company']) return String(app.metadata['company']);
  if (app.platform) return app.platform;
  return '';
}

export default function ApplicationsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const PAGE_SIZE = 100;
      let page = 1;
      let allApps: ApplicationResponse[] = [];
      while (true) {
        const batch = await applicationApi.list(workspaceId, { page, page_size: PAGE_SIZE });
        allApps = allApps.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        page++;
      }
      setApplications(allApps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
          <p className="text-text-muted">
            Track your progress and let the Application Agent handle submissions.
          </p>
        </header>
        <LoadingSpinner text="Loading applications..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
          <p className="text-text-muted">
            Track your progress and let the Application Agent handle submissions.
          </p>
        </header>
        <ErrorState
          title="Failed to load applications"
          message={error}
          onRetry={fetchApplications}
        />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
          <p className="text-text-muted">
            Track your progress and let the Application Agent handle submissions.
          </p>
        </header>
        <EmptyState
          title="No active applications"
          description="Shortlist jobs to start tracking your application pipeline."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
        <p className="text-text-muted">
          Track your progress and let the Application Agent handle submissions.
        </p>
      </header>

      <div
        className="flex gap-4 overflow-x-auto pb-4 flex-1"
        role="region"
        aria-label="Application pipeline"
      >
        {columns.map((col) => {
          const colApps = applications.filter((a) => a.status?.toLowerCase() === col.id);
          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-80 flex flex-col bg-surface-hover/50 rounded-lg p-4 border border-border"
            >
              <h2 className="font-display font-medium text-text mb-4 flex justify-between text-lg">
                {col.title}
                <span
                  className="text-text-muted font-mono text-sm bg-surface px-2 py-0.5 rounded"
                  aria-label={`${colApps.length} applications`}
                >
                  {colApps.length}
                </span>
              </h2>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {colApps.map((app) => (
                  <div
                    key={app.id}
                    className="card hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <h3 className="font-medium text-text">{getAppTitle(app)}</h3>
                    {getAppCompany(app) && (
                      <p className="text-sm text-text-muted mt-1">{getAppCompany(app)}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge
                        variant={statusVariant[app.status?.toLowerCase()] || 'neutral'}
                        label={
                          app.status?.charAt(0).toUpperCase() + app.status?.slice(1).toLowerCase()
                        }
                      />
                      {app.outcome && (
                        <StatusBadge
                          variant={app.outcome === 'offer' ? 'success' : 'error'}
                          label={
                            app.outcome?.charAt(0).toUpperCase() +
                            app.outcome?.slice(1).toLowerCase()
                          }
                        />
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-2 font-mono">
                      Created {formatDate(app.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
