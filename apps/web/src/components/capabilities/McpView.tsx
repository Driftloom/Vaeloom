'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConfirmationDialog,
  EmptyState,
  IconButton,
  Spinner,
  StatusDot,
  Tooltip,
} from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import { formatRelativeTime } from '@/lib/capabilities-data';
import {
  capabilitiesApi,
  connectorsApi,
  type BuiltinMcpServer,
  type CapabilityItemRecord,
  type ConnectorItem,
  type McpToolInfo,
} from '@/lib/api-client';

interface McpViewProps {
  workspaceId: string;
  searchQuery?: string;
  onOpenCreateServer: () => void;
  onOpenImport: () => void;
}

// ─── Community MCP templates ────────────────────────────────────────────────
//
// Every entry here runs THIRD-PARTY code on the machine, so none of them may be
// presented as an official one-click install. The confirmation step names the
// exact argv that will be executed before anything is written.
//
// Nothing in this list carries a credential. The previous table baked
// `env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' }` and similar, which
// meant a literal `${...}` string could be persisted into a workspace row and
// then into a manifest; a real token is never held here, so the credential is a
// documented follow-up step instead of a fake value.

export interface McpCatalogTemplate {
  id: string;
  name: string;
  transports: ('stdio' | 'http')[];
  authType?: string;
  category: string;
  description: string;
  /** True when installing this pulls the package from the npm registry. */
  installsFromNpm: boolean;
  /** What the operator has to do afterwards. Never a value Vaeloom can supply. */
  credentialNote?: string;
  defaultConfig: {
    transport: 'stdio' | 'http';
    command?: string;
    args?: string[];
  };
}

const MCP_CATALOG_TEMPLATES: McpCatalogTemplate[] = [
  {
    id: 'filesystem',
    name: 'Local Filesystem MCP',
    transports: ['stdio'],
    category: 'Filesystem',
    description:
      'Community reference server that reads and writes a directory you name. Vaeloom has not audited its code.',
    installsFromNpm: true,
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './data'],
    },
  },
  {
    id: 'github',
    name: 'GitHub MCP Server',
    transports: ['stdio'],
    authType: 'Personal access token',
    category: 'Developer',
    description:
      'Community reference server for repositories, pull requests and code search. Vaeloom has not audited its code.',
    installsFromNpm: true,
    credentialNote:
      'Needs a token in GITHUB_PERSONAL_ACCESS_TOKEN. The connector is created without one; add it in mcp.json after you create the token, or the subprocess starts with no credentials.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
  },
  {
    id: 'brave-search',
    name: 'Brave Search MCP',
    transports: ['stdio'],
    authType: 'API key',
    category: 'Web Search',
    description:
      'Community reference server for web and news search. Vaeloom has not audited its code.',
    installsFromNpm: true,
    credentialNote:
      'Needs a key in BRAVE_API_KEY. The connector is created without one; add it in mcp.json before the subprocess can search.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
  },
  {
    id: 'slack',
    name: 'Slack MCP Server',
    transports: ['stdio'],
    authType: 'Bot token',
    category: 'Communication',
    description:
      'Community reference server for channel history and posting. Vaeloom has not audited its code.',
    installsFromNpm: true,
    credentialNote:
      'Needs a bot token in SLACK_BOT_TOKEN. The connector is created without one; add it in mcp.json before the subprocess can post.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
    },
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer Browser Scraper',
    transports: ['stdio'],
    category: 'Automation',
    description:
      'Community reference server that drives headless Chromium. It executes JavaScript from the pages it visits.',
    installsFromNpm: true,
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
  },
  {
    id: 'memory',
    name: 'Memory Graph MCP',
    transports: ['stdio'],
    category: 'Memory',
    description:
      'Community reference server holding a local entity/relationship graph. It writes to a file you choose.',
    installsFromNpm: true,
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  },
];

/** The exact argv a stdio template will run, for the trust prompt. */
function templateCommandLine(template: McpCatalogTemplate): string {
  return [template.defaultConfig.command ?? '', ...(template.defaultConfig.args ?? [])]
    .filter(Boolean)
    .join(' ');
}

/** The exact argv a built-in definition will run, as the server reported it. */
function builtinCommandLine(server: BuiltinMcpServer): string {
  const cfg = (server.config ?? {}) as Record<string, unknown>;
  const command = typeof cfg['command'] === 'string' ? cfg['command'] : '';
  const args = Array.isArray(cfg['args']) ? cfg['args'].map((a) => String(a)) : [];
  return [command, ...args].filter(Boolean).join(' ');
}

// ─── Typed readers for open payloads ─────────────────────────────────────────

/**
 * `POST /connectors/{id}/mcp/call` returns a fixed shape, but the client types it
 * as `any` because the MCP content array is pass-through. Coerced here so the
 * playground renders declared fields instead of a `JSON.stringify` of whatever
 * arrived.
 */
interface McpToolCallResult {
  tool: string | null;
  text: string | null;
  isError: boolean;
  structured: unknown;
  structuredTruncated: boolean;
}

function readToolCallResult(raw: unknown): McpToolCallResult {
  if (raw === null || typeof raw !== 'object') {
    return {
      tool: null,
      text: null,
      isError: false,
      structured: undefined,
      structuredTruncated: false,
    };
  }
  const src = raw as Record<string, unknown>;
  return {
    tool: typeof src['tool'] === 'string' ? src['tool'] : null,
    text: typeof src['text'] === 'string' ? src['text'] : null,
    isError: src['isError'] === true,
    structured: src['structured'],
    structuredTruncated: src['structuredTruncated'] === true,
  };
}

/**
 * `POST /capabilities/{id}/test` for a category of `mcp`.
 *
 * The client type pins `status` to `success | warning | error`, but the MCP branch
 * of the handler returns the probe vocabulary (`connected`, `skipped`, `timeout`,
 * `error`). Read the body as open data rather than widening a shared type, and
 * render only what the response actually carries.
 */
interface McpProbeResult {
  status: string;
  executed: boolean;
  latencyMs: number | null;
  detail: string | null;
  error: string | null;
  transport: string | null;
  tools: string[];
  toolsCount: number | null;
}

