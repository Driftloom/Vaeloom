/**
 * Focused regression suite for McpView and ConnectorsView.
 *
 * The shared route spec (`app/workspace/[workspaceId]/capabilities/page.spec.tsx`)
 * exercises both views through the page, but it stubs the MCP data sources to
 * empty and never opens the panes. Every defect fixed in these two files lives in
 * a state that suite does not reach: a hovered-only control, a placeholder URL
 * written into a manifest, a hardcoded success toast, a fabricated app count.
 *
 * Status codes are asserted exactly where an HTTP failure is simulated
 * (`httpError(502, ...)`), and the assertions distinguish "the request was made"
 * from "the request was not made", which is the whole point of the health-check
 * and probe work.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';

import { McpView } from '../McpView';
import { ConnectorsView } from '../ConnectorsView';

// ─── Fixtures ────────────────────────────────────────────────────────────────

type ConnectorRow = Record<string, unknown> & {
  id: string;
  name: string;
  type: 'mcp' | 'rest' | 'graphql';
  status: 'active' | 'syncing' | 'error' | 'paused';
  config: Record<string, unknown>;
};

function mcpConnector(overrides: Partial<ConnectorRow> = {}): ConnectorRow {
  return {
    id: 'conn-mcp-1',
    name: 'SQLite Memory MCP',
    type: 'mcp',
    status: 'active',
    config: {
      transport: 'stdio',
      command: '/usr/bin/python3',
      args: ['-m', 'api.mcp_servers.sqlite_mcp'],
    },
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
    lastSync: '2026-09-20T00:00:00Z',
    ...overrides,
  };
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

const server = {
  connectors: [] as Array<Record<string, unknown>>,
  workspaceIntegrations: [] as Array<Record<string, unknown>>,
  builtin: [] as Array<Record<string, unknown>>,
  /** camelCased by transformKeys(): the server field is `builtin_servers`. */
  builtinResponse: { builtinServers: [] as Array<Record<string, unknown>> },
  capabilityRows: [] as Array<Record<string, unknown>>,
  created: [] as Array<Record<string, unknown>>,
  updated: [] as Array<{ id: string; body: Record<string, unknown> }>,
  deleted: [] as string[],
  tools: [] as Array<Record<string, unknown>>,
  composioApps: {
    total: 0,
    limit: 500,
    offset: 0,
    apps: [] as Array<Record<string, unknown>>,
    categories: [] as string[],
  },
  composioStatus: { enabled: false, totalApps: 0, popularApps: [] } as Record<string, unknown>,
  failures: {
    list: null as Error | null,
    builtin: null as Error | null,
    create: null as Error | null,
    update: null as Error | null,
    delete: null as Error | null,
    sync: null as Error | null,
    test: null as Error | null,
    health: null as Error | null,
    composioApps: null as Error | null,
    capabilities: null as Error | null,
  },
  syncCalls: 0,
  testCalls: [] as string[],
  healthCalls: [] as string[],
  probeResponse: null as unknown,
};

