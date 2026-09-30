'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { PageHeader } from '@/components/shared/Page';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Response bodies are passed through the api client's `transformKeys`, which
 * camelCases every key. The declared wire spellings (`builtin_servers`,
 * `popular_apps`, `redirect_url`) therefore never survive to this component,
 * and reading them silently yielded `undefined`.
 */
interface BuiltinServer {
  id: string;
  name: string;
  description: string;
  transport: string;
  tools: string[];
  config: Record<string, unknown>;
}

interface BuiltinServersResponse {
  builtinServers?: BuiltinServer[];
}

interface ComposioApp {
  id: string;
  name: string;
  description: string;
}

interface ComposioStatusResponse {
  enabled: boolean;
  popularApps?: ComposioApp[];
}

interface ConnectedConnector {
  id: string;
  name: string;
  type: string;
  status?: string;
}

interface CreateConnectorResponse {
  id: string;
}

interface ComposioAuthUrlResponse {
  redirectUrl?: string;
  message?: string;
}

interface ComposioSyncResponse {
  registered?: string[];
  count?: number;
}

type TabId = 'mcp' | 'composio' | 'trigger';

interface StatusMessage {
  tone: 'info' | 'error' | 'success';
  text: string;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Characters that make an argument ambiguous if the receiving side ever builds a
 * shell string. We send an argv array, never a command line, so these are
 * rejected rather than escaped: silently passing a literal `;` to a program that
 * does not expect it hides a mistake.
 */
const SHELL_METACHARACTERS = /[;&|`$><\n\r]/;

type CommandParse = { ok: true; argv: string[] } | { ok: false; error: string };

/**
 * Split a user-typed command into argv, honouring single and double quotes and
 * backslash escapes inside double quotes. `split(' ')` broke any argument that
 * legitimately contained a space, such as a connection string with a password.
 */
function parseCommandLine(input: string): CommandParse {
  const argv: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] as string;
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && ch === '\\' && i + 1 < input.length) {
        i += 1;
        current += input[i] as string;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) {
        argv.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }

  if (quote) return { ok: false, error: 'Unbalanced quote in the command line.' };
  if (started) argv.push(current);
  if (argv.length === 0) return { ok: false, error: 'Enter the command to run.' };
  if (SHELL_METACHARACTERS.test(argv.join(' '))) {
    return {
      ok: false,
      error:
        'Shell metacharacters (; & | ` $ > <) are not allowed. Enter a plain command and arguments.',
    };
  }
  return { ok: true, argv };
}

