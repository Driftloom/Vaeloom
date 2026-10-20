'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Spinner,
  StatusDot,
  TabPanel,
  Tabs,
  Textarea,
} from '@vaeloom/ui-kit';
import { connectorsApi, type ConnectorItem, type McpToolInfo } from '@/lib/api-client';
import { MCP_CATALOG_TEMPLATES, type McpCatalogTemplate } from '@/components/capabilities/McpView';
import { useToast } from '@/components/shared/Toast';
import { CapabilityDetailLayout, MetaRow } from '@/components/capabilities/CapabilityDetailLayout';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

type SubTab = 'transport' | 'tools' | 'rpc';

export default function McpSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const serverId = (params?.['serverId'] as string) || '';
  const decodedServerId = decodeURIComponent(serverId);

  const [activeTab, setActiveTab] = useState<SubTab>('transport');
  const [syncingTools, setSyncingTools] = useState(false);
  const [callingTool, setCallingTool] = useState(false);
  const [selectedToolName, setSelectedToolName] = useState<string>('');
  const [toolArgsPayload, setToolArgsPayload] = useState('{}');
  const [rpcResult, setRpcResult] = useState<unknown>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);

  const {
    data: mcpConnectors,
    isLoading: loadingConnectors,
    mutate: mutateConnectors,
  } = useSWR(
    workspaceId ? ['workspace-mcp-connectors', workspaceId] : null,
    () => connectorsApi.list(workspaceId, 'mcp'),
    { revalidateOnFocus: false },
  );

  const configuredServer = useMemo<ConnectorItem | null>(() => {
    if (!mcpConnectors || !decodedServerId) return null;
    return (
      mcpConnectors.find(
        (c) =>
          c.id === decodedServerId ||
          c.name.toLowerCase() === decodedServerId.toLowerCase() ||
          c.name.toLowerCase().replace(/\s+/g, '-') === decodedServerId.toLowerCase(),
      ) ?? null
    );
  }, [mcpConnectors, decodedServerId]);

  const templateServer = useMemo<McpCatalogTemplate | null>(() => {
    if (!decodedServerId) return null;
    return (
      MCP_CATALOG_TEMPLATES.find(
        (t) =>
          t.id === decodedServerId ||
          t.name.toLowerCase() === decodedServerId.toLowerCase() ||
          t.name.toLowerCase().replace(/\s+/g, '-') === decodedServerId.toLowerCase(),
      ) ?? null
    );
  }, [decodedServerId]);

  const isConfigured = Boolean(configuredServer);
  const serverTitle = configuredServer?.name ?? templateServer?.name ?? decodedServerId;
  const serverDescription =
    (configuredServer as any)?.description ??
    templateServer?.description ??
    'Model Context Protocol Server';

  // Transport truth: a configured server renders what ITS OWN config declares;
  // a catalog template renders only the template's declared default. No
  // invented fallback such as `stdio` — if the connector config does not
  // declare a transport, the UI says so instead of guessing.
  const displayTransport = isConfigured
    ? typeof configuredServer?.config?.['transport'] === 'string' &&
      configuredServer.config['transport']
      ? (configuredServer.config['transport'] as string)
      : 'not declared in connector config'
    : (templateServer?.defaultConfig.transport ?? 'template transport not declared');

  const {
    data: toolsData,
    isLoading: loadingTools,
    mutate: mutateTools,
  } = useSWR(
    configuredServer?.id ? ['mcp-server-tools', configuredServer.id] : null,
    async () => {
      try {
        const res = await connectorsApi.mcp.listTools(configuredServer!.id);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    { revalidateOnFocus: false },
  );

  // Stable identity: `toolsData ?? []` allocates a new array every render,
  // which made this effect re-run on every render.
  const tools: McpToolInfo[] = useMemo(() => toolsData ?? [], [toolsData]);

  React.useEffect(() => {
    if (tools.length > 0 && !selectedToolName) {
      setSelectedToolName(tools[0]!.name);
    }
  }, [tools, selectedToolName]);

  const handleSyncTools = useCallback(async () => {
    if (!configuredServer) return;
    setSyncingTools(true);
    try {
      const res = await connectorsApi.mcp.sync(configuredServer.id, workspaceId);
      void mutateTools();
      toast({
        tone: 'success',
        title: 'MCP tools synchronized',
        detail: `Updated tool registrations (${res.registered?.length ?? 0} active).`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Tool sync failed',
        detail: err instanceof Error ? err.message : 'Server communication failed.',
      });
    } finally {
      setSyncingTools(false);
    }
  }, [configuredServer, workspaceId, mutateTools, toast]);

  const handleCallTool = useCallback(async () => {
    if (!configuredServer || !selectedToolName) return;
    setCallingTool(true);
    setRpcError(null);
    setRpcResult(null);

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(toolArgsPayload);
    } catch {
      setRpcError('Invalid JSON arguments syntax.');
      setCallingTool(false);
      return;
    }

    try {
      const res = await connectorsApi.mcp.call(configuredServer.id, selectedToolName, parsedArgs);
      setRpcResult(res);
      toast({ tone: 'success', title: `RPC call completed: ${selectedToolName}` });
    } catch (err) {
      setRpcError(err instanceof Error ? err.message : 'Call rejected by MCP daemon.');
      toast({
        tone: 'error',
        title: 'MCP call failed',
        detail: err instanceof Error ? err.message : 'Error executing RPC.',
      });
    } finally {
      setCallingTool(false);
    }
  }, [configuredServer, selectedToolName, toolArgsPayload, toast]);

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=mcp`;

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'MCP', href: breadcrumbsBackUrl },
    { label: serverTitle, current: true },
  ];

  const subTabs = [
    { id: 'transport', label: 'Transport & Process Config' },
    { id: 'tools', label: `Tools (${tools.length})` },
    { id: 'rpc', label: 'RPC Execution Probe' },
  ];

  return (
    <CapabilityDetailLayout
      eyebrow="Model Context Protocol Server"
      title={serverTitle}
      description={serverDescription}
      backHref={breadcrumbsBackUrl}
      backLabel="Back to MCP"
      breadcrumbs={breadcrumbItems}
      rail={
        <>
          {isConfigured && (
            <Button
              variant="primary"
              size="sm"
              disabled={syncingTools}
              onClick={() => void handleSyncTools()}
            >
              {syncingTools ? <Spinner size="sm" /> : 'Sync Tools'}
            </Button>
          )}
        </>
      }
      meta={
        <>
          <div className="flex items-center gap-2">
            <StatusDot status={isConfigured ? 'active' : 'idle'} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate">{serverTitle}</div>
            </div>
          </div>
          <MetaRow
            label="State"
            value={isConfigured ? 'Configured Connector' : 'Catalog Template'}
          />
          <MetaRow label="Transport" value={displayTransport} />
          <MetaRow label="Category" value={templateServer?.category ?? 'Developer'} />
        </>
      }
      tabs={
        configuredServer || templateServer ? (
          <Tabs
            ariaLabel="MCP Inspection Subtabs"
            size="sm"
            tabs={subTabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SubTab)}
          />
        ) : undefined
      }
    >
      {loadingConnectors && !configuredServer && !templateServer ? (
        <CapabilitySubpageSkeleton eyebrow="MCP Server" />
      ) : !configuredServer && !templateServer ? (
        <div className="max-w-xl mx-auto py-12">
          <EmptyState
            title={`MCP Server "${decodedServerId}" not found`}
            description="This MCP server does not match any configured servers or verified templates."
            action={{
              label: 'View all MCP Servers',
              onClick: () => router.push(breadcrumbsBackUrl),
            }}
          />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          <TabPanel id="transport" activeTab={activeTab}>
            <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
              <h3 className="text-base font-semibold text-text">
                Process & Transport Configuration
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                MCP servers run as sandboxed local subprocesses over standard I/O (stdio) or via
                Server-Sent Events (SSE) over HTTP.
              </p>

              <div className="p-4 rounded-lg bg-surface-elevated border border-border space-y-3 text-xs font-mono">
                <div>
                  <span className="text-text-muted">Transport: </span>
                  <span className="text-primary font-bold">{displayTransport}</span>
                </div>
                {isConfigured ? (
                  <>
                    {typeof configuredServer?.config?.['url'] === 'string' &&
                      configuredServer.config['url'] && (
                        <div>
                          <span className="text-text-muted">URL: </span>
                          <span className="text-text">{configuredServer.config['url']}</span>
                        </div>
                      )}
                    {typeof configuredServer?.config?.['command'] === 'string' &&
                      configuredServer.config['command'] && (
                        <div>
                          <span className="text-text-muted">Command: </span>
                          <span className="text-text">{configuredServer.config['command']}</span>
                        </div>
                      )}
                  </>
                ) : (
                  <>
                    {templateServer?.defaultConfig.command && (
                      <div>
                        <span className="text-text-muted">Command: </span>
                        <span className="text-text">
                          {templateServer.defaultConfig.command}{' '}
                          {templateServer.defaultConfig.args?.join(' ')}
                        </span>
                      </div>
                    )}
                    {templateServer?.credentialNote && (
                      <div className="pt-2 border-t border-border-subtle text-text-secondary font-sans text-xs">
                        <span className="font-semibold text-warning">Credential Requirement: </span>
                        {templateServer.credentialNote}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel id="tools" activeTab={activeTab}>
            <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-text">Exposed MCP Tools</h3>
                {isConfigured && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={syncingTools}
                    onClick={() => void handleSyncTools()}
                  >
                    Sync Tools
                  </Button>
                )}
              </div>

              {loadingTools ? (
                <div className="py-8 flex justify-center">
                  <Spinner size="md" />
                </div>
              ) : tools.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  No tools currently recorded for this server. Sync tools when the server is
                  connected.
                </div>
              ) : (
                <div className="space-y-3">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-3.5 rounded-lg border border-border-subtle bg-surface-elevated space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-text">
                          {tool.name}
                        </span>
                        <Badge variant="primary" size="sm">
                          MCP Schema
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary">{tool.description}</p>
                      {tool.inputSchema && (
                        <details className="text-[11px] font-mono text-text-muted">
                          <summary className="cursor-pointer hover:text-text">View Schema</summary>
                          <pre className="p-2 mt-1 rounded bg-surface border border-border overflow-x-auto">
                            {JSON.stringify(tool.inputSchema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel id="rpc" activeTab={activeTab}>
            <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
              <h3 className="text-base font-semibold text-text">Live RPC Execution Probe</h3>
              <p className="text-xs text-text-muted">
                Issue an authenticated RPC invocation directly to this MCP daemon.
              </p>

              {tools.length === 0 ? (
                <div className="p-4 rounded-lg bg-surface-elevated border border-border text-xs text-text-muted">
                  Please sync or register tools before executing live RPC probes.
                </div>
              ) : (
                <>
                  <FormField label="Target Tool Name">
                    <select
                      value={selectedToolName}
                      onChange={(e) => setSelectedToolName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-elevated text-text font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {tools.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="JSON Arguments Payload">
                    <Textarea
                      value={toolArgsPayload}
                      onChange={(e) => setToolArgsPayload(e.target.value)}
                      rows={4}
                      className="font-mono text-xs"
                    />
                  </FormField>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={callingTool}
                    onClick={() => void handleCallTool()}
                  >
                    {callingTool ? <Spinner size="sm" /> : 'Send RPC Call'}
                  </Button>

                  {rpcError && (
                    <div className="p-3 rounded bg-danger/10 border border-danger/20 text-danger text-xs">
                      {rpcError}
                    </div>
                  )}

                  {rpcResult && (
                    <div className="p-3 rounded bg-surface-elevated border border-border text-xs font-mono">
                      <div className="font-semibold text-text mb-1">Daemon Output:</div>
                      <pre className="overflow-x-auto">{JSON.stringify(rpcResult, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabPanel>
        </div>
      )}
    </CapabilityDetailLayout>
  );
}
