'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, clearToken, clearRefreshToken } from '../../../../lib/api';
import { consentApi, gdprApi } from '../../../../lib/api-client';
import { ProviderKeysSection } from '@/components/settings/ProviderKeysSection';
import { ThemePreferences } from '@/components/profile/ThemePreferences';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  Panel,
  Button,
  Badge,
  Switch,
  Checkbox,
  CpuIcon,
  PlugIcon,
  ShieldIcon,
  KeyIcon,
  DatabaseIcon,
  SunIcon,
  AlertCircleIcon,
  CheckIcon,
  TrashIcon,
  DownloadIcon,
  LockIcon,
} from '@vaeloom/ui-kit';
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

type SettingsTab = 'autonomy' | 'connectors' | 'consent' | 'byok' | 'privacy' | 'appearance';

const CATEGORIES: Array<{
  id: SettingsTab;
  label: string;
  icon: React.FC<{ size?: number | string; className?: string }>;
}> = [
  { id: 'autonomy', label: 'Agent Autonomy', icon: CpuIcon },
  { id: 'connectors', label: 'Connectors & Permissions', icon: PlugIcon },
  { id: 'consent', label: 'Consent Scopes', icon: ShieldIcon },
  { id: 'byok', label: 'API Keys (BYOK)', icon: KeyIcon },
  { id: 'privacy', label: 'Data & Privacy', icon: DatabaseIcon },
  { id: 'appearance', label: 'Appearance', icon: SunIcon },
];