export default function DynamicConnectorsPage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string) || '';

  const [activeTab, setActiveTab] = useState<TabId>('mcp');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composioEnabled, setComposioEnabled] = useState<boolean>(false);
  const [composioApps, setComposioApps] = useState<ComposioApp[]>([]);
  const [composioError, setComposioError] = useState<string | null>(null);
  const [builtinServers, setBuiltinServers] = useState<BuiltinServer[]>([]);
  const [builtinError, setBuiltinError] = useState<string | null>(null);
  const [connectedConnectors, setConnectedConnectors] = useState<ConnectedConnector[]>([]);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Form states for adding custom MCP
  const [customName, setCustomName] = useState('');
  const [customTransport, setCustomTransport] = useState<'stdio' | 'http'>('stdio');
  const [customCommand, setCustomCommand] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [commandError, setCommandError] = useState<string | null>(null);
  /**
   * stdio transport makes the API host launch a local process. That is a
   * capability the user has to be told they are granting, not one they should
   * hand over as a side effect of filling in a form.
   */
  const [acknowledgeSubprocess, setAcknowledgeSubprocess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      setComposioError(null);
      setBuiltinError(null);
      try {
        const connRes = await api.get<ConnectedConnector[]>(
          `/connectors?workspace_id=${workspaceId}`,
        );
        if (!cancelled) setConnectedConnectors(Array.isArray(connRes) ? connRes : []);
      } catch (err) {
        if (!cancelled) {
          setConnectedConnectors([]);
          setLoadError(
            errorMessage(err, 'Could not load the connectors attached to this workspace.'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (cancelled) return;

      // Composio and the built-in MCP catalogue are optional sections. Their
      // failures are reported in place rather than silently rendered as "none
      // configured".
      try {
        const compRes = await api.get<ComposioStatusResponse>('/connectors/composio/status');
        if (cancelled) return;
        setComposioEnabled(Boolean(compRes?.enabled));
        setComposioApps(compRes?.popularApps ?? []);
      } catch (err) {
        if (cancelled) return;
        setComposioEnabled(false);
        setComposioApps([]);
        setComposioError(errorMessage(err, 'Could not read the Composio status.'));
      }

      try {
        const mcpRes = await api.get<BuiltinServersResponse>('/connectors/mcp/builtin');
        if (cancelled) return;
        setBuiltinServers(mcpRes?.builtinServers ?? []);
      } catch (err) {
        if (cancelled) return;
        setBuiltinServers([]);
        setBuiltinError(errorMessage(err, 'Could not load the built-in MCP catalogue.'));
      }
    }

    if (workspaceId) {
      void loadData();
    } else {
      setLoading(false);
      setLoadError('No workspace context, so connectors cannot be loaded.');
    }

    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadToken]);

  const handleAttachBuiltin = async (srv: BuiltinServer) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const created = await api.post<CreateConnectorResponse>('/connectors', {
        name: srv.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: srv.config,
      });

      // Automatically sync bridge
      await api.post(`/connectors/${created.id}/mcp/sync`, {
        workspace_id: workspaceId,
      });

      setStatusMessage({ tone: 'success', text: `Attached and synced ${srv.name}.` });
      const refreshed = await api.get<ConnectedConnector[]>(
        `/connectors?workspace_id=${workspaceId}`,
      );
      setConnectedConnectors(Array.isArray(refreshed) ? refreshed : []);
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: `Could not attach ${srv.name}: ${errorMessage(err, 'the request failed.')}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const config: Record<string, unknown> = { transport: customTransport };
    if (customTransport === 'stdio') {
      if (!acknowledgeSubprocess) {
        setCommandError('Confirm that this launches a local process on the API host.');
        return;
      }
      const parsed = parseCommandLine(customCommand);
      if (!parsed.ok) {
        setCommandError(parsed.error);
        return;
      }
      setCommandError(null);
      config['command'] = parsed.argv[0];
      config['args'] = parsed.argv.slice(1);
    } else {
      // No `allow_insecure` is sent. A browser is not a policy authority: the
      // server decides whether a plaintext endpoint is acceptable, and the old
      // client-side flag let any user downgrade transport security for the whole
      // workspace by editing a URL.
      config['url'] = customUrl;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const created = await api.post<CreateConnectorResponse>('/connectors', {
        name: customName.trim(),
        type: 'mcp',
        workspace_id: workspaceId,
        config,
      });

      await api.post(`/connectors/${created.id}/mcp/sync`, {
        workspace_id: workspaceId,
      });

      setStatusMessage({ tone: 'success', text: `Added and synced "${customName.trim()}".` });
      setCustomName('');
      setCustomCommand('');
      setCustomUrl('');
      setAcknowledgeSubprocess(false);

      const refreshed = await api.get<ConnectedConnector[]>(
        `/connectors?workspace_id=${workspaceId}`,
      );
      setConnectedConnectors(Array.isArray(refreshed) ? refreshed : []);
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: `Could not add the custom MCP server: ${errorMessage(err, 'the request failed.')}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectComposio = async (appId: string) => {
    setStatusMessage(null);
    try {
      const res = await api.post<ComposioAuthUrlResponse>('/connectors/composio/auth-url', {
        app: appId,
        workspace_id: workspaceId,
      });

      if (res?.redirectUrl) {
        window.open(res.redirectUrl, '_blank', 'noopener,noreferrer');
      } else {
        setStatusMessage({
          tone: 'info',
          text: res?.message || 'Configure COMPOSIO_API_KEY on the API host before connecting.',
        });
      }
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: errorMessage(err, 'Could not start Composio authorization.'),
      });
    }
  };

  const handleSyncComposio = async () => {
    setStatusMessage(null);
    try {
      const res = await api.post<ComposioSyncResponse>('/connectors/composio/sync', {
        workspace_id: workspaceId,
      });
      setStatusMessage({
        tone: 'success',
        text: `Synced ${res?.count ?? 0} tools from Composio.`,
      });
    } catch (err) {
      setStatusMessage({
        tone: 'error',
        text: errorMessage(err, 'Composio sync failed.'),
      });
    }
  };

  const tabs = [
    { id: 'mcp', label: 'Model Context Protocol (MCP)' },
    { id: 'composio', label: 'Composio SaaS Gateway (250+ Apps)' },
    { id: 'trigger', label: 'Trigger.dev Background Jobs' },
  ];

  const statusTone = {
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-error/30 bg-error/10 text-error',
  }[statusMessage?.tone ?? 'info'];

  return (
    // The workspace layout already supplies a scroll container and padding. A
    // min-h-screen child inside it forced a second scrollbar and double padding.
    <div className="min-h-full bg-background text-text">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          eyebrow="Extensibility Hub"
          title="Dynamic Connectors & Agent Tools"
          description="Connect Open Model Context Protocol (MCP) servers, Composio 250+ SaaS tools, and trigger durable background tasks."
          actions={
            <Link
              href={`/workspace/${workspaceId}/connectors`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span aria-hidden="true">←</span> Back to Connectors
            </Link>
          }
        />

        {statusMessage && (
          <div
            role="status"
            className={`mt-4 p-4 rounded-lg border text-sm flex justify-between items-center gap-3 ${statusTone}`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="shrink-0 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadError ? (
          <ErrorState
            className="mt-6"
            title="Failed to load connectors"
            message={loadError}
            onRetry={() => setReloadToken((n) => n + 1)}
          />
        ) : (
          <>
            <div className="mt-6">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as TabId)}
              />
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <LoadingSpinner size="lg" text="Loading connectors..." />
              </div>
            ) : (
              <>
                {/* TAB 1: MCP SERVERS */}
                <TabPanel id="mcp" activeTab={activeTab}>
                  <div className="mt-6 space-y-6">
                    {/* Built-in MCP Servers */}
                    <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
                      <h2 className="text-lg font-display font-medium text-text flex items-center gap-2 flex-wrap">
                        <span>
                          <span aria-hidden="true">📦</span> Built-in Curated MCP Servers
                        </span>
                        <span className="text-2xs px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 font-mono">
                          Zero Config
                        </span>
                      </h2>
                      <p className="text-xs text-text-muted mt-1">
                        One-click attach official Vaeloom MCP tools right to your agent loop.
                      </p>

                      {builtinError ? (
                        <ErrorState
                          className="mt-4"
                          title="Could not load built-in MCP servers"
                          message={builtinError}
                          onRetry={() => setReloadToken((n) => n + 1)}
                        />
                      ) : builtinServers.length === 0 ? (
                        <EmptyState
                          className="mt-4"
                          title="No built-in MCP servers offered"
                          description="This deployment publishes an empty built-in MCP catalogue. Add a remote server below instead."
                        />
                      ) : (
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
                                type="button"
                                onClick={() => void handleAttachBuiltin(srv)}
                                disabled={isSubmitting}
                                className="btn-primary mt-4 w-full text-xs"
                              >
                                {isSubmitting ? 'Attaching…' : 'Attach to Workspace'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Custom MCP Server Form */}
                    <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
                      <h2 className="text-lg font-display font-medium text-text">
                        Add Custom MCP Server
                      </h2>
                      <p className="text-xs text-text-muted mt-1">
                        Connect any stdio subprocess (Node/Python) or remote streamable HTTP / SSE
                        MCP server.
                      </p>

                      <form onSubmit={handleAddCustomMcp} className="mt-4 space-y-4 max-w-xl">
                        <div>
                          <label
                            htmlFor="custom-mcp-name"
                            className="block text-xs font-medium text-text-muted"
                          >
                            Server Name
                          </label>
                          <input
                            id="custom-mcp-name"
                            type="text"
                            required
                            placeholder="e.g. Postgres DB Explorer or Browser Agent"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="input-field mt-1"
                          />
                        </div>

                        <fieldset className="flex gap-4">
                          <legend className="sr-only">Transport</legend>
                          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                            <input
                              type="radio"
                              name="transport"
                              value="stdio"
                              checked={customTransport === 'stdio'}
                              onChange={() => {
                                setCustomTransport('stdio');
                                setCommandError(null);
                              }}
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
                              onChange={() => {
                                setCustomTransport('http');
                                setCommandError(null);
                              }}
                              className="text-primary focus:ring-accent"
                            />
                            streamable HTTP / SSE
                          </label>
                        </fieldset>

                        {customTransport === 'stdio' ? (
                          <>
                            <div>
                              <label
                                htmlFor="custom-mcp-command"
                                className="block text-xs font-medium text-text-muted"
                              >
                                Command &amp; Arguments
                              </label>
                              <input
                                id="custom-mcp-command"
                                type="text"
                                required
                                placeholder='npx -y @modelcontextprotocol/server-postgres "postgresql://user:p a ss@host/db"'
                                value={customCommand}
                                onChange={(e) => {
                                  setCustomCommand(e.target.value);
                                  setCommandError(null);
                                }}
                                aria-describedby="custom-mcp-command-help"
                                aria-invalid={commandError ? true : undefined}
                                className="input-field mt-1 font-mono"
                              />
                              <p
                                id="custom-mcp-command-help"
                                className="text-xs text-text-muted mt-1"
                              >
                                Quote any argument that contains a space. Arguments are sent as a
                                list, never as a shell command line.
                              </p>
                            </div>
                            <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
                              <input
                                type="checkbox"
                                checked={acknowledgeSubprocess}
                                onChange={(e) => {
                                  setAcknowledgeSubprocess(e.target.checked);
                                  setCommandError(null);
                                }}
                                className="mt-0.5 text-primary focus:ring-accent"
                              />
                              <span>
                                I understand this starts a local process on the API host, with that
                                host&apos;s permissions.
                              </span>
                            </label>
                          </>
                        ) : (
                          <div>
                            <label
                              htmlFor="custom-mcp-url"
                              className="block text-xs font-medium text-text-muted"
                            >
                              Endpoint URL
                            </label>
                            <input
                              id="custom-mcp-url"
                              type="url"
                              required
                              placeholder="https://mcp.example.com/sse"
                              value={customUrl}
                              onChange={(e) => setCustomUrl(e.target.value)}
                              aria-describedby="custom-mcp-url-help"
                              className="input-field mt-1 font-mono"
                            />
                            <p id="custom-mcp-url-help" className="text-xs text-text-muted mt-1">
                              The server enforces transport security. A plaintext endpoint is
                              rejected there, not here.
                            </p>
                          </div>
                        )}

                        {commandError && (
                          <p role="alert" className="text-xs text-error">
                            {commandError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="btn-primary text-xs"
                        >
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
                        <p className="text-xs text-text-muted mt-3">
                          No active connectors attached yet.
                        </p>
                      ) : (
                        <div className="mt-3 divide-y divide-border">
                          {connectedConnectors.map((c) => (
                            <div
                              key={c.id}
                              className="py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-text">{c.name}</span>
                                <span className="ml-2 text-xs font-mono text-text-muted">
                                  ({c.type})
                                </span>
                                <div className="text-xs text-text-muted mt-0.5 break-all">
                                  ID: <span className="font-mono">{c.id}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.post(`/connectors/${c.id}/mcp/sync`, {
                                      workspace_id: workspaceId,
                                    });
                                    setStatusMessage({
                                      tone: 'success',
                                      text: `Re-synced tools for ${c.name}.`,
                                    });
                                  } catch (err) {
                                    setStatusMessage({
                                      tone: 'error',
                                      text: `Sync failed for ${c.name}: ${errorMessage(err, 'the request failed.')}`,
                                    });
                                  }
                                }}
                                className="btn-secondary text-xs px-2.5 py-1 font-mono shrink-0"
                              >
                                Re-sync Tools
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabPanel>

                {/* TAB 2: COMPOSIO SAAS GATEWAY */}
                <TabPanel id="composio" activeTab={activeTab}>
                  <div className="mt-6 space-y-6">
                    <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="text-lg font-display font-medium text-text">
                            Composio Universal SaaS Gateway
                          </h2>
                          <p className="text-xs text-text-muted mt-1">
                            Connect Slack, Notion, GitHub, LinkedIn, Jira, and 250+ SaaS tools
                            without writing OAuth plumbing.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              composioError
                                ? 'bg-text-dim'
                                : composioEnabled
                                  ? 'bg-success'
                                  : 'bg-warning'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="text-xs font-mono text-text-secondary">
                            {composioError
                              ? 'Status unavailable'
                              : composioEnabled
                                ? 'API Key Active'
                                : 'Key missing on API host'}
                          </span>
                        </div>
                      </div>

                      {composioError && (
                        <div
                          role="status"
                          className="mt-4 p-3 rounded-lg border border-warning/30 bg-warning/10 text-xs text-warning"
                        >
                          {composioError} The status below may be incomplete until this is resolved.
                        </div>
                      )}

                      {!composioError && !composioEnabled && (
                        <div className="mt-4 p-4 rounded-lg bg-warning/15 border border-warning/30 text-xs text-warning">
                          <p className="font-semibold">Composio key setup:</p>
                          <p className="mt-1">
                            Set{' '}
                            <code className="bg-background/40 px-1 py-0.5 rounded font-mono">
                              COMPOSIO_API_KEY
                            </code>{' '}
                            on the API host to enable this gateway.
                          </p>
                        </div>
                      )}

                      <div className="mt-6 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-text-secondary">
                          Popular integrations
                        </h3>
                        <button
                          type="button"
                          onClick={() => void handleSyncComposio()}
                          disabled={!composioEnabled}
                          className="btn-primary text-xs"
                        >
                          <span aria-hidden="true">🔄</span> Sync Connected Tools
                        </button>
                      </div>

                      {composioApps.length === 0 ? (
                        <p className="text-xs text-text-muted mt-3">
                          {composioError
                            ? 'Integrations could not be listed because the Composio status is unavailable.'
                            : 'Composio reported no popular integrations for this deployment.'}
                        </p>
                      ) : (
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
                                type="button"
                                onClick={() => void handleConnectComposio(app.id)}
                                disabled={!composioEnabled}
                                className="btn-secondary mt-4 w-full text-xs"
                              >
                                Connect {app.name}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabPanel>

                {/* TAB 3: TRIGGER.DEV BACKGROUND JOBS */}
                <TabPanel id="trigger" activeTab={activeTab}>
                  <div className="mt-6 space-y-6">
                    <div className="bg-surface rounded-xl p-6 border border-border shadow-card">
                      <h2 className="text-lg font-display font-medium text-text">
                        Trigger.dev (v3) Durable Engine
                      </h2>
                      <p className="text-xs text-text-muted mt-1">
                        Runs your long-running agent tasks, document ingestion, and connector sync
                        with zero timeouts.
                      </p>

                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-surface-100 border border-border">
                          <h3 className="text-sm font-semibold text-text">
                            Registered Background Tasks
                          </h3>
                          <p className="text-xs text-text-muted mt-2">
                            The task registry is not exposed by the API, so the registered task list
                            cannot be read and is not shown. This page previously displayed four
                            hardcoded names with a success tick that had never been queried.
                          </p>
                        </div>

                        <div className="p-4 rounded-lg bg-surface-100 border border-border flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-text">Cloud Dashboard</h3>
                            <p className="text-xs text-text-muted mt-1">
                              No Trigger.dev dashboard is configured for this workspace, so there is
                              no per-workspace run trace to link to. A single shared organisation
                              URL was previously shown to every workspace, which pointed at somebody
                              else&apos;s project.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabPanel>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
