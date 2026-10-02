'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Card,
  Badge,
  Button,
  StatCard,
  CheckSquareIcon,
  ClockIcon,
  PlayIcon,
  ShieldIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Spinner,
  EmptyState,
} from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { FilterPills } from '@/components/shared/FilterPills';
import { ErrorState } from '@/components/shared/ErrorState';
import { schedulerApi, approvalApi, type JobResponse, type ApprovalItem } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export default function TasksPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // 1. SWR: Scheduler Jobs
  const {
    data: jobs,
    isLoading: jobsLoading,
    error: jobsError,
    mutate: mutateJobs,
  } = useSWR<JobResponse[]>(
    workspaceId ? `scheduler-jobs-${workspaceId}` : null,
    () => schedulerApi.listJobs({ page_size: 50 }),
    { revalidateOnFocus: false },
  );

  // 2. SWR: Pending Approvals
  const {
    data: approvalsRes,
    error: approvalsError,
    mutate: mutateApprovals,
  } = useSWR(
    workspaceId ? `approvals-${workspaceId}` : null,
    () => approvalApi.list({ status: 'PENDING' }),
    { revalidateOnFocus: false },
  );

  const pendingApprovals: ApprovalItem[] = approvalsRes?.items ?? [];
  const rawJobs = jobs ?? [];

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const filteredJobs = rawJobs.filter((job) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return job.status === 'active';
    if (statusFilter === 'PAUSED') return job.status === 'paused';
    if (statusFilter === 'PENDING_APPROVAL') return false; // Handled separately
    return job.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const activeCount = rawJobs.filter((j) => j.status === 'active').length;
  const pausedCount = rawJobs.filter((j) => j.status === 'paused').length;

  const handleTrigger = async (jobId: string, name: string) => {
    setActionInProgress(jobId);
    try {
      await schedulerApi.triggerJob(jobId);
      toast({
        tone: 'success',
        title: 'Task Execution Triggered',
        detail: `Dispatched '${name}' to background worker pool.`,
      });
      await mutateJobs();
    } catch {
      toast({
        tone: 'error',
        title: 'Trigger Failed',
        detail: 'Could not trigger background job execution.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTogglePause = async (job: JobResponse) => {
    setActionInProgress(job.id);
    try {
      if (job.status === 'active') {
        await schedulerApi.pauseJob(job.id);
        toast({
          tone: 'success',
          title: 'Task Paused',
          detail: `Paused cron schedule for '${job.name}'.`,
        });
      } else {
        await schedulerApi.resumeJob(job.id);
        toast({
          tone: 'success',
          title: 'Task Resumed',
          detail: `Resumed cron schedule for '${job.name}'.`,
        });
      }
      await mutateJobs();
    } catch {
      toast({
        tone: 'error',
        title: 'Action Failed',
        detail: 'Could not update task schedule status.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return (
          <Badge variant="primary" size="sm">
            ACTIVE SCHEDULE
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" size="sm">
            COMPLETED
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="warning" size="sm">
            PAUSED
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="error" size="sm">
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Autonomous Tasks &amp; Workflow DAGs"
        eyebrow="Live scheduler"
        description="Multi-agent execution graph, background cron sweeps, and human-in-the-loop decision checkpoints."
        actions={
          <Link href={`/workspace/${workspaceId}/approvals`}>
            <Button variant={pendingApprovals.length > 0 ? 'primary' : 'outline'} size="sm">
              <span className="flex items-center gap-1.5">
                <ShieldIcon size={14} /> Approvals Center{' '}
                {pendingApprovals.length > 0 && `(${pendingApprovals.length})`}
              </span>
            </Button>
          </Link>
        }
      />

      {/* Execution Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Recurring Jobs"
          value={activeCount}
          icon={<PlayIcon size={20} />}
          caption="Autonomous background tasks"
        />
        <StatCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          icon={<ShieldIcon size={20} />}
          caption="Awaiting human consent"
        />
        <StatCard
          label="Paused Schedules"
          value={pausedCount}
          icon={<CheckSquareIcon size={20} />}
          caption="Inactive or suspended jobs"
        />
        <StatCard
          label="Execution Mode"
          value="Async Worker"
          icon={<ClockIcon size={20} />}
          caption="PostgreSQL Cron Runtime"
        />
      </div>

      {/* Filter Tabs */}
      <FilterPills
        options={[
          { value: 'ALL', label: 'All Tasks' },
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'PAUSED', label: 'PAUSED' },
        ]}
        value={statusFilter}
        onChange={setStatusFilter}
        ariaLabel="Filter tasks by schedule status"
      />

      {/* Pending Approvals load failure: never render a silent "0" */}
      {approvalsError && !jobsError && (
        <div
          className="p-3.5 text-sm text-error bg-error/10 rounded-xl border border-error/30 flex items-center justify-between gap-2"
          role="alert"
        >
          <span>Couldn&apos;t load pending approvals. Counts below may be incomplete.</span>
          <button
            type="button"
            onClick={() => mutateApprovals()}
            className="text-xs font-medium underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Pending Approvals Section if any */}
      {pendingApprovals.length > 0 && (
        <Card className="p-4 border-warning/30 bg-warning/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-warning font-semibold text-xs">
              <ShieldIcon size={16} /> Human-In-The-Loop: {pendingApprovals.length} Action(s)
              Require Authorization
            </div>
            <Link
              href={`/workspace/${workspaceId}/approvals`}
              className="text-xs text-action hover:underline font-medium"
            >
              Review in Approvals &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 3).map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border-subtle text-xs"
              >
                <div>
                  <span className="font-semibold text-text">{app.action_type}</span>
                  <span className="text-text-muted ml-2">by {app.agent_name || 'Agent'}</span>
                </div>
                <Badge variant="warning" size="sm">
                  PENDING
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tasks List */}
      {jobsLoading ? (
        <Card className="p-12 text-center space-y-3">
          <Spinner size="md" className="text-primary" />
          <p className="text-xs text-text-muted font-medium">
            Loading autonomous execution schedules from database…
          </p>
        </Card>
      ) : jobsError ? (
        <ErrorState
          title="Failed to load tasks"
          message="We couldn't retrieve your scheduled tasks from the server. This is a connection or server issue, not an empty list."
          onRetry={() => mutateJobs()}
        />
      ) : filteredJobs.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No scheduled tasks found"
            description="There are currently no background tasks or cron executions configured in this workspace."
            action={{
              label: 'Refresh Task List',
              onClick: () => mutateJobs(),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const isExpanded = !!expandedTasks[job.id];
            const isActing = actionInProgress === job.id;

            return (
              <Card key={job.id} className="p-5 space-y-4 border-border-strong transition-all">
                {/* Task Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-200 text-text-muted">
                        {job.id}
                      </span>
                      {getStatusBadge(job.status)}
                      <span className="text-xs font-mono text-text-muted">
                        Cron: <code className="text-text">{job.cron}</code>
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-text pt-0.5">{job.name}</h2>
                    <p className="text-xs text-text-secondary">
                      Type: <strong className="text-text">{job.type}</strong>
                      {job.method && <span> • HTTP {job.method}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => handleTrigger(job.id, job.name)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <PlayIcon size={12} /> Run Now
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isActing}
                      onClick={() => handleTogglePause(job)}
                    >
                      {job.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(job.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${job.name}`}
                      className="p-1.5 rounded-lg border border-border-subtle hover:bg-surface-100 text-text-muted hover:text-text transition-colors"
                    >
                      {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t border-border-subtle text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-surface-100 border border-border-subtle font-mono text-xs">
                      <div>
                        <span className="text-text-muted block">Last Run:</span>
                        <span className="text-text font-semibold">
                          {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Next Run:</span>
                        <span className="text-text font-semibold">
                          {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block">Registered:</span>
                        <span className="text-text">
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {job.payload && Object.keys(job.payload).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs font-semibold uppercase text-text-muted">
                          Configured Payload
                        </span>
                        <pre className="p-3 rounded-lg bg-surface-200 border border-border-subtle font-mono text-xs overflow-x-auto text-text">
                          {JSON.stringify(job.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
