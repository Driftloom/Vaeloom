'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface BuiltinServer {
  id: string;
  name: string;
  description: string;
  transport: string;
  tools: string[];
  config: any;
}

interface ComposioApp {
  id: string;
  name: string;
  description: string;
}

export default function DynamicConnectorsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = (params?.['workspaceId'] as string) || '';

  const [activeTab, setActiveTab] = useState<'mcp' | 'composio' | 'trigger'>('mcp');
  const [loading, setLoading] = useState<boolean>(true);
  const [composioEnabled, setComposioEnabled] = useState<boolean>(false);
  const [composioApps, setComposioApps] = useState<ComposioApp[]>([]);
  const [builtinServers, setBuiltinServers] = useState<BuiltinServer[]>([]);
  const [connectedConnectors, setConnectedConnectors] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form states for adding custom MCP
  const [customName, setCustomName] = useState('');
  const [customTransport, setCustomTransport] = useState<'stdio' | 'http'>('stdio');
  const [customCommand, setCustomCommand] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch connectors for this workspace
        const connRes = await api.get<any[]>(`/connectors?workspace_id=${workspaceId}`);
        setConnectedConnectors(Array.isArray(connRes) ? connRes : []);

        // Fetch Composio status
        try {
          const compRes = await api.get<{ enabled: boolean; popular_apps: ComposioApp[] }>(
            '/connectors/composio/status',
          );
          setComposioEnabled(Boolean(compRes?.enabled));
          setComposioApps(compRes?.popular_apps || []);
        } catch {
          setComposioEnabled(false);
        }

        // Fetch builtin MCP servers
        try {
          const mcpRes = await api.get<{ builtin_servers: BuiltinServer[] }>(
            '/connectors/mcp/builtin',
          );
          setBuiltinServers(mcpRes?.builtin_servers || []);
        } catch {
          setBuiltinServers([]);
        }
      } catch (err) {
        console.error('Failed to load dynamic connector data:', err);
      } finally {
        setLoading(false);
      }
    }
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  const handleAttachBuiltin = async (srv: BuiltinServer) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const created = await api.post<any>('/connectors', {
        name: srv.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: srv.config,
      });

      // Automatically sync bridge
      await api.post(`/connectors/${created.id}/mcp/sync`, {
        workspace_id: workspaceId,
      });

      setStatusMessage(`Successfully attached and synced ${srv.name}!`);
      // Refresh list
      const refreshed = await api.get<any[]>(`/connectors?workspace_id=${workspaceId}`);
      setConnectedConnectors(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      setStatusMessage(`Error attaching ${srv.name}: ${err.message || 'Failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName) return;
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const config: any = { transport: customTransport };
      if (customTransport === 'stdio') {
        const parts = customCommand.trim().split(' ');
        config.command = parts[0];
        config.args = parts.slice(1);
      } else {
        config.url = customUrl;
        config.allow_insecure = customUrl.startsWith('http://');
      }

      const created = await api.post<any>('/connectors', {
        name: customName,
        type: 'mcp',
        workspace_id: workspaceId,
        config,
      });

      await api.post(`/connectors/${created.id}/mcp/sync`, {
        workspace_id: workspaceId,
      });

      setStatusMessage(`Custom MCP "${customName}" added and synced!`);
      setCustomName('');
      setCustomCommand('');
      setCustomUrl('');

      const refreshed = await api.get<any[]>(`/connectors?workspace_id=${workspaceId}`);
      setConnectedConnectors(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      setStatusMessage(`Error adding custom MCP: ${err.message || 'Failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectComposio = async (appId: string) => {
    setStatusMessage(null);
    try {
      const res = await api.post<{ redirect_url?: string; message?: string }>(
        '/connectors/composio/auth-url',
        {
          app: appId,
          workspace_id: workspaceId,
        },
      );

      if (res?.redirect_url) {
        window.open(res.redirect_url, '_blank');
      } else {
        setStatusMessage(res?.message || 'Please configure COMPOSIO_API_KEY in .env first.');
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to initiate Composio authorization.');
    }
  };

  const handleSyncComposio = async () => {
    setStatusMessage(null);
    try {
      const res = await api.post<{ registered: string[]; count: number }>(
        '/connectors/composio/sync',
        {
          workspace_id: workspaceId,
        },
      );
      setStatusMessage(`Synced ${res?.count || 0} tools from Composio!`);
    } catch (err: any) {
      setStatusMessage(
        err.message || 'Composio sync failed. Make sure COMPOSIO_API_KEY is active.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href={`/workspace/${workspaceId}/connectors`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Back to Connectors
              </Link>
              <span className="text-2xs px-2 py-0.5 rounded bg-primary/15 text-primary font-mono border border-primary/30">
                Extensibility Hub
              </span>
            </div>
            <h1 className="text-3xl font-display font-medium mt-2 text-text">
              Dynamic Connectors & Agent Tools
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Connect Open Model Context Protocol (MCP) servers, Composio 250+ SaaS tools, and
              trigger durable background tasks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono text-success">Agent Router Online</span>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary flex justify-between items-center">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs text-text-muted hover:text-text"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-4 mt-6 border-b border-border pb-1">
          <button
            onClick={() => setActiveTab('mcp')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mcp'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            🔌 Model Context Protocol (MCP)
          </button>
          <button
            onClick={() => setActiveTab('composio')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'composio'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            ⚡ Composio SaaS Gateway (250+ Apps)
          </button>
          <button
            onClick={() => setActiveTab('trigger')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trigger'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            ⏳ Trigger.dev Background Jobs
          </button>
        </div>

        {/* TAB 1: MCP SERVERS */}
        {activeTab === 'mcp' && (
          <div className="mt-6 space-y-6">
            {/* Built-in MCP Servers */}
            <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-lg font-display font-medium text-text flex items-center gap-2">
                <span>📦 Built-in Curated MCP Servers</span>
                <span className="text-2xs px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 font-mono">
                  Zero Config
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-1">
                One-click attach official Vaeloom MCP tools right to your agent loop.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {builtinServers.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-lg bg-surface-100 border border-border flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text">{srv.name}</span>
                        <span className="text-2xs uppercase font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                          {srv.transport}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-2">{srv.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {srv.tools.map((t) => (
                          <span
                            key={t}
                            className="text-2xs font-mono px-2 py-0.5 rounded bg-surface-200 text-text-secondary"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAttachBuiltin(srv)}
                      disabled={isSubmitting}
                      className="btn-primary mt-4 w-full text-xs"
                    >
                      {isSubmitting ? 'Attaching…' : 'Attach to Workspace'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom MCP Server Form */}
            <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-lg font-display font-medium text-text">Add Custom MCP Server</h2>
              <p className="text-xs text-text-muted mt-1">
                Connect any stdio subprocess (Node/Python) or remote streamable HTTP / SSE MCP
                server.
              </p>

              <form onSubmit={handleAddCustomMcp} className="mt-4 space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-text-muted">Server Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Postgres DB Explorer or Browser Agent"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="input-field mt-1"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      value="stdio"
                      checked={customTransport === 'stdio'}
                      onChange={() => setCustomTransport('stdio')}
                      className="text-primary focus:ring-accent"
                    />
                    stdio (Local process / CLI)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      value="http"
                      checked={customTransport === 'http'}
                      onChange={() => setCustomTransport('http')}
                      className="text-primary focus:ring-accent"
                    />
                    streamable HTTP / SSE
                  </label>
                </div>

                {customTransport === 'stdio' ? (
                  <div>
                    <label className="block text-xs font-medium text-text-muted">
                      Command & Arguments
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="npx -y @modelcontextprotocol/server-postgres postgresql://..."
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="input-field mt-1 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-text-muted">
                      Endpoint URL
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://mcp.example.com/sse"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="input-field mt-1 font-mono"
                    />
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className="btn-primary text-xs">
                  {isSubmitting ? 'Registering...' : 'Register & Sync MCP'}
                </button>
              </form>
            </div>

            {/* Attached MCP Connectors */}
            <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Connected Workspace Connectors ({connectedConnectors.length})
              </h3>
              {connectedConnectors.length === 0 ? (
                <p className="text-xs text-text-muted mt-3">No active connectors attached yet.</p>
              ) : (
                <div className="mt-3 divide-y divide-border">
                  {connectedConnectors.map((c) => (
                    <div key={c.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-text">{c.name}</span>
                        <span className="ml-2 text-xs font-mono text-text-muted">({c.type})</span>
                        <div className="text-xs text-text-muted mt-0.5">
                          ID: <span className="font-mono">{c.id}</span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/connectors/${c.id}/mcp/sync`, {
                              workspace_id: workspaceId,
                            });
                            setStatusMessage(`Re-synced tools for ${c.name}!`);
                          } catch (err: any) {
                            setStatusMessage(`Sync failed: ${err.message}`);
                          }
                        }}
                        className="btn-secondary text-xs px-2.5 py-1 font-mono"
                      >
                        Re-sync Tools
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: COMPOSIO SAAS GATEWAY */}
        {activeTab === 'composio' && (
          <div className="mt-6 space-y-6">
            <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-medium text-text">
                    Composio Universal SaaS Gateway
                  </h2>
                  <p className="text-xs text-text-muted mt-1">
                    Connect Slack, Notion, GitHub, LinkedIn, Jira, and 250+ SaaS tools without
                    writing OAuth plumbing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      composioEnabled ? 'bg-success' : 'bg-warning'
                    }`}
                  />
                  <span className="text-xs font-mono text-text-secondary">
                    {composioEnabled ? 'API Key Active' : 'Key Missing in .env'}
                  </span>
                </div>
              </div>

              {!composioEnabled && (
                <div className="mt-4 p-4 rounded-lg bg-warning/15 border border-warning/30 text-xs text-warning">
                  <p className="font-semibold">Composio Key Setup:</p>
                  <p className="mt-1">
                    Add{' '}
                    <code className="bg-background/40 px-1 py-0.5 rounded font-mono">
                      COMPOSIO_API_KEY=your_key
                    </code>{' '}
                    to your <code className="font-mono">.env</code> file. Grab your free key at{' '}
                    <a
                      href="https://app.composio.dev"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold text-warning"
                    >
                      app.composio.dev
                    </a>{' '}
                    (1,000 free actions/month).
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-text-secondary">Popular Integrations</h3>
                <button onClick={handleSyncComposio} className="btn-primary text-xs">
                  🔄 Sync Connected Tools
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                {composioApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-lg bg-surface-100 border border-border flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text">{app.name}</span>
                        <span className="text-xs text-primary font-mono">OAuth 2.0</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1">{app.description}</p>
                    </div>
                    <button
                      onClick={() => handleConnectComposio(app.id)}
                      className="btn-secondary mt-4 w-full text-xs"
                    >
                      Connect {app.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRIGGER.DEV BACKGROUND JOBS */}
        {activeTab === 'trigger' && (
          <div className="mt-6 space-y-6">
            <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-medium text-text">
                    Trigger.dev (v3) Durable Engine
                  </h2>
                  <p className="text-xs text-text-muted mt-1">
                    Runs your long-running agent tasks, document ingestion, and connector sync with
                    zero timeouts.
                  </p>
                </div>
                <span className="text-2xs px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30 font-mono">
                  Connected: proj_rroqfqpflbsmzbiuiilt
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-surface-100 border border-border">
                  <h4 className="text-sm font-semibold text-text">Registered Background Tasks</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-text-secondary font-mono">
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span> example-task
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span> vaeloom.ingest-document
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span> vaeloom.run-agent
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span> vaeloom.sync-connector
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-surface-100 border border-border flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-text">Cloud Dashboard</h4>
                    <p className="text-xs text-text-muted mt-1">
                      Monitor live task execution traces, view run parameters, and debug outputs in
                      real-time.
                    </p>
                  </div>
                  <a
                    href="https://cloud.trigger.dev/orgs/vaeloom-dbed/projects/vaeloom-agents-0iIn"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary mt-4 inline-flex items-center justify-center text-xs"
                  >
                    Open Trigger.dev Cloud ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
