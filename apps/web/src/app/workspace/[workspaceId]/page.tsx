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
import { MorningBriefingCard } from '@/components/dashboard/MorningBriefingCard';
import { AnticipationFeed } from '@/components/dashboard/AnticipationFeed';
import type { Agent, Memory, PaginatedResponse, Event } from '@vaeloom/shared-types';
import {
  Card,
  Badge,
  Heading,
  Text,
  CpuIcon,
  BrainIcon,
  ClockIcon,
  CalendarIcon,
  AlertCircleIcon,
} from '@vaeloom/ui-kit';

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

  const { data: approvalsRes } = useSWR(
    workspaceId ? `approvals-pending-${workspaceId}` : null,
    () => approvalApi.list({ status: 'PENDING', page: 1, page_size: 5 }),
  );
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
        <div className="h-10 w-full max-w-64 bg-[var(--color-bg-elevated,#18181c)] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-[var(--color-bg-surface,#111114)] border border-[var(--color-border-subtle,#27272a)] rounded-xl p-4"
            >
              <div className="h-4 w-24 bg-[var(--color-bg-elevated,#18181c)] rounded mb-4" />
              <div className="h-8 w-12 bg-[var(--color-bg-elevated,#18181c)] rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-96 bg-[var(--color-bg-surface,#111114)] border border-[var(--color-border-subtle,#27272a)] rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="workspace-dashboard">
      <header>
        <Heading level={1} size="2xl" className="mb-2">
          {workspace?.name ?? 'Dashboard'}
        </Heading>
        <Text color="muted" size="base">
          {agentsFailed || memoriesFailed ? (
            'Could not load workspace stats — see cards below.'
          ) : agentCount === 0 && memoryCount === 0 ? (
            <>
              No agents or memories yet —{' '}
              <a
                href={`/workspace/${workspaceId}/files`}
                className="text-[var(--color-action-primary,#3b82f6)] underline"
              >
                upload a file
              </a>{' '}
              or{' '}
              <a
                href={`/workspace/${workspaceId}/agents`}
                className="text-[var(--color-action-primary,#3b82f6)] underline"
              >
                create an agent
              </a>{' '}
              to get started.
            </>
          ) : (
            <>Welcome back. Here&apos;s what your {agentCount} agents have been up to.</>
          )}
        </Text>
      </header>

      {workspaceId && <MorningBriefingCard workspaceId={workspaceId} />}
      {workspaceId && <AnticipationFeed workspaceId={workspaceId} />}

      {(agentCount === 0 || memoryCount === 0) && <OnboardingChecklist workspaceId={workspaceId} />}

      {pendingCount > 0 && (
        <Link
          href={`/workspace/${workspaceId}/approvals`}
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between hover:border-amber-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-500 font-mono text-sm font-semibold">
              {pendingCount}
            </span>
            <div>
              <p className="font-semibold text-sm text-[var(--color-text-primary,#f4f4f5)]">
                Pending approvals
              </p>
              <p className="text-xs text-[var(--color-text-muted,#71717a)]">
                Agent suggestions require your review — Files, Gmail, Schedule, Applications
              </p>
            </div>
          </div>
          <span className="text-xs text-amber-500 font-medium">Review →</span>
        </Link>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-[var(--color-text-muted,#71717a)] uppercase tracking-wider">
              Active Agents
            </h2>
            <CpuIcon size={16} className="text-[var(--color-action-primary,#3b82f6)]" />
          </div>
          {agentsFailed ? (
            <p className="text-sm text-[var(--color-status-danger,#ef4444)]">Failed to load</p>
          ) : (
            <div className="text-3xl font-bold font-mono text-[var(--color-action-primary,#3b82f6)] tabular-nums">
              {agentCount}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-[var(--color-text-muted,#71717a)] uppercase tracking-wider">
              Memory Nodes
            </h2>
            <BrainIcon size={16} className="text-[var(--color-ai-accent,#6366f1)]" />
          </div>
          {memoriesFailed ? (
            <p className="text-sm text-[var(--color-status-danger,#ef4444)]">Failed to load</p>
          ) : (
            <div className="text-3xl font-bold font-mono text-[var(--color-text-primary,#f4f4f5)] tabular-nums">
              {memoryCount}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-[var(--color-text-muted,#71717a)] uppercase tracking-wider">
              Tasks Pending
            </h2>
            <ClockIcon size={16} className="text-[var(--color-text-muted,#71717a)]" />
          </div>
          <div className="text-3xl font-bold font-mono text-[var(--color-text-primary,#f4f4f5)] tabular-nums">
            {deadlineEvents.length || 0}
          </div>
        </Card>
      </div>

      {/* Dual Workbench: Recent Activity & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-96 flex flex-col p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border-subtle,#27272a)] pb-3">
            <h2 className="font-mono text-xs text-[var(--color-text-muted,#71717a)] uppercase tracking-wider flex items-center gap-2">
              <ClockIcon size={14} />
              <span>Recent Activity</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {eventsLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 items-start animate-pulse">
                    <div className="w-6 h-6 bg-[var(--color-bg-elevated,#18181c)] rounded" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-[var(--color-bg-elevated,#18181c)] rounded mb-2" />
                      <div className="h-3 w-20 bg-[var(--color-bg-elevated,#18181c)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!eventsLoading && eventsError && (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted,#71717a)] gap-2">
                <AlertCircleIcon size={20} className="text-[var(--color-status-danger,#ef4444)]" />
                <p className="text-xs">Could not load activity feed.</p>
                <button
                  className="text-xs text-[var(--color-action-primary,#3b82f6)] hover:underline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            )}
            {!eventsLoading && !eventsError && activityEvents.length === 0 && (
              <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted,#71717a)]">
                No recent activity.
              </div>
            )}
            {!eventsLoading &&
              !eventsError &&
              activityEvents.map((evt) => (
                <div key={evt.id} className="flex gap-3 items-start text-xs">
                  <span className="w-5 h-5 rounded bg-[var(--color-bg-elevated,#18181c)] border border-[var(--color-border-subtle,#27272a)] flex items-center justify-center font-mono text-[10px] text-[var(--color-text-secondary,#a1a1aa)] shrink-0">
                    {evt.category === 'agent' ? 'A' : evt.category === 'memory' ? 'M' : 'E'}
                  </span>
                  <div>
                    <p className="text-[var(--color-text-primary,#f4f4f5)] font-medium">
                      {evt.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted,#71717a)] font-mono mt-0.5">
                      {formatRelativeTime(evt.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card className="h-96 flex flex-col p-5">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border-subtle,#27272a)] pb-3">
            <h2 className="font-mono text-xs text-[var(--color-text-muted,#71717a)] uppercase tracking-wider flex items-center gap-2">
              <CalendarIcon size={14} />
              <span>Upcoming Deadlines</span>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {eventsLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse p-3 bg-[var(--color-bg-elevated,#18181c)] rounded-lg border border-[var(--color-border-subtle,#27272a)]"
                  >
                    <div className="h-4 w-32 bg-[var(--color-border-subtle,#27272a)] rounded mb-2" />
                    <div className="h-3 w-24 bg-[var(--color-border-subtle,#27272a)] rounded" />
                  </div>
                ))}
              </div>
            )}
            {!eventsLoading && eventsError && (
              <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted,#71717a)] gap-2">
                <AlertCircleIcon size={20} className="text-[var(--color-status-danger,#ef4444)]" />
                <p className="text-xs">Could not load deadlines.</p>
                <button
                  className="text-xs text-[var(--color-action-primary,#3b82f6)] hover:underline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            )}
            {!eventsLoading && !eventsError && deadlineEvents.length === 0 && (
              <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted,#71717a)]">
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
                    className="flex justify-between items-center p-3 bg-[var(--color-bg-elevated,#18181c)] rounded-lg border border-[var(--color-border-subtle,#27272a)] text-xs"
                  >
                    <div>
                      <p className="text-[var(--color-text-primary,#f4f4f5)] font-medium">
                        {title}
                      </p>
                      {description && (
                        <p className="text-[11px] text-[var(--color-text-muted,#71717a)] mt-0.5">
                          {description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[var(--color-action-primary,#3b82f6)] font-mono text-xs">
                        {formatDeadlineDate(deadline)}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted,#71717a)] mt-0.5 tabular-nums">
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
        </Card>
      </div>
    </div>
  );
}