function readProbeResult(raw: unknown): McpProbeResult {
  const base: McpProbeResult = {
    status: 'unknown',
    executed: false,
    latencyMs: null,
    detail: null,
    error: null,
    transport: null,
    tools: [],
    toolsCount: null,
  };
  if (raw === null || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  const output =
    src['output'] !== null && typeof src['output'] === 'object'
      ? (src['output'] as Record<string, unknown>)
      : {};
  const tools = Array.isArray(output['tools'])
    ? output['tools'].filter((name): name is string => typeof name === 'string')
    : [];
  const toolsCount =
    typeof output['toolsCount'] === 'number'
      ? output['toolsCount']
      : typeof output['tools_count'] === 'number'
        ? output['tools_count']
        : tools.length > 0
          ? tools.length
          : null;

  return {
    status: typeof src['status'] === 'string' ? src['status'] : 'unknown',
    executed: src['executed'] === true,
    latencyMs: typeof src['latencyMs'] === 'number' ? src['latencyMs'] : null,
    detail: typeof output['detail'] === 'string' ? output['detail'] : null,
    error: typeof src['error'] === 'string' ? src['error'] : null,
    transport: typeof output['transport'] === 'string' ? output['transport'] : null,
    tools,
    toolsCount,
  };
}

// ─── Manifest helpers ────────────────────────────────────────────────────────

/** Unsubstituted `${...}` template syntax. A real value never contains it. */
const TEMPLATE_PLACEHOLDER = /\$\{[^}]*\}/;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

interface ManifestOmission {
  key: string;
  reason: string;
}

/**
 * First `${...}` occurrence in a value tree, as a dotted path.
 *
 * Persisting one of these writes a literal placeholder into the database and then
 * into every generated manifest, where it looks like a working credential to the
 * next reader and authenticates as nothing at all.
 */
