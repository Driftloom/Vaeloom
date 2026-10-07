'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Spinner, StatusDot, Tooltip } from '@vaeloom/ui-kit';
import { connectorsApi, type ConnectorHealthResponse, type McpToolInfo } from '@/lib/api-client';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'security'>('overview');
  const [tools, setTools] = useState<McpToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [syncingTools, setSyncingTools] = useState(false);
  const [healthStatus, setHealthStatus] = useState<ConnectorHealthResponse | null>(null);
  const [testingHealth, setTestingHealth] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load tools when tools tab is activated or row changes
  const loadTools = useCallback(async () => {
    if (!connectorId || !workspaceId) return;
    setLoadingTools(true);
    try {
      const res = await connectorsApi.mcp.tools(connectorId, workspaceId);
      const list = Array.isArray(res?.tools) ? res.tools : [];
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

  const handleTestHealth = async () => {
    if (!connectorId) return;
    setTestingHealth(true);
    try {
      const res = await connectorsApi.health(connectorId);
      setHealthStatus(res);
      toast({
        tone: res.status === 'healthy' ? 'success' : 'warning',
        title: `Health Check: ${res.status.toUpperCase()}`,
        detail: `Probe completed in ${res.latency_ms ?? 0}ms.`,
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
        role="dialog"
        aria-label={`Connector details: ${row.name}`}
        aria-modal="true"
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
                      <StatusDot status="active" size="xs" />
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
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close drawer">
              Close
            </Button>
          </div>

          {/* Subtabs Bar */}
          <div className="flex border-b border-border bg-surface px-5 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              Overview &amp; Permissions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tools')}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'tools'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              Tools &amp; Schemas {tools.length > 0 ? `(${tools.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'security'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              Zero-Trust &amp; Health
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain p-5 space-y-5">
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Description */}
                <div className="space-y-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                    Description &amp; Purpose
                  </span>
                  <p className="text-xs text-text leading-relaxed bg-surface-elevated/40 p-3.5 rounded-xl border border-border">
                    {row.description || 'No description provided by the integration provider.'}
                  </p>
                </div>

                {/* Permissions & Scopes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-text">Permissions</h4>
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
                      This catalog entry declares no scope list. The provider&apos;s consent screen
                      is the only authority on what will be requested.
                    </p>
                  )}
                </div>

                {/* Swarm Agent Assignments */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-text">Agent assignment</h4>
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
                      No agent assignment is declared for this catalog row. The orchestrator may
                      still route to it if the capability matches a task.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="space-y-4">
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
                            {tool.approval_gated && (
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
                        {tool.input_schema && (
                          <div className="mt-2 pt-2 border-t border-border/60">
                            <span className="text-2xs font-mono text-text-muted block mb-1">
                              Parameters Schema:
                            </span>
                            <pre className="p-2 rounded bg-background border border-border/40 font-mono text-2xs text-text-muted overflow-x-auto max-h-36">
                              {JSON.stringify(tool.input_schema, null, 2)}
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

            {activeTab === 'security' && (
              <div className="space-y-4">
                {/* Security Guarantees */}
                <div className="rounded-xl border border-border bg-surface-elevated/40 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-text flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Zero-Trust Security Posture
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 text-2xs">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <div>
                        <span className="font-semibold text-text">SSRF Protected:</span>
                        <p className="text-text-secondary">
                          All outbound HTTP calls are validated against RFC-1918 private subnets and
                          cloud metadata endpoints.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <div>
                        <span className="font-semibold text-text">Credential Encryption:</span>
                        <p className="text-text-secondary">
                          API keys, bearer tokens, and OAuth secrets are encrypted at rest with
                          AES-256-GCM.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <div>
                        <span className="font-semibold text-text">Webhook HMAC Verification:</span>
                        <p className="text-text-secondary">
                          Inbound webhooks require valid SHA-256 signatures; unauthenticated
                          requests are denied.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
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
                              healthStatus.status === 'healthy'
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {healthStatus.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Latency:</span>
                          <span className="text-text">{healthStatus.latency_ms ?? 0}ms</span>
                        </div>
                        {healthStatus.version && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">Version:</span>
                            <span className="text-text">{healthStatus.version}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-2xs text-text-muted">
                        Click "Ping Server" to verify socket reachability and calculate response
                        round-trip time.
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
