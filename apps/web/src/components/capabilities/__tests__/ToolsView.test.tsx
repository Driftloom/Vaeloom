/**
 * ToolsView's enable gate and suite data source.
 *
 * The switch this suite covers used to write `vaeloom.tools.suites.<workspace>`
 * into localStorage and its Tooltip said so: "Browser-local visibility
 * preference. The server registers every built-in tool unconditionally." Both
 * halves of that are now false. A `workspace_capabilities` row with
 * `category='tool'` and `enabled=false` makes `execute_tool` raise
 * `PermissionDeniedError`, so a switch that only moves a browser preference is a
 * control that lies about what it controls.
 *
 * Since the workbench rework, the suites themselves are also server data: the
 * tool rows that were once hand-copied into a client catalog now come from
 * `GET /capabilities/tools/definitions`, grouped client-side by the first dotted
 * segment of each tool's required scope. Some tests here therefore pin
 * grouping and labels as well:
 *   - which rows were written, under which tool name;
 *   - what the switch shows when only some of a suite's tools have rows;
 *   - what it shows when a write fails, which must be "still enabled";
 *   - that every rendered suite is derived from the served definitions.
 *
 * The absent-means-enabled invariant is the reason several of these tests look
 * backwards: a tool with no row runs, so an empty map must render as ON.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { SWRConfig, mutate as globalMutate } from 'swr';

import { ToolsView } from '../ToolsView';
import { invalidateCapabilities } from '@/lib/queries/capability-keys';
import { TOOL_DEFINITIONS_SWR_KEY } from '@/lib/tool-definitions-catalog';
import type { CapabilityItem } from '@/lib/capabilities-data';

// ─── Server doubles ──────────────────────────────────────────────────────────

interface ServerToolRow {
  id: string;
  name: string;
  category: 'tool';
  enabled: boolean;
  config: Record<string, unknown>;
  description?: string;
}

/**
 * One camelCased `GET /capabilities/tools/definitions` row, the client-shaped
 * record after `transformKeys` runs and while JSON Schema values pass through
 * verbatim. Every name/scope/category below was read out of the backend
 * registry (`ALL_TOOLS` in `apps/api/src/api/tools/definitions.py`); the
 * descriptions are neutral fixture text. `inputSchema` mirrors what the
 * backend's `_build_schema` produces for these tools.
 */
interface RegistryDefinition {
  name: string;
  description: string;
  requiredScope: string;
  category: string;
  trustClass: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

const FIXTURE_DEFINITIONS: RegistryDefinition[] = [
  {
    name: 'search_documents',
    description: 'Search across workspace documents.',
    requiredScope: 'memory.read',
    category: 'memory_read',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search for documents.' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'query_graph',
    description: 'Query the workspace knowledge graph.',
    requiredScope: 'memory.read',
    category: 'memory_read',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Graph query to run.' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'create_entity',
    description: 'Create an entity in the workspace memory graph.',
    requiredScope: 'memory.write',
    category: 'memory_write',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', description: 'Type of entity to create.' },
      },
      required: ['entity_type'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'spawn_sub_agents',
    description: 'Fan a task out to sub agents.',
    requiredScope: 'agent.spawn',
    category: 'system',
    trustClass: 'core_trusted',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt handed to the sub agents.' },
      },
      required: ['prompt'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'delegate_to_sub_agent',
    description: 'Delegate one task to a named sub agent.',
    requiredScope: 'agent.spawn',
    category: 'system',
    trustClass: 'core_trusted',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description for the sub agent.' },
      },
      required: ['task'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'search_gmail',
    description: 'Search Gmail messages.',
    requiredScope: 'connector.gmail.read',
    category: 'connector_read',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query.' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
  },
];

function fixtureDefinitions(): RegistryDefinition[] {
  return JSON.parse(JSON.stringify(FIXTURE_DEFINITIONS)) as RegistryDefinition[];
}

/** `GET /capabilities` rows, camelCased by `transformKeys`. The view now reads
 *  the shared unfiltered list key, so the double answers for any category and
 *  ToolsView filters `category === 'tool'` rows out of it client-side. */
function toolRow(name: string, overrides: Partial<ServerToolRow> = {}): ServerToolRow {
  return {
    id: `row-${name}`,
    name,
    category: 'tool',
    enabled: true,
    config: {},
    description: `${name} tool`,
    ...overrides,
  };
}

const server = {
  toolRows: [] as ServerToolRow[],
  failures: {
    list: null as Error | null,
    create: null as Error | null,
    update: null as Error | null,
  },
  nextId: 0,
};

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  const maybeFail = (err: Error | null) => {
    if (err) throw err;
  };
  return {
    ...actual,
    capabilitiesApi: {
      list: jest.fn(async (category?: string, workspaceId?: string) => {
        maybeFail(server.failures.list);
        void workspaceId;
        return !category || category === 'tool' ? server.toolRows.map((row) => ({ ...row })) : [];
      }),
      listToolDefinitions: jest.fn(async () => fixtureDefinitions()),
      create: jest.fn(async (body: Record<string, unknown>) => {
        maybeFail(server.failures.create);
        server.nextId += 1;
        const created = toolRow(String(body['name']), {
          // `POST /capabilities` has no `enabled` field and writes true.
          id: `created-${server.nextId}`,
          enabled: true,
          config: (body['config'] as Record<string, unknown>) ?? {},
        });
        server.toolRows.push(created);
        return { ...created };
      }),
      update: jest.fn(async (id: string, body: Record<string, unknown>) => {
        maybeFail(server.failures.update);
        const row = server.toolRows.find((entry) => entry.id === id);
        if (!row) throw Object.assign(new Error('Capability not found'), { status: 404 });
        if (typeof body['enabled'] === 'boolean') row.enabled = body['enabled'];
        return { ...row };
      }),
      test: jest.fn(),
    },
  };
});

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

