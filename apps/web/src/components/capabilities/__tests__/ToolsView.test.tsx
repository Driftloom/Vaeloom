/**
 * ToolsView's enable gate.
 *
 * The switch this suite covers used to write `vaeloom.tools.suites.<workspace>`
 * into localStorage and its Tooltip said so: "Browser-local visibility
 * preference. The server registers every built-in tool unconditionally." Both
 * halves of that are now false. A `workspace_capabilities` row with
 * `category='tool'` and `enabled=false` makes `execute_tool` raise
 * `PermissionDeniedError`, so a switch that only moves a browser preference is a
 * control that lies about what it controls.
 *
 * Every assertion here is about the SERVER's state, not the component's:
 *   - which rows were written, under which tool name;
 *   - what the switch shows when only some of a suite's tools have rows;
 *   - what it shows when a write fails, which must be "still enabled".
 *
 * The absent-means-enabled invariant is the reason several of these tests look
 * backwards: a tool with no row runs, so an empty map must render as ON.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { ToolsView } from '../ToolsView';
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

/** `GET /capabilities?category=tool` rows, camelCased by `transformKeys`. */
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
        return category === 'tool' ? server.toolRows.map((row) => ({ ...row })) : [];
      }),
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
    capabilitiesApi: { list: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  const maybeFail = (err: Error | null) => {
    if (err) throw err;
  };
  mocked.capabilitiesApi.list.mockImplementation(async (category?: string) => {
    maybeFail(server.failures.list);
    return category === 'tool' ? server.toolRows.map((row) => ({ ...row })) : [];
  });
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

const WORKSPACE = 'ws-tools-1';

function renderView(props: Partial<React.ComponentProps<typeof ToolsView>> = {}) {
  const tools: CapabilityItem[] = [];
  return render(<ToolsView tools={tools} workspaceId={WORKSPACE} {...props} />);
}

/** `memory-graph` renders as "Memory Graph"; the switch lives in the same card. */
function suiteIdLabel(suiteId: string): string {
  return suiteId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** The suite card for a suite id. The suite name is a span inside the card's li. */
function suiteCard(suiteId: string): HTMLElement {
  const card = screen
    .getAllByText(suiteIdLabel(suiteId))
    .map((node) => node.closest('li'))
    .find((node) => node !== null);
  if (!card) throw new Error(`No suite card for ${suiteId}`);
  return card;
}

function suiteSwitch(suiteId: string): HTMLElement {
  return within(suiteCard(suiteId)).getByRole('switch');
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

/** memory-graph is the default selection: search_documents, query_graph, create_entity. */
const MEMORY_GRAPH_TOOLS = ['search_documents', 'query_graph', 'create_entity'] as const;

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
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
    const tooltip = openTooltip(suiteSwitch('memory-graph'));
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

    fireEvent.click(suiteSwitch('memory-graph'));

    await waitFor(() => expect(server.toolRows).toHaveLength(3));
    expect(server.toolRows.map((row) => row.name).sort()).toEqual([...MEMORY_GRAPH_TOOLS].sort());
    for (const row of server.toolRows) {
      expect(row.enabled).toBe(false);
      expect(row.category).toBe('tool');
    }
    // A row named after the suite would be a row nothing reads: the gate matches
    // on the individual tool name.
    expect(server.toolRows.some((row) => row.name === 'memory-graph')).toBe(false);
  });

  it('reflects a fully disabled suite as off, from the server rows', async () => {
    server.toolRows = MEMORY_GRAPH_TOOLS.map((name) =>
      toolRow(name, { id: `row-${name}`, enabled: false }),
    );
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('all 3 denied')).toBeInTheDocument();
  });

  it('shows a partially disabled suite as partially denied, never as disabled', async () => {
    // One tool of three has a disabling row. The suite is not disabled: two of its
    // tools still run.
    server.toolRows = [toolRow('query_graph', { id: 'row-query_graph', enabled: false })];
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('1 of 3 denied')).toBeInTheDocument();
    expect(screen.queryByText('all 3 denied')).toBeNull();
    // The accessible name carries the mixed state too, so the switch is not read
    // as a plain "on" by a screen reader either.
    expect(suiteSwitch('memory-graph').closest('div')?.textContent).toContain(
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
    const tooltip = openTooltip(suiteSwitch('memory-graph'));
    expect(tooltip).toHaveTextContent('2 of 3 tools have an enabled=false row');
    expect(tooltip).toHaveTextContent('query_graph');
    expect(tooltip).toHaveTextContent('create_entity');
    expect(tooltip).toHaveTextContent('no row means enabled');
  });

  it('says in the tooltip where the state is enforced', async () => {
    renderView();
    await waitForGateLoaded();

    const tooltip = openTooltip(suiteSwitch('memory-graph'));
    expect(tooltip).toHaveTextContent('the gate keys on the individual tool name');
    expect(tooltip).toHaveTextContent('execute_tool');
  });

  it('treats an explicit enabled row as enabled, and says the row exists', async () => {
    server.toolRows = [toolRow('search_documents', { id: 'row-sd', enabled: true })];
    renderView();
    await waitForGateLoaded();

    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
    expect(document.body.textContent ?? '').not.toContain('denied');
  });

  it('re-enables through the same rows rather than deleting them', async () => {
    server.toolRows = MEMORY_GRAPH_TOOLS.map((name) =>
      toolRow(name, { id: `row-${name}`, enabled: false }),
    );
    renderView();
    await waitForGateLoaded();
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(suiteSwitch('memory-graph'));

    await waitFor(() => expect(server.toolRows.every((row) => row.enabled)).toBe(true));
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
  });

  it('disables the switches when the rows cannot be read, instead of guessing', async () => {
    server.failures.list = new Error('502 Bad Gateway');
    renderView();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('502 Bad Gateway');
    expect(alert).toHaveTextContent('The switches are disabled');
    // An empty map after a failure is indistinguishable from "no row means
    // enabled", which is exactly the confusion the disabled state prevents.
    expect(suiteSwitch('memory-graph')).toBeDisabled();
  });
});

// ─── Failure paths ───────────────────────────────────────────────────────────

describe('ToolsView gate write failures', () => {
  it('leaves the switch showing enabled when the row write fails', async () => {
    renderView();
    await waitForGateLoaded();
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');

    server.failures.update = Object.assign(new Error('Capability not found'), { status: 404 });
    fireEvent.click(suiteSwitch('memory-graph'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: '3 of 3 row writes failed' }),
      ),
    );
    // The rows the server refused do not exist, so the tools still run. A switch
    // reading "off" here would be a claim about server state that is false.
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
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

    fireEvent.click(suiteSwitch('memory-graph'));

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
    expect(suiteSwitch('memory-graph')).toHaveAttribute('aria-checked', 'true');
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
