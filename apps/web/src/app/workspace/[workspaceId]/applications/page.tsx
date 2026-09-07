'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@vaeloom/ui-kit';
import { applicationApi } from '@/lib/api-client';
import type { ApplicationResponse, ApplicationUpdateOutcomeRequest } from '@/lib/api-client';
import type { StatusVariant } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/shared/Toast';

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
  const { toast } = useToast();

  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApplicationResponse | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editOutcome, setEditOutcome] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openDetail = useCallback((app: ApplicationResponse) => {
    setSelected(app);
    setEditStatus(app.status ?? 'draft');
    setEditOutcome(app.outcome ?? '');
  }, []);

  const handleSave = useCallback(async () => {
    if (!workspaceId || !selected) return;
    setSaving(true);
    try {
      const body: ApplicationUpdateOutcomeRequest = { status: editStatus };
      const updated = await applicationApi.updateOutcome(workspaceId, selected.id, body);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(null);
      toast({ tone: 'success', title: 'Application updated', detail: getAppTitle(updated) });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Update failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [workspaceId, selected, editStatus, toast]);

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
                  <button
                    key={app.id}
                    onClick={() => openDetail(app)}
                    className="card w-full text-left hover:border-primary/50 transition-colors"
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
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? getAppTitle(selected) : 'Application'}
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-mono text-text-dim">Company</span>
                <p className="text-text">{getAppCompany(selected) || '—'}</p>
              </div>
              <div>
                <span className="font-mono text-text-dim">Platform</span>
                <p className="text-text">{selected.platform ?? '—'}</p>
              </div>
              <div>
                <span className="font-mono text-text-dim">Job ID</span>
                <p className="font-mono text-text">{selected.job_external_id ?? '—'}</p>
              </div>
              <div>
                <span className="font-mono text-text-dim">Created</span>
                <p className="text-text">{formatDate(selected.created_at)}</p>
              </div>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <pre className="max-h-40 overflow-auto rounded bg-surface-hover border border-border p-2 font-mono text-xs">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                Status
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">draft</option>
                  <option value="shortlisted">shortlisted</option>
                  <option value="tailoring">tailoring</option>
                  <option value="submitted">submitted</option>
                  <option value="interviewing">interviewing</option>
                  <option value="resolved">resolved</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
              <label className="block">
                Outcome
                <select
                  value={editOutcome}
                  onChange={(e) => setEditOutcome(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="offer">offer</option>
                  <option value="rejected">rejected</option>
                  <option value="withdrawn">withdrawn</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-full border border-border px-4 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-white px-4 py-1.5 text-sm text-black disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
