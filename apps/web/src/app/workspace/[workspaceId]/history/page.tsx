'use client';
import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '../../../../lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Event, PaginatedResponse } from '@vaeloom/shared-types';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getActionDescription(event: Event): string {
  if (event.payload?.['description']) return event.payload['description'] as string;
  if (event.payload?.['action']) return event.payload['action'] as string;
  return `${event.type} from ${event.source}`;
}

const statusStyles: Record<string, string> = {
  completed: 'border-primary/50 text-primary bg-primary/10',
  published: 'border-border text-text-muted bg-surface',
  processing: 'border-yellow-500/50 text-yellow-600 bg-yellow-50 dark:border-yellow-400/50 dark:text-yellow-400 dark:bg-yellow-950/20',
  failed: 'border-red-500/50 text-red-600 bg-red-50 dark:border-red-400/50 dark:text-red-400 dark:bg-red-950/20',
  retrying: 'border-yellow-500/50 text-yellow-600 bg-yellow-50 dark:border-yellow-400/50 dark:text-yellow-400 dark:bg-yellow-950/20',
};

export default function HistoryPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Event>>(
    workspaceId ? `events-${workspaceId}` : null,
    () => api.events.list(),
  );

  const events = data?.data ?? [];

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">History</h1>
          <p className="text-text-muted">Audit log of all agent actions and system events.</p>
        </header>
        <ErrorState
          title="Failed to load history"
          message={error.message || 'An unexpected error occurred.'}
          onRetry={() => mutate()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">History</h1>
          <p className="text-text-muted">Audit log of all agent actions and system events.</p>
        </div>
        <button className="btn-secondary" onClick={handleExport} disabled={events.length === 0}>
          Export Log
        </button>
      </header>

      {isLoading ? (
        <div className="card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                <th scope="col" className="pb-3 font-normal">Timestamp</th>
                <th scope="col" className="pb-3 font-normal">Agent</th>
                <th scope="col" className="pb-3 font-normal">Action</th>
                <th scope="col" className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="border-b border-border/50 animate-pulse">
                  <td className="py-3"><div className="h-4 bg-border rounded w-20" /></td>
                  <td className="py-3"><div className="h-4 bg-border rounded w-28" /></td>
                  <td className="py-3"><div className="h-4 bg-border rounded w-56" /></td>
                  <td className="py-3"><div className="h-4 bg-border rounded w-14" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Agent actions and system events will appear here once you start using the workspace."
        />
      ) : (
        <div className="card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                <th scope="col" className="pb-3 font-normal">Timestamp</th>
                <th scope="col" className="pb-3 font-normal">Agent</th>
                <th scope="col" className="pb-3 font-normal">Action</th>
                <th scope="col" className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="py-3 text-text-muted text-sm" title={new Date(event.createdAt).toLocaleString()}>
                    {formatTimestamp(event.createdAt)}
                  </td>
                  <td className="py-3 text-primary text-sm font-medium">{event.source}</td>
                  <td className="py-3 text-text text-sm">{getActionDescription(event)}</td>
                  <td className="py-3">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[event.status] || 'border-border text-text-muted bg-surface'}`}>
                      {event.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
