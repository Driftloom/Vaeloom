'use client';
import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/Page';
import { ApprovalCard } from '@/components/shared/ApprovalCard';
import { notificationApi, approvalApi } from '@/lib/api-client';
import type { NotificationResponse, ApprovalItem } from '@/lib/api-client';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const channelStyles: Record<string, string> = {
  email: 'border-primary/50 text-primary bg-primary/10',
  webhook: 'border-border text-text-muted bg-surface',
  slack: 'border-success/50 text-success bg-success/10',
  push: 'border-blue-500/50 text-info bg-blue-950/20',
};

const statusStyles: Record<string, string> = {
  sent: 'text-success border-success/30 bg-success/10',
  pending: 'text-warning border-warning/30 bg-warning/10',
  failed: 'text-error border-error/30 bg-error/10',
};

export default function NotificationsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const {
    data: notifications,
    error,
    isLoading,
    mutate,
  } = useSWR<NotificationResponse[]>(workspaceId ? `notifications-${workspaceId}` : null, () =>
    notificationApi.list(),
  );

  const { data: approvalsRes, mutate: mutateApprovals } = useSWR(
    workspaceId ? `approvals-${workspaceId}` : null,
    () => approvalApi.list({ status: 'PENDING' }),
  );

  const pendingApprovals = approvalsRes?.items ?? [];

  const handleApprove = useCallback(
    async (id: string) => {
      await approvalApi.approve(id);
      mutateApprovals();
    },
    [mutateApprovals],
  );

  const handleReject = useCallback(
    async (id: string) => {
      await approvalApi.reject(id);
      mutateApprovals();
    },
    [mutateApprovals],
  );

  const handleExport = useCallback(() => {
    if (!notifications) return;
    const blob = new Blob([JSON.stringify(notifications, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notifications-${workspaceId}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notifications, workspaceId]);

  const items = notifications ?? [];

  // Rendered once, above the state branches. Previously copy-pasted into the
  // error, loading and success returns, giving this file three <h1>s and three
  // chances for the title to drift.
  const header = (
    <PageHeader
      title="Notifications"
      description="Notification history and delivery status."
      actions={
        <button className="btn-secondary" onClick={handleExport} disabled={items.length === 0}>
          Export
        </button>
      }
    />
  );

  if (error) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <ErrorState
          title="Failed to load notifications"
          message={error.message || 'An unexpected error occurred.'}
          onRetry={() => mutate()}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <LoadingSpinner text="Loading notifications..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {header}

      {items.length === 0 && pendingApprovals.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="System notifications and pending approvals will appear here once events are triggered."
        />
      ) : (
        <>
          {pendingApprovals.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
                Pending Approvals
              </h2>
              <div className="space-y-4">
                {pendingApprovals.map((approval: ApprovalItem) => (
                  <ApprovalCard
                    key={approval.id}
                    id={approval.id}
                    agentName={approval.agentName ?? approval.agent_name ?? 'Unknown agent'}
                    actionType={approval.actionType ?? approval.action_type ?? 'action'}
                    description={
                      approval.reason ||
                      `${approval.agentName ?? approval.agent_name ?? 'An agent'} requests approval for ${approval.actionType ?? approval.action_type ?? 'an action'}`
                    }
                    expiresAt={approval.expires_at ?? undefined}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
              Notification History
            </h2>
            {items.length === 0 ? (
              <EmptyState
                title="No notifications yet"
                description="System notifications will appear here once events are triggered."
              />
            ) : (
              <div className="card">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                      <th scope="col" className="pb-3 font-normal">
                        Time
                      </th>
                      <th scope="col" className="pb-3 font-normal">
                        Subject
                      </th>
                      <th scope="col" className="pb-3 font-normal">
                        Channel
                      </th>
                      <th scope="col" className="pb-3 font-normal">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((n) => (
                      <tr
                        key={n.id}
                        className="border-b border-border/50 hover:bg-background/50 transition-colors"
                      >
                        <td
                          className="py-3 text-text-muted text-sm"
                          title={new Date(n.created_at).toLocaleString()}
                        >
                          {formatTimestamp(n.created_at)}
                        </td>
                        <td className="py-3">
                          <div className="text-text text-sm font-medium">
                            {n.subject || '(no subject)'}
                          </div>
                          <div className="text-text-muted text-xs truncate max-w-md">{n.body}</div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-xs font-mono px-2 py-1 rounded border ${channelStyles[n.channel] || 'border-border text-text-muted bg-surface'}`}
                          >
                            {n.channel.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[n.status] || 'border-border text-text-muted bg-surface'}`}
                          >
                            {n.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
