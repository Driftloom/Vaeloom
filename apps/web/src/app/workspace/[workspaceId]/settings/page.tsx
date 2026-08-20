'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '../../../../lib/api';
import { consentApi } from '../../../../lib/api-client';
import { ProviderKeysSection } from '@/components/settings/ProviderKeysSection';
import { ErrorState } from '@/components/shared/ErrorState';
import type { Agent, PaginatedResponse } from '@vaeloom/shared-types';

type IntegrationData = Record<string, unknown> & {
  id: string;
  name?: string;
  provider?: string;
  accountEmail?: string;
};

const AUTONOMY_OPTIONS = [
  { value: 'read_only', label: 'Read Only' },
  { value: 'approval_gated', label: 'Approval Gated' },
  { value: 'full', label: 'Full Autonomy' },
];

export default function SettingsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const {
    data: agentsRes,
    error: agentsError,
    isLoading: agentsLoading,
    mutate: mutateAgents,
  } = useSWR<PaginatedResponse<Agent>>(workspaceId ? `agents-${workspaceId}` : null, () =>
    api.agents.list(),
  );

  const {
    data: integrationsRes,
    error: integrationsError,
    mutate: mutateIntegrations,
  } = useSWR<PaginatedResponse<IntegrationData>>(
    workspaceId ? `integrations-${workspaceId}` : null,
    () => api.integrations.list() as Promise<PaginatedResponse<IntegrationData>>,
  );

  const agents = agentsRes?.data ?? [];
  const integrations = integrationsRes?.data ?? [];

  const [autonomyMap, setAutonomyMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectorPerms, setConnectorPerms] = useState<
    Record<string, { read: boolean; write: boolean }>
  >({});
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReceipt, setDeleteReceipt] = useState<string | null>(null);

  const [consentState, setConsentState] = useState<Record<string, boolean>>({});
  const [consentLoading, setConsentLoading] = useState(false);

  useEffect(() => {
    consentApi
      .me()
      .then((res) => {
        const granted: Record<string, boolean> = {};
        const items = res?.items ?? [];
        for (const item of items) {
          granted[item.scope] = item.revoked_at === null;
        }
        setConsentState(granted);
      })
      .catch(() => {});
  }, []);

  const getAutonomy = useCallback(
    (agent: Agent): string => {
      return autonomyMap[agent.id] ?? 'approval_gated';
    },
    [autonomyMap],
  );

  const handleAutonomyChange = async (agentId: string, newValue: string) => {
    setAutonomyMap((prev) => ({ ...prev, [agentId]: newValue }));
    setSavingId(agentId);
    setSaveError(null);
    try {
      await api.request(`/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ autonomy: newValue }),
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save autonomy level');
      setAutonomyMap((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.request(`/workspaces/${workspaceId}/export`, { method: 'POST' });
    } catch {
      const events = await api.events.list();
      const payload = {
        workspaceId,
        exportedAt: new Date().toISOString(),
        events: events.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-${workspaceId}-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setSaveError('Type DELETE to confirm permanent erasure.');
      return;
    }
    setDeleting(true);
    setSaveError(null);
    setDeleteReceipt(null);
    try {
      await api.request(`/workspaces/${workspaceId}/data`, { method: 'DELETE' });
      setDeleteReceipt(
        `Erasure request received. Your data is being removed (primary deletion). Backups expire within 30 days (backup expiry); nothing is kept longer unless legally required.`,
      );
      setDeleteConfirmText('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete workspace data');
    } finally {
      setDeleting(false);
    }
  };

  const toggleConnectorPerm = (id: string, perm: 'read' | 'write') => {
    setConnectorPerms((prev) => {
      const current = prev[id] ?? { read: true, write: true };
      return { ...prev, [id]: { ...current, [perm]: !current[perm] } };
    });
  };

  const getConnectorPerm = (id: string, perm: 'read' | 'write'): boolean => {
    return connectorPerms[id]?.[perm] ?? true;
  };

  const handleConsentToggle = async (scope: string, grant: boolean) => {
    setConsentLoading(true);
    try {
      if (grant) {
        await consentApi.grant({ scope });
      } else {
        await consentApi.revoke(scope);
      }
      setConsentState((prev) => ({ ...prev, [scope]: grant }));
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : `Failed to ${grant ? 'grant' : 'revoke'} consent`,
      );
    } finally {
      setConsentLoading(false);
    }
  };

  if (agentsError) {
    return (
      <div className="flex flex-col h-full max-w-4xl">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Settings</h1>
          <p className="text-text-muted">Manage workspace preferences and agent autonomy.</p>
        </header>
        <ErrorState
          title="Failed to load agents"
          message={agentsError.message || 'An unexpected error occurred.'}
          onRetry={() => mutateAgents()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Settings</h1>
        <p className="text-text-muted">Manage workspace preferences and agent autonomy.</p>
      </header>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
            Agent Autonomy Levels
          </h2>
          <p className="text-sm text-text-muted mb-4">
            Control how independently each agent is allowed to act on your behalf.
          </p>

          {saveError && (
            <div
              className="mb-4 p-3 text-sm text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/20 rounded border border-red-500/50"
              role="alert"
            >
              {saveError}
            </div>
          )}

          {agentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card flex items-center justify-between animate-pulse">
                  <div className="h-5 bg-border rounded w-40" />
                  <div className="h-8 bg-border rounded w-36" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-text-muted">No agents found in this workspace.</p>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-text">{agent.name}</h3>
                    {savingId === agent.id && (
                      <span className="text-xs text-text-muted font-mono">saving...</span>
                    )}
                  </div>
                  <select
                    aria-label={`Autonomy level for ${agent.name}`}
                    className="bg-background border border-border text-text rounded px-3 py-1.5 text-sm font-mono"
                    value={getAutonomy(agent)}
                    onChange={(e) => handleAutonomyChange(agent.id, e.target.value)}
                    disabled={savingId === agent.id}
                  >
                    {AUTONOMY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
            Connector Permissions
          </h2>
          <p className="text-sm text-text-muted mb-4">
            Manage read/write permissions for connected integrations.
          </p>

          {integrationsError ? (
            <p className="text-sm text-red-600">
              Failed to load integrations.{' '}
              <button className="underline" onClick={() => mutateIntegrations()}>
                Retry
              </button>
            </p>
          ) : integrations.length === 0 ? (
            <p className="text-sm text-text-muted">No integrations connected yet.</p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => {
                const id = integration['id'];
                const name = integration['name'] || integration['provider'] || id;
                return (
                  <div key={id} className="card flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-text">{name}</h3>
                      {integration['accountEmail'] && (
                        <p className="text-xs text-text-muted mt-0.5">
                          {integration['accountEmail']}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getConnectorPerm(id, 'read')}
                          onChange={() => toggleConnectorPerm(id, 'read')}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        Read
                      </label>
                      <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getConnectorPerm(id, 'write')}
                          onChange={() => toggleConnectorPerm(id, 'write')}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        Write
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
            Consent Scopes
          </h2>
          <p className="text-sm text-text-muted mb-4">
            Control what Vaeloom may access. Revoking a scope pauses the connectors that depend on
            it (e.g. revoking gmail read pauses Gmail watching). Connected data remains until you
            delete it.
          </p>
          <p className="text-sm text-text-muted mb-2">
            Consent version: <span className="font-mono">v1</span> — granted at signup, revocable
            anytime.
          </p>
          <div className="space-y-3">
            <label className="card flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="font-medium text-text">Gmail — read (draft-only)</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Watch for job emails and extract deadlines. Vaeloom never sends email without your
                  approval.
                </p>
              </div>
              <input
                type="checkbox"
                checked={consentState['data_processing'] ?? true}
                disabled={consentLoading}
                onChange={(e) => handleConsentToggle('data_processing', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
                aria-label="Gmail read consent"
              />
            </label>
            <label className="card flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="font-medium text-text">Resume & job data</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Store resume, applications and ATS scores for assisted job search.
                </p>
              </div>
              <input
                type="checkbox"
                checked={consentState['agent_access'] ?? true}
                disabled={consentLoading}
                onChange={(e) => handleConsentToggle('agent_access', e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
                aria-label="Resume data consent"
              />
            </label>
            <label className="card flex items-center justify-between cursor-pointer opacity-60">
              <div>
                <h3 className="font-medium text-text">Email send (T3 — gated)</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Disabled by default. Only enabled after legal review and explicit approval (phase
                  13).
                </p>
              </div>
              <input
                type="checkbox"
                disabled
                className="rounded border-border"
                aria-label="Email send consent (gated)"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
            API Keys — Bring Your Own Key
          </h2>
          <ProviderKeysSection workspaceId={workspaceId} />
        </section>

        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
            Data & Privacy
          </h2>
          <p className="text-sm text-text-muted mb-4">Export or delete your workspace data.</p>
          <div className="flex gap-4">
            <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export Workspace Data'}
            </button>
            <button
              className="btn-accent bg-transparent border border-accent hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDeleteData}
              disabled={deleting || deleteConfirmText !== 'DELETE'}
            >
              {deleting ? 'Deleting...' : 'Delete All Data'}
            </button>
          </div>
          <div className="mt-4">
            <label htmlFor="delete-confirm" className="block text-xs text-text-muted mb-1">
              Type <span className="font-mono text-text">DELETE</span> to confirm permanent erasure
            </label>
            <input
              id="delete-confirm"
              type="text"
              className="w-full max-w-sm bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-text-muted">
              Primary deletion is immediate for on-demand data; backups expire within 30 days.
              Nothing is kept longer unless legally required.
            </p>
          </div>
          {deleteReceipt && (
            <div
              className="mt-3 p-3 text-sm text-success-muted bg-success/10 border border-success/40 rounded"
              role="status"
            >
              {deleteReceipt}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
