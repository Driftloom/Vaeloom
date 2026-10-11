'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/shared/Toast';
import {
  capabilitiesApi,
  connectorsApi,
  type BuiltinMcpServer,
  type CapabilityItemRecord,
  type ConnectorItem,
  type McpToolInfo,
} from '@/lib/api-client';
import {
  applyMcpServersManifest,
  builtinCommandLine,
  buildMcpServersManifest,
  isStdioConfig,
  readProbeResult,
  readToolCallResult,
  slugify,
  type LogEntry,
  type ManifestOmission,
  type McpCatalogTemplate,
  type McpProbeResult,
} from './index';

let logSequence = 0;

export interface UseMcpServersOptions {
  workspaceId: string;
  searchQuery?: string;
}

export function useMcpServers({ workspaceId, searchQuery = '' }: UseMcpServersOptions) {
  const { toast } = useToast();

  const [installedServers, setInstalledServers] = useState<ConnectorItem[]>([]);
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  const [mcpCapabilityRows, setMcpCapabilityRows] = useState<CapabilityItemRecord[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const [serverTools, setServerTools] = useState<McpToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [syncingServerId, setSyncingServerId] = useState<string | null>(null);
  const [refreshingTools, setRefreshingTools] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'inspector' | 'manifest'>('inspector');

  const [mcpConfigText, setMcpConfigText] = useState('{\n  "mcpServers": {}\n}');
  const [manifestOmissions, setManifestOmissions] = useState<ManifestOmission[]>([]);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [logFilter, setLogFilter] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [installing, setInstalling] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<McpProbeResult | null>(null);

  const installedServersRef = useRef<ConnectorItem[]>([]);
  const isEditorDirtyRef = useRef(false);

  useEffect(() => {
    installedServersRef.current = installedServers;
  }, [installedServers]);

  useEffect(() => {
    isEditorDirtyRef.current = isEditorDirty;
  }, [isEditorDirty]);

  const addLog = useCallback((level: LogEntry['level'], message: string, server?: string) => {
    logSequence += 1;
    const entry: LogEntry = {
      id: `log-${logSequence}`,
      at: new Date().toISOString(),
      level,
      message,
      ...(server ? { server } : {}),
    };
    setLogs((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const serverNameFor = useCallback(
    (serverId: string): string =>
      installedServersRef.current.find((server) => server.id === serverId)?.name ?? serverId,
    [],
  );

  const loadWorkspaceServers = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingServers(true);
    setLoadError(null);
    try {
      const [listRes, builtinRes, capabilityRes] = await Promise.allSettled([
        connectorsApi.list(workspaceId, 'mcp'),
        connectorsApi.mcp.builtin(),
        capabilitiesApi.list('mcp', workspaceId),
      ]);

      const servers: ConnectorItem[] =
        listRes.status === 'fulfilled' && Array.isArray(listRes.value) ? listRes.value : [];
      setInstalledServers(servers);
      if (listRes.status !== 'fulfilled' || !Array.isArray(listRes.value)) {
        setLoadError(
          listRes.status === 'rejected' && listRes.reason instanceof Error
            ? listRes.reason.message
            : 'The server did not return a connector list.',
        );
      }

      if (builtinRes.status === 'fulfilled') {
        const builtins = builtinRes.value?.builtinServers ?? builtinRes.value?.builtin_servers;
        if (Array.isArray(builtins)) setBuiltinServers(builtins);
      }

      if (capabilityRes.status === 'fulfilled' && Array.isArray(capabilityRes.value)) {
        setMcpCapabilityRows(capabilityRes.value.filter((row) => row.category === 'mcp'));
      }

      setSelectedServerId((prev) => {
        if (prev && servers.some((server) => server.id === prev)) return prev;
        return servers[0]?.id ?? null;
      });

      if (!isEditorDirtyRef.current) {
        const built = buildMcpServersManifest(servers);
        setMcpConfigText(built.json);
        setManifestOmissions(built.omissions);
      }
    } finally {
      setLoadingServers(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadWorkspaceServers();
  }, [loadWorkspaceServers]);

  const selectedServer = useMemo(
    () => installedServers.find((server) => server.id === selectedServerId) ?? null,
    [installedServers, selectedServerId],
  );

  const probeCapabilityId = useMemo(() => {
    if (!selectedServer) return null;
    const target = slugify(selectedServer.name);
    const match = mcpCapabilityRows.find(
      (row) => row.category === 'mcp' && slugify(row.name) === target,
    );
    return match?.id ?? null;
  }, [mcpCapabilityRows, selectedServer]);

  const loadServerTools = useCallback(
    async (serverId: string, refresh = false) => {
      if (!serverId) return;
      if (refresh) setRefreshingTools(true);
      else setLoadingTools(true);

      const name = serverNameFor(serverId);
      try {
        const tools = refresh
          ? await connectorsApi.mcp.refreshTools(serverId)
          : await connectorsApi.mcp.listTools(serverId);
        const discovered = Array.isArray(tools) ? tools : [];
        setServerTools(discovered);
        addLog('info', `Server '${name}' listed ${discovered.length} tool(s).`, name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not query MCP tools';
        addLog('warn', `tools/list failed for '${name}': ${msg}`, name);
        setServerTools([]);
      } finally {
        setLoadingTools(false);
        setRefreshingTools(false);
      }
    },
    [addLog, serverNameFor],
  );

  useEffect(() => {
    setProbeResult(null);
    if (selectedServerId) {
      void loadServerTools(selectedServerId);
    } else {
      setServerTools([]);
    }
  }, [selectedServerId, loadServerTools]);

  const handleSyncBridge = useCallback(
    async (server: ConnectorItem) => {
      setSyncingServerId(server.id);
      try {
        const res = await connectorsApi.mcp.sync(server.id, workspaceId);
        const bridged = res?.registered?.length ?? 0;
        addLog(
          'success',
          `Bridge sync registered ${bridged} tool(s) for '${server.name}'.`,
          server.name,
        );
        toast({
          tone: 'success',
          title: 'MCP Bridge Synchronized',
          detail: `Registered ${bridged} tool(s) for autonomous agent execution.`,
        });
        await loadServerTools(server.id, true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        addLog('error', `Bridge sync failed for '${server.name}': ${msg}`, server.name);
        toast({ tone: 'error', title: 'Bridge Sync Failed', detail: msg });
      } finally {
        setSyncingServerId(null);
      }
    },
    [addLog, loadServerTools, toast, workspaceId],
  );

  const handleInstall = useCallback(
    async (
      pending:
        | { kind: 'builtin'; server: BuiltinMcpServer }
        | { kind: 'template'; template: McpCatalogTemplate },
    ) => {
      setInstalling(true);
      const isBuiltin = pending.kind === 'builtin';
      const name = isBuiltin ? pending.server.name : pending.template.name;
      const config = isBuiltin ? pending.server.config : pending.template.defaultConfig;

      addLog('info', `Creating MCP connector '${name}' in this workspace.`, name);
      try {
        const created = await connectorsApi.create({
          name,
          type: 'mcp',
          workspace_id: workspaceId,
          config,
        });

        let bridged: number | null = null;
        let syncFailure: string | null = null;
        try {
          const res = await connectorsApi.mcp.sync(created.id, workspaceId);
          bridged = res?.registered?.length ?? 0;
          addLog('success', `'${name}' bridged ${bridged} tool(s).`, name);
        } catch (err) {
          syncFailure = err instanceof Error ? err.message : 'The bridge sync request failed.';
          addLog('error', `'${name}' was created but the bridge sync failed: ${syncFailure}`, name);
        }

        await loadWorkspaceServers();
        setSelectedServerId(created.id);

        if (syncFailure) {
          toast({
            tone: 'warning',
            title: `${name} created, not bridged`,
            detail: `The connector row exists but tool registration failed: ${syncFailure}`,
          });
        } else {
          toast({
            tone: 'success',
            title: `${name} created`,
            detail: `Registered in this workspace${bridged === null ? '' : ` with ${bridged} bridged tool(s)`}.`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not create the connector.';
        addLog('error', `Creating '${name}' failed: ${msg}`, name);
        toast({ tone: 'error', title: 'Install Failed', detail: msg });
      } finally {
        setInstalling(false);
      }
    },
    [addLog, loadWorkspaceServers, toast, workspaceId],
  );

  const handleDeleteServer = useCallback(
    async (server: ConnectorItem) => {
      try {
        await connectorsApi.delete(server.id);
        addLog('warn', `Removed MCP server '${server.name}' from this workspace.`, server.name);
        toast({
          tone: 'info',
          title: 'Server Removed',
          detail: `${server.name} is no longer registered in this workspace.`,
        });
        await loadWorkspaceServers();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not delete server';
        addLog('error', `Removing '${server.name}' failed: ${msg}`, server.name);
        toast({ tone: 'error', title: 'Deletion Failed', detail: msg });
      }
    },
    [addLog, loadWorkspaceServers, toast],
  );

  const handleTogglePauseServer = useCallback(
    async (server: ConnectorItem) => {
      const nextStatus = server.status === 'paused' ? 'active' : 'paused';
      try {
        await connectorsApi.update(server.id, { status: nextStatus });
        addLog('info', `Server '${server.name}' status updated to '${nextStatus}'.`, server.name);
        toast({
          tone: 'info',
          title: `Server ${nextStatus === 'paused' ? 'Paused' : 'Resumed'}`,
          detail: `${server.name} is now ${nextStatus}.`,
        });
        await loadWorkspaceServers();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Status update failed';
        toast({ tone: 'error', title: 'Update Failed', detail: msg });
      }
    },
    [addLog, loadWorkspaceServers, toast],
  );

  const handleProbe = useCallback(async () => {
    if (!probeCapabilityId) return;
    setProbing(true);
    setProbeResult(null);
    const name = selectedServer?.name ?? 'this server';
    try {
      const raw: unknown = await capabilitiesApi.testCapability(probeCapabilityId);
      const parsed = readProbeResult(raw);
      setProbeResult(parsed);
      addLog(
        parsed.status === 'connected' ? 'success' : parsed.status === 'skipped' ? 'info' : 'error',
        `Probe of '${name}' reported '${parsed.status}' (executed=${String(parsed.executed)}).`,
        name,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'The probe request failed.';
      setProbeResult({
        status: 'request_failed',
        executed: false,
        latencyMs: null,
        detail: null,
        error: msg,
        transport: null,
        tools: [],
        toolsCount: null,
      });
      addLog('error', `Probe request for '${name}' failed: ${msg}`, name);
    } finally {
      setProbing(false);
    }
  }, [addLog, probeCapabilityId, selectedServer]);

  const handleExecuteToolCall = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      if (!selectedServer) throw new Error('No server selected');
      addLog('info', `Calling '${toolName}' on '${selectedServer.name}'.`, selectedServer.name);
      const startedAt = performance.now();
      try {
        const raw = await connectorsApi.mcp.call(selectedServer.id, toolName, args);
        const parsed = readToolCallResult(raw);
        const latencyMs = Math.round(performance.now() - startedAt);
        if (parsed.isError) {
          addLog('error', `'${toolName}' returned an MCP error result.`, selectedServer.name);
        } else {
          addLog(
            'success',
            `'${toolName}' returned in ${latencyMs}ms (measured in this browser).`,
            selectedServer.name,
          );
        }
        return { result: parsed, latencyMs };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Execution failed';
        addLog('error', `'${toolName}' failed: ${msg}`, selectedServer.name);
        throw err;
      }
    },
    [addLog, selectedServer],
  );

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true);
    try {
      const outcome = await applyMcpServersManifest(
        mcpConfigText,
        workspaceId,
        installedServers,
        addLog,
      );
      if (outcome.kind === 'validation_error' || outcome.kind === 'write_failure') {
        toast({ tone: 'error', title: outcome.title, detail: outcome.detail });
      } else {
        setIsEditorDirty(false);
        await loadWorkspaceServers();
        if (outcome.syncFailures.length > 0) {
          toast({ tone: 'warning', title: outcome.title, detail: outcome.detail });
        } else {
          toast({ tone: 'success', title: outcome.title, detail: outcome.detail });
        }
      }
    } finally {
      setSavingConfig(false);
    }
  }, [addLog, installedServers, loadWorkspaceServers, mcpConfigText, toast, workspaceId]);

  const handleFormatConfig = useCallback(() => {
    try {
      const parsed = JSON.parse(mcpConfigText);
      setMcpConfigText(JSON.stringify(parsed, null, 2));
      toast({ tone: 'info', title: 'Formatted mcp.json' });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Cannot format: Invalid JSON syntax',
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  }, [mcpConfigText, toast]);

  const effectiveQuery = searchQuery.trim().toLowerCase();

  const filteredInstalled = useMemo(() => {
    if (!effectiveQuery) return installedServers;
    return installedServers.filter(
      (s) =>
        s.name.toLowerCase().includes(effectiveQuery) ||
        String(s.config?.['command'] ?? '')
          .toLowerCase()
          .includes(effectiveQuery) ||
        String(s.config?.['url'] ?? '')
          .toLowerCase()
          .includes(effectiveQuery),
    );
  }, [installedServers, effectiveQuery]);

  const installedNames = useMemo(
    () => new Set(installedServers.map((s) => s.name.toLowerCase())),
    [installedServers],
  );

  const installedCommands = useMemo(
    () =>
      new Set(
        installedServers
          .filter((s) => isStdioConfig(s.config))
          .map((s) => builtinCommandLine({ config: s.config } as BuiltinMcpServer)),
      ),
    [installedServers],
  );

  const paneTitle = useMemo(() => {
    if (activeSubTab === 'manifest') return 'mcp.json manifest';
    if (selectedServer) return selectedServer.name;
    return 'Model Context Protocol (MCP v2) Runtime';
  }, [activeSubTab, selectedServer]);

  return {
    installedServers,
    builtinServers,
    loadingServers,
    loadError,
    selectedServerId,
    setSelectedServerId,
    selectedServer,
    probeCapabilityId,
    serverTools,
    loadingTools,
    syncingServerId,
    refreshingTools,
    activeSubTab,
    setActiveSubTab,
    mcpConfigText,
    setMcpConfigText,
    manifestOmissions,
    isEditorDirty,
    setIsEditorDirty,
    savingConfig,
    logFilter,
    setLogFilter,
    logs,
    setLogs,
    installing,
    probing,
    probeResult,
    filteredInstalled,
    installedNames,
    installedCommands,
    paneTitle,
    loadServerTools,
    handleSyncBridge,
    handleInstall,
    handleDeleteServer,
    handleTogglePauseServer,
    handleProbe,
    handleExecuteToolCall,
    handleSaveConfig,
    handleFormatConfig,
  };
}