// Every reference to `server` below sits inside a mock implementation body, never
// at factory-evaluation time: `import { McpView }` is hoisted above this
// `const`, so reading it while the factory runs is a temporal-dead-zone error.
jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  const maybeFail = (err: Error | null) => {
    if (err) throw err;
  };
  return {
    ...actual,
    capabilitiesApi: {
      ...actual.capabilitiesApi,
      list: jest.fn(async (category?: string) => {
        maybeFail(server.failures.capabilities);
        if (category !== 'mcp') return [];
        return server.capabilityRows.map((row) => ({ ...row }));
      }),
      testCapability: jest.fn(async () => server.probeResponse),
    },
    connectorsApi: {
      list: jest.fn(async () => {
        maybeFail(server.failures.list);
        return server.connectors.map((row) => ({ ...row }));
      }),
      create: jest.fn(async (body: Record<string, unknown>) => {
        maybeFail(server.failures.create);
        server.created.push(body);
        return {
          id: `conn-created-${server.created.length}`,
          name: body['name'],
          type: 'mcp',
          config: body['config'] ?? {},
          createdAt: '2026-09-20T00:00:00Z',
          updatedAt: '2026-09-20T00:00:00Z',
        };
      }),
      update: jest.fn(async (id: string, body: Record<string, unknown>) => {
        maybeFail(server.failures.update);
        server.updated.push({ id, body });
        return { id };
      }),
      delete: jest.fn(async (id: string) => {
        maybeFail(server.failures.delete);
        server.deleted.push(id);
      }),
      sync: jest.fn(async () => {
        server.syncCalls += 1;
        maybeFail(server.failures.sync);
        return { connector_id: 'x', registered: ['a'], bridged_total: 1 };
      }),
      test: jest.fn(async (id: string) => {
        server.testCalls.push(id);
        maybeFail(server.failures.test);
        return { status: 'success', code: 200, message: 'Endpoint answered 200 OK.' };
      }),
      health: jest.fn(async (id: string) => {
        server.healthCalls.push(id);
        maybeFail(server.failures.health);
        return {
          status: 'healthy',
          connector_id: id,
          type: 'mcp',
          name: 'SQLite Memory MCP',
          last_sync: '2026-09-20T00:00:00Z',
          config_keys: ['transport', 'command'],
        };
      }),
      mcp: {
        builtin: jest.fn(async () => {
          maybeFail(server.failures.builtin);
          return server.builtinResponse;
        }),
        listTools: jest.fn(async () => server.tools),
        refreshTools: jest.fn(async () => server.tools),
        call: jest.fn(async () => ({ tool: 'query_sql', text: 'rows: 2', isError: false })),
        sync: jest.fn(async () => {
          server.syncCalls += 1;
          maybeFail(server.failures.sync);
          return { connector_id: 'x', registered: ['a'], bridged_total: 1 };
        }),
      },
      composio: {
        status: jest.fn(async () => server.composioStatus),
        apps: jest.fn(async () => {
          maybeFail(server.failures.composioApps);
          return server.composioApps;
        }),
        authUrl: jest.fn(async () => ({ status: 'ok', url: 'https://composio.test/auth' })),
        sync: jest.fn(async () => ({ workspace_id: 'ws', registered: [], count: 0 })),
      },
    },
  };
});

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));
jest.mock('@/hooks/useWorkspace', () => ({
  useWorkspaceConnectors: () => ({
    connectors: server.workspaceIntegrations,
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    integrations: {
      create: jest.fn(async () => ({})),
      delete: jest.fn(async () => undefined),
      sync: jest.fn(async () => ({ synced: true, message: 'Sync requested.' })),
    },
  },
}));

/**
 * Restore the read-side defaults. `jest.clearAllMocks()` wipes call history but
 * keeps the last `mockImplementation`, so a test that overrides `list` would
 * otherwise hand its own response to every test that runs after it.
 */
function reapplyDefaultImplementations(): void {
  const mocked = jest.requireMock('@/lib/api-client') as {
    connectorsApi: { list: jest.Mock; composio: { status: jest.Mock; apps: jest.Mock } };
    capabilitiesApi: { list: jest.Mock; testCapability: jest.Mock };
  };
  mocked.connectorsApi.list.mockImplementation(async () =>
    server.connectors.map((row) => ({ ...row })),
  );
  mocked.connectorsApi.composio.status.mockImplementation(async () => server.composioStatus);
  mocked.connectorsApi.composio.apps.mockImplementation(async () => server.composioApps);
  mocked.capabilitiesApi.list.mockImplementation(async (category?: string) => {
    if (category !== 'mcp') return [];
    return server.capabilityRows.map((row) => ({ ...row }));
  });
  mocked.capabilitiesApi.testCapability.mockImplementation(async () => server.probeResponse);
}

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` resets call history but NOT implementations, so a test that
  // overrides one of these would otherwise leak its override into every later
  // test in the file.
  reapplyDefaultImplementations();
  Object.keys(server.failures).forEach((key) => {
    (server.failures as Record<string, Error | null>)[key] = null;
  });
  server.connectors = [];
  server.workspaceIntegrations = [];
  server.builtin = [];
  server.builtinResponse = { builtinServers: [] };
  server.capabilityRows = [];
  server.created = [];
  server.updated = [];
  server.deleted = [];
  server.tools = [];
  server.composioApps = { total: 0, limit: 500, offset: 0, apps: [], categories: [] };
  server.composioStatus = { enabled: false, totalApps: 0, popularApps: [] };
  server.syncCalls = 0;
  server.testCalls = [];
  server.healthCalls = [];
  server.probeResponse = null;
  (window as unknown as { open: unknown }).open = jest.fn();
});

afterEach(() => {
  // A fake-timer test that leaves the clock faked corrupts every later test in
  // the file, so restore it unconditionally rather than in a `finally`.
  jest.useRealTimers();
});

async function renderMcp() {
  const utils = render(
    <McpView
      workspaceId="ws-1"
      searchQuery=""
      onOpenCreateServer={jest.fn()}
      onOpenImport={jest.fn()}
    />,
  );
  await waitFor(() => expect(screen.queryByText('Loading workspace servers...')).toBeNull());
  return utils;
}

async function renderConnectors() {
  const utils = render(<ConnectorsView workspaceId="ws-1" searchQuery="" />);
  // `aria-busy` on the workspace region is the view's own statement that its
  // first load finished, so the wait is on a rendered fact rather than on a
  // guessed number of microtask turns.
  await waitFor(() => {
    expect(screen.getByLabelText('Connector workspace')).not.toHaveAttribute('aria-busy', 'true');
  });
  return utils;
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// McpView
// ══════════════════════════════════════════════════════════════════════════════

describe('McpView', () => {
  it('reveals the per-row delete control on hover and on keyboard focus', async () => {
    server.connectors = [mcpConnector()];
    await renderMcp();

    const row = screen
      .getByRole('button', { name: 'SQLite Memory MCP stdio active' })
      .closest('div.group');
    expect(row).not.toBeNull();
    // The `group` class the reveal depends on has to be on an ancestor of the
    // control, not merely somewhere in the file.
    expect(row?.className).toContain('group');

    const del = screen.getByRole('button', { name: 'Delete SQLite Memory MCP' });
    expect(del.className).toContain('focus-visible:opacity-100');
    expect(del.className).toContain('group-hover:opacity-100');
  });

  it('confirms removal in a dialog instead of calling window.confirm', async () => {
    server.connectors = [mcpConnector()];
    const confirmSpy = jest.spyOn(window, 'confirm');
    await renderMcp();

    await click(screen.getByRole('button', { name: 'Delete SQLite Memory MCP' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/SQLite Memory MCP/)).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    // Nothing is deleted until the dialog is confirmed.
    expect(server.deleted).toEqual([]);

    await click(within(dialog).getByRole('button', { name: 'Remove server' }));
    await waitFor(() => expect(server.deleted).toEqual(['conn-mcp-1']));
  });

  it('starts with no invented history and stamps real events as ISO 8601', async () => {
    server.connectors = [mcpConnector()];
    await renderMcp();

    expect(screen.getByText('Session Activity')).toBeInTheDocument();
    expect(
      screen.getByText(/Actions taken in this tab, in this browser session/),
    ).toBeInTheDocument();
    // The fabricated "client initialized" line is gone.
    expect(document.body.textContent ?? '').not.toContain('client initialized in workspace');

    // The one entry that exists is a real one: the initial tools/list call.
    expect(await screen.findByText(/listed 0 tool\(s\)/)).toBeInTheDocument();
    const stamps = Array.from(document.querySelectorAll('time')).map(
      (node) => node.getAttribute('datetime') ?? '',
    );
    expect(stamps.length).toBeGreaterThan(0);
    for (const stamp of stamps) {
      expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('renders the server-provided built-in catalog and the exact command it will run', async () => {
    server.builtin = [
      {
        id: 'sqlite-memory-mcp',
        name: 'SQLite Memory MCP',
        description: 'Sovereign relational database engine',
        transport: 'stdio',
        tools: ['list_tables', 'query_sql'],
        config: {
          transport: 'stdio',
          command: '/opt/venv/bin/python',
          args: ['-m', 'api.mcp_servers.sqlite_mcp'],
        },
      },
    ];
    server.builtinResponse = { builtinServers: server.builtin };
    await renderMcp();

    // Read from the response, so the `builtin_servers` / `builtinServers`
    // mismatch cannot silently empty the panel again.
    expect(screen.getAllByText('Verified Catalog').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('/opt/venv/bin/python -m api.mcp_servers.sqlite_mcp').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/2 declared tools/)).toBeInTheDocument();
  });

  it('requires a trust step naming the exact command before installing a community template', async () => {
    await renderMcp();

    await click(screen.getAllByRole('button', { name: 'Review' })[0] as HTMLElement);

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/npx -y @modelcontextprotocol\/server-filesystem \.\/data/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/has not audited/i)).toBeInTheDocument();
    // Nothing written before the operator agrees.
    expect(server.created).toEqual([]);

    await click(within(dialog).getByRole('button', { name: 'Install anyway' }));
    await waitFor(() => expect(server.created).toHaveLength(1));
  });

  it('never writes a placeholder URL into the generated manifest', async () => {
    server.connectors = [
      mcpConnector({
        id: 'conn-a',
        name: 'Local Files',
        config: { transport: 'stdio', command: 'node' },
      }),
      mcpConnector({ id: 'conn-b', name: 'Endpointless', config: { transport: 'http' } }),
    ];
    await renderMcp();

    await click(screen.getByRole('tab', { name: /mcp\.json Manifest/i }));

    const editor = screen.getByRole('textbox', {
      name: 'mcp.json manifest',
    }) as HTMLTextAreaElement;
    expect(editor.value).toContain('"command": "node"');
    expect(editor.value).not.toContain('example.com');
    // The endpointless row is reported rather than given an invented URL.
    expect(screen.getByText(/endpointless \(no command or URL is configured/)).toBeInTheDocument();
  });

  it('never emits a literal ${AUTH_TOKEN} header for a connector that holds a token', async () => {
    server.connectors = [
      mcpConnector({
        id: 'conn-http',
        name: 'Remote Gateway',
        config: { transport: 'http', url: 'https://mcp.internal.example/sse', auth_token: 'shhh' },
      }),
    ];
    await renderMcp();

    await click(screen.getByRole('tab', { name: /mcp\.json Manifest/i }));

    const editor = screen.getByRole('textbox', {
      name: 'mcp.json manifest',
    }) as HTMLTextAreaElement;
    expect(editor.value).toContain('https://mcp.internal.example/sse');
    expect(editor.value).not.toContain('${AUTH_TOKEN}');
    expect(editor.value).not.toContain('Bearer');
    expect(screen.getByText(/holds a stored token/)).toBeInTheDocument();
  });

  it('rejects an unresolved ${...} placeholder with the real reason, not a syntax error', async () => {
    server.connectors = [mcpConnector()];
    await renderMcp();
    await click(screen.getByRole('tab', { name: /mcp\.json Manifest/i }));

    fireEvent.change(screen.getByRole('textbox', { name: 'mcp.json manifest' }), {
      target: {
        value: JSON.stringify({
          mcpServers: {
            gateway: {
              url: 'https://mcp.internal/sse',
              headers: { Authorization: 'Bearer ${AUTH_TOKEN}' },
            },
          },
        }),
      },
    });
    await click(screen.getByRole('button', { name: 'Apply to Workspace' }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', title: 'Unresolved ${...} placeholder' }),
    );
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Syntax Error in mcp.json' }),
    );
    expect(server.created).toEqual([]);
    expect(server.updated).toEqual([]);
  });

  it('reports a mid-apply write failure as the failure it was, and rolls the partial write back', async () => {
    server.connectors = [mcpConnector({ id: 'conn-existing', name: 'local-files' })];
    await renderMcp();
    await click(screen.getByRole('tab', { name: /mcp\.json Manifest/i }));

    // The update to the existing row fails with a gateway error; the create of
    // the second row succeeds, so the run leaves a partial manifest unless the
    // created row is compensated.
    server.failures.update = httpError(502, 'Bad Gateway');
    server.failures.delete = null;

    fireEvent.change(screen.getByRole('textbox', { name: 'mcp.json manifest' }), {
      target: {
        value: JSON.stringify({
          mcpServers: {
            'local-files': { command: 'node', args: ['server.js'] },
            'second-server': { command: 'python', args: ['-m', 'other'] },
          },
        }),
      },
    });
    await click(screen.getByRole('button', { name: 'Apply to Workspace' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'mcp.json was not applied' }),
      ),
    );
    const applied = mockToast.mock.calls.at(-1)?.[0] as { detail: string };
    expect(applied.detail).toContain('Bad Gateway');
    expect(applied.detail).toContain('rolled back');
    // No success claim for a run that failed.
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'mcp.json Applied' }),
    );
    // The row this run created is compensated away.
    await waitFor(() => expect(server.deleted).toEqual(['conn-created-1']));
  });

  it('surfaces a failed bridge sync instead of claiming the manifest was fully applied', async () => {
    server.connectors = [];
    await renderMcp();
    await click(screen.getByRole('tab', { name: /mcp\.json Manifest/i }));

    server.failures.sync = httpError(502, 'MCP bridge unavailable');

    fireEvent.change(screen.getByRole('textbox', { name: 'mcp.json manifest' }), {
      target: { value: JSON.stringify({ mcpServers: { only: { command: 'node' } } }) },
    });
    await click(screen.getByRole('button', { name: 'Apply to Workspace' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'warning', title: 'mcp.json written, bridges incomplete' }),
      ),
    );
    const applied = mockToast.mock.calls.at(-1)?.[0] as { detail: string };
    expect(applied.detail).toContain('MCP bridge unavailable');
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'mcp.json Applied' }),
    );
  });

  it('paints a paused server as paused, not as an error', async () => {
    server.connectors = [mcpConnector({ status: 'paused' })];
    await renderMcp();

    const row = screen.getByRole('button', { name: 'SQLite Memory MCP stdio paused' });
    expect(row.textContent).toContain('paused');
    expect(row.textContent).not.toContain('error');
    // The error palette must not appear anywhere in the row.
    expect(row.outerHTML).not.toMatch(/bg-(error|danger)\b/);
    expect(row.outerHTML).not.toMatch(/text-(error|danger)\b/);
    // The dot itself is the disabled token, not the error token.
    expect(row.querySelector('.bg-text-dim')).not.toBeNull();
    expect(row.querySelector('.bg-error')).toBeNull();
  });

  it('keeps one heading level for the pane with a server selected', async () => {
    server.connectors = [mcpConnector()];
    await renderMcp();

    const levels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(levels.filter((text) => text?.startsWith('Servers'))).toHaveLength(1);
    expect(levels).toContain('Verified Catalog');
    // Exactly one pane heading, and no level is skipped below it.
    expect(levels.filter((text) => text?.includes('SQLite Memory MCP'))).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 3, name: /Discovered Protocol Tools/ }),
    ).toBeInTheDocument();
  });

  it('keeps the same heading level for the pane with nothing selected', async () => {
    server.connectors = [];
    await renderMcp();

    const levels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(levels).toContain('Model Context Protocol (MCP v2) Runtime');
    expect(levels).toContain('Verified Catalog');
  });

  it('shows which server each activity row came from, because the filter matches on it', async () => {
    server.connectors = [mcpConnector()];
    await renderMcp();

    await click(screen.getByRole('button', { name: 'Sync Bridge' }));
    await waitFor(() =>
      expect(screen.getAllByText('[SQLite Memory MCP]').length).toBeGreaterThan(0),
    );

    fireEvent.change(screen.getByLabelText('Filter activity by server'), {
      target: { value: 'SQLite Memory MCP' },
    });
    expect(screen.getAllByText('[SQLite Memory MCP]').length).toBeGreaterThan(0);
  });

  it('shows no per-tool scope, because the tools endpoint declares none', async () => {
    server.connectors = [mcpConnector()];
    server.tools = [
      { name: 'query_sql', description: 'Run a read-only query', readOnly: true },
      { name: 'write_row', description: 'Insert a row', readOnly: false },
    ];
    await renderMcp();

    await waitFor(() => expect(screen.getByText('query_sql')).toBeInTheDocument());
    expect(screen.getByText('write_row')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('connector.mcp.execute');
  });

  it('renders the real connected probe result with the tool names the server reported', async () => {
    server.connectors = [mcpConnector()];
    server.capabilityRows = [
      {
        id: 'cap-mcp-1',
        workspaceId: 'ws-1',
        name: 'SQLite Memory MCP',
        category: 'mcp',
        enabled: true,
        config: {},
        usageCount: 0,
        lastUsedAt: null,
      },
    ];
    server.probeResponse = {
      status: 'connected',
      latencyMs: 41.2,
      error: null,
      executed: true,
      output: {
        status: 'connected',
        detail: 'Real tools/list round trip returned 2 tool(s).',
        // transformKeys() camelCases `tools_count` on the way in.
        toolsCount: 2,
        tools: ['list_tables', 'query_sql'],
        transport: 'stdio',
      },
    };
    await renderMcp();

    await click(screen.getByRole('button', { name: 'Probe endpoint' }));

    await waitFor(() => expect(screen.getByText('connected')).toBeInTheDocument());
    expect(screen.getByText('executed: true')).toBeInTheDocument();
    expect(screen.getByText('2 tools reported by the server:')).toBeInTheDocument();
    expect(screen.getByText('list_tables')).toBeInTheDocument();
    expect(screen.getByText('query_sql')).toBeInTheDocument();
  });

  it('renders a skipped probe with the detail the server sent, claiming no connection', async () => {
    server.connectors = [mcpConnector({ config: { transport: 'http' } })];
    server.capabilityRows = [
      {
        id: 'cap-mcp-2',
        workspaceId: 'ws-1',
        name: 'SQLite Memory MCP',
        category: 'mcp',
        enabled: true,
        config: {},
        usageCount: 0,
        lastUsedAt: null,
      },
    ];
    server.probeResponse = {
      status: 'skipped',
      latencyMs: 0.4,
      error: null,
      executed: false,
      output: { status: 'skipped', detail: 'No MCP endpoint configured; nothing was contacted.' },
    };
    await renderMcp();

    await click(screen.getByRole('button', { name: 'Probe endpoint' }));

    await waitFor(() => expect(screen.getByText('skipped')).toBeInTheDocument());
    expect(screen.getByText('executed: false')).toBeInTheDocument();
    expect(
      screen.getByText('No MCP endpoint configured; nothing was contacted.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('connected')).toBeNull();
  });

  it('says why the probe is unavailable instead of firing a request that would 404', async () => {
    server.connectors = [mcpConnector()];
    const { capabilitiesApi } = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: Record<string, jest.Mock>;
    };
    await renderMcp();

    expect(
      screen.getByText(/The probe endpoint reads a workspace capability row/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Probe endpoint' })).toBeNull();
    expect(capabilitiesApi['testCapability']).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ConnectorsView
// ══════════════════════════════════════════════════════════════════════════════

describe('ConnectorsView', () => {
  it('never shows a Composio app count the server did not report', async () => {
    server.composioStatus = { enabled: false, totalApps: 0, popularApps: [] };
    await renderConnectors();

    const html = document.body.textContent ?? '';
    expect(html).not.toContain('1,553');
    expect(html).not.toContain('1553');
    expect(screen.getByText('Composio is switched off on the server')).toBeInTheDocument();
    // A count of 0 is not rendered as a live badge.
    expect(screen.queryByText('0 apps')).toBeNull();
  });

  it('shows the real reported total once the server sends one', async () => {
    server.composioStatus = { enabled: true, totalApps: 412, popularApps: [] };
    await renderConnectors();

    expect(screen.getByText('412')).toBeInTheDocument();
  });

  it('calls the diagnostic endpoint for Ping Health instead of toasting a hardcoded 200', async () => {
    server.connectors = [mcpConnector()];
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));
    await click(await screen.findByRole('button', { name: 'Ping Health' }));

    await waitFor(() => expect(server.testCalls).toEqual(['conn-mcp-1']));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', title: 'Connection Healthy' }),
    );
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Health 200 OK' }));
  });

  it('surfaces the exact status code a failing diagnostic returned', async () => {
    server.connectors = [mcpConnector()];
    server.failures.test = httpError(502, 'Bad Gateway');
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));
    await click(await screen.findByRole('button', { name: 'Ping Health' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'error',
          title: 'Diagnostic Test Failed',
          detail: 'Bad Gateway',
        }),
      ),
    );
  });

  it('renders the health the server reported through the endpoint it always had', async () => {
    server.connectors = [mcpConnector()];
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));
    await click(await screen.findByRole('button', { name: 'Details' }));

    await waitFor(() => expect(server.healthCalls).toEqual(['conn-mcp-1']));
    expect(await screen.findByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('transport, command')).toBeInTheDocument();
  });

  it('lists the built-in MCP servers the API returned, not a hardcoded five', async () => {
    server.builtin = [
      {
        id: 'job-search-mcp',
        name: 'Public ATS Job Search MCP',
        description: 'Searches live jobs',
        transport: 'stdio',
        tools: ['search_public_ats_jobs'],
        config: {
          transport: 'stdio',
          command: '/opt/venv/bin/python',
          args: ['-m', 'api.mcp_servers.job_search_mcp'],
        },
      },
    ];
    server.builtinResponse = { builtinServers: server.builtin };
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));

    expect(await screen.findByText('1 declared')).toBeInTheDocument();
    expect(screen.getByText('Public ATS Job Search MCP')).toBeInTheDocument();
    expect(screen.getByText('search_public_ats_jobs')).toBeInTheDocument();
    const html = document.body.textContent ?? '';
    expect(html).not.toContain('active & sandboxed');
    expect(html).not.toContain('Atlassian MCP Suite');
  });

  it('reports a failed built-in catalog read rather than falling back to an empty grid', async () => {
    server.failures.builtin = httpError(503, 'Service Unavailable');
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));

    expect(await screen.findByText('Built-in catalog unavailable')).toBeInTheDocument();
    expect(screen.getByText('Service Unavailable')).toBeInTheDocument();
  });

  it('does not paint a native runtime capability as a connected connector', async () => {
    await renderConnectors();

    const browserCard = screen
      .getByRole('button', { name: /Browser Scraper \(Playwright\)/ })
      .closest('li') as HTMLElement;
    expect(within(browserCard).queryByText('Connected')).toBeNull();
    expect(within(browserCard).getByText(/no connector row to connect/i)).toBeInTheDocument();
  });

  it('does not present catalog prose as the scopes an OAuth screen will request', async () => {
    await renderConnectors();

    await click(screen.getByRole('button', { name: /^Google Drive/ }));

    expect(screen.queryByText('Requested Scopes')).toBeNull();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText(/not what an OAuth consent screen will display/i)).toBeInTheDocument();
  });

  it('omits invented scopes and agent assignments for a runtime Composio app', async () => {
    server.composioStatus = { enabled: true, totalApps: 1, popularApps: [] };
    server.composioApps = {
      total: 1,
      limit: 500,
      offset: 0,
      apps: [{ id: 'acme-crm', name: 'Acme CRM', description: 'Acme contacts', category: 'Sales' }],
      categories: [],
    };
    await renderConnectors();

    await click(screen.getByRole('button', { name: /^Show all \(/ }));
    await click(await screen.findByRole('button', { name: /Acme CRM OAuth 2\.0/ }));

    expect(screen.getByText(/declares no scope list/i)).toBeInTheDocument();
    expect(screen.getByText(/no agent assignment is declared/i)).toBeInTheDocument();
    const html = document.body.textContent ?? '';
    expect(html).not.toContain('api:execute');
    expect(html).not.toContain('ExecutiveStrategyAgent');
  });

  it('filters a runtime app with its own action count rather than a synthesised scope', async () => {
    server.composioStatus = { enabled: true, totalApps: 1, popularApps: [] };
    server.composioApps = {
      total: 1,
      limit: 500,
      offset: 0,
      apps: [{ id: 'acme-crm', name: 'Acme CRM', description: 'Acme contacts', action_count: 37 }],
      categories: [],
    };
    await renderConnectors();

    await click(screen.getByRole('button', { name: /^Show all \(/ }));
    expect(await screen.findByText('37 actions reported')).toBeInTheDocument();
  });

  /**
   * Two halves of the same contract, kept as separate tests so a fake-timer
   * failure in one cannot leave a pending `waitFor` behind for the other:
   * the flow must NOT claim success on its own, and it MUST claim it once a
   * connector row actually appears.
   */
  describe('Composio OAuth completion', () => {
    function mockComposioApp() {
      server.composioStatus = { enabled: true, totalApps: 1, popularApps: [] };
      server.composioApps = {
        total: 1,
        limit: 500,
        offset: 0,
        apps: [{ id: 'acme-crm', name: 'Acme CRM', description: 'Acme contacts' }],
        categories: [],
      };
    }

    function mockedList() {
      return (jest.requireMock('@/lib/api-client') as { connectorsApi: { list: jest.Mock } })
        .connectorsApi;
    }

    /** Render and let the initial data load settle, then open the directory. */
    async function openAcmeApp() {
      render(<ConnectorsView workspaceId="ws-1" searchQuery="" />);
      await waitFor(() => {
        expect(screen.getByLabelText('Connector workspace')).not.toHaveAttribute(
          'aria-busy',
          'true',
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^Show all \(/ }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Connect Acme CRM' }));
      });
    }

    it('polls the connector list and claims nothing while no row exists', async () => {
      jest.useFakeTimers();
      mockComposioApp();
      mockedList().list.mockImplementation(async () => []);

      await openAcmeApp();

      expect(window.open).toHaveBeenCalledWith(
        'https://composio.test/auth',
        '_blank',
        'noopener,noreferrer',
      );
      const callsBefore = mockedList().list.mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // The poll actually happened...
      expect(mockedList().list.mock.calls.length).toBeGreaterThan(callsBefore);
      // ...and it did not invent a success.
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Acme CRM connected' }),
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.stringContaining('This tab checks for the resulting connector'),
        }),
      );
    });

    it('confirms the connection once the connector list shows the app', async () => {
      jest.useFakeTimers();
      mockComposioApp();
      // The connector only exists once the consent screen has been completed,
      // which is what `authUrl` standing in for the provider window models.
      const mocked = jest.requireMock('@/lib/api-client') as {
        connectorsApi: { list: jest.Mock; composio: { authUrl: jest.Mock } };
      };
      let authorized = false;
      mocked.connectorsApi.list.mockImplementation(async () =>
        authorized
          ? [{ id: 'c-1', name: 'acme-crm', type: 'mcp', config: { app: 'acme-crm' } }]
          : [],
      );
      mocked.connectorsApi.composio.authUrl.mockImplementation(async () => {
        authorized = true;
        return { status: 'ok', url: 'https://composio.test/auth' };
      });

      await openAcmeApp();
      expect(window.open).toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'success',
          title: 'Acme CRM connected',
          detail: 'A connector row for this app now exists in this workspace.',
        }),
      );
    });
  });

  it('has a real search field inside the view, not one owned by the page header', async () => {
    server.composioStatus = { enabled: true, totalApps: 2, popularApps: [] };
    await renderConnectors();

    const search = screen.getByRole('searchbox', { name: 'Search connectors in this directory' });
    await act(async () => {
      fireEvent.change(search, { target: { value: 'zzz-no-such-connector' } });
    });
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
  });

  it('gives every sector chip a real predicate, including Marketing', async () => {
    // The bundled catalog carries no Marketing row at all, so the only honest
    // way to prove the branch exists is to feed it a runtime app whose category
    // the server actually reported.
    server.composioStatus = { enabled: true, totalApps: 2, popularApps: [] };
    server.composioApps = {
      total: 2,
      limit: 500,
      offset: 0,
      apps: [
        { id: 'acme-ads', name: 'Acme Ads', description: 'Campaigns', category: 'Marketing' },
        { id: 'acme-crm', name: 'Acme CRM', description: 'Contacts', category: 'Sales' },
      ],
      categories: ['Marketing', 'Sales'],
    };
    await renderConnectors();
    await click(screen.getByRole('button', { name: /^Show all \(/ }));

    expect(await screen.findByRole('button', { name: /Acme Ads OAuth 2\.0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acme CRM OAuth 2\.0/ })).toBeInTheDocument();

    await click(screen.getByRole('button', { name: /^Marketing/ }));
    expect(screen.getByRole('heading', { name: /Marketing & Social/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acme Ads OAuth 2\.0/ })).toBeInTheDocument();
    // A real branch, not the generic `cat.includes(sel)` fall-through: the sales
    // app must not ride along.
    expect(screen.queryByRole('button', { name: /Acme CRM OAuth 2\.0/ })).toBeNull();

    const select = screen.getByLabelText('Filter connectors by sector') as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(
      expect.arrayContaining([
        'All',
        'Education',
        'Sales',
        'Productivity',
        'Engineering',
        'Financial',
        'Legal',
        'HR',
        'AI & ML',
        'Data & Analytics',
        'Communication',
        'Marketing',
        'Support',
        'E-Commerce',
        'Google',
        'Native',
        'MCP',
      ]),
    );
  });

  it('makes a catalog card keyboard operable without nesting a button in a click target', async () => {
    await renderConnectors();

    const openCard = screen.getByRole('button', { name: /^Google Drive/ });
    expect(openCard.tagName).toBe('BUTTON');
    // The Connect control is a sibling of that button, not a descendant.
    expect(openCard.querySelector('button')).toBeNull();

    const card = openCard.closest('li') as HTMLElement;
    await click(within(card).getByRole('button', { name: /Connect/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('marks the studio connector panels as tables and the catalog grids as lists', async () => {
    server.connectors = [mcpConnector()];
    server.builtin = [
      {
        id: 'sqlite-memory-mcp',
        name: 'SQLite Memory MCP',
        description: 'Sovereign relational database engine',
        transport: 'stdio',
        tools: ['list_tables'],
        config: {
          transport: 'stdio',
          command: '/opt/venv/bin/python',
          args: ['-m', 'api.mcp_servers.sqlite_mcp'],
        },
      },
    ];
    server.builtinResponse = { builtinServers: server.builtin };
    await renderConnectors();

    expect(screen.getAllByRole('list').length).toBeGreaterThan(0);
    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));

    const custom = await screen.findByRole('table', {
      name: 'Custom connectors in this workspace',
    });
    expect(
      within(custom)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Connector', 'Protocol', 'Status', 'Actions']);
    expect(within(custom).getByRole('row', { name: /SQLite Memory MCP/ })).toHaveTextContent(
      'conn-mcp-1',
    );
    // The built-in panel is a sibling table, not a descendant of this one.
    const builtins = screen.getByRole('table', { name: 'Built-in MCP servers' });
    expect(
      within(builtins)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Server', 'Transport', 'Declared tools', 'Action']);
    expect(within(builtins).getByRole('row', { name: /list_tables/ })).toBeInTheDocument();
  });

  it('confirms a disconnect instead of removing a connector on the first click', async () => {
    server.connectors = [mcpConnector()];
    await renderConnectors();

    await click(screen.getByRole('tab', { name: /Custom Protocols/i }));
    await click(await screen.findByRole('button', { name: 'Remove SQLite Memory MCP' }));

    const dialog = screen.getByRole('dialog');
    expect(server.deleted).toEqual([]);
    await click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(server.deleted).toEqual(['conn-mcp-1']));
  });
});
