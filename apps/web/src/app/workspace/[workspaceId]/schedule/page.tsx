'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { eventApi } from '@/lib/api-client';
import type { Event } from '@vaeloom/shared-types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getEventTitle(event: Event): string {
  if (event.payload?.['title']) return event.payload['title'] as string;
  return event.type;
}

const typeColors: Record<string, string> = {
  interview: 'bg-primary',
  deadline: 'bg-accent',
  meeting: 'bg-yellow-500',
};

export default function SchedulePage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await eventApi.list();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
          <p className="text-text-muted">Manage your interviews and deadlines.</p>
        </header>
        <LoadingSpinner text="Loading schedule..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
          <p className="text-text-muted">Manage your interviews and deadlines.</p>
        </header>
        <ErrorState title="Failed to load schedule" message={error} onRetry={fetchEvents} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
        <p className="text-text-muted">Manage your interviews and deadlines.</p>
      </header>

      {events.length === 0 ? (
        <EmptyState title="No upcoming events" description="Sync your calendar or let the Gmail Agent extract deadlines for you." />
      ) : (
        <div className="card">
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-12 rounded-full ${typeColors[event.category] || 'bg-primary'}`}></div>
                  <div>
                    <h3 className="text-lg font-medium text-text">{getEventTitle(event)}</h3>
                    <p className="text-sm text-text-muted">{formatDate(event.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono px-2 py-1 rounded border ${event.status === 'completed' ? 'border-green-500/50 text-green-400 bg-green-950/20' : event.status === 'failed' ? 'border-red-500/50 text-red-400 bg-red-950/20' : 'border-border text-text-muted bg-surface'}`}>
                    {event.status.toUpperCase()}
                  </span>
                  <div className="bg-surface px-3 py-1 rounded border border-border">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wider">{event.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
