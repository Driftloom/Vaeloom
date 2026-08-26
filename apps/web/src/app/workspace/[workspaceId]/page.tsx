'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { approvalApi } from '@/lib/api-client';
import Link from 'next/link';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import type { Agent, Memory, PaginatedResponse, Event } from '@vaeloom/shared-types';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDeadlineDate(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diff = target - now;
  if (diff < 0) return 'Overdue';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  return new Date(iso).toLocaleDateString();
}

type DeadlineEvent = Event & {
  payload: { deadline?: string; title?: string; description?: string };
};

function isDeadlineEvent(e: Event): e is DeadlineEvent {
  const deadline = (e.payload as Record<string, unknown>)?.['deadline'];
  return typeof deadline === 'string' && !!deadline;
}

export default function DashboardPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const { workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: agents, error: agentsError } = useSWR<Agent[]>(
    workspaceId ? `/workspaces/${workspaceId}/agents` : null,
    () => api.request<Agent[]>(`/workspaces/${workspaceId}/agents`),
  );
  const { data: memories, error: memoriesError } = useSWR<Memory[]>(
    workspaceId ? `/workspaces/${workspaceId}/memories` : null,
    () => api.request<Memory[]>(`/workspaces/${workspaceId}/memories`),
  );
  const {
    data: eventsRes,
    loading: eventsLoading,
    error: eventsError,
  } = useApi<Event[] | PaginatedResponse<Event>>(
    () => api.request<Event[] | PaginatedResponse<Event>>(`/events?workspace_id=${workspaceId}`),
    { enabled: !!workspaceId },
  );

  const { data: approvalsRes } = useSWR(workspaceId ? `approvals-pending-${workspaceId}` : null, () => approvalApi.list({ status: 'PENDING', page: 1, page_size: 5 }));
  const pendingCount = approvalsRes?.total ?? approvalsRes?.items?.length ?? 0;
  const events: Event[] = Array.isArray(eventsRes)
    ? eventsRes
    : ((eventsRes as PaginatedResponse<Event>)?.data ?? []);
  const activityEvents = events.slice(0, 10);
  const deadlineEvents = events.filter(isDeadlineEvent).slice(0, 5);
  const agentCount = agents?.length ?? 0;
  const memoryCount = memories?.length ?? 0;
  const agentsFailed = Boolean(agentsError);
  const memoriesFailed = Boolean(memoriesError);

  if (wsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-surface-hover rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-24">
              <div className="h-4 w-24 bg-surface-hover rounded mb-4" />
              <div className="h-8 w-12 bg-surface-hover rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="card h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="workspace-dashboard">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">
          {workspace?.name ?? 'Dashboard'}
        </h1>
        <p className="text-text-muted">
          {agentsFailed || memoriesFailed ? (
            'Could not load workspace stats ΓÇö see cards below.'
          ) : agentCount === 0 && memoryCount === 0 ? (
            <>
              No agents or memories yet ΓÇö{' '}
              <a href={`/workspace/${workspaceId}/files`} className="text-primary underline">
                upload a file
              </a>{' '}
              or{' '}
              <a href={`/workspace/${workspaceId}/agents`} className="text-primary underline">
                create an agent
              </a>{' '}
              to get started.
            </>
          ) : (
            <>Welcome back. Here&apos;s what your {agentCount} agents have been up to.</>
          )}
        </p>
      </header>

      {(agentCount === 0 || memoryCount === 0) && <OnboardingChecklist workspaceId={workspaceId} />}

      {pendingCount > 0 && (
        <Link href={`/workspace/${workspaceId}/approvals`} className="card border-amber-500/30 bg-amber-500/5 flex items-center justify-between hover:border-amber-500/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-700 font-mono text-sm">{pendingCount}</span>
            <div>
              <p className="font-medium text-text">Pending approvals</p>
              <p className="text-xs text-text-muted">Agent suggestions require your review ΓÇö Files, Gmail, Schedule, Applications</p>
            </div>
          </div>
          <span className="text-sm text-amber-700 font-medium">Review ΓåÆ</span>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">
            Active Agents
          </h2>
          {agentsFailed ? (
            <p className="text-sm text-red-400">Failed to load</p>
          ) : (
            <div className="text-4xl font-display text-primary">{agentCount}</div>
          )}
        </div>
        <div className="card">
          <h2 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">
            Memory Nodes
          </h2>
          {memoriesFailed ? (
            <p className="text-sm text-red-400">Failed to load</p>
          ) : (
            <div className="text-4xl font-display text-accent">{memoryCount}</div>
          )}
        </div>
        <div className="card">
          <h2 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">
            Tasks Pending
          </h2>
          <div className="text-4xl font-display text-text">{deadlineEvents.length || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card h-96 flex flex-col">
          <h2 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">
            Recent Activity
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4">
            {eventsLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 items-start animate-pulse">
                    <div className="w-6 h-6 bg-surface-hover rounded" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-surface-hover rounded mb-2" />
                      <div className="h-3 w-20 bg-surface-hover rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!eventsLoading && eventsError && (
              <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
                <p>Could not load activity feed.</p>
                <button
                  className="text-sm text-primary hover:underline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            )}
            {!eventsLoading && !eventsError && activityEvents.length === 0 && (
              <div className="flex items-center justify-center h-full text-text-muted">
                No recent activity.
              </div>
            )}
            {!eventsLoading &&
              !eventsError &&
              activityEvents.map((evt) => (
                <div key={evt.id} className="flex gap-4 items-start">
                  <span className="text-lg mt-0.5">
                    {evt.category === 'agent' ? 'A' : evt.category === 'memory' ? 'M' : 'E'}
                  </span>
                  <div>
                    <p className="text-text">{evt.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-text-muted font-mono mt-1">
                      {formatRelativeTime(evt.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="card h-96 flex flex-col">
          <h2 className="font-mono text-sm text-text-muted mb-4 uppercase tracking-wider">
            Upcoming Deadlines
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4">
            {eventsLoading && (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse p-3 bg-background rounded border border-border"
                  >
                    <div className="h-4 w-32 bg-surface-hover rounded mb-2" />
                    <div className="h-3 w-24 bg-surface-hover rounded" />
                  </div>
                ))}
              </div>
            )}
            {!eventsLoading && eventsError && (
              <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
                <p>Could not load deadlines.</p>
                <button
                  className="text-sm text-primary hover:underline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            )}
            {!eventsLoading && !eventsError && deadlineEvents.length === 0 && (
              <div className="flex items-center justify-center h-full text-text-muted">
                No deadlines set.
              </div>
            )}
            {!eventsLoading &&
              !eventsError &&
              deadlineEvents.map((evt) => {
                const payload = evt.payload as Record<string, unknown>;
                const deadline = payload?.['deadline'] as string;
                const title = (payload?.['title'] as string) ?? evt.type.replace(/_/g, ' ');
                const description = (payload?.['description'] as string) ?? '';
                return (
                  <div
                    key={evt.id}
                    className="flex justify-between items-center p-3 bg-background rounded border border-border"
                  >
                    <div>
                      <p className="text-text font-medium">{title}</p>
                      {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-accent font-mono text-sm">
                        {formatDeadlineDate(deadline)}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {new Date(deadline).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