export default function SettingsPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('autonomy');

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

  const agents = useMemo(() => agentsRes?.data ?? [], [agentsRes?.data]);
  const integrations = useMemo(() => integrationsRes?.data ?? [], [integrationsRes?.data]);

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  useEffect(() => {
    if (integrations.length === 0) return;
    const perms: Record<string, { read: boolean; write: boolean }> = {};
    for (const integration of integrations) {
      const id = integration['id'];
      const config = (integration as Record<string, unknown>)['config'] as
        Record<string, unknown> | undefined;
      const permissions = config?.['permissions'] as Record<string, unknown> | undefined;
      perms[id] = {
        read: (permissions?.['read'] as boolean) ?? true,
        write: (permissions?.['write'] as boolean) ?? true,
      };
    }
    setConnectorPerms(perms);
  }, [integrations]);

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
        method: 'PUT',
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
    setSaveError(null);
    try {
      const data = await gdprApi.export();
      const payload = {
        workspaceId,
        exportedAt: data.exported_at,
        totalRecords: data.total_records,
        data: data.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaeloom-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to export data');
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
      const result = await gdprApi.delete();
      const tables = Object.entries(result.tables ?? {})
        .filter(([, count]) => (count as number) > 0)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');
      setDeleteReceipt(
        `Erasure completed. Your account has been anonymized and your data removed (${tables || 'nothing to remove'}). Backups expire within 30 days; nothing is kept longer unless legally required.`,
      );
      setDeleteConfirmText('');
      setIsDeleteModalOpen(false);
      clearToken();
      clearRefreshToken();
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete workspace data');
    } finally {
      setDeleting(false);
    }
  };

  const toggleConnectorPerm = async (id: string, perm: 'read' | 'write') => {
    const current = connectorPerms[id] ?? { read: true, write: true };
    const next = { ...current, [perm]: !current[perm] };
    setConnectorPerms((prev) => ({ ...prev, [id]: next }));
    setSaveError(null);
    try {
      await api.request(`/integrations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ config: { permissions: next } }),
      });
      await mutateIntegrations();
    } catch (err) {
      setConnectorPerms((prev) => ({ ...prev, [id]: current }));
      setSaveError(err instanceof Error ? err.message : 'Failed to update permission — reverted');
    }
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
      <div className="flex flex-col h-full max-w-6xl mx-auto py-6 px-4">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text mb-2">Settings</h1>
          <p className="text-sm text-text-muted">
            Manage workspace preferences and security policies.
          </p>
        </header>
        <ErrorState
          title="Failed to load workspace settings"
          message={agentsError.message || 'An unexpected error occurred.'}
          onRetry={() => mutateAgents()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Page Header */}
      <header className="border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-medium text-text">
              Workspace Settings
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Configure agent governance, connected integrations, BYOK credentials, and data
              privacy.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="default" size="sm">
              <LockIcon size={12} className="mr-1 text-primary" />
              Zero-Trust Enforced
            </Badge>
          </div>
        </div>
      </header>

      {/* Global Save Error Banner */}
      {saveError && (
        <div
          className="p-3.5 text-sm text-error bg-error/10 rounded-xl border border-error/30 flex items-center gap-2"
          role="alert"
        >
          <AlertCircleIcon size={16} className="shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 lg:gap-8 items-start">
        {/* Left: Navigation Categories */}
        <aside className="w-full">
          <nav
            className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none"
            aria-label="Settings categories"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left whitespace-nowrap shrink-0 md:shrink ${
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} className={isActive ? 'text-primary' : 'text-text-dim'} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right: Category Panels */}
        <main className="w-full min-w-0 space-y-6">
          {/* TAB 1: Agent Autonomy */}
          {activeTab === 'autonomy' && (
            <Panel
              padding="lg"
              header={
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text">Agent Autonomy Levels</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Control how independently each agent is authorized to act on your behalf.
                    </p>
                  </div>
                  <Badge variant="info" size="sm">
                    {agents.length} Agents
                  </Badge>
                </div>
              }
            >
              {agentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-surface border border-border"
                    />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No agents registered in this workspace.
                </p>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="p-3.5 rounded-lg border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-surface-hover text-text">
                          <CpuIcon size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-text">{agent.name}</h3>
                          <p className="text-xs text-text-dim">
                            Role:{' '}
                            {(agent as unknown as { role?: string }).role || 'Autonomous Worker'}
                          </p>
                        </div>
                        {savingId === agent.id && (
                          <span className="text-xs text-text-muted font-mono animate-pulse">
                            saving...
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Autonomy level for ${agent.name}`}
                        className="bg-background border border-border text-text rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary self-start sm:self-center"
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
            </Panel>
          )}

          {/* TAB 2: Connectors & Permissions */}
          {activeTab === 'connectors' && (
            <Panel
              padding="lg"
              header={
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text">Connector Permissions</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Granular read/write permissions for connected integrations and data streams.
                    </p>
                  </div>
                  <Badge variant="default" size="sm">
                    {integrations.length} Connected
                  </Badge>
                </div>
              }
            >
              {integrationsError ? (
                <div className="p-4 rounded-lg bg-error/10 border border-error/30 text-error text-sm flex items-center justify-between">
                  <span>Failed to load integrations.</span>
                  <Button variant="secondary" size="sm" onClick={() => mutateIntegrations()}>
                    Retry
                  </Button>
                </div>
              ) : integrations.length === 0 ? (
                <p className="text-sm text-text-muted py-6 text-center">
                  No integrations connected yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {integrations.map((integration) => {
                    const id = integration['id'];
                    const name = integration['name'] || integration['provider'] || id;
                    return (
                      <div
                        key={id}
                        className="p-3.5 rounded-lg border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-surface-hover text-text">
                            <PlugIcon size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-text">{name}</h3>
                            {integration['accountEmail'] && (
                              <p className="text-xs text-text-muted font-mono mt-0.5">
                                {integration['accountEmail']}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-5 self-start sm:self-center">
                          <Checkbox
                            label="Read"
                            checked={getConnectorPerm(id, 'read')}
                            onChange={() => toggleConnectorPerm(id, 'read')}
                          />
                          <Checkbox
                            label="Write"
                            checked={getConnectorPerm(id, 'write')}
                            onChange={() => toggleConnectorPerm(id, 'write')}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {/* TAB 3: Consent Scopes */}
          {activeTab === 'consent' && (
            <Panel
              padding="lg"
              header={
                <div>
                  <h2 className="text-base font-semibold text-text">
                    Consent Scopes & Legal Authorization
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Consent version: <span className="font-mono text-text">v1</span> — Granted at
                    signup, revocable anytime.
                  </p>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-text">
                      Gmail — Read & Watch (Draft Only)
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Monitors incoming job responses and deadline notifications. Vaeloom will never
                      send email without your manual approval.
                    </p>
                  </div>
                  <Switch
                    checked={consentState['data_processing'] ?? true}
                    disabled={consentLoading}
                    onChange={(checked) => handleConsentToggle('data_processing', checked)}
                  />
                </div>

                <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-text">
                      Resume & Career Data Processing
                    </h3>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Store resumes, applications, and semantic ATS scores for autonomous search and
                      matching.
                    </p>
                  </div>
                  <Switch
                    checked={consentState['agent_access'] ?? true}
                    disabled={consentLoading}
                    onChange={(checked) => handleConsentToggle('agent_access', checked)}
                  />
                </div>

                <div className="p-4 rounded-xl border border-border bg-surface/60 opacity-60 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-text">Autonomous Outbound Email</h3>
                      <Badge variant="default" size="sm">
                        Gated
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Disabled by default. Only accessible following legal compliance review and
                      verified workspace approval.
                    </p>
                  </div>
                  <Switch checked={false} disabled onChange={() => {}} />
                </div>
              </div>
            </Panel>
          )}

          {/* TAB 4: API Keys (BYOK) */}
          {activeTab === 'byok' && <ProviderKeysSection workspaceId={workspaceId} />}

          {/* TAB 5: Data & Privacy (GDPR) */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <Panel
                padding="lg"
                header={
                  <div>
                    <h2 className="text-base font-semibold text-text">
                      Data Ownership & GDPR Compliance
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Export your complete workspace data or execute permanent zero-trace deletion.
                    </p>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export Box */}
                  <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-text font-medium text-sm">
                        <DownloadIcon size={16} className="text-primary" />
                        <span>Export Workspace Data</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                        Download a machine-readable JSON archive containing all resumes, agent
                        configurations, memory nodes, and telemetry.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExport}
                      loading={exporting}
                    >
                      Download Archive (.json)
                    </Button>
                  </div>

                  {/* Erasure Box */}
                  <div className="p-4 rounded-xl border border-error/30 bg-error/5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-error font-medium text-sm">
                        <TrashIcon size={16} />
                        <span>Permanent Workspace Erasure</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                        Irreversibly anonymize and purge all workspace data from live databases.
                        Backups expire automatically within 30 days.
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
                      Delete Workspace Data
                    </Button>
                  </div>
                </div>

                {deleteReceipt && (
                  <div
                    className="mt-4 p-3 text-xs text-success bg-success/10 border border-success/30 rounded-lg flex items-start gap-2"
                    role="status"
                  >
                    <CheckIcon size={14} className="shrink-0 mt-0.5" />
                    <span>{deleteReceipt}</span>
                  </div>
                )}
              </Panel>

              {/* Explicit Erasure Confirmation Dialog */}
              <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteData}
                title="Permanent Data Erasure"
                message="This action is completely irreversible. Type DELETE below to confirm permanent destruction of all workspace records and agent memories."
                confirmLabel="Confirm Permanent Erasure"
                variant="danger"
                loading={deleting}
              />
            </div>
          )}

          {/* TAB 6: Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <ThemePreferences />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
