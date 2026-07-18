'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { api } from '../../../../lib/api';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';

const AVAILABLE_CONNECTORS: { id: ConnectorProvider; name: string; icon: string }[] = [
  { id: 'drive', name: 'Google Drive', icon: '📁' },
  { id: 'gmail', name: 'Gmail', icon: '📧' },
  { id: 'notion', name: 'Notion', icon: '📓' },
  { id: 'github', name: 'GitHub', icon: '🐙' },
  { id: 'calendar', name: 'Calendar', icon: '📅' },
  { id: 'slack', name: 'Slack', icon: '💬' },
];

export default function ConnectorsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { connectors, isLoading, mutate } = useWorkspaceConnectors(workspaceId);

  const handleConnect = async (provider: ConnectorProvider) => {
    if (!workspaceId) return;
    try {
      await api.integrations.create({ name: provider, provider });
      await mutate();
    } catch (e) {
      console.error('Failed to connect', e);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await api.integrations.sync(id);
      await mutate();
    } catch (e) {
      console.error('Failed to sync', e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
        <p className="text-text-muted">Link external accounts for your agents to access.</p>
      </header>

      {isLoading ? (
        <div className="text-text-muted">Loading connectors...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {AVAILABLE_CONNECTORS.map(provider => {
            const connected = connectors.find(c => c.provider === provider.id);
            return (
              <div key={provider.id} className={`card border ${connected ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl">{provider.icon}</div>
                  <div>
                    <h3 className="font-display font-medium text-text">{provider.name}</h3>
                    <p className="text-xs font-mono text-text-muted mt-1">
                      {connected 
                        ? (connected.status === 'syncing' ? 'Syncing...' : `Synced ${connected.lastSyncAt ? new Date(connected.lastSyncAt).toLocaleDateString() : 'recently'}`) 
                        : 'Not connected'}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <button onClick={() => handleSync(connected.id)} className="btn-secondary w-full" disabled={connected.status === 'syncing'}>
                    {connected.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                  </button>
                ) : (
                  <button onClick={() => handleConnect(provider.id)} className="btn-primary w-full bg-surface-hover text-text hover:bg-surface-active">
                    Connect
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