/**
 * Re-seed the mock implementations.
 *
 * `jest.clearAllMocks()` wipes call history but keeps the last
 * `mockImplementation`, so without this an override in one test would hand its
 * own response to every test after it.
 */
function reapplyDefaults(): void {
  const mocked = jest.requireMock('@/lib/api-client') as {
    capabilitiesApi: {
      list: jest.Mock;
      listToolDefinitions: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  const maybeFail = (err: Error | null) => {
    if (err) throw err;
  };
  mocked.capabilitiesApi.list.mockImplementation(async (category?: string) => {
    maybeFail(server.failures.list);
    return !category || category === 'tool' ? server.toolRows.map((row) => ({ ...row })) : [];
  });
  mocked.capabilitiesApi.listToolDefinitions.mockImplementation(async () => fixtureDefinitions());
  mocked.capabilitiesApi.create.mockImplementation(async (body: Record<string, unknown>) => {
    maybeFail(server.failures.create);
    server.nextId += 1;
    const created = toolRow(String(body['name']), {
      id: `created-${server.nextId}`,
      enabled: true,
      config: (body['config'] as Record<string, unknown>) ?? {},
    });
    server.toolRows.push(created);
    return { ...created };
  });
  mocked.capabilitiesApi.update.mockImplementation(
    async (id: string, body: Record<string, unknown>) => {
      maybeFail(server.failures.update);
      const row = server.toolRows.find((entry) => entry.id === id);
      if (!row) throw Object.assign(new Error('Capability not found'), { status: 404 });
      if (typeof body['enabled'] === 'boolean') row.enabled = body['enabled'];
      return { ...row };
    },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A fresh workspace id per test.
 *
 * The gate now reads its rows through SWR, whose module-level cache outlives
 * `jest.clearAllMocks()`. Sharing one id across the file would let one test's
 * revalidated row answer every later one (whether the second mount refetches
 * depends on the dedup window, which makes the failure non-deterministic), so
 * every render gets its own key. The definitions cache is keyless-safe to
 * share: its data is static across tests.
 */
let workspaceSeq = 0;

/**
 * `swrCache` starts a test from an empty SWR cache.
 *
 * The module-level default cache shares the definitions key across every test
 * ("its data is static across tests" only holds while every test gets the
 * success answer). The failure tests need a cache that starts empty — one that
 * has never seen a definition — so a failing fetch cannot be papered over by
 * rows an earlier test happened to cache.
 */
function renderView(
  props: Partial<React.ComponentProps<typeof ToolsView>> & {
    swrCache?: () => Map<string, unknown>;
  } = {},
) {
  workspaceSeq += 1;
  const tools: CapabilityItem[] = [];
  const { swrCache, tools: toolsProp, ...rest } = props;
  return render(
    <SWRConfig value={{ provider: swrCache }}>
      <ToolsView tools={toolsProp ?? tools} workspaceId={`ws-tools-${workspaceSeq}`} {...rest} />
    </SWRConfig>,
  );
}

/** The suite card for a suite by its rendered name. The suite name is a span
 *  inside the card's li. */
function suiteCard(suiteName: string): HTMLElement {
  const card = screen
    .getAllByText(suiteName)
    .map((node) => node.closest('li'))
    .find((node) => node !== null);
  if (!card) throw new Error(`No suite card for ${suiteName}`);
  return card;
}

function suiteSwitch(suiteName: string): HTMLElement {
  return within(suiteCard(suiteName)).getByRole('switch');
}

/**
 * The switch's tooltip.
 *
 * `Tooltip` only mounts its content while visible, so the text has to be earned
 * with a hover — which is also the only way it is ever read.
 */
function openTooltip(control: HTMLElement): HTMLElement {
  const wrapper = control.parentElement;
  if (!wrapper) throw new Error('The control has no tooltip wrapper');
  fireEvent.mouseOver(wrapper);
  return screen.getByRole('tooltip');
}

/** The per-tool switch in the detail pane, by its accessible name. */
function toolSwitch(name: string): HTMLElement {
  return screen.getByRole('switch', { name: `Allow ${name} in this workspace` });
}

/** The memory suite is the default selection: search_documents, query_graph, create_entity. */
const MEMORY_TOOLS = ['search_documents', 'query_graph', 'create_entity'] as const;

/** Tool names that only ever existed in the fabricated client catalog. Task 1
 *  proved none of these is served by the backend registry. */
const CATALOG_ONLY_TOOLS = [
  'eval_python',
  'take_screenshot',
  'delegate_to_agent',
  'broadcast_message',
  'playback_state',
  'queue_track',
  'create_task_card',
  'cursor_click',
  'read_workspace_file',
  'write_workspace_file',
  'fetch_webpage_content',
  'execute_custom_capability',
] as const;

const SELECTED_SUITE_LABELS = ['Memory Graph', 'Agent Bus', 'Other'] as const;

async function waitForGateLoaded(): Promise<void> {
  await waitFor(() => expect(screen.queryByText(/Reading this workspace/)).toBeNull());
}

beforeEach(() => {
  jest.clearAllMocks();
  reapplyDefaults();
  localStorage.clear();
  server.toolRows = [];
  server.nextId = 0;
  server.failures.list = null;
  server.failures.create = null;
  server.failures.update = null;
});

// ─── The gate is server state ────────────────────────────────────────────────

describe('ToolsView tool enable gate', () => {
  it('reads the workspace rows and starts every switch on when there are none', async () => {
    renderView();
    await waitForGateLoaded();

    // No row means enabled. Rendering this as OFF would switch off the whole
    // built-in surface for every workspace that has never touched a toggle.
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    const tooltip = openTooltip(suiteSwitch('Memory Graph'));
    expect(tooltip).toHaveTextContent('No tool in Memory Graph has an enabled=false row');
    expect(tooltip).toHaveTextContent('Turning this off writes one capability row per tool');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('never describes the switch as a browser-local preference', async () => {
    renderView();
    await waitForGateLoaded();

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Browser-local visibility preference');
    expect(text).not.toContain('Stored in this browser only');
    // And it must say where the state actually lives.
    expect(text).toContain('workspace capability row with category=tool');
    expect(text).toContain('read by execute_tool at call time');
    expect(text).toContain('No row means enabled');
  });

  it('writes one capability row per tool in the suite, keyed by tool name', async () => {
    renderView();
    await waitForGateLoaded();

    fireEvent.click(suiteSwitch('Memory Graph'));

    await waitFor(() => expect(server.toolRows).toHaveLength(3));
    expect(server.toolRows.map((row) => row.name).sort()).toEqual([...MEMORY_TOOLS].sort());
    for (const row of server.toolRows) {
      expect(row.enabled).toBe(false);
      expect(row.category).toBe('tool');
    }
    // A row named after the suite would be a row nothing reads: the gate matches
    // on the individual tool name.
    expect(server.toolRows.some((row) => row.name === 'memory')).toBe(false);
  });

  it('reflects a fully disabled suite as off, from the server rows', async () => {
    server.toolRows = MEMORY_TOOLS.map((name) =>
      toolRow(name, { id: `row-${name}`, enabled: false }),
    );
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('all 3 denied')).toBeInTheDocument();
  });

  it('shows a partially disabled suite as partially denied, never as disabled', async () => {
    // One tool of three has a disabling row. The suite is not disabled: two of its
    // tools still run.
    server.toolRows = [toolRow('query_graph', { id: 'row-query_graph', enabled: false })];
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('1 of 3 denied')).toBeInTheDocument();
    expect(screen.queryByText('all 3 denied')).toBeNull();
    // The accessible name carries the mixed state too, so the switch is not read
    // as a plain "on" by a screen reader either.
    expect(suiteSwitch('Memory Graph').closest('div')?.textContent).toContain(
      'Partially disabled: 1 of 3 tools in Memory Graph are denied at execution',
    );
  });

  it('names the denied tools in a partial suite so the row can be found', async () => {
    server.toolRows = [
      toolRow('query_graph', { id: 'row-query_graph', enabled: false }),
      toolRow('create_entity', { id: 'row-create_entity', enabled: false }),
    ];
    renderView();
    await waitForGateLoaded();

    expect(screen.getByText('2 of 3 denied')).toBeInTheDocument();
    const tooltip = openTooltip(suiteSwitch('Memory Graph'));
    expect(tooltip).toHaveTextContent('2 of 3 tools have an enabled=false row');
    expect(tooltip).toHaveTextContent('query_graph');
    expect(tooltip).toHaveTextContent('create_entity');
    expect(tooltip).toHaveTextContent('no row means enabled');
  });

  it('says in the tooltip where the state is enforced', async () => {
    renderView();
    await waitForGateLoaded();

    const tooltip = openTooltip(suiteSwitch('Memory Graph'));
    expect(tooltip).toHaveTextContent('the gate keys on the individual tool name');
    expect(tooltip).toHaveTextContent('execute_tool');
  });

  it('treats an explicit enabled row as enabled, and says the row exists', async () => {
    server.toolRows = [toolRow('search_documents', { id: 'row-sd', enabled: true })];
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    expect(document.body.textContent ?? '').not.toContain('denied');
  });

  it('re-enables through the same rows rather than deleting them', async () => {
    server.toolRows = MEMORY_TOOLS.map((name) =>
      toolRow(name, { id: `row-${name}`, enabled: false }),
    );
    renderView();
    await waitForGateLoaded();
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(suiteSwitch('Memory Graph'));

    await waitFor(() => expect(server.toolRows.every((row) => row.enabled)).toBe(true));
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
  });

  it('disables the switches when the rows cannot be read, instead of guessing', async () => {
    server.failures.list = new Error('502 Bad Gateway');
    renderView();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('502 Bad Gateway');
    expect(alert).toHaveTextContent('The switches are disabled');
    // An empty map after a failure is indistinguishable from "no row means
    // enabled", which is exactly the confusion the disabled state prevents.
    expect(suiteSwitch('Memory Graph')).toBeDisabled();
  });

  it('keeps stale rows operable and says so when a background refresh fails', async () => {
    // One row on the server (query_graph denied) answers the first fetch; the
    // NEXT fetch fails while the view still holds the earlier rows.
    server.toolRows = [toolRow('query_graph', { id: 'row-query_graph', enabled: false })];
    renderView({ workspaceId: 'ws-tools-stale-refresh' });
    await waitForGateLoaded();

    server.failures.list = new Error('502 Bad Gateway');
    // Trigger the refetch the way production does — through the shared
    // invalidation helper, whose single-arg mutate keeps the cached rows.
    await act(async () => {
      await invalidateCapabilities('ws-tools-stale-refresh', 'list');
    });

    // Honest notice about the failed refresh — not the failed-state copy,
    // because the rows are on screen and the "nothing" claim would be false.
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('502 Bad Gateway');
    expect(notice).toHaveTextContent('last known state');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('The switches are disabled')).toBeNull();

    // The retained rows still read truthfully — and stay operable.
    expect(screen.getByText('1 of 3 denied')).toBeInTheDocument();
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    expect(suiteSwitch('Memory Graph')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'query_graph' }));
    expect(toolSwitch('query_graph')).toHaveAttribute('aria-checked', 'false');
    expect(toolSwitch('query_graph')).not.toBeDisabled();
  });
});

// ─── Suite data source: served definitions, grouped client-side ─────────────

describe('ToolsView suite data source', () => {
  it('groups the served definitions by scope prefix under their labels', async () => {
    renderView();
    await waitForGateLoaded();

    const memoryCard = suiteCard('Memory Graph');
    expect(memoryCard.textContent).toContain('search_documents');
    expect(memoryCard.textContent).toContain('query_graph');
    expect(memoryCard.textContent).toContain('create_entity');

    const agentCard = suiteCard('Agent Bus');
    expect(agentCard.textContent).toContain('spawn_sub_agents');
    expect(agentCard.textContent).toContain('delegate_to_sub_agent');
  });

  it('lands scope prefixes without a suite label under Other', async () => {
    renderView();
    await waitForGateLoaded();

    const otherCard = suiteCard('Other');
    expect(otherCard.textContent).toContain('search_gmail');
    // The labeled segments never leak into the catch-all suite.
    expect(otherCard.textContent).not.toContain('spawn_sub_agents');
    expect(otherCard.textContent).not.toContain('search_documents');
  });

  it('renders no catalog-only tool anywhere in the view', async () => {
    renderView();
    await waitForGateLoaded();

    // Visiting every suite exercises each suite's row list, not just the one
    // the drawer happens to open by default.
    for (const suiteName of SELECTED_SUITE_LABELS) {
      const card = suiteCard(suiteName);
      const selectButton = within(card).getAllByRole('button')[0];
      fireEvent.click(selectButton);

      const text = document.body.textContent ?? '';
      for (const phantom of CATALOG_ONLY_TOOLS) {
        expect(text).not.toContain(phantom);
      }
    }
  });
});

// ─── Definitions fetch failure: never a false "empty catalog" claim ─────────

/**
 * `GET /capabilities/tools/definitions` failing is a statement about the
 * network, not about the tool catalog. Rendering "The tool catalog is empty."
 * in that state claims the server answered and holds nothing — a claim about
 * server state that is false. These tests mirror the workspace-rows gate
 * design: no cached data → failure alert, no suites; cached data → rows plus a
 * stale notice, switches operable.
 */
describe('ToolsView definitions fetch failure', () => {
  it('renders a failure alert instead of suites, and never the empty-catalog copy', async () => {
    const mocked = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: { listToolDefinitions: jest.Mock };
    };
    mocked.capabilitiesApi.listToolDefinitions.mockImplementation(async () => {
      throw new Error('502 Bad Gateway');
    });

    // An empty SWR cache: nothing about the catalog can be known from history.
    renderView({ swrCache: () => new Map() });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('502 Bad Gateway');
    expect(alert).toHaveTextContent('could not be loaded');

    // The empty-catalog copy is a claim about server state that is false here.
    expect(screen.queryByText('The tool catalog is empty.')).toBeNull();
    // No cached data and no successful fetch: no suite may be guessed either.
    expect(screen.queryByText('Memory Graph')).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('keeps served rows operable under a stale notice when a refresh fails', async () => {
    // Rendered on the module default SWR cache: `mutate` imported from `swr`
    // only reaches that cache, unlike the scoped provider this file uses for
    // the failed-mount test above. The cache already holds the fixture the
    // earlier loads stored — the same definitions every test caches.
    renderView();
    await waitForGateLoaded();

    expect(suiteCard('Memory Graph').textContent).toContain('search_documents');

    const mocked = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: { listToolDefinitions: jest.Mock };
    };
    mocked.capabilitiesApi.listToolDefinitions.mockImplementation(async () => {
      throw new Error('502 Bad Gateway');
    });
    // Trigger the refetch the way production would after a background
    // revalidation — global mutate on the shared definitions key keeps the
    // cached rows and revalidates through the mounted fetcher.
    await act(async () => {
      await globalMutate(TOOL_DEFINITIONS_SWR_KEY);
    });

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('502 Bad Gateway');
    expect(notice).toHaveTextContent('last known state');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('The tool catalog is empty.')).toBeNull();

    // The retained rows still read truthfully — and stay operable.
    expect(suiteCard('Memory Graph').textContent).toContain('search_documents');
    expect(suiteSwitch('Memory Graph')).not.toBeDisabled();
  });
});

