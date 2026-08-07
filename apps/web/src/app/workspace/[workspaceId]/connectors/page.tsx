'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { api } from '../../../../lib/api';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';

const DEFAULT_CONNECTORS: Array<{ provider: ConnectorProvider; name: string }> = [
  { provider: 'drive', name: 'Google Drive' },
  { provider: 'github', name: 'GitHub' },
];

const PROVIDER_NAMES: Record<string, string> = {
  drive: 'Google Drive',
  github: 'GitHub',
  gmail: 'Gmail',
  notion: 'Notion',
  calendar: 'Calendar',
  slack: 'Slack',
};

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const { connectors, isLoading, isError, mutate } = useWorkspaceConnectors(workspaceId);
  const [busy, setBusy] = useState<string | null>(null);

  const byProvider = new Map<string, Connector>(connectors.map((c) => [c.provider, c]));
  const merged: Array<Connector & { name: string }> = [
    ...DEFAULT_CONNECTORS.map((d) => {
      const existing = byProvider.get(d.provider);
      if (existing) {
        return { ...existing, name: d.name };
      }
      return {
        id: `default-${d.provider}`,
        workspaceId: workspaceId ?? '',
        provider: d.provider,
        status: 'disconnected',
        createdAt: '',
        updatedAt: '',
        name: d.name,
      } as Connector & { name: string };
    }),
    ...connectors
      .filter((c) => !DEFAULT_CONNECTORS.some((d) => d.provider === c.provider))
      .map((c) => ({ ...c, name: PROVIDER_NAMES[c.provider] ?? c.provider })),
  ];

  const handleConnect = async (provider: ConnectorProvider, name: string) => {
    setBusy(`connect-${provider}`);
    try {
      await api.integrations.create({ name, provider });
      await mutate();
    } catch (err) {
      console.error('Failed to connect', err);
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async (connector: Connector) => {
    setBusy(`sync-${connector.id}`);
    try {
      await api.integrations.sync(connector.id);
      await mutate();
    } catch (err) {
      console.error('Failed to sync', err);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
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

  if (isError) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
          <p className="text-text-muted">Link external accounts for your agents to access.</p>
        </header>
        <ErrorState
          title="Failed to load connectors"
          message={String(isError)}
          onRetry={() => mutate()}
        />
      </div>
    );
  }

  const connected = (connector: Connector & { name: string }) =>
    connector.status === 'connected' || connector.status === 'syncing';

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
        <p className="text-text-muted">Link external accounts for your agents to access.</p>
      </header>

      {merged.length === 0 ? (
        <p className="text-text-muted">No connectors available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {merged.map((conn) => {
            const isBusy = busy === `sync-${conn.id}` || busy === `connect-${conn.provider}`;
            return (
              <div key={conn.id} className="card border border-primary/50 bg-primary/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg font-bold text-primary uppercase">
                    {conn.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display font-medium text-text text-lg truncate">
                      {conn.name}
                    </h2>
                    <p className="text-xs font-mono text-text-muted mt-1">{conn.provider}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[conn.status] || 'border-border text-text-muted bg-surface'}`}
                  >
                    {conn.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-text-muted">
                    Last sync: {formatDate(conn.lastSyncAt)}
                  </span>
                </div>

                {connected(conn) ? (
                  <button
                    className="btn-secondary w-full text-sm"
                    disabled={isBusy}
                    onClick={() => handleSync(conn)}
                  >
                    {isBusy ? 'Syncing...' : 'Sync Now'}
                  </button>
                ) : (
                  <button
                    className="btn-primary w-full text-sm"
                    disabled={isBusy}
                    onClick={() => handleConnect(conn.provider, conn.provider)}
                  >
                    {isBusy ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