function findPlaceholder(value: unknown, path = 'value'): string | null {
  if (typeof value === 'string') return TEMPLATE_PLACEHOLDER.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findPlaceholder(value[index], `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const hit = findPlaceholder(nested, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

interface BuiltManifest {
  json: string;
  omissions: ManifestOmission[];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Build an `mcpServers` manifest from the connectors this workspace really has.
 *
 * Every value here is copied from a stored row. A server with neither a command
 * nor a URL is omitted rather than given a substitute: the previous
 * `cfg['url'] || cfg['base_url'] || 'https://api.example.com/mcp'` wrote a
 * documentation URL into a real workspace manifest, and `command: 'npx'` silently
 * launched a different program than the operator registered.
 *
 * Credentials are never exported. A token lives in the connector row, not in a
 * file meant to be shared with Claude Desktop, so the header is left out and the
 * omission is reported.
 */
function buildMcpServersManifest(servers: ConnectorItem[]): BuiltManifest {
  const mcpServers: Record<string, unknown> = {};
  const omissions: ManifestOmission[] = [];

  for (const server of servers) {
    const cfg = (server.config ?? {}) as Record<string, unknown>;
    const key = slugify(server.name);
    if (!key) continue;

    const command = nonEmptyString(cfg['command']);
    const url = nonEmptyString(cfg['url']) ?? nonEmptyString(cfg['base_url']);
    const entry: Record<string, unknown> = {};

    if (command) {
      entry['command'] = command;
      entry['args'] = Array.isArray(cfg['args']) ? cfg['args'] : [];
    } else if (url) {
      entry['url'] = url;
    } else {
      omissions.push({
        key,
        reason: 'no command or URL is configured, so there is nothing to point a client at',
      });
      continue;
    }

    if (cfg['auth_token'] !== undefined && cfg['auth_token'] !== null && cfg['auth_token'] !== '') {
      omissions.push({
        key,
        reason: 'it holds a stored token, which is not written to a shareable manifest',
      });
    }

    mcpServers[key] = entry;
  }

  return {
    json: JSON.stringify({ mcpServers }, null, 2),
    omissions,
  };
}

// ─── Status vocabulary ───────────────────────────────────────────────────────

type ServerDotStatus = 'active' | 'idle' | 'warning' | 'error' | 'disabled';

const SERVER_STATUS_META: Record<ConnectorItem['status'], { dot: ServerDotStatus; label: string }> =
  {
    active: { dot: 'active', label: 'active' },
    syncing: { dot: 'warning', label: 'syncing' },
    // Paused is an operator choice, not a failure. Painting it with the error colour
    // is what made a deliberately idle server look broken.
    paused: { dot: 'disabled', label: 'paused' },
    error: { dot: 'error', label: 'error' },
  };

function isStdioConfig(config: Record<string, unknown> | undefined): boolean {
  if (!config) return false;
  return config['transport'] === 'stdio' || typeof config['command'] === 'string';
}

// ─── Session activity log ────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  /** ISO 8601. A locale clock string is not sortable and not parseable downstream. */
  at: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  server?: string;
}

let logSequence = 0;

// ─── Component ───────────────────────────────────────────────────────────────

export const McpView: React.FC<McpViewProps> = ({
  workspaceId,
  searchQuery = '',
  onOpenCreateServer,
  onOpenImport,
}) => {
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

  const [testingTool, setTestingTool] = useState<McpToolInfo | null>(null);
  const [testArgsJson, setTestArgsJson] = useState('{}');
  const [testCalling, setTestCalling] = useState(false);
  const [testResult, setTestResult] = useState<McpToolCallResult | null>(null);
  const [testLatencyMs, setTestLatencyMs] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [mcpConfigText, setMcpConfigText] = useState('{\n  "mcpServers": {}\n}');
  const [manifestOmissions, setManifestOmissions] = useState<ManifestOmission[]>([]);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [logFilter, setLogFilter] = useState('all');
  // No seeded entry. A pre-filled "client initialized" line in a panel a reader
  // will take for an audit trail is fabricated history; the panel now records
  // only what happened in this tab.
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [pendingDelete, setPendingDelete] = useState<ConnectorItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingInstall, setPendingInstall] = useState<
    | { kind: 'builtin'; server: BuiltinMcpServer }
    | { kind: 'template'; template: McpCatalogTemplate }
    | null
  >(null);
  const [installing, setInstalling] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

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
        const servers = builtinRes.value?.builtinServers ?? builtinRes.value?.builtin_servers;
        if (Array.isArray(servers)) setBuiltinServers(servers);
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

  /**
   * The probe reads a workspace capability row, not a connector row, so the
   * selected server has to have a same-named `category: 'mcp'` capability for the
   * endpoint to have anything to probe. When it does not, the UI says so instead
   * of running a request that would 404.
   */
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
    setTestingTool(null);
    setTestResult(null);
    setTestError(null);
    setTestLatencyMs(null);
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
        const bridged = res?.bridged_total ?? res?.registered?.length ?? 0;
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
        toast({
          tone: 'error',
          title: 'Bridge Sync Failed',
          detail: msg,
        });
      } finally {
        setSyncingServerId(null);
      }
    },
    [addLog, loadServerTools, toast, workspaceId],
  );

  const confirmInstall = useCallback(async () => {
    if (!pendingInstall) return;
    setInstalling(true);
    const isBuiltin = pendingInstall.kind === 'builtin';
    const name = isBuiltin ? pendingInstall.server.name : pendingInstall.template.name;
    const setId = isBuiltin ? pendingInstall.server.id : pendingInstall.template.id;
    const config = isBuiltin ? pendingInstall.server.config : pendingInstall.template.defaultConfig;

    addLog('info', `Creating MCP connector '${name}' in this workspace.`, name);
    try {
      const created = await connectorsApi.create({
        name,
        type: 'mcp',
        workspace_id: workspaceId,
        config,
      });

      // A failed bridge is reported, never swallowed: the row exists, so telling
      // the user it was "configured and bridged" when nothing was registered is
      // the exact failure this replaces.
      let bridged: number | null = null;
      let syncFailure: string | null = null;
      try {
        const res = await connectorsApi.mcp.sync(created.id, workspaceId);
        bridged = res?.bridged_total ?? res?.registered?.length ?? 0;
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
      setPendingInstall(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create the connector.';
      addLog('error', `Creating '${name}' failed: ${msg}`, name);
      toast({ tone: 'error', title: 'Install Failed', detail: msg });
    } finally {
      setInstalling(false);
      setInstallingId(null);
    }
  }, [addLog, loadWorkspaceServers, pendingInstall, toast, workspaceId]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const server = pendingDelete;
    try {
      await connectorsApi.delete(server.id);
      addLog('warn', `Removed MCP server '${server.name}' from this workspace.`, server.name);
      toast({
        tone: 'info',
        title: 'Server Removed',
        detail: `${server.name} is no longer registered in this workspace.`,
      });
      setPendingDelete(null);
      await loadWorkspaceServers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete server';
      addLog('error', `Removing '${server.name}' failed: ${msg}`, server.name);
      toast({ tone: 'error', title: 'Deletion Failed', detail: msg });
    } finally {
      setDeleting(false);
    }
  }, [addLog, loadWorkspaceServers, pendingDelete, toast]);

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

  /**
   * Apply an `mcpServers` manifest.
   *
   * The failure taxonomy is explicit, because the previous version reported every
   * failure as "Syntax Error in mcp.json": a mid-loop 502 was described to the
   * user as a JSON parse problem. Parse, validation, write and bridge are four
   * separate outcomes with four separate messages, and a partial write is rolled
   * back rather than left half applied.
   */
  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true);

    let parsed: unknown;
    try {
      parsed = JSON.parse(mcpConfigText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      toast({ tone: 'error', title: 'Syntax Error in mcp.json', detail: msg });
      setSavingConfig(false);
      return;
    }

    if (parsed === null || typeof parsed !== 'object') {
      toast({
        tone: 'error',
        title: 'mcp.json is not an object',
        detail: 'The top level of the file must be a JSON object with an "mcpServers" key.',
      });
      setSavingConfig(false);
      return;
    }

    const rawServers = (parsed as Record<string, unknown>)['mcpServers'];
    if (rawServers === null || typeof rawServers !== 'object' || Array.isArray(rawServers)) {
      toast({
        tone: 'error',
        title: 'mcp.json has no mcpServers object',
        detail: 'Expected {"mcpServers": { "<name>": { ... } }}.',
      });
      setSavingConfig(false);
      return;
    }

    const entries = Object.entries(rawServers as Record<string, unknown>);
    if (entries.length === 0) {
      toast({
        tone: 'warning',
        title: 'Empty Configuration',
        detail: 'No servers found under "mcpServers".',
      });
      setSavingConfig(false);
      return;
    }

    interface WriteOp {
      key: string;
      config: Record<string, unknown>;
      existingId: string | null;
    }

    const ops: WriteOp[] = [];
    for (const [key, value] of entries) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        toast({
          tone: 'error',
          title: `mcp.json entry "${key}" is not an object`,
          detail: 'Each server must be a JSON object with "command"/"args" or "url".',
        });
        setSavingConfig(false);
        return;
      }

      const def = value as Record<string, unknown>;
      const placeholder = findPlaceholder(def, key);
      if (placeholder) {
        toast({
          tone: 'error',
          title: 'Unresolved ${...} placeholder',
          detail: `"${placeholder}" still contains a template placeholder. Substitute the real value before applying, or remove the field.`,
        });
        setSavingConfig(false);
        return;
      }

      const command = nonEmptyString(def['command']);
      const url = nonEmptyString(def['url']);
      if (!command && !url) {
        toast({
          tone: 'error',
          title: `mcp.json entry "${key}" has no endpoint`,
          detail:
            'Provide "command" (stdio) or "url" (streamable HTTP). No URL was invented for you.',
        });
        setSavingConfig(false);
        return;
      }

      const config: Record<string, unknown> = { transport: command ? 'stdio' : 'http' };
      if (command) {
        config['command'] = command;
        config['args'] = Array.isArray(def['args']) ? def['args'] : [];
      } else {
        config['url'] = url;
      }
      if (def['env'] !== undefined) config['env'] = def['env'];
      if (def['headers'] !== undefined) config['headers'] = def['headers'];

      const existing = installedServers.find(
        (server) => server.id === key || slugify(server.name) === slugify(key),
      );
      ops.push({ key, config, existingId: existing?.id ?? null });
    }

    // Concurrent writes with an all-or-report outcome. A sequential loop that
    // throws on entry 3 of 5 leaves entries 1 and 2 committed and reports a
    // syntax error for a request that parsed fine.
    const createdIds: string[] = [];
    const results = await Promise.allSettled(
      ops.map(async (op) => {
        if (op.existingId) {
          const updated = await connectorsApi.update(op.existingId, {
            name: op.key,
            config: op.config,
          });
          return { key: op.key, id: updated?.id ?? op.existingId, created: false };
        }
        const created = await connectorsApi.create({
          name: op.key,
          type: 'mcp',
          workspace_id: workspaceId,
          config: op.config,
        });
        createdIds.push(created.id);
        return { key: op.key, id: created.id, created: true };
      }),
    );

    const writeFailures: string[] = [];
    const succeeded: Array<{ key: string; id: string }> = [];
    results.forEach((result, index) => {
      const op = ops[index];
      if (!op) return;
      if (result.status === 'fulfilled') {
        succeeded.push({ key: result.value.key, id: result.value.id });
        return;
      }
      const reason = result.reason;
      writeFailures.push(
        `${op.key}: ${reason instanceof Error ? reason.message : 'the write was rejected'}`,
      );
    });

    if (writeFailures.length > 0) {
      // Compensate: remove the rows this run created so the workspace is not left
      // holding half a manifest.
      let rolledBack = 0;
      await Promise.allSettled(createdIds.map((id) => connectorsApi.delete(id))).then(
        (outcomes) => {
          rolledBack = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
        },
      );

      addLog('error', `mcp.json not applied: ${writeFailures.length} write(s) failed.`);
      toast({
        tone: 'error',
        title: 'mcp.json was not applied',
        detail:
          `${writeFailures.length} of ${results.length} server(s) could not be written (${writeFailures[0]})` +
          (createdIds.length > 0
            ? ` ${rolledBack} newly created row(s) were rolled back.`
            : ' Nothing was created, so nothing was rolled back.'),
      });
      setSavingConfig(false);
      return;
    }

    const syncFailures: string[] = [];
    await Promise.allSettled(
      succeeded.map(async ({ key, id }) => {
        const res = await connectorsApi.mcp.sync(id, workspaceId);
        const bridged = res?.bridged_total ?? res?.registered?.length ?? 0;
        addLog('success', `'${key}' written and ${bridged} tool(s) bridged.`, key);
      }),
    ).then((outcomes) => {
      outcomes.forEach((outcome, index) => {
        if (outcome.status !== 'rejected') return;
        const key = succeeded[index]?.key ?? 'server';
        const reason = outcome.reason;
        syncFailures.push(
          `${key}: ${reason instanceof Error ? reason.message : 'the bridge sync was rejected'}`,
        );
      });
    });

    setIsEditorDirty(false);
    await loadWorkspaceServers();

    const created = succeeded.length;
    if (syncFailures.length > 0) {
      addLog(
        'warn',
        `mcp.json written for ${created} server(s); ${syncFailures.length} bridge sync(s) failed.`,
      );
      toast({
        tone: 'warning',
        title: 'mcp.json written, bridges incomplete',
        detail: `${created} server(s) saved. ${syncFailures.length} bridge sync(s) failed: ${syncFailures[0]}`,
      });
    } else {
      addLog('success', `mcp.json applied: ${created} server(s) written and bridged.`);
      toast({
        tone: 'success',
        title: 'mcp.json Applied',
        detail: `${created} MCP server(s) written and bridged in this workspace.`,
      });
    }
    setSavingConfig(false);
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
        ...(err instanceof Error ? { detail: err.message } : {}),
      });
    }
  }, [mcpConfigText, toast]);

  const handleExecuteToolCall = useCallback(async () => {
    if (!selectedServer || !testingTool) return;
    setTestCalling(true);
    setTestError(null);
    setTestResult(null);
    const startedAt = performance.now();

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgsJson || '{}') as Record<string, unknown>;
    } catch {
      setTestError('Arguments must be a valid JSON object.');
      setTestCalling(false);
      return;
    }

    addLog(
      'info',
      `Calling '${testingTool.name}' on '${selectedServer.name}'.`,
      selectedServer.name,
    );

    try {
      const raw: unknown = await connectorsApi.mcp.call(selectedServer.id, testingTool.name, args);
      const parsed = readToolCallResult(raw);
      setTestLatencyMs(Math.round(performance.now() - startedAt));
      setTestResult(parsed);
      if (parsed.isError) {
        addLog('error', `'${testingTool.name}' returned an MCP error result.`, selectedServer.name);
      } else {
        addLog(
          'success',
          `'${testingTool.name}' returned in ${Math.round(performance.now() - startedAt)}ms (measured in this browser).`,
          selectedServer.name,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setTestError(msg);
      addLog('error', `'${testingTool.name}' failed: ${msg}`, selectedServer.name);
    } finally {
      setTestCalling(false);
    }
  }, [addLog, selectedServer, testArgsJson, testingTool]);

  const effectiveQuery = searchQuery.trim().toLowerCase();

  const filteredInstalled = useMemo(() => {
    if (!effectiveQuery) return installedServers;
    return installedServers.filter(
      (server) =>
        server.name.toLowerCase().includes(effectiveQuery) ||
        String(server.config?.['command'] ?? '')
          .toLowerCase()
          .includes(effectiveQuery) ||
        String(server.config?.['url'] ?? '')
          .toLowerCase()
          .includes(effectiveQuery),
    );
  }, [installedServers, effectiveQuery]);

  const installedNames = useMemo(
    () => new Set(installedServers.map((server) => server.name.toLowerCase())),
    [installedServers],
  );

  const installedCommands = useMemo(
    () =>
      new Set(
        installedServers
          .filter((server) => isStdioConfig(server.config))
          .map((server) => builtinCommandLine({ config: server.config } as BuiltinMcpServer)),
      ),
    [installedServers],
  );

  const filteredBuiltins = useMemo(() => {
    if (!effectiveQuery) return builtinServers;
    return builtinServers.filter(
      (server) =>
        server.name.toLowerCase().includes(effectiveQuery) ||
        server.description.toLowerCase().includes(effectiveQuery) ||
        server.id.toLowerCase().includes(effectiveQuery),
    );
  }, [builtinServers, effectiveQuery]);

  const filteredTemplates = useMemo(() => {
    if (!effectiveQuery) return MCP_CATALOG_TEMPLATES;
    return MCP_CATALOG_TEMPLATES.filter(
      (template) =>
        template.name.toLowerCase().includes(effectiveQuery) ||
        template.description.toLowerCase().includes(effectiveQuery) ||
        template.category.toLowerCase().includes(effectiveQuery),
    );
  }, [effectiveQuery]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((entry) => entry.server?.toLowerCase() === logFilter.toLowerCase());
  }, [logFilter, logs]);

  const paneTitle = useMemo(() => {
    if (activeSubTab === 'manifest') return 'mcp.json manifest';
    if (selectedServer) return selectedServer.name;
    return 'Model Context Protocol (MCP v2) Runtime';
  }, [activeSubTab, selectedServer]);

  const probeStatusTone: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    connected: 'success',
    skipped: 'warning',
    timeout: 'error',
    error: 'error',
    request_failed: 'error',
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      {/* ── Left column: installed servers + catalogs ─────────────────────────── */}
      <div className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0">
        <div className="border-b border-border flex flex-col shrink-0">
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-text font-sans tracking-tight flex items-center gap-2">
              Servers
              <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-surface-elevated text-text-secondary border border-border">
                {installedServers.length}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={onOpenImport}>
              Import
            </Button>
          </div>

          <div className="p-3 space-y-2 max-h-[260px] overflow-y-auto">
            {loadingServers ? (
              <div
                role="status"
                aria-label="Loading MCP servers"
                className="py-4 flex items-center justify-center gap-2 text-xs text-text-muted"
              >
                <Spinner size="sm" />
                <span>Loading workspace servers...</span>
              </div>
            ) : filteredInstalled.length === 0 ? (
              <EmptyState
                title={
                  installedServers.length === 0 ? 'No MCP servers connected' : 'No servers match'
                }
                description={
                  installedServers.length === 0
                    ? 'Add a built-in server from the catalog below, or register a custom one.'
                    : 'Clear the search to see every server in this workspace.'
                }
                action={{ label: 'New server', onClick: onOpenCreateServer }}
              />
            ) : (
              filteredInstalled.map((server) => {
                const isSelected = selectedServerId === server.id;
                const isStdio = isStdioConfig(server.config);
                const status = SERVER_STATUS_META[server.status] ?? SERVER_STATUS_META.error;
                const isSyncing = syncingServerId === server.id;
                return (
                  <div
                    key={server.id}
                    className={`group flex items-center justify-between gap-2 p-1.5 pl-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40'
                        : 'bg-surface-elevated border-border hover:border-border-subtle hover:bg-surface-hover'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServerId(server.id);
                        setActiveSubTab('inspector');
                      }}
                      aria-current={isSelected ? 'true' : undefined}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Tooltip content={`Status: ${isSyncing ? 'syncing' : status.label}`}>
                        <StatusDot
                          status={isSyncing ? 'warning' : status.dot}
                          pulse={isSyncing}
                          size="sm"
                        />
                      </Tooltip>
                      <span className="text-xs font-mono font-medium text-text truncate">
                        {server.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-2xs font-mono bg-surface text-text-secondary border border-border">
                        {isStdio ? 'stdio' : 'http'}
                      </span>
                      <span className="ml-auto text-2xs font-sans text-text-muted">
                        {isSyncing ? 'syncing' : status.label}
                      </span>
                    </button>
                    <IconButton
                      aria-label={`Delete ${server.name}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(server)}
                      // The affordance used to render at `opacity-0` with no
                      // ancestor carrying `group`, so it was permanently invisible
                      // and reachable only by tabbing into it. Revealed on hover
                      // AND on keyboard focus, which is the a11y half of the bug.
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-error transition-opacity"
                    >
                      <svg
                        className="w-3.5 h-3.5"
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
                    </IconButton>
                  </div>
                );
              })
            )}

            {loadError && (
              <p role="alert" className="text-2xs text-error px-1">
                The server list could not be read: {loadError}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/70 shrink-0">
            <h2 className="text-xs font-semibold text-text font-sans tracking-tight">
              Verified Catalog
            </h2>
            <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
              Built-in definitions served by this API from{' '}
              <code className="font-mono">GET /connectors/mcp/builtin</code>. They run this
              deployment&apos;s own interpreter, so nothing is downloaded.
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-2 pb-8 space-y-1.5">
            {filteredBuiltins.length === 0 ? (
              <p className="text-2xs text-text-muted px-2 py-3">
                The API returned no built-in MCP definitions.
              </p>
            ) : (
              filteredBuiltins.map((server) => {
                const isInstalled =
                  installedNames.has(server.name.toLowerCase()) ||
                  installedCommands.has(builtinCommandLine(server));
                return (
                  <div
                    key={server.id}
                    className="p-3 rounded-lg border border-border bg-surface-elevated/40 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-text font-sans">
                          {server.name}
                        </span>
                        <Badge variant="mono" size="sm">
                          {server.transport}
                        </Badge>
                        {Array.isArray(server.tools) && server.tools.length > 0 && (
                          <Badge variant="default" size="sm">
                            {server.tools.length} declared tool
                            {server.tools.length === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary font-sans leading-relaxed mt-1 line-clamp-2">
                        {server.description}
                      </p>
                      <p className="text-2xs font-mono text-text-muted mt-1 break-all">
                        {builtinCommandLine(server)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isInstalled ? 'outline' : 'primary'}
                      disabled={isInstalled}
                      onClick={() => {
                        setInstallingId(server.id);
                        setPendingInstall({ kind: 'builtin', server });
                      }}
                    >
                      {isInstalled ? 'Installed' : 'Add'}
                    </Button>
                  </div>
                );
              })
            )}

            <div className="px-1 pt-4">
              <h2 className="text-xs font-semibold text-text font-sans tracking-tight">
                Community templates (unverified)
              </h2>
              <p className="text-2xs text-text-muted mt-0.5 leading-relaxed">
                Third-party npm packages. The exact command is shown before anything is created, and
                the package is downloaded and executed on the machine that discovers tools. Vaeloom
                has not audited any of them.
              </p>
            </div>

            {filteredTemplates.map((template) => {
              const isInstalled = installedNames.has(template.name.toLowerCase());
              return (
                <div
                  key={template.id}
                  className="p-3 rounded-lg border border-border bg-surface-elevated/40 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-text font-sans">
                        {template.name}
                      </span>
                      {template.transports.map((transport) => (
                        <Badge key={transport} variant="mono" size="sm">
                          {transport}
                        </Badge>
                      ))}
                      {template.authType && (
                        <Badge variant="warning" size="sm">
                          needs {template.authType}
                        </Badge>
                      )}
                      <Badge variant="default" size="sm">
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary font-sans leading-relaxed mt-1 line-clamp-2">
                      {template.description}
                    </p>
                    <p className="text-2xs font-mono text-text-muted mt-1 break-all">
                      {templateCommandLine(template)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isInstalled ? 'outline' : 'secondary'}
                    disabled={isInstalled}
                    onClick={() => {
                      setInstallingId(template.id);
                      setPendingInstall({ kind: 'template', template });
                    }}
                  >
                    {isInstalled ? 'Installed' : 'Review'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right column: inspector / manifest ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background text-text overflow-hidden">
        <div className="border-b border-border bg-surface px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-4 min-w-0" role="tablist" aria-label="MCP pane">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'inspector'}
              onClick={() => setActiveSubTab('inspector')}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSubTab === 'inspector'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              Inspector &amp; Tools
              {serverTools.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-2xs bg-primary/10 text-primary border border-primary/20">
                  {serverTools.length}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'manifest'}
              onClick={() => {
                setActiveSubTab('manifest');
                if (!isEditorDirty) {
                  const built = buildMcpServersManifest(installedServers);
                  setMcpConfigText(built.json);
                  setManifestOmissions(built.omissions);
                }
              }}
              className={`text-xs font-sans font-semibold pb-1 border-b-2 transition-colors flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSubTab === 'manifest'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              mcp.json Manifest
              <span className="text-2xs font-mono text-text-muted">Claude Desktop / Cursor</span>
            </button>
          </div>

          {activeSubTab === 'manifest' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleFormatConfig}>
                Format
              </Button>
              <Button size="sm" loading={savingConfig} onClick={() => void handleSaveConfig()}>
                {savingConfig ? 'Applying...' : 'Apply to Workspace'}
              </Button>
            </div>
          ) : selectedServer ? (
            <div className="flex items-center gap-2">
              <Tooltip content="The server declared this many tools when it was last listed">
                <Button
                  variant="outline"
                  size="sm"
                  loading={refreshingTools}
                  onClick={() => void loadServerTools(selectedServer.id, true)}
                >
                  Refresh Tools
                </Button>
              </Tooltip>
              <Button
                size="sm"
                loading={syncingServerId === selectedServer.id}
                onClick={() => void handleSyncBridge(selectedServer)}
              >
                Sync Bridge
              </Button>
            </div>
          ) : null}
        </div>

        {/* One <h2> for the pane in every state. It used to exist only in the
            empty branch, so with a server selected the pane had no heading and
            the section levels underneath skipped a level. */}
        <h2 className="sr-only">{paneTitle}</h2>

        {activeSubTab === 'inspector' ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain pb-16">
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
                  <h3 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans">
                    Model Context Protocol (MCP v2) Runtime
                  </h3>
                  <p className="text-xs text-text-secondary max-w-lg mx-auto leading-relaxed font-sans">
                    Connect external tools, local filesystems and databases to this workspace&apos;s
                    agents over sandboxed stdio subprocesses or streamable-HTTP endpoints. Select a
                    server to inspect it.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
                    Built-in servers available in this workspace
                  </h3>
                  {builtinServers.length === 0 ? (
                    <p className="text-xs text-text-muted">
                      The API returned no built-in definitions.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {builtinServers.map((server) => (
                        <div
                          key={server.id}
                          className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-text font-sans">
                                {server.name}
                              </span>
                              <Badge variant="mono" size="sm">
                                {server.transport}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                              {server.description}
                            </p>
                            <p className="text-2xs font-mono text-text-muted break-all">
                              {builtinCommandLine(server)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setInstallingId(server.id);
                              setPendingInstall({ kind: 'builtin', server });
                            }}
                          >
                            Add to workspace
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-text font-mono flex items-center gap-2 flex-wrap">
                        {selectedServer.name}
                        <Badge variant="mono" size="sm">
                          {String(selectedServer.config?.['transport'] ?? 'unspecified')}
                        </Badge>
                        <Badge
                          variant={
                            (SERVER_STATUS_META[selectedServer.status] ?? SERVER_STATUS_META.error)
                              .dot === 'error'
                              ? 'error'
                              : 'default'
                          }
                          size="sm"
                        >
                          {
                            (SERVER_STATUS_META[selectedServer.status] ?? SERVER_STATUS_META.error)
                              .label
                          }
                        </Badge>
                      </h3>
                      <p className="text-xs text-text-muted mt-1 font-mono">
                        ID {selectedServer.id} &middot; last sync{' '}
                        {formatRelativeTime(selectedServer.lastSync ?? null)}
                        {selectedServer.errorMessage ? ` · ${selectedServer.errorMessage}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingDelete(selectedServer)}
                    >
                      Disconnect Server
                    </Button>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-elevated border border-border font-mono text-xs text-text space-y-1 break-all">
                    {selectedServer.config?.['command'] ? (
                      <div>
                        <span className="text-text-muted">command: </span>
                        <span className="text-primary font-medium">
                          {String(selectedServer.config['command'])}
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
                          {String(selectedServer.config['url'])}
                        </span>
                      </div>
                    ) : (
                      <div className="text-text-muted">
                        This connector has no command or URL, so nothing can be contacted.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-text border-b border-border pb-2">
                    Endpoint probe
                  </h3>
                  <div className="p-3 rounded-lg border border-border bg-surface-elevated/40 space-y-3">
                    {probeCapabilityId ? (
                      <>
                        <p className="text-xs text-text-secondary">
                          Contacts the server for real: it validates the config, opens the
                          transport, and runs one bounded{' '}
                          <code className="font-mono">tools/list</code> round trip. It reports
                          &quot;skipped&quot; and contacts nothing when no endpoint is configured.
                        </p>
                        <Button size="sm" loading={probing} onClick={() => void handleProbe()}>
                          Probe endpoint
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-warning">
                        The probe endpoint reads a workspace capability row, and this workspace has
                        no <code className="font-mono">mcp</code> capability named{' '}
                        <span className="font-mono">{selectedServer.name}</span>. Register one to
                        enable a real probe for this connector.
                      </p>
                    )}

                    {probeResult && (
                      <div className="space-y-2 border-t border-border pt-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={probeStatusTone[probeResult.status] ?? 'default'}
                            size="sm"
                          >
                            {probeResult.status}
                          </Badge>
                          <span className="text-2xs text-text-muted">
                            executed: {String(probeResult.executed)}
                          </span>
                          {probeResult.latencyMs !== null && (
                            <span className="text-2xs text-text-muted font-mono">
                              {probeResult.latencyMs}ms round trip
                            </span>
                          )}
                          {probeResult.transport && (
                            <Badge variant="mono" size="sm">
                              {probeResult.transport}
                            </Badge>
                          )}
                        </div>
                        {probeResult.detail && (
                          <p className="text-xs text-text-secondary">{probeResult.detail}</p>
                        )}
                        {probeResult.error && (
                          <p role="alert" className="text-xs text-error">
                            {probeResult.error}
                          </p>
                        )}
                        {probeResult.status === 'connected' && probeResult.toolsCount !== null && (
                          <p className="text-xs text-text-secondary">
                            {probeResult.toolsCount} tool{probeResult.toolsCount === 1 ? '' : 's'}{' '}
                            reported by the server
                            {probeResult.tools.length > 0 ? ':' : ' (no names returned).'}
                          </p>
                        )}
                        {probeResult.tools.length > 0 && (
                          <ul className="flex flex-wrap gap-1.5">
                            {probeResult.tools.map((tool) => (
                              <li key={tool}>
                                <Badge variant="mono" size="sm">
                                  {tool}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 gap-3">
                    <h3 className="text-sm font-semibold text-text">
                      Discovered Protocol Tools ({serverTools.length})
                    </h3>
                    <span className="text-2xs text-text-muted text-right">
                      The tools endpoint declares no per-tool scope, so none is shown.
                    </span>
                  </div>

                  {loadingTools ? (
                    <div
                      role="status"
                      aria-label="Listing MCP tools"
                      className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted"
                    >
                      <Spinner size="sm" />
                      <span>Querying MCP tools/list protocol...</span>
                    </div>
                  ) : serverTools.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-border bg-surface text-center space-y-2">
                      <p className="text-xs font-medium text-text">No tools listed</p>
                      <p className="text-xs text-text-muted max-w-sm mx-auto">
                        Either the server exposes none or the last{' '}
                        <code className="font-mono">tools/list</code> call failed. Use &quot;Sync
                        Bridge&quot; or &quot;Refresh Tools&quot; to ask again.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void handleSyncBridge(selectedServer)}
                        className="mt-1"
                      >
                        Sync Bridge Now
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {serverTools.map((tool) => {
                        const isTestingThis = testingTool?.name === tool.name;
                        return (
                          <div
                            key={tool.name}
                            className={`p-3.5 rounded-xl border transition-colors ${
                              isTestingThis
                                ? 'bg-primary/5 border-primary/50'
                                : 'bg-surface border-border hover:border-border-subtle'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-text">
                                    {tool.name}
                                  </span>
                                  {tool.readOnly ? (
                                    <Badge variant="success" size="sm">
                                      Read-Only
                                    </Badge>
                                  ) : (
                                    <Badge variant="warning" size="sm">
                                      Approval Gated
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed font-sans">
                                  {tool.description ||
                                    'The server sent no description for this tool.'}
                                </p>
                              </div>

                              <Button
                                variant={isTestingThis ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (isTestingThis) {
                                    setTestingTool(null);
                                  } else {
                                    setTestingTool(tool);
                                    setTestArgsJson('{}');
                                    setTestResult(null);
                                    setTestError(null);
                                    setTestLatencyMs(null);
                                  }
                                }}
                              >
                                {isTestingThis ? 'Close Test' : 'Test Tool'}
                              </Button>
                            </div>

                            {isTestingThis && (
                              <div className="mt-4 pt-3 border-t border-border space-y-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <span className="text-xs font-semibold text-text font-sans">
                                    Tool Execution Playground
                                  </span>
                                  <code className="text-2xs font-mono text-text-muted break-all">
                                    POST /connectors/{selectedServer.id}/mcp/call
                                  </code>
                                </div>

                                <div>
                                  <label
                                    htmlFor="mcp-tool-args"
                                    className="block text-2xs font-mono text-text-secondary mb-1"
                                  >
                                    Arguments (JSON)
                                  </label>
                                  <textarea
                                    id="mcp-tool-args"
                                    value={testArgsJson}
                                    onChange={(event) => setTestArgsJson(event.target.value)}
                                    rows={3}
                                    spellCheck={false}
                                    className="w-full p-2 rounded bg-surface-elevated border border-border font-mono text-xs text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent placeholder:text-text-muted"
                                    placeholder='{ "query": "test" }'
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    loading={testCalling}
                                    onClick={() => void handleExecuteToolCall()}
                                  >
                                    Run Tool
                                  </Button>
                                  {testLatencyMs !== null && (
                                    <span className="text-2xs font-mono text-text-muted">
                                      {testLatencyMs}ms (measured in this browser)
                                    </span>
                                  )}
                                </div>

                                {testError && (
                                  <p
                                    role="alert"
                                    className="p-2.5 rounded bg-error/10 border border-error/30 text-xs font-mono text-error"
                                  >
                                    {testError}
                                  </p>
                                )}

                                {testResult && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-2xs font-mono text-text-secondary">
                                        Result
                                      </span>
                                      <Badge
                                        variant={testResult.isError ? 'error' : 'success'}
                                        size="sm"
                                      >
                                        {testResult.isError ? 'MCP error result' : 'returned'}
                                      </Badge>
                                    </div>
                                    {testResult.tool && (
                                      <p className="text-2xs font-mono text-text-muted break-all">
                                        tool: {testResult.tool}
                                      </p>
                                    )}
                                    {testResult.text !== null && (
                                      <pre className="p-2.5 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-48 overflow-auto whitespace-pre-wrap break-all">
                                        {testResult.text === ''
                                          ? '(empty text content)'
                                          : testResult.text}
                                      </pre>
                                    )}
                                    {testResult.structured !== undefined && (
                                      <div>
                                        <span className="text-2xs font-mono text-text-secondary">
                                          structuredContent
                                          {testResult.structuredTruncated
                                            ? ' (truncated by the server)'
                                            : ''}
                                        </span>
                                        <pre className="p-2.5 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-48 overflow-auto">
                                          {safeStringify(testResult.structured)}
                                        </pre>
                                      </div>
                                    )}
                                    {testResult.text === null &&
                                      testResult.structured === undefined && (
                                        <p className="text-2xs text-text-muted">
                                          The server returned no content blocks.
                                        </p>
                                      )}
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
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-3 shrink-0">
              <h3 className="text-xs font-mono font-medium text-text">
                mcp.json
                <span className="text-2xs text-text-muted font-sans ml-2">
                  Claude Desktop / Cursor compatible manifest
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(mcpConfigText)
                    .then(() => toast({ tone: 'info', title: 'Copied mcp.json to clipboard' }))
                    .catch(() =>
                      toast({
                        tone: 'error',
                        title: 'Copy failed',
                        detail: 'The browser refused clipboard access.',
                      }),
                    );
                }}
              >
                Copy JSON
              </Button>
            </div>

            {manifestOmissions.length > 0 && (
              <div className="px-4 py-2 border-b border-border bg-warning/10 text-2xs text-warning shrink-0">
                {manifestOmissions.length} server(s) are not in this manifest:{' '}
                {manifestOmissions
                  .map((omission) => `${omission.key} (${omission.reason})`)
                  .join('; ')}
              </div>
            )}

            <div className="flex-1 flex overflow-hidden bg-surface font-mono text-xs">
              <div
                aria-hidden="true"
                className="w-10 py-3 bg-surface-elevated border-r border-border text-right pr-2 text-text-muted select-none text-xs leading-5 shrink-0"
              >
                {mcpConfigText.split('\n').map((_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </div>

              <textarea
                aria-label="mcp.json manifest"
                value={mcpConfigText}
                onChange={(event) => {
                  setMcpConfigText(event.target.value);
                  setIsEditorDirty(true);
                }}
                spellCheck={false}
                className="flex-1 min-h-0 p-3 bg-transparent text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent resize-none leading-5 overflow-auto overscroll-contain selection:bg-primary/20"
              />
            </div>
          </div>
        )}

        <div className="h-[200px] flex flex-col shrink-0 bg-surface border-t border-border">
          <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-sans font-semibold text-text">Session Activity</h3>
              <label htmlFor="mcp-log-filter" className="sr-only">
                Filter activity by server
              </label>
              <select
                id="mcp-log-filter"
                value={logFilter}
                onChange={(event) => setLogFilter(event.target.value)}
                className="bg-surface border border-border rounded-md px-2 py-0.5 text-xs font-sans text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
              >
                <option value="all">All events</option>
                {installedServers.map((server) => (
                  <option key={server.id} value={server.name}>
                    {server.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filteredLogs.length === 0}
                onClick={() => {
                  // One JSON object per line so the export is machine-parseable. The
                  // previous `[locale time] LEVEL > message` format was neither.
                  const exportText = filteredLogs
                    .map((entry) =>
                      JSON.stringify({
                        at: entry.at,
                        level: entry.level,
                        ...(entry.server ? { server: entry.server } : {}),
                        message: entry.message,
                      }),
                    )
                    .join('\n');
                  void navigator.clipboard
                    ?.writeText(exportText)
                    .then(() => toast({ tone: 'info', title: 'Activity copied as JSON lines' }))
                    .catch(() =>
                      toast({
                        tone: 'error',
                        title: 'Copy failed',
                        detail: 'The browser refused clipboard access.',
                      }),
                    );
                }}
              >
                Copy Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={logs.length === 0}
                onClick={() => setLogs([])}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-y-contain font-mono text-xs leading-5 bg-surface">
            <p className="text-2xs text-text-muted mb-2 font-sans">
              Actions taken in this tab, in this browser session. This is not a server audit log,
              and it is not persisted anywhere.
            </p>
            {filteredLogs.length === 0 ? (
              <p className="text-text-muted italic text-xs">
                {logs.length === 0 ? 'No activity yet.' : 'No activity for this server.'}
              </p>
            ) : (
              filteredLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2 ${
                    entry.level === 'error'
                      ? 'text-error'
                      : entry.level === 'success'
                        ? 'text-success'
                        : entry.level === 'warn'
                          ? 'text-warning'
                          : 'text-text-secondary'
                  }`}
                >
                  <time
                    dateTime={entry.at}
                    className="text-text-muted select-none text-2xs shrink-0"
                  >
                    {entry.at}
                  </time>
                  {entry.server && (
                    <span className="text-text-muted select-none shrink-0">[{entry.server}]</span>
                  )}
                  <span className="break-all">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        variant="destructive"
        title="Remove MCP server?"
        message={
          pendingDelete
            ? `${pendingDelete.name} will be removed from this workspace. Any agent that was bridged to its tools loses them, and the server is not contacted again.`
            : ''
        }
        confirmLabel="Remove server"
        cancelLabel="Keep it"
      />

      <ConfirmationDialog
        isOpen={pendingInstall !== null}
        onClose={() => {
          if (!installing) setPendingInstall(null);
        }}
        onConfirm={() => void confirmInstall()}
        loading={installing}
        variant={pendingInstall?.kind === 'template' ? 'warning' : 'default'}
        title={
          pendingInstall
            ? pendingInstall.kind === 'builtin'
              ? `Add ${pendingInstall.server.name}?`
              : `Run third-party code: ${pendingInstall.template.name}?`
            : ''
        }
        message={
          pendingInstall
            ? pendingInstall.kind === 'builtin'
              ? `This registers the connector and later runs: ${builtinCommandLine(pendingInstall.server)}. The command comes from this API and uses its own interpreter; nothing is downloaded.`
              : `This registers the connector and later runs on this machine: ${templateCommandLine(pendingInstall.template)}.\n\nnpx downloads that package from the npm registry and executes it as a subprocess. Vaeloom has not audited it.${pendingInstall.template.credentialNote ? `\n\n${pendingInstall.template.credentialNote}` : ''}`
            : ''
        }
        confirmLabel={pendingInstall?.kind === 'template' ? 'Install anyway' : 'Add server'}
        cancelLabel="Cancel"
      />
    </div>
  );
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return '[unserialisable value returned by the server]';
  }
}

export type { McpToolCallResult, McpProbeResult };