// ─── Failure paths ───────────────────────────────────────────────────────────

describe('ToolsView gate write failures', () => {
  it('leaves the switch showing enabled when the row write fails', async () => {
    renderView();
    await waitForGateLoaded();
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');

    server.failures.update = Object.assign(new Error('Capability not found'), { status: 404 });
    fireEvent.click(suiteSwitch('Memory Graph'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: '3 of 3 row writes failed' }),
      ),
    );
    // The rows the server refused do not exist, so the tools still run. A switch
    // reading "off" here would be a claim about server state that is false.
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    const detail = (mockToast.mock.calls.at(-1)?.[0] as { detail: string }).detail;
    expect(detail).toContain('still enabled server-side');
  });

  it('keeps the tools whose write landed and reports only the ones that failed', async () => {
    server.toolRows = [toolRow('search_documents', { id: 'row-sd', enabled: true })];
    renderView();
    await waitForGateLoaded();

    const mocked = jest.requireMock('@/lib/api-client') as {
      capabilitiesApi: { update: jest.Mock };
    };
    mocked.capabilitiesApi.update.mockImplementation(
      async (id: string, body: Record<string, unknown>) => {
        // Deny exactly one tool's row.
        if (id === 'row-sd') throw Object.assign(new Error('RLS denied'), { status: 403 });
        const row = server.toolRows.find((entry) => entry.id === id);
        if (!row) throw Object.assign(new Error('Capability not found'), { status: 404 });
        if (typeof body['enabled'] === 'boolean') row.enabled = body['enabled'];
        return { ...row };
      },
    );

    fireEvent.click(suiteSwitch('Memory Graph'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: '1 of 3 row writes failed' }),
      ),
    );
    const detail = (mockToast.mock.calls.at(-1)?.[0] as { detail: string }).detail;
    expect(detail).toContain('search_documents');
    expect(detail).toContain('RLS denied');
    expect(detail).toContain('The other 2 did change');

    // The two that did get rows are denied; the one that did not is not.
    await waitFor(() =>
      expect(server.toolRows.filter((row) => row.name !== 'search_documents')).toHaveLength(2),
    );
    expect(server.toolRows.find((row) => row.name === 'search_documents')?.enabled).toBe(true);
    expect(suiteSwitch('Memory Graph')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('2 of 3 denied')).toBeInTheDocument();
  });

  it('leaves a single tool switch on when its own write fails', async () => {
    renderView();
    await waitForGateLoaded();
    expect(toolSwitch('search_documents')).toHaveAttribute('aria-checked', 'true');

    server.failures.create = Object.assign(new Error('Capability with name already exists'), {
      status: 409,
    });

    fireEvent.click(toolSwitch('search_documents'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'error',
          title: 'search_documents was not disabled',
        }),
      ),
    );
    // Nothing was written, so the tool still runs and the switch still says so.
    expect(server.toolRows).toHaveLength(0);
    expect(toolSwitch('search_documents')).toHaveAttribute('aria-checked', 'true');
    const detail = (mockToast.mock.calls.at(-1)?.[0] as { detail: string }).detail;
    expect(detail).toContain('still has this tool enabled');
  });

  it('reports the tool it denies on the tool itself, not only on the suite', async () => {
    renderView();
    await waitForGateLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'create_entity' }));

    fireEvent.click(toolSwitch('create_entity'));

    await waitFor(() => expect(server.toolRows).toHaveLength(1));
    expect(server.toolRows[0]).toMatchObject({ name: 'create_entity', enabled: false });
    await waitFor(() =>
      expect(toolSwitch('create_entity')).toHaveAttribute('aria-checked', 'false'),
    );
    expect(screen.getByText('denied at execution')).toBeInTheDocument();
    expect(screen.getByText(/raises PermissionDeniedError/)).toBeInTheDocument();
    // The other two have no row, so the suite is partial rather than denied.
    expect(screen.getByText('1 of 3 denied')).toBeInTheDocument();
  });
});
