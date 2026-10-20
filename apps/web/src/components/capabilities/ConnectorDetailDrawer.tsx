'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge, Button, Spinner, StatusDot, Tooltip, useFocusTrap } from '@vaeloom/ui-kit';
import {
  connectorsApi,
  type ConnectorHealthResponse,
  type ConnectorUsageResponse,
  type McpToolInfo,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export interface CatalogRowData {
  id: string;
  name: string;
  provider: string;
  protocol: string;
  category: string;
  description: string;
  scopes: string[];
  assignedAgents: string[];
  composioApp?: string | null;
  actionCount?: number | null;
  icon?: React.ReactNode;
}

export interface ConnectorDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row: CatalogRowData | null;
  connected: boolean;
  connectorId?: string | null;
  workspaceId: string;
  onConnect: () => void;
  onDisconnect: () => void;
  connectBusy?: boolean;
  onRefresh?: () => void;
}

export const ConnectorDetailDrawer: React.FC<ConnectorDetailDrawerProps> = ({
  isOpen,
  onClose,
  row,
  connected,
  connectorId,
  workspaceId,
  onConnect,
  onDisconnect,
  connectBusy = false,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'security' | 'activity'>(
    'overview',
  );
  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [syncingTools, setSyncingTools] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ConnectorHealthResponse | null>(null);
  const [testingHealth, setTestingHealth] = useState(false);
  const [usage, setUsage] = useState<ConnectorUsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const TABS = [
    { id: 'overview', label: 'Overview & Permissions' },
    { id: 'tools', label: 'Tools & Schemas' },
    { id: 'security', label: 'Zero-Trust & Health' },
    { id: 'activity', label: 'Activity' },
  ] as const;

  // Arrow keys move between tabs. This row is visually a tab bar but was four
  // bare buttons, so Tab visited each one and arrows did nothing.
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const index = TABS.findIndex((t) => t.id === activeTab);
    const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
    if (!next) return;
    setActiveTab(next.id);
    document.getElementById(`connector-tab-${next.id}`)?.focus();
  };

  // Escape plus Tab containment. This declared aria-modal="true" while trapping
  // nothing, so Tab walked out into the page behind the drawer.
  const drawerRef = useFocusTrap(isOpen, onClose);

  // Load tools when tools tab is activated or row changes
  const loadTools = useCallback(async () => {
    if (!connectorId || !workspaceId) return;
    setLoadingTools(true);
    try {
      const res = await connectorsApi.mcp.listTools(connectorId);
      const list = Array.isArray(res) ? res : [];
      setTools(list);
    } catch {
      setTools([]);
    } finally {
      setLoadingTools(false);
    }
  }, [connectorId, workspaceId]);

  useEffect(() => {
    if (isOpen && activeTab === 'tools' && connectorId) {
      void loadTools();
    }
  }, [isOpen, activeTab, connectorId, loadTools]);

  // Lifecycle activity, aggregated server-side from audit_events.
  //
  // `connectorsApi.usage` has existed since the client method landed but had
  // no caller, so nothing in the product ever displayed it. The error is kept
  // separate from the data on purpose: a failed read must not render as
  // "0 events", which would read as a connector that has never been used.
  const loadUsage = useCallback(async () => {
    if (!connectorId) return;
    setLoadingUsage(true);
    setUsageError(null);
    try {
      setUsage(await connectorsApi.usage(connectorId));
    } catch (err) {
      setUsage(null);
      setUsageError(
        err instanceof Error && err.message
          ? err.message
          : 'The activity summary could not be read.',
      );
    } finally {
      setLoadingUsage(false);
    }
  }, [connectorId]);

  useEffect(() => {
    if (isOpen && activeTab === 'activity' && connectorId) {
      void loadUsage();
    }
  }, [isOpen, activeTab, connectorId, loadUsage]);

  const handleRollback = async () => {
    if (!connectorId || !usage) return;
    // `rollback_config` resolves `version` against config_history and 404s when
    // the snapshot is absent, so the target is the version immediately before
    // the current one. If no such snapshot exists the 404 surfaces below rather
    // than silently restoring the wrong config.
    const targetVersion = usage.config_version - 1;
    const confirmed = window.confirm(
      `Restore ${usage.name} to config version ${targetVersion}? ` +
        'The stored config and credentials are replaced by that snapshot.',
    );
    if (!confirmed) return;
    setRollingBack(true);
    try {
      await connectorsApi.rollback(connectorId, targetVersion);
      toast({
        tone: 'success',
        title: `${usage.name} restored to version ${targetVersion}`,
        detail: 'Config replaced from snapshot history.',
      });
      await loadUsage();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Rollback failed',
        detail: err instanceof Error && err.message ? err.message : 'Nothing was changed.',
      });
    } finally {
      setRollingBack(false);
    }
  };

  const handleTestHealth = async () => {
    if (!connectorId) return;
    setTestingHealth(true);
    try {
      const res = await connectorsApi.health(connectorId);
      setHealthStatus(res);
      const latency = (res as any).latency_ms ?? (res as any).latencyMs ?? 0;
      toast({
        tone: res.status === 'healthy' ? 'success' : 'warning',
        title: `Health Check: ${res.status.toUpperCase()}`,
        detail: `Probe completed in ${latency}ms.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Health Check Failed',
        detail: err instanceof Error ? err.message : 'Probe request timed out.',
      });
    } finally {
      setTestingHealth(false);
    }
  };

  const handleSyncTools = async () => {
    if (!connectorId || !workspaceId) return;
    setSyncingTools(true);
    try {
      const res = await connectorsApi.mcp.sync(connectorId, workspaceId);
      const registered = res?.registered?.length ?? 0;
      toast({
        tone: 'success',
        title: 'Tools Synchronized',
        detail: `Successfully refreshed ${registered} dynamic tools in agent runtime.`,
      });
      await loadTools();
      if (onRefresh) onRefresh();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: err instanceof Error ? err.message : 'Failed to synchronize tools.',
      });
    } finally {
      setSyncingTools(false);
    }
  };

  if (!isOpen || !row) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-label={`Connector details: ${row.name}`}
        aria-modal="true"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 max-w-full flex pl-10"
      >
        <div className="w-screen max-w-xl bg-surface border-l border-border shadow-2xl flex flex-col focus:outline-none">
          {/* Header */}
          <div className="p-5 border-b border-border bg-surface shrink-0 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center p-2.5 shrink-0 shadow-xs">
                {row.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-text truncate">{row.name}</h2>
                  <Badge variant="mono" size="sm">
                    {row.protocol}
                  </Badge>
                  {connected ? (
                    <Badge variant="success" size="sm" className="flex items-center gap-1">
                      <StatusDot status="active" size="sm" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      Available
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1 font-mono truncate">
                  Category: {row.category || 'All Purposes'} &middot; Provider: {row.provider}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {workspaceId && (connectorId || row.id || row.provider) && (
                <Link
                  href={`/workspace/${workspaceId}/capabilities/connectors/${encodeURIComponent(connectorId || row.id || row.provider)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-text font-medium text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <span>Open Full Page ↗</span>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close drawer">
                Close
              </Button>
            </div>
          </div>

          {/* Subtabs Bar */}
          {/*
            No aria-controls on the tabs. Only the active panel is mounted, so a
            reference from an inactive tab would point at an id that does not
            exist -- and a dangling reference is worse than none, because
            assistive tech follows it and lands nowhere. The active panel still
            carries aria-labelledby back to its tab, which is the direction that
            matters for announcing content.
          */}
          <div
            role="tablist"
            aria-label="Connector detail sections"
            onKeyDown={handleTabKeyDown}
            className="flex border-b border-border bg-surface px-5 gap-1 shrink-0"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`connector-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-all rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text'
                }`}
              >
                {tab.id === 'tools' && tools.length > 0
                  ? `Tools & Schemas (${tools.length})`
                  : tab.label}
              </button>
            ))}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain p-5 space-y-5">
            {activeTab === 'overview' && (
              <div
                role="tabpanel"
                id="connector-panel-overview"
                aria-labelledby="connector-tab-overview"
                className="space-y-5"
              >
                {/* Description */}
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    Description &amp; Purpose
                  </span>
                  <p className="text-xs text-text leading-relaxed bg-surface-elevated/40 p-3.5 rounded-xl border border-border">
                    {row.description || 'No description provided by the integration provider.'}
                  </p>
                </div>

                {/* Scopes & Permissions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                      Permissions
                    </span>
                    <span className="text-2xs font-mono text-text-muted">
                      {row.scopes.length} declared
                    </span>
                  </div>
                  {row.scopes.length > 0 ? (
                    <>
                      <p className="text-2xs text-text-muted">
                        Notes shipped with this build&apos;s catalog. They are not read from the
                        provider, and they are not what an OAuth consent screen will display.
                      </p>
                      <ul className="space-y-1.5 bg-surface-elevated/40 p-3 rounded-xl border border-border">
                        {row.scopes.map((scope) => (
                          <li
                            key={scope}
                            className="flex items-center gap-2 text-2xs font-mono text-text-secondary"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            <span className="truncate">{scope}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-2xs text-text-muted bg-surface-elevated/40 p-3 rounded-xl border border-border">
                      This connector declares no scope list. The provider will ask for what its own
                      app registration requires.
                    </p>
                  )}
                </div>

                {/* Swarm Agent Assignments */}
                <div className="space-y-2">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    Agent Swarm Access
                  </span>
                  {row.assignedAgents.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {row.assignedAgents.map((agent) => (
                        <Badge key={agent} variant="primary" size="sm">
                          ⚡ {agent}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-2xs text-text-muted bg-surface-elevated/40 p-3 rounded-xl border border-border">
                      No agent assignment is declared for this connector. Available to general
                      orchestrator loop and custom ReAct pipelines.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div
                role="tabpanel"
                id="connector-panel-tools"
                aria-labelledby="connector-tab-tools"
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-text">Registered Tool Signatures</h3>
                    <p className="text-2xs text-text-muted">
                      Functions exposed to AI agent planning and tool calling loops.
                    </p>
                  </div>
                  {connected && connectorId && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={syncingTools}
                      onClick={handleSyncTools}
                      className="text-xs"
                    >
                      Sync Tools
                    </Button>
                  )}
                </div>

                {loadingTools ? (
                  <div className="flex items-center justify-center p-8">
                    <Spinner size="md" />
                  </div>
                ) : tools.length > 0 ? (
                  <ul className="space-y-3">
                    {tools.map((tool) => (
                      <li
                        key={tool.name}
                        className="rounded-xl border border-border bg-surface-elevated/40 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-text">
                            {tool.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {Boolean(
                              (tool as any).approval_gated || (tool as any).approvalGated,
                            ) && (
                              <Badge variant="warning" size="sm">
                                🔒 HITL Approval Gated
                              </Badge>
                            )}
                            <Badge variant="mono" size="sm">
                              read-only
                            </Badge>
                          </div>
                        </div>
                        {tool.description && (
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {tool.description}
                          </p>
                        )}
                        {Boolean((tool as any).input_schema || (tool as any).inputSchema) && (
                          <div className="mt-2 pt-2 border-t border-border/60">
                            <span className="text-2xs font-mono text-text-muted block mb-1">
                              Parameters Schema:
                            </span>
                            <pre className="p-2 rounded bg-background border border-border/40 font-mono text-2xs text-text-muted overflow-x-auto max-h-36">
                              {JSON.stringify(
                                (tool as any).input_schema || (tool as any).inputSchema,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center border border-dashed border-border rounded-xl bg-surface-elevated/20">
                    <p className="text-xs text-text-muted">
                      {connected
                        ? 'No tools reported yet. Click "Sync Tools" to bridge available capabilities.'
                        : 'Connect this integration to reflect its tools into the agent runtime.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div
                role="tabpanel"
                id="connector-panel-activity"
                aria-labelledby="connector-tab-activity"
                className="space-y-4"
              >
                {loadingUsage && !usage && (
                  <p className="text-xs text-text-secondary" role="status">
                    Reading lifecycle activity...
                  </p>
                )}

                {usageError && (
                  <div role="alert" className="rounded-xl border border-error/30 bg-error/5 p-4">
                    <p className="text-xs font-semibold text-error">Activity could not be read</p>
                    <p className="text-xs text-text-secondary mt-1">{usageError}</p>
                    <button
                      type="button"
                      onClick={() => void loadUsage()}
                      className="mt-2 text-xs text-primary underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loadingUsage && !usageError && usage && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-surface p-3">
                        <p className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                          Total events
                        </p>
                        <p className="text-lg font-semibold text-text">{usage.total_events}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-3">
                        <p className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                          Config version
                        </p>
                        <p className="text-lg font-semibold text-text">{usage.config_version}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-3">
                        <p className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                          Last activity
                        </p>
                        <p className="text-xs text-text mt-1">
                          {usage.last_activity_at
                            ? new Date(usage.last_activity_at).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface p-3">
                        <p className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                          Last synced
                        </p>
                        <p className="text-xs text-text mt-1">
                          {usage.last_synced_at
                            ? new Date(usage.last_synced_at).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                      <h3 className="text-xs font-semibold text-text">Events by action</h3>
                      {usage.total_events === 0 ? (
                        <p className="text-xs text-text-secondary">
                          No lifecycle events recorded for this connector yet.
                        </p>
                      ) : (
                        <dl className="space-y-1.5">
                          {Object.entries(usage.events_by_action)
                            .sort((a, b) => b[1] - a[1])
                            .map(([action, count]) => (
                              <div key={action} className="flex items-center justify-between gap-3">
                                <dt className="text-xs font-mono text-text-secondary">{action}</dt>
                                <dd className="text-xs font-mono text-text">{count}</dd>
                              </div>
                            ))}
                        </dl>
                      )}
                    </div>

                    {/* Rollback stays hidden at version 1: there is no earlier
                        config to restore, so offering it invites a pointless
                        round trip. */}
                    {usage.config_version > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleRollback()}
                        disabled={rollingBack}
                        className="text-xs text-error underline underline-offset-2 disabled:opacity-60"
                      >
                        {rollingBack ? 'Rolling back...' : 'Roll back to previous config version'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div
                role="tabpanel"
                id="connector-panel-security"
                aria-labelledby="connector-tab-security"
                className="space-y-4"
              >
                {/* Security Guarantees */}
                <div className="rounded-xl border border-border bg-surface-elevated/40 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-text flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    Zero-Trust Security Posture
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 text-2xs">
                    <div className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <div>
                        <span className="font-semibold text-text">SSRF Protected:</span>
                        <p className="text-text-secondary">
                          All outbound HTTP calls are validated against RFC-1918 private subnets and
                          cloud metadata endpoints.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <div>
                        <span className="font-semibold text-text">Credential Encryption:</span>
                        <p className="text-text-secondary">
                          API keys, bearer tokens, and OAuth secrets are encrypted at rest with
                          AES-256-GCM.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <div>
                        <span className="font-semibold text-text">Webhook HMAC Verification:</span>
                        <p className="text-text-secondary">
                          Inbound webhooks require valid SHA-256 signatures; unauthenticated
                          requests are denied.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-success">✓</span>
                      <div>
                        <span className="font-semibold text-text">Argv Tokenization:</span>
                        <p className="text-text-secondary">
                          Stdio MCP arguments are strictly sanitized to prevent shell metacharacter
                          injection.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health Check Probe */}
                {connected && connectorId && (
                  <div className="rounded-xl border border-border bg-surface-elevated/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-text">Live Connection Health</h4>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={testingHealth}
                        onClick={handleTestHealth}
                        className="text-xs"
                      >
                        Ping Server
                      </Button>
                    </div>

                    {healthStatus ? (
                      <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5 text-2xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Status:</span>
                          <span
                            className={
                              healthStatus.status === 'healthy' ? 'text-success' : 'text-warning'
                            }
                          >
                            {healthStatus.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Latency:</span>
                          <span className="text-text">
                            {(healthStatus as any).latency_ms ??
                              (healthStatus as any).latencyMs ??
                              0}
                            ms
                          </span>
                        </div>
                        {(healthStatus as any).version && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">Version:</span>
                            <span className="text-text">{(healthStatus as any).version}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-2xs text-text-muted">
                        Click &quot;Ping Server&quot; to verify socket reachability and calculate
                        response round-trip time.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Actions Footer */}
          <div className="p-4 border-t border-border bg-surface shrink-0 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Done
            </Button>
            <div className="flex items-center gap-2">
              {connected ? (
                <Button variant="danger" size="sm" onClick={onDisconnect}>
                  Disconnect
                </Button>
              ) : row.provider === 'native' ? (
                <Tooltip content="Native components execute in the Vaeloom engine without external authentication.">
                  <Button variant="outline" size="sm" disabled>
                    Built-in
                  </Button>
                </Tooltip>
              ) : (
                <Button variant="primary" size="sm" loading={connectBusy} onClick={onConnect}>
                  Connect Integration
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
