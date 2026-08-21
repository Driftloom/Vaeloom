'use client';
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { api } from '../../../../lib/api';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Modal } from '@vaeloom/ui-kit';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';

const PROVIDER_META: Record<string, { name: string; scopes: string[]; description: string }> = {
  drive: {
    name: 'Google Drive',
    scopes: ['drive.readonly'],
    description: 'Read-only access to files you open with Vaeloom. No write/delete.',
  },
  github: {
    name: 'GitHub',
    scopes: ['repo:read', 'user:read'],
    description: 'Read your repos and profile. No write access.',
  },
  gmail: {
    name: 'Gmail',
    scopes: ['gmail.readonly'],
    description: 'Read-only mailbox access for ingestion. Drafts require approval.',
  },
  notion: {
    name: 'Notion',
    scopes: ['notion:read'],
    description: 'Read pages you share. No edit access.',
  },
  calendar: {
    name: 'Google Calendar',
    scopes: ['calendar.readonly'],
    description: 'Read events to extract deadlines. No write.',
  },
  slack: {
    name: 'Slack',
    scopes: ['channels:read', 'chat:write'],
    description: 'Read channels you authorize. Messages via approval.',
  },
};

const ALL_PROVIDERS: ConnectorProvider[] = [
  'drive',
  'github',
  'gmail',
  'notion',
  'calendar',
  'slack',
];

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
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [connectorToRevoke, setConnectorToRevoke] = useState<Connector | null>(null);
  const [pendingProvider, setPendingProvider] = useState<ConnectorProvider | null>(null);

  const byProvider = useMemo(() => new Map(connectors.map((c) => [c.provider, c])), [connectors]);
  const connected = useMemo(() => connectors, [connectors]);
  const available = useMemo(() => ALL_PROVIDERS.filter((p) => !byProvider.has(p)), [byProvider]);

  const handleConnect = async (provider: ConnectorProvider) => {
    const meta = PROVIDER_META[provider];
    setBusy(`connect-${provider}`);
    try {
      // Try real OAuth redirect first for providers that support SSO
      const redirectUri = `${window.location.origin}/auth/callback`;
      try {
        const res = await api.request<{ auth_url?: string; authUrl?: string }>(
          `/auth/sso/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`,
        );
        const url =
          (res as Record<string, string>)['auth_url'] ?? (res as Record<string, string>)['authUrl'];
        if (url) {
          window.location.href = url;
          return;
        }
      } catch {
        // fallback to legacy integration create if SSO not configured for this provider
      }
      await api.integrations.create({ name: meta?.name ?? provider, provider });
      await mutate();
      toast({
        tone: 'success',
        title: 'Connector created',
        detail: `${meta?.name ?? provider} — ${meta?.scopes.join(', ')}`,
      });
      setPendingProvider(null);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Connect failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async (connector: Connector) => {
    setBusy(`revoke-${connector.id}`);
    try {
      await api.request(`/integrations/${connector.id}`, { method: 'DELETE' });
      await mutate();
      toast({ tone: 'success', title: 'Revoked', detail: `${connector.provider} disconnected` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Revoke failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async (connector: Connector) => {
    setBusy(`sync-${connector.id}`);
    try {
      const res = await api.integrations.sync(connector.id);
      await mutate();
      toast({
        tone: 'success',
        title: 'Sync started',
        detail: (res as { message?: string })?.message ?? 'Sync requested',
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
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
          message={String((isError as Error)?.message ?? isError)}
          onRetry={() => mutate()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="connectors-page">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Connectors</h1>
        <p className="text-text-muted">
          Least-privilege OAuth. Each connector shows the exact scopes granted — review before
          connecting. Sync progress and errors surface inline with retry.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-3">
          Connected
        </h2>
        {connected.length === 0 ? (
          <p className="text-sm text-text-muted border border-dashed border-border rounded-xl p-6 text-center">
            No connectors yet. Connect one below.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {connected.map((conn) => {
              const meta = PROVIDER_META[conn.provider];
              const isBusy = busy === `sync-${conn.id}`;
              return (
                <div
                  key={conn.id}
                  className="card border border-primary/20"
                  data-testid="connector-card"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg font-bold text-primary uppercase">
                      {(meta?.name ?? conn.provider).charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-display font-medium text-text truncate"
                        data-testid="connector-name"
                      >
                        {meta?.name ?? conn.provider}
                      </h3>
                      <p className="text-xs font-mono text-text-muted">
                        {conn.provider} · {meta?.scopes.join(', ') ?? '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mb-3">{meta?.description ?? ''}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      data-testid="connector-status"
                      className={`text-xs font-mono px-2 py-1 rounded border ${statusStyles[conn.status] ?? statusStyles['disconnected']}`}
                    >
                      {conn.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-text-muted">
                      Last sync: {formatDate(conn.lastSyncAt)}
                    </span>
                  </div>
                  {conn.status === 'syncing' && (
                    <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                      <div className="h-full w-2/3 animate-pulse bg-yellow-500/60" />
                    </div>
                  )}
                  {(conn as unknown as Record<string, unknown>)['errorDetail'] ? (
                    <p className="text-xs text-red-400 mb-3" role="alert">
                      {String((conn as unknown as Record<string, unknown>)['errorDetail'])}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      data-testid="sync-button"
                      className="btn-secondary flex-1 text-sm"
                      disabled={isBusy}
                      onClick={() => handleSync(conn)}
                    >
                      {isBusy ? 'Syncing…' : 'Sync Now'}
                    </button>
                    <button
                      className="btn-ghost border border-border flex-1 text-sm"
                      disabled={busy === `revoke-${conn.id}`}
                      onClick={() => setConnectorToRevoke(conn)}
                    >
                      {busy === `revoke-${conn.id}` ? 'Revoking…' : 'Revoke'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-mono text-sm uppercase tracking-widest text-text-muted mb-3">
          Available
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {available.map((provider) => {
            const meta = PROVIDER_META[provider]!;
            const isBusy = busy === `connect-${provider}`;
            return (
              <div
                key={provider}
                className="card border border-border"
                data-testid="connector-card"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg font-bold text-text-muted uppercase">
                    {meta.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display font-medium text-text" data-testid="connector-name">
                      {meta.name}
                    </h3>
                    <p className="text-xs font-mono text-text-muted">{provider}</p>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 rounded border border-border text-text-muted">
                    NOT CONNECTED
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-2">{meta.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {meta.scopes.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-mono text-text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <button
                  data-testid="connect-button"
                  className="btn-primary w-full text-sm"
                  disabled={isBusy}
                  onClick={() => setPendingProvider(provider)}
                >
                  {isBusy ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Modal
        isOpen={Boolean(pendingProvider)}
        onClose={() => setPendingProvider(null)}
        title={`Connect ${pendingProvider ? PROVIDER_META[pendingProvider]?.name : ''}`}
      >
        {pendingProvider && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{PROVIDER_META[pendingProvider]!.description}</p>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-text-dim mb-2">
                Scopes requested (least privilege)
              </p>
              <div className="flex flex-wrap gap-1">
                {PROVIDER_META[pendingProvider]!.scopes.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-mono text-primary"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-dim">
              You will be redirected to {PROVIDER_META[pendingProvider]!.name} OAuth. The app never
              sees your password. You can revoke access from the provider at any time.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPendingProvider(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy === `connect-${pendingProvider}`}
                onClick={() => handleConnect(pendingProvider)}
              >
                {busy === `connect-${pendingProvider}` ? 'Connecting…' : 'Continue to OAuth'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!connectorToRevoke}
        onClose={() => setConnectorToRevoke(null)}
        onConfirm={() => {
          if (connectorToRevoke) handleRevoke(connectorToRevoke);
        }}
        title={`Revoke ${connectorToRevoke ? (PROVIDER_META[connectorToRevoke.provider]?.name ?? connectorToRevoke.provider) : ''}?`}
        message="This will remove the connection and stop future syncs. You can reconnect anytime."
        confirmLabel="Revoke"
        variant="danger"
      />
    </div>
  );
}
