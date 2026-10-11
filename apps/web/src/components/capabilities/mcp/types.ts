import { type BuiltinMcpServer, type ConnectorItem } from '@/lib/api-client';

// ─── Status vocabulary ───────────────────────────────────────────────────────

export type ServerDotStatus = 'active' | 'idle' | 'warning' | 'error' | 'disabled';

export const SERVER_STATUS_META: Record<
  ConnectorItem['status'],
  { dot: ServerDotStatus; label: string }
> = {
  active: { dot: 'active', label: 'active' },
  syncing: { dot: 'warning', label: 'syncing' },
  // Paused is an operator choice, not a failure. Painting it with the error colour
  // is what made a deliberately idle server look broken.
  paused: { dot: 'disabled', label: 'paused' },
  error: { dot: 'error', label: 'error' },
  disconnected: { dot: 'disabled', label: 'disconnected' },
  synced: { dot: 'active', label: 'synced' },
};

export function isStdioConfig(config: Record<string, unknown> | undefined): boolean {
  if (!config) return false;
  return config['transport'] === 'stdio' || typeof config['command'] === 'string';
}

// ─── Community MCP templates ────────────────────────────────────────────────

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

export const MCP_CATALOG_TEMPLATES: McpCatalogTemplate[] = [
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
  {
    id: 'postgres',
    name: 'PostgreSQL MCP Server',
    transports: ['stdio'],
    authType: 'Connection string',
    category: 'Database',
    description:
      'Community reference server for PostgreSQL databases. Vaeloom has not audited its code.',
    installsFromNpm: true,
    credentialNote:
      'Needs a PostgreSQL connection string in POSTGRES_URL or as argument. The connector is created without one; configure it in mcp.json before querying.',
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    },
  },
  {
    id: 'fetch',
    name: 'Fetch MCP Server',
    transports: ['stdio'],
    category: 'Web',
    description:
      'Community reference server for fetching web pages and converting HTML to markdown. Vaeloom has not audited its code.',
    installsFromNpm: true,
    defaultConfig: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
  },
];

/** The exact argv a stdio template will run, for the trust prompt. */
export function templateCommandLine(template: McpCatalogTemplate): string {
  return [template.defaultConfig.command ?? '', ...(template.defaultConfig.args ?? [])]
    .filter(Boolean)
    .join(' ');
}

/** The exact argv a built-in definition will run, as the server reported it. */
export function builtinCommandLine(server: BuiltinMcpServer): string {
  const cfg = (server.config ?? {}) as Record<string, unknown>;
  const command = typeof cfg['command'] === 'string' ? cfg['command'] : '';
  const args = Array.isArray(cfg['args']) ? cfg['args'].map((a) => String(a)) : [];
  return [command, ...args].filter(Boolean).join(' ');
}

// ─── Typed readers for open payloads ─────────────────────────────────────────

export interface McpToolCallResult {
  tool: string | null;
  text: string | null;
  isError: boolean;
  structured: unknown;
  structuredTruncated: boolean;
}

export function readToolCallResult(raw: unknown): McpToolCallResult {
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

export interface McpProbeResult {
  status: string;
  executed: boolean;
  latencyMs: number | null;
  detail: string | null;
  error: string | null;
  transport: string | null;
  tools: string[];
  toolsCount: number | null;
}

export function readProbeResult(raw: unknown): McpProbeResult {
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

export interface LogEntry {
  id: string;
  /** ISO 8601. A locale clock string is not sortable and not parseable downstream. */
  at: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  server?: string;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return '[unserialisable value returned by the server]';
  }
}
