'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { connectorApi } from '@/lib/api-client';
import type { ConnectorResponseExt } from '@/lib/api-client';

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusStyles: Record<string, string> = {
  connected: 'border-green-500/50 text-green-400 bg-green-950/20',
  syncing: 'border-yellow-500/50 text-yellow-400 bg-yellow-950/20',
  error: 'border-red-500/50 text-red-400 bg-red-950/20',
  disconnected: 'border-border text-text-muted bg-surface',
};

export default function ConnectorsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [connectors, setConnectors] = useState<ConnectorResponseExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnectors = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await connectorApi.list();
      setConnectors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
          <p className="text-text-muted">Link external accounts for your agents to access.</p>
        </header>
        <LoadingSpinner text="Loading connectors..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
          <p className="text-text-muted">Link external accounts for your agents to access.</p>
        </header>
        <ErrorState title="Failed to load connectors" message={error} onRetry={fetchConnectors} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
        <p className="text-text-muted">Link external accounts for your agents to access.</p>
      </header>

      {connectors.length === 0 ? (
        <EmptyState title="No connectors yet" description="Connect your accounts to enable agent access to external data." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {connectors.map((conn) => (
            <div key={conn.id} className="card border border-primary/50 bg-primary/5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg font-bold text-primary uppercase">
                  {conn.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-medium text-text text-lg truncate">{conn.name}</h2>
                  <p className="text-xs font-mono text-text-muted mt-1">{conn.type}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[conn.status] || 'border-border text-text-muted bg-surface'}`}>
                  {conn.status.toUpperCase()}
                </span>
                <span className="text-xs text-text-muted">
                  Last sync: {formatDate(conn.last_synced_at)}
                </span>
              </div>

              <button className="btn-secondary w-full text-sm" disabled>
                Sync Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
