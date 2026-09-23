'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/components/shared/Toast';
import {
  connectorsApi,
  type ConnectorItem,
  type BuiltinMcpServer,
  type McpToolInfo,
} from '@/lib/api-client';

interface McpViewProps {
  workspaceId: string;
  searchQuery?: string;
  onOpenCreateServer: () => void;
  onOpenImport: () => void;
}

export interface McpCatalogTemplate {
  id: string;
  name: string;
  transports: ('stdio' | 'http')[];
  authType?: string;
  category: string;
  description: string;
  defaultConfig: {
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    headers?: Record<string, string>;
  };
}

const MCP_CATALOG_TEMPLATES: McpCatalogTemplate[] = [
  {
    id: 'sqlite-memory',
    name: 'SQLite Memory MCP',
    transports: ['stdio'],
    category: 'Database',
    description:
      'Sovereign relational database engine with zero external dependencies. Ingests tables, profiles, and relational memory.',
    defaultConfig: {
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'api.mcp_servers.sqlite_mcp', '--db-path', './data/memory.db'],
    },
  },
  {
    id: 'job-search-mcp',
    name: 'Public ATS Job Search MCP',
    transports: ['stdio'],
    category: 'Career & ATS',
    description:
      'Native ATS crawler discovering live jobs from Greenhouse, Lever, and corporate portals for automated matching.',
    defaultConfig: {
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'api.mcp_servers.job_search_mcp'],
    },
  },
  {
    id: 'filesystem',
    name: 'Local Filesystem MCP',
    transports: ['stdio'],
    category: 'Filesystem',
    description:
      'Secure, sandboxed local directory reader and writer for candidate portfolios and workspace documents.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './data'],
    },
  },
  {
    id: 'postgres-db',
    name: 'PostgreSQL Database MCP',
    transports: ['stdio'],
    category: 'Database',
    description:
      'Inspect enterprise Postgres tables, execute read-only queries, and analyze relational schemas.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost:5432/vaeloom'],
    },
  },
  {
    id: 'github',
    name: 'GitHub MCP Server',
    transports: ['stdio'],
    authType: 'Token',
    category: 'Developer',
    description:
      'Query repositories, inspect pull requests, read issues, and search code for candidate portfolios.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    },
  },
  {
    id: 'brave-search',
    name: 'Brave Search MCP',
    transports: ['stdio'],
    authType: 'API Key',
    category: 'Web Search',
    description:
      'Real-time web search and news indexing for company intelligence and hiring research.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
    },
  },
  {
    id: 'slack',
    name: 'Slack MCP Server',
    transports: ['stdio'],
    authType: 'Bot Token',
    category: 'Communication',
    description:
      'Interact with Slack channels, post candidate evaluations, and search team discussions.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: { SLACK_BOT_TOKEN: '${SLACK_BOT_TOKEN}' },
    },
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer Browser Scraper',
    transports: ['stdio'],
    category: 'Automation',
    description: 'Headless browser navigation, page screenshots, and dynamic DOM data extraction.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
  },
  {
    id: 'memory-graph',
    name: 'Memory Graph MCP',
    transports: ['stdio'],
    category: 'Memory',
    description:
      'Persistent knowledge graph maintaining entities, relationships, and context between agent sessions.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  },
  {
    id: 'atlassian',
    name: 'Atlassian MCP Suite',
    transports: ['http'],
    authType: 'OAuth',
    category: 'Productivity',
    description:
      'Bidirectional Jira ticket tracking, agile sprint management, and Confluence wiki indexing.',
    defaultConfig: {
      transport: 'http',
      url: 'https://api.atlassian.com/mcp/v1',
    },
  },
];

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  server?: string;
}

