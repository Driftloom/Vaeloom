'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { eventApi, Event, profileApi, ProfileActivityItem } from '@/lib/api-client';

interface ActivityItem {
  id: string;
  agentName: string;
  action: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'failed';
}

export function RecentActivity({
  activities,
  workspaceId,
}: {
  activities?: ActivityItem[];
  workspaceId: string;
}) {
  const { data: profileActs, isLoading: loadingProfileActs } = useSWR<ProfileActivityItem[]>(
    workspaceId && (!activities || activities.length === 0)
      ? ['profile-activity', workspaceId]
      : null,
    () => profileApi.activity(workspaceId),
    { revalidateOnFocus: false },
  );

  const { data: liveEvents, isLoading: loadingEvents } = useSWR<Event[]>(
    !activities || activities.length === 0 ? ['workspace-events', workspaceId] : null,
    () => eventApi.list({ workspace_id: workspaceId }),
    { revalidateOnFocus: false },
  );

  const isLoading = loadingProfileActs && loadingEvents;

  const displayActivities: ActivityItem[] = React.useMemo(() => {
    if (activities && activities.length > 0) return activities;

    if (profileActs && profileActs.length > 0) {
      return profileActs.map((act) => ({
        id: act.id,
        agentName: act.agentName || 'System',
        action: act.description,
        timestamp: act.timestamp,
        status: (act.status as any) || 'completed',
      }));
    }

    if (!liveEvents || liveEvents.length === 0) return [];

    return liveEvents.slice(0, 8).map((evt) => {
      const payload = evt.payload || {};
      const agent = (payload['agent_name'] as string) || evt.source || 'Agent';
      const eventType = evt.type || 'activity';
      const action =
        eventType === 'agent.execution' ? 'executed a task' : eventType.replace(/[_.]/g, ' ');

      const statusVal = (evt.status || (payload['status'] as string) || 'completed').toLowerCase();
      const status: 'completed' | 'in_progress' | 'failed' =
        statusVal === 'failed' || statusVal === 'error'
          ? 'failed'
          : statusVal === 'running' || statusVal === 'processing'
            ? 'in_progress'
            : 'completed';

      const date = evt.createdAt ? new Date(evt.createdAt) : new Date();
      const timestamp =
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' · ' +
        date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return {
        id: evt.id,
        agentName: agent.charAt(0).toUpperCase() + agent.slice(1),
        action,
        timestamp,
        status,
      };
    });
  }, [activities, profileActs, liveEvents]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-text">Recent Activity</h2>
          <p className="text-sm text-text-dim mt-1">
            Latest actions performed on your profile and memory
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}/history`}
          className="text-sm text-primary hover:text-primary-hover transition-colors"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-12 bg-surface-200 rounded-lg" />
          <div className="h-12 bg-surface-200 rounded-lg" />
          <div className="h-12 bg-surface-200 rounded-lg" />
        </div>
      ) : displayActivities.length === 0 ? (
        <div className="text-center py-8 px-4 border border-dashed border-border rounded-lg bg-surface-50">
          <svg
            className="w-8 h-8 text-text-muted mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-text">No recent activity</p>
          <p className="text-xs text-text-dim mt-1">
            Actions on your profile will appear here in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-3 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  activity.status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                    : activity.status === 'in_progress'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                }`}
              >
                {activity.status === 'completed' && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {activity.status === 'in_progress' && (
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                )}
                {activity.status === 'failed' && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">
                  <span className="font-medium">{activity.agentName}</span> {activity.action}
                </p>
                <p className="text-xs text-text-dim mt-0.5">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
