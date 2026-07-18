'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '../../../../lib/api';

export default function SchedulePage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [syncing, setSyncing] = useState(false);
  const events = [
    { id: '1', title: 'Google Technical Screen', date: 'Tomorrow, 10:00 AM - 11:00 AM', type: 'Interview' },
    { id: '2', title: 'Stripe Application Deadline', date: 'Friday, 11:59 PM', type: 'Deadline' },
  ];

  const handleSync = async () => {
    if (!workspaceId) return;
    setSyncing(true);
    try {
      const connectors = await api.request<Array<{ id: string; provider: string }>>(`/workspaces/${workspaceId}/connectors`);
      const calendar = connectors.find((c) => c.provider === 'calendar');
      if (calendar) {
        await api.integrations.sync(calendar.id);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
          <p className="text-text-muted">Manage your interviews and deadlines.</p>
        </div>
        <button className="btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync Calendar'}
        </button>
      </header>

      {events.length === 0 ? (
        <EmptyState 
          title="No upcoming events" 
          description="Sync your calendar or let the Gmail Agent extract deadlines for you."
          action={{ label: 'Connect Calendar', onClick: () => {} }}
        />
      ) : (
        <div className="card">
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-12 rounded-full ${event.type === 'Interview' ? 'bg-primary' : 'bg-accent'}`}></div>
                  <div>
                    <h3 className="text-lg font-medium text-text">{event.title}</h3>
                    <p className="text-sm text-text-muted">{event.date}</p>
                  </div>
                </div>
                <div className="bg-surface px-3 py-1 rounded border border-border">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">{event.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
