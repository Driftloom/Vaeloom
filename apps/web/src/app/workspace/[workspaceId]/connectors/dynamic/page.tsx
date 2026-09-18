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
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href={`/workspace/${workspaceId}/connectors`}
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
              >
                ← Back to Connectors
              </Link>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono border border-indigo-700/50">
                Extensibility Hub
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-2 text-white">Dynamic Connectors & Agent Tools</h1>
            <p className="text-sm text-gray-400 mt-1">
              Connect Open Model Context Protocol (MCP) servers, Composio 250+ SaaS tools, and
              trigger durable background tasks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400">Agent Router Online</span>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-4 rounded-lg bg-indigo-950/60 border border-indigo-800/80 text-sm text-indigo-200 flex justify-between items-center">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-4 mt-6 border-b border-gray-800 pb-1">
          <button
            onClick={() => setActiveTab('mcp')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mcp'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🔌 Model Context Protocol (MCP)
          </button>
          <button
            onClick={() => setActiveTab('composio')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'composio'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ Composio SaaS Gateway (250+ Apps)
          </button>
          <button
            onClick={() => setActiveTab('trigger')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trigger'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ⏳ Trigger.dev Background Jobs
          </button>
        </div>

        {/* TAB 1: MCP SERVERS */}
        {activeTab === 'mcp' && (
          <div className="mt-6 space-y-6">
            {/* Built-in MCP Servers */}
            <div className="bg-[#121218] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>📦 Built-in Curated MCP Servers</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  Zero Config
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                One-click attach official Vaeloom MCP tools right to your agent loop.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {builtinServers.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-lg bg-[#181824] border border-gray-700/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{srv.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                          {srv.transport}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{srv.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {srv.tools.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAttachBuiltin(srv)}
                      disabled={isSubmitting}
                      className="mt-4 w-full py-2 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Attaching…' : 'Attach to Workspace'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom MCP Server Form */}
            <div className="bg-[#121218] rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold text-white">Add Custom MCP Server</h2>
              <p className="text-xs text-gray-400 mt-1">
                Connect any stdio subprocess (Node/Python) or remote streamable HTTP / SSE MCP
                server.
              </p>

              <form onSubmit={handleAddCustomMcp} className="mt-4 space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-medium text-gray-300">Server Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Postgres DB Explorer or Browser Agent"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      value="stdio"
                      checked={customTransport === 'stdio'}
                      onChange={() => setCustomTransport('stdio')}
                      className="text-indigo-600"
                    />
                    stdio (Local process / CLI)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="radio"
                      name="transport"
                      value="http"
                      checked={customTransport === 'http'}
                      onChange={() => setCustomTransport('http')}
                      className="text-indigo-600"
                    />
                    streamable HTTP / SSE
                  </label>
                </div>

                {customTransport === 'stdio' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-300">
                      Command & Arguments
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="npx -y @modelcontextprotocol/server-postgres postgresql://..."
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm font-mono bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-300">Endpoint URL</label>
                    <input
                      type="url"
                      required
                      placeholder="https://mcp.example.com/sse"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm font-mono bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2 px-4 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register & Sync MCP'}
                </button>
              </form>
            </div>

            {/* Attached MCP Connectors */}
            <div className="bg-[#121218] rounded-xl p-6 border border-gray-800">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-gray-400">
                Connected Workspace Connectors ({connectedConnectors.length})
              </h3>
              {connectedConnectors.length === 0 ? (
                <p className="text-xs text-gray-500 mt-3">No active connectors attached yet.</p>
              ) : (
                <div className="mt-3 divide-y divide-gray-800">
                  {connectedConnectors.map((c) => (
                    <div key={c.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-white">{c.name}</span>
                        <span className="ml-2 text-xs font-mono text-gray-400">({c.type})</span>
                        <div className="text-xs text-gray-500 mt-0.5">
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
                        className="text-xs py-1 px-2.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono"
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
            <div className="bg-[#121218] rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Composio Universal SaaS Gateway
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect Slack, Notion, GitHub, LinkedIn, Jira, and 250+ SaaS tools without
                    writing OAuth plumbing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      composioEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-mono text-gray-300">
                    {composioEnabled ? 'API Key Active' : 'Key Missing in .env'}
                  </span>
                </div>
              </div>

              {!composioEnabled && (
                <div className="mt-4 p-4 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                  <p className="font-semibold">Composio Key Setup:</p>
                  <p className="mt-1">
                    Add{' '}
                    <code className="bg-black/40 px-1 py-0.5 rounded font-mono">
                      COMPOSIO_API_KEY=your_key
                    </code>{' '}
                    to your <code className="font-mono">.env</code> file. Grab your free key at{' '}
                    <a
                      href="https://app.composio.dev"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold text-amber-100"
                    >
                      app.composio.dev
                    </a>{' '}
                    (1,000 free actions/month).
                  </p>
                </div>
              )}

              <div className="mt-6 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-300">Popular Integrations</h3>
                <button
                  onClick={handleSyncComposio}
                  className="text-xs py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  🔄 Sync Connected Tools
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                {composioApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-lg bg-[#181824] border border-gray-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white">{app.name}</span>
                        <span className="text-xs text-indigo-400 font-mono">OAuth 2.0</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{app.description}</p>
                    </div>
                    <button
                      onClick={() => handleConnectComposio(app.id)}
                      className="mt-4 w-full py-1.5 px-3 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-900/50"
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
            <div className="bg-[#121218] rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Trigger.dev (v3) Durable Engine
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Runs your long-running agent tasks, document ingestion, and connector sync with
                    zero timeouts.
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  Connected: proj_rroqfqpflbsmzbiuiilt
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#181824] border border-gray-800">
                  <h4 className="text-sm font-semibold text-white">Registered Background Tasks</h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-gray-300 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> example-task
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> vaeloom.ingest-document
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> vaeloom.run-agent
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> vaeloom.sync-connector
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-[#181824] border border-gray-800 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Cloud Dashboard</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Monitor live task execution traces, view run parameters, and debug outputs in
                      real-time.
                    </p>
                  </div>
                  <a
                    href="https://cloud.trigger.dev/orgs/vaeloom-dbed/projects/vaeloom-agents-0iIn"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center justify-center py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
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