export const McpView: React.FC<McpViewProps> = ({
  workspaceId,
  searchQuery = '',
  onOpenCreateServer,
  onOpenImport,
}) => {
  const { toast } = useToast();

  // Dynamic Workspace Servers State
  const [installedServers, setInstalledServers] = useState<ConnectorItem[]>([]);
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  // Active Server Discovered Tools State
  const [serverTools, setServerTools] = useState<McpToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [syncingServerId, setSyncingServerId] = useState<string | null>(null);
  const [refreshingTools, setRefreshingTools] = useState(false);

  // View Subtabs
  const [activeSubTab, setActiveSubTab] = useState<'inspector' | 'manifest'>('inspector');

  // Interactive Tool Playground State
  const [testingTool, setTestingTool] = useState<McpToolInfo | null>(null);
  const [testArgsJson, setTestArgsJson] = useState('{}');
  const [testCalling, setTestCalling] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLatencyMs, setTestLatencyMs] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Raw mcp.json Editor State
  const [mcpConfigText, setMcpConfigText] = useState('{\n  "mcpServers": {}\n}');
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Console Logs
  const [logFilter, setLogFilter] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Model Context Protocol (MCP v2) client initialized in workspace.',
    },
  ]);

  const addLog = useCallback((level: LogEntry['level'], message: string, server?: string) => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        server,
      },
      ...prev.slice(0, 99), // keep last 100
    ]);
  }, []);

  // Helper: Build standard mcpServers JSON from installed servers
  const buildMcpServersJson = useCallback((servers: ConnectorItem[]) => {
    const mcpServers: Record<string, unknown> = {};
    servers.forEach((s) => {
      const cfg = s.config || {};
      const slug = s.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      if (cfg['transport'] === 'stdio' || cfg['command']) {
        const item: Record<string, unknown> = {
          command: cfg['command'] || 'npx',
          args: cfg['args'] || [],
        };
        if (cfg['env'] && Object.keys(cfg['env'] as object).length > 0) {
          item['env'] = cfg['env'];
        }
        mcpServers[slug] = item;
      } else {
        const item: Record<string, unknown> = {
          url: cfg['url'] || cfg['base_url'] || 'https://api.example.com/mcp',
        };
        if (cfg['auth_token']) {
          item['headers'] = { Authorization: 'Bearer ${AUTH_TOKEN}' };
        }
        mcpServers[slug] = item;
      }
    });
    return JSON.stringify({ mcpServers }, null, 2);
  }, []);

  // Load workspace MCP servers from API
  const loadWorkspaceServers = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingServers(true);
    try {
      const [listRes, builtinRes] = await Promise.allSettled([
        connectorsApi.list(workspaceId, 'mcp'),
        connectorsApi.mcp.builtin(),
      ]);

      let servers: ConnectorItem[] = [];
      if (listRes.status === 'fulfilled' && Array.isArray(listRes.value)) {
        servers = listRes.value;
        setInstalledServers(servers);
      }

      if (builtinRes.status === 'fulfilled' && builtinRes.value?.builtin_servers) {
        setBuiltinServers(builtinRes.value.builtin_servers);
      }

      // Auto-select first server if none selected
      setSelectedServerId((prev) => {
        if (prev && servers.some((s) => s.id === prev)) return prev;
        return servers.length > 0 && servers[0] ? servers[0].id : null;
      });

      // Update mcp.json editor if not modified by user
      if (!isEditorDirty) {
        setMcpConfigText(buildMcpServersJson(servers));
      }
    } catch {
      // Safe fallback
    } finally {
      setLoadingServers(false);
    }
  }, [workspaceId, isEditorDirty, buildMcpServersJson]);

  useEffect(() => {
    loadWorkspaceServers();
  }, [loadWorkspaceServers]);

  // Selected Server Object
  const selectedServer = useMemo(
    () => installedServers.find((s) => s.id === selectedServerId) || null,
    [installedServers, selectedServerId],
  );

  // Load tools for selected server
  const loadServerTools = useCallback(
    async (serverId: string, refresh = false) => {
      if (!serverId) return;
      if (refresh) setRefreshingTools(true);
      else setLoadingTools(true);

      try {
        const tools = refresh
          ? await connectorsApi.mcp.refreshTools(serverId)
          : await connectorsApi.mcp.listTools(serverId);

        setServerTools(tools || []);
        addLog(
          'info',
          `Discovered ${tools?.length || 0} tools from server '${selectedServer?.name || serverId}'.`,
          selectedServer?.name,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not query MCP tools';
        addLog('warn', `Failed to query tools: ${msg}`, selectedServer?.name);
        setServerTools([]);
      } finally {
        setLoadingTools(false);
        setRefreshingTools(false);
      }
    },
    [selectedServer, addLog],
  );

  useEffect(() => {
    if (selectedServerId) {
      loadServerTools(selectedServerId);
    } else {
      setServerTools([]);
    }
  }, [selectedServerId, loadServerTools]);

  // Handle Sync Bridge (Bridges tools to agent orchestrator)
  const handleSyncBridge = async (server: ConnectorItem) => {
    setSyncingServerId(server.id);
    try {
      const res = await connectorsApi.mcp.sync(server.id, workspaceId);
      addLog(
        'success',
        `Successfully bridged ${res.bridged_total ?? res.registered?.length ?? 0} tools to Agent Orchestrator.`,
        server.name,
      );
      toast({
        tone: 'success',
        title: 'MCP Bridge Synchronized',
        detail: `Registered ${res.bridged_total ?? res.registered?.length ?? 0} tools for autonomous agent execution.`,
      });
      loadServerTools(server.id, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      addLog('error', `Bridge sync error: ${msg}`, server.name);
      toast({
        tone: 'error',
        title: 'Bridge Sync Failed',
        detail: msg,
      });
    } finally {
      setSyncingServerId(null);
    }
  };

  // Handle Install from Catalog
  const handleInstallCatalogServer = async (template: McpCatalogTemplate) => {
    try {
      addLog('info', `Provisioning '${template.name}' into workspace...`, template.name);
      const created = await connectorsApi.create({
        name: template.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: template.defaultConfig,
      });

      addLog(
        'success',
        `Created MCP connector '${template.name}'. Running tool sync...`,
        template.name,
      );

      // Auto-sync
      try {
        await connectorsApi.mcp.sync(created.id, workspaceId);
      } catch {
        // Non-fatal if server takes time to start
      }

      toast({
        tone: 'success',
        title: `Installed ${template.name}`,
        detail: 'MCP server configured and bridged into workspace.',
      });

      await loadWorkspaceServers();
      setSelectedServerId(created.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not install server';
      addLog('error', `Install failed: ${msg}`, template.name);
      toast({
        tone: 'error',
        title: 'Installation Failed',
        detail: msg,
      });
    }
  };

  // Handle Delete Server
  const handleDeleteServer = async (server: ConnectorItem) => {
    if (!window.confirm(`Are you sure you want to remove ${server.name} from this workspace?`)) {
      return;
    }

    try {
      await connectorsApi.delete(server.id);
      addLog('warn', `Removed MCP server '${server.name}'.`, server.name);
      toast({
        tone: 'info',
        title: 'Server Removed',
        detail: `Disconnected ${server.name}.`,
      });
      await loadWorkspaceServers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete server';
      toast({
        tone: 'error',
        title: 'Deletion Failed',
        detail: msg,
      });
    }
  };

  // Handle Save / Apply mcp.json
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const parsed = JSON.parse(mcpConfigText);
      const mcpServers = (parsed.mcpServers || {}) as Record<string, Record<string, any>>;
      const serverKeys = Object.keys(mcpServers);

      if (serverKeys.length === 0) {
        toast({
          tone: 'warning',
          title: 'Empty Configuration',
          detail: 'No servers found under "mcpServers".',
        });
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const key of serverKeys) {
        const sDef = mcpServers[key] as Record<string, any> | undefined;
        if (!sDef) continue;
        const existing = installedServers.find(
          (s) => s.name.toLowerCase() === key.toLowerCase() || s.id === key,
        );

        const isStdio = !!sDef['command'];
        const config: Record<string, any> = {
          transport: isStdio ? 'stdio' : 'http',
          command: sDef['command'],
          args: sDef['args'] || [],
          url: sDef['url'],
          env: sDef['env'],
          headers: sDef['headers'],
        };

        if (existing) {
          await connectorsApi.update(existing.id, {
            name: key,
            config,
          });
          try {
            await connectorsApi.mcp.sync(existing.id, workspaceId);
          } catch {
            // ignore
          }
          updatedCount++;
        } else {
          const created = await connectorsApi.create({
            name: key,
            type: 'mcp',
            workspace_id: workspaceId,
            config,
          });
          try {
            await connectorsApi.mcp.sync(created.id, workspaceId);
          } catch {
            // ignore
          }
          createdCount++;
        }
      }

      setIsEditorDirty(false);
      addLog(
        'success',
        `Applied mcp.json manifest: ${createdCount} created, ${updatedCount} updated.`,
      );
      toast({
        tone: 'success',
        title: 'mcp.json Applied',
        detail: `Successfully updated ${createdCount + updatedCount} MCP servers in workspace.`,
      });

      await loadWorkspaceServers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON format';
      toast({
        tone: 'error',
        title: 'Syntax Error in mcp.json',
        detail: msg,
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Format JSON in editor
  const handleFormatConfig = () => {
    try {
      const parsed = JSON.parse(mcpConfigText);
      setMcpConfigText(JSON.stringify(parsed, null, 2));
      toast({ tone: 'info', title: 'Formatted mcp.json' });
    } catch {
      toast({ tone: 'error', title: 'Cannot format: Invalid JSON syntax' });
    }
  };

  // Execute Live Tool Call in Playground
  const handleExecuteToolCall = async () => {
    if (!selectedServer || !testingTool) return;
    setTestCalling(true);
    setTestError(null);
    setTestResult(null);
    const t0 = performance.now();

    try {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(testArgsJson || '{}');
      } catch {
        throw new Error('Arguments must be a valid JSON object.');
      }

      addLog(
        'info',
        `Calling tool '${testingTool.name}' with args: ${JSON.stringify(args)}`,
        selectedServer.name,
      );

      const res = await connectorsApi.mcp.call(selectedServer.id, testingTool.name, args);
      const t1 = performance.now();
      setTestLatencyMs(Math.round(t1 - t0));
      setTestResult(res);
      addLog(
        'success',
        `Tool '${testingTool.name}' executed in ${Math.round(t1 - t0)}ms.`,
        selectedServer.name,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setTestError(msg);
      addLog('error', `Tool '${testingTool.name}' error: ${msg}`, selectedServer.name);
    } finally {
      setTestCalling(false);
    }
  };

  // Filtering for left column
  const effectiveQuery = searchQuery.trim().toLowerCase();

  const filteredInstalled = useMemo(() => {
    if (!effectiveQuery) return installedServers;
    return installedServers.filter(
      (s) =>
        s.name.toLowerCase().includes(effectiveQuery) ||
        (s.config?.['command'] &&
          String(s.config['command']).toLowerCase().includes(effectiveQuery)) ||
        (s.config?.['url'] && String(s.config['url']).toLowerCase().includes(effectiveQuery)),
    );
  }, [installedServers, effectiveQuery]);

  const filteredCatalog = useMemo(() => {
    if (!effectiveQuery) return MCP_CATALOG_TEMPLATES;
    return MCP_CATALOG_TEMPLATES.filter(
      (s) =>
        s.name.toLowerCase().includes(effectiveQuery) ||
        s.description.toLowerCase().includes(effectiveQuery) ||
        s.category.toLowerCase().includes(effectiveQuery) ||
        s.transports.some((t) => t.toLowerCase().includes(effectiveQuery)),
    );
  }, [effectiveQuery]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((l) => l.server?.toLowerCase() === logFilter.toLowerCase());
  }, [logs, logFilter]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Left Column: Servers + Catalog (Pixel-Matched to Design System)          */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0">
        {/* Section 1: Installed Servers Header */}
        <div className="border-b border-border flex flex-col shrink-0">
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text font-sans tracking-tight">
                Servers
              </span>
              <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-surface-elevated text-text-secondary border border-border">
                {installedServers.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenImport}
                className="inline-flex items-center gap-1 text-xs font-sans font-medium text-text-muted hover:text-text transition-colors"
                title="Import mcp.json configuration"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span>Import</span>
              </button>
            </div>
          </div>

          {/* Installed Servers List */}
          <div className="p-3 space-y-2 max-h-[260px] overflow-y-auto">
            {loadingServers ? (
              <div className="py-4 text-center text-xs text-text-muted animate-pulse">
                Loading workspace servers...
              </div>
            ) : filteredInstalled.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-border bg-surface-elevated/40 text-center space-y-1">
                <p className="text-xs font-medium text-text">No MCP servers connected</p>
                <p className="text-2xs text-text-muted">
                  Install a server from the catalog below or create a custom server.
                </p>
              </div>
            ) : (
              filteredInstalled.map((server) => {
                const isSelected = selectedServerId === server.id;
                const isStdio =
                  server.config?.['transport'] === 'stdio' || !!server.config?.['command'];
                const status = server.status || 'active';
                const isSyncing = syncingServerId === server.id;

                return (
                  <div
                    key={server.id}
                    onClick={() => {
                      setSelectedServerId(server.id);
                      setActiveSubTab('inspector');
                      setTestingTool(null);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 shadow-xs'
                        : 'bg-surface-elevated border-border hover:border-border-subtle hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          status === 'active'
                            ? 'bg-success'
                            : status === 'syncing' || isSyncing
                              ? 'bg-warning animate-ping'
                              : 'bg-danger'
                        }`}
                        title={`Status: ${status}`}
                      />
                      <span className="text-xs font-mono font-medium text-text truncate">
                        {server.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-surface text-text-secondary border border-border">
                        {isStdio ? 'stdio' : 'http'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xs font-sans text-text-muted">
                        {isSyncing ? 'syncing...' : status === 'active' ? 'connected' : 'error'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteServer(server);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-danger text-text-muted transition-all p-1"
                        title={`Delete ${server.name}`}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={onOpenCreateServer}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-border hover:border-border-subtle text-xs font-sans font-medium text-text-secondary hover:text-text flex items-center justify-center gap-1.5 transition-colors bg-surface-elevated/40"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span>New server</span>
            </button>
          </div>
        </div>

        {/* Section 2: Catalog (1-click installable verified servers) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text font-sans tracking-tight">
                Verified Catalog
              </span>
              <span className="text-2xs font-sans px-1.5 py-0.2 rounded-full bg-surface-elevated text-text-secondary border border-border">
                {filteredCatalog.length} available
              </span>
            </div>
            <span className="text-2xs font-mono text-primary font-medium">1-Click Install</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle p-2 space-y-1">
            {filteredCatalog.map((template) => {
              const isInstalled = installedServers.some(
                (s) =>
                  s.name.toLowerCase() === template.name.toLowerCase() ||
                  s.name.toLowerCase() === template.id.toLowerCase(),
              );

              return (
                <div
                  key={template.id}
                  className="p-3 rounded-lg hover:bg-surface-hover/70 transition-colors flex items-start justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-text font-sans">
                        {template.name}
                      </span>
                      {template.transports.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-surface-elevated text-text-secondary border border-border"
                        >
                          {t}
                        </span>
                      ))}
                      {template.authType && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-primary/10 text-primary border border-primary/20">
                          {template.authType}
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 text-[9px] font-sans rounded bg-surface-elevated text-text-muted">
                        {template.category}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary font-sans leading-relaxed mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isInstalled}
                    onClick={() => handleInstallCatalogServer(template)}
                    className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors shrink-0 ${
                      isInstalled
                        ? 'bg-surface-elevated text-text-muted border border-border cursor-default'
                        : 'bg-primary hover:bg-primary-hover text-primary-foreground border border-primary/40 shadow-xs'
                    }`}
                  >
                    {isInstalled ? 'Installed' : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Right Column: Server Inspector & Tools OR mcp.json Manifest Editor         */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text overflow-hidden">
        {/* Sub-navigation Tabs */}
        <div className="border-b border-border bg-surface px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSubTab('inspector')}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'inspector'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>Inspector & Tools</span>
              {serverTools.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">
                  {serverTools.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSubTab('manifest');
                if (!isEditorDirty) {
                  setMcpConfigText(buildMcpServersJson(installedServers));
                }
              }}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'manifest'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                />
              </svg>
              <span>mcp.json Manifest</span>
              <span className="text-[10px] font-mono text-text-muted">Claude Desktop / Cursor</span>
            </button>
          </div>

          {/* Subtab specific top actions */}
          {activeSubTab === 'manifest' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFormatConfig}
                title="Format JSON"
                className="px-2.5 py-1 rounded text-xs font-mono text-text-secondary hover:text-text bg-surface-elevated border border-border hover:bg-surface-hover transition-colors"
              >
                {`{ } Format`}
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-3 py-1 rounded bg-primary hover:bg-primary-hover text-xs font-sans font-semibold text-primary-foreground transition-colors shadow-xs flex items-center gap-1.5"
              >
                {savingConfig ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Apply to Workspace</span>
                )}
              </button>
            </div>
          ) : selectedServer ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadServerTools(selectedServer.id, true)}
                disabled={refreshingTools}
                className="px-2.5 py-1 rounded text-xs font-sans text-text-secondary hover:text-text bg-surface-elevated border border-border hover:bg-surface-hover transition-colors flex items-center gap-1.5"
                title="Query server for updated tool definitions"
              >
                <svg
                  className={`w-3.5 h-3.5 text-primary ${refreshingTools ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Refresh Tools</span>
              </button>

              <button
                type="button"
                onClick={() => handleSyncBridge(selectedServer)}
                disabled={syncingServerId === selectedServer.id}
                className="px-3 py-1 rounded bg-primary hover:bg-primary-hover text-xs font-sans font-semibold text-primary-foreground transition-colors shadow-xs flex items-center gap-1.5"
                title="Register discovered tools into agent executor"
              >
                <svg
                  className={`w-3 h-3 ${syncingServerId === selectedServer.id ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Sync Bridge</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Content Pane: Inspector vs Manifest */}
        {activeSubTab === 'inspector' ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {!selectedServer ? (
              <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full space-y-6">
                <div className="text-center py-6 space-y-2 border-b border-border">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-text font-sans">
                    Model Context Protocol (MCP v2) Runtime
                  </h3>
                  <p className="text-xs text-text-secondary max-w-lg mx-auto leading-relaxed font-sans">
                    Connect verified external tools, local filesystems, and databases directly to
                    autonomous agents with sandboxed stdio subprocesses or streamable-http
                    endpoints.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
                      Recommended Sovereign Protocols
                    </h4>
                    <span className="text-xs text-text-muted font-mono">1-Click Fast Connect</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {MCP_CATALOG_TEMPLATES.slice(0, 4).map((template) => (
                      <div
                        key={template.id}
                        className="p-4 rounded-xl bg-surface border border-border hover:border-primary/40 transition-all duration-200 flex flex-col justify-between space-y-3 shadow-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-text font-sans">
                              {template.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {template.category}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2.5 border-t border-border">
                          <span className="text-[10px] font-mono text-text-muted">
                            {template.defaultConfig.transport.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleInstallCatalogServer(template)}
                            className="px-3 py-1 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition-colors cursor-pointer"
                          >
                            Install Protocol
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                {/* Server Overview Banner */}
                <div className="p-4 rounded-xl bg-surface border border-border shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-success" />
                        <h2 className="text-base font-semibold text-text font-mono">
                          {selectedServer.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded text-2xs font-mono bg-surface-elevated text-text-secondary border border-border">
                          {selectedServer.config?.['transport'] || 'stdio'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-2xs font-sans bg-success/15 text-success border border-success/30 font-medium">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        ID: {selectedServer.id} • Last synced:{' '}
                        {selectedServer.lastSync
                          ? new Date(selectedServer.lastSync).toLocaleTimeString()
                          : 'Just now'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteServer(selectedServer)}
                        className="px-2.5 py-1 text-xs text-danger hover:bg-danger/10 rounded border border-danger/30 transition-colors"
                      >
                        Disconnect Server
                      </button>
                    </div>
                  </div>

                  {/* Config Details */}
                  <div className="p-3 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-text space-y-1">
                    {selectedServer.config?.['command'] ? (
                      <div>
                        <span className="text-text-muted">command: </span>
                        <span className="text-primary font-medium">
                          {selectedServer.config['command']}
                        </span>{' '}
                        <span className="text-text-secondary">
                          {Array.isArray(selectedServer.config['args'])
                            ? selectedServer.config['args'].join(' ')
                            : ''}
                        </span>
                      </div>
                    ) : selectedServer.config?.['url'] ? (
                      <div>
                        <span className="text-text-muted">url: </span>
                        <span className="text-primary font-medium">
                          {selectedServer.config['url']}
                        </span>
                      </div>
                    ) : (
                      <div className="text-text-muted">
                        Sovereign standard configuration active.
                      </div>
                    )}
                  </div>
                </div>

                {/* Discovered Protocol Tools Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text">Discovered Protocol Tools</h3>
                      <span className="text-xs text-text-muted">({serverTools.length})</span>
                    </div>
                    <span className="text-2xs text-text-muted">
                      Exposed as dynamic tools to Agent Orchestrator
                    </span>
                  </div>

                  {loadingTools ? (
                    <div className="py-8 text-center text-xs text-text-muted animate-pulse">
                      Querying MCP tools/list protocol...
                    </div>
                  ) : serverTools.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border bg-surface text-center space-y-2">
                      <p className="text-xs font-medium text-text">No tools discovered yet</p>
                      <p className="text-xs text-text-muted max-w-sm mx-auto">
                        This server is connected. Click &quot;Sync Bridge&quot; or &quot;Refresh
                        Tools&quot; above to discover and register its available tools.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSyncBridge(selectedServer)}
                        className="mt-2 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover"
                      >
                        Sync Bridge Now
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {serverTools.map((tool) => {
                        const isTestingThis = testingTool?.name === tool.name;
                        return (
                          <div
                            key={tool.name}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isTestingThis
                                ? 'bg-primary/5 border-primary/50 shadow-xs'
                                : 'bg-surface border-border hover:border-border-subtle hover:bg-surface-hover/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-text">
                                    {tool.name}
                                  </span>
                                  <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-surface-elevated text-text-secondary border border-border">
                                    connector.mcp.execute
                                  </span>
                                  {tool.readOnly ? (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-sans bg-success/15 text-success border border-success/30 font-medium">
                                      Read-Only
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-sans bg-warning/15 text-warning border border-warning/30 font-medium">
                                      Approval Gated
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed font-sans">
                                  {tool.description || 'No tool description provided by server.'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isTestingThis) {
                                    setTestingTool(null);
                                  } else {
                                    setTestingTool(tool);
                                    setTestArgsJson('{}');
                                    setTestResult(null);
                                    setTestError(null);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors shrink-0 ${
                                  isTestingThis
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text border border-border'
                                }`}
                              >
                                {isTestingThis ? 'Close Test' : 'Test Tool'}
                              </button>
                            </div>

                            {/* Interactive Test Runner Drawer */}
                            {isTestingThis && (
                              <div className="mt-4 pt-3 border-t border-border space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-text font-sans">
                                    Tool Execution Playground
                                  </span>
                                  <span className="text-2xs font-mono text-text-muted">
                                    POST /connectors/{selectedServer.id}/mcp/call
                                  </span>
                                </div>

                                <div>
                                  <label className="block text-2xs font-mono text-text-secondary mb-1">
                                    Arguments (JSON):
                                  </label>
                                  <textarea
                                    value={testArgsJson}
                                    onChange={(e) => setTestArgsJson(e.target.value)}
                                    rows={3}
                                    className="w-full p-2 rounded bg-surface-elevated border border-border font-mono text-xs text-text focus:outline-none focus:border-primary placeholder:text-text-muted"
                                    placeholder='{ "query": "test" }'
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleExecuteToolCall}
                                    disabled={testCalling}
                                    className="px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-primary-foreground font-medium text-xs flex items-center gap-1.5 shadow-xs"
                                  >
                                    {testCalling ? (
                                      <>
                                        <svg
                                          className="w-3 h-3 animate-spin"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                        >
                                          <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                          />
                                          <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                          />
                                        </svg>
                                        <span>Executing...</span>
                                      </>
                                    ) : (
                                      <span>Run Tool</span>
                                    )}
                                  </button>

                                  {testLatencyMs !== null && (
                                    <span className="text-2xs font-mono text-success">
                                      Latency: {testLatencyMs}ms
                                    </span>
                                  )}
                                </div>

                                {/* Results viewer */}
                                {testError && (
                                  <div className="p-2.5 rounded bg-danger/10 border border-danger/30 text-xs font-mono text-danger">
                                    Error: {testError}
                                  </div>
                                )}

                                {testResult && (
                                  <div>
                                    <label className="block text-2xs font-mono text-text-secondary mb-1">
                                      Result Output:
                                    </label>
                                    <pre className="p-2.5 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-48 overflow-auto">
                                      {JSON.stringify(testResult, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* mcp.json Raw Manifest Editor (Full Height) */
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-text">mcp.json</span>
                <span className="text-2xs font-mono text-text-muted">
                  (Claude Desktop / Cursor Compatible Manifest)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mcpConfigText);
                  toast({ tone: 'info', title: 'Copied mcp.json to clipboard' });
                }}
                className="text-xs text-text-secondary hover:text-text transition-colors"
              >
                Copy JSON
              </button>
            </div>

            {/* Editor with line numbers */}
            <div className="flex-1 flex overflow-hidden bg-surface font-mono text-xs">
              <div className="w-10 py-3 bg-surface-elevated border-r border-border text-right pr-2 text-text-muted select-none text-xs leading-5 shrink-0">
                {mcpConfigText.split('\n').map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>

              <textarea
                value={mcpConfigText}
                onChange={(e) => {
                  setMcpConfigText(e.target.value);
                  setIsEditorDirty(true);
                }}
                spellCheck={false}
                className="flex-1 p-3 bg-transparent text-text focus:outline-none resize-none leading-5 overflow-auto selection:bg-primary/20"
              />
            </div>
          </div>
        )}

        {/* Bottom Console Logs */}
        <div className="h-[200px] flex flex-col shrink-0 bg-surface border-t border-border">
          <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-sans font-semibold text-text">
                Console & Audit Logs
              </span>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="bg-surface border border-border rounded-md px-2 py-0.5 text-xs font-sans text-text focus:outline-none cursor-pointer"
              >
                <option value="all">All events</option>
                {installedServers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const exportText = filteredLogs
                    .map((l) => `[${l.timestamp}] ${l.level.toUpperCase()} > ${l.message}`)
                    .join('\n');
                  navigator.clipboard.writeText(exportText);
                  toast({ tone: 'info', title: 'Logs copied to clipboard' });
                }}
                className="px-2 py-0.5 text-xs text-text-secondary hover:text-text bg-surface-elevated hover:bg-surface-hover border border-border rounded transition-colors cursor-pointer"
              >
                Copy Logs
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="px-2 py-0.5 text-xs text-text-secondary hover:text-text bg-surface-elevated hover:bg-surface-hover border border-border rounded transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-5 space-y-1 bg-surface">
            {filteredLogs.length === 0 ? (
              <div className="text-text-muted italic text-xs">No activity logged yet.</div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 ${
                    log.level === 'error'
                      ? 'text-danger'
                      : log.level === 'success'
                        ? 'text-success'
                        : log.level === 'warn'
                          ? 'text-warning'
                          : 'text-text-secondary'
                  }`}
                >
                  <span className="text-text-muted select-none text-xs">[{log.timestamp}]</span>
                  <span className="text-text-muted select-none">&gt;</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
