/**
 * Capabilities route.
 *
 * The previous version of this file stubbed `swr` to return `data: undefined` for
 * every key, which meant the page rendered the offline seed and none of its data
 * path ran: no server merge, no write, no error state. Every assertion about
 * "installed vs browse" or "the save hit the server" would have passed against a
 * component that never asked the server anything.
 *
 * The `swr` stub below actually invokes each fetcher, and `@/lib/api-client` is
 * a small in-memory server with the same status codes the real one returns --
 * including the 409 a bundled capability gets from DELETE. Status codes are
 * asserted exactly; this repo bans `expect(x).toBe(y || z)`-style range checks.
 */

import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import CapabilitiesPage from './page';

// Six sibling panes, each of which mounts a full data load on tab activation.
// The default 5s budget is below what one render costs when several suites run
// concurrently, and a timeout here reports as a red build for no real reason.
jest.setTimeout(20000);

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-test-123' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

const mockToast = jest.fn();
jest.mock('../../../../components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ─── Fake server ─────────────────────────────────────────────────────────────

type MockRow = Record<string, unknown> & {
  id: string | null;
  name: string;
  category: string;
  installed: boolean;
  bundled: boolean;
  enabled: boolean;
};

const BASE_ROW = {
  description: '',
  status: 'active',
  version: '1.0.0',
  author: 'Vaeloom Core Team',
  type: 'built-in',
  runtime: 'python',
  config: {} as Record<string, unknown>,
  tags: [] as string[],
  triggers: [] as string[],
  markdownDoc: null as string | null,
  requiredScope: null as string | null,
  trustClass: null as string | null,
  autonomy: null as string | null,
  usageCount: 0,
  lastUsedAt: null as string | null,
  slug: null as string | null,
  installedAt: null as string | null,
  createdAt: '2026-09-20T00:00:00Z',
  updatedAt: '2026-09-20T00:00:00Z',
  workspaceId: 'ws-test-123' as string | null,
};

/** A row the workspace has actually registered. */
function installedSkill(overrides: Partial<MockRow> = {}): MockRow {
  return {
    ...BASE_ROW,
    id: 'srv-skill-1',
    name: 'acceptance-criteria-review',
    category: 'skill',
    installed: true,
    bundled: false,
    enabled: true,
    ...overrides,
  };
}

/**
 * A catalog row. `id` is null and `installed` is false by contract -- a catalog
 * entry has no workspace row to point at, so treating it as installed is how the
 * two lists used to disagree.
 */
function catalogSkill(overrides: Partial<MockRow> = {}): MockRow {
  return {
    ...BASE_ROW,
    id: null,
    workspaceId: null,
    category: 'skill',
    installed: false,
    bundled: true,
    enabled: false,
    ...overrides,
  };
}

const fakeDb = {
  skills: [] as MockRow[],
  updates: [] as Array<{ id: string; body: Record<string, unknown> }>,
  creates: [] as Array<Record<string, unknown>>,
  deletes: [] as string[],
  listSkillsError: null as Error | null,
};

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    agentCatalogApi: {
      get: jest.fn().mockResolvedValue({
        agents: [],
        total: 0,
        canonicalCount: 0,
        toolDefinitions: {},
      }),
    },
    // The four plugins that actually exist under plugins/ in this repo. Anything
    // else the Plugins pane shows is invented.
    pluginApi: {
      list: jest.fn().mockResolvedValue({
        plugins: ['tag-generator', 'summarizer', 'sentiment', 'translator'].map((name) => ({
          id: `plug-${name}`,
          name,
          description: `${name} plugin`,
          version: '1.0.0',
          author: 'Vaeloom',
          status: 'active',
          tags: [],
          entrypoint: `${name}.py`,
        })),
        total: 4,
        page: 1,
        page_size: 100,
      }),
      update: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    capabilitiesApi: {
      list: jest.fn().mockResolvedValue([]),
      listSkills: jest.fn().mockImplementation(async () => {
        if (fakeDb.listSkillsError) throw fakeDb.listSkillsError;
        return fakeDb.skills.map((row) => ({ ...row }));
      }),
      catalog: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (body: Record<string, unknown>) => {
        fakeDb.creates.push(body);
        const row: MockRow = {
          ...BASE_ROW,
          ...body,
          id: `srv-created-${fakeDb.creates.length}`,
          category: String(body['category']),
          installed: true,
          bundled: false,
          enabled: true,
        } as MockRow;
        fakeDb.skills.push(row);
        return { ...row };
      }),
      update: jest.fn().mockImplementation(async (id: string, body: Record<string, unknown>) => {
        fakeDb.updates.push({ id, body });
        const row = fakeDb.skills.find((entry) => entry.id === id);
        if (!row) throw httpError(404, 'Capability not found');
        if (body['enabled'] !== undefined) row.enabled = body['enabled'] as boolean;
        if (body['config']) {
          row.config = { ...row.config, ...(body['config'] as Record<string, unknown>) };
        }
        return { ...row };
      }),
      delete: jest.fn().mockImplementation(async (id: string) => {
        fakeDb.deletes.push(id);
        const row = fakeDb.skills.find((entry) => entry.id === id);
        if (!row) throw httpError(404, 'Capability not found');
        if (row.bundled) {
          throw httpError(409, 'Capability is not custom and cannot be deleted');
        }
        fakeDb.skills = fakeDb.skills.filter((entry) => entry.id !== id);
      }),
      toggleCapability: jest.fn().mockImplementation(async (id: string, enabled: boolean) => {
        fakeDb.updates.push({ id, body: { enabled } });
        const row = fakeDb.skills.find((entry) => entry.id === id);
        if (!row) throw httpError(404, 'Capability not found');
        row.enabled = enabled;
        return { ...row };
      }),
      test: jest.fn().mockResolvedValue({
        status: 'success',
        capability: 'test-cap',
        category: 'skill',
        timestamp: '2026-09-20T00:00:00Z',
        executionDurationMs: 25,
        validationErrors: [],
        result: { ok: true },
        // POST /agents/capabilities/test validates and never dispatches. The
        // endpoint's own docstring says so and its handler returns
        // `executed = False` for a skill, so a mock claiming `true` would render
        // the Agents and Tools views as having run something.
        executed: false,
      }),
      testCapability: jest.fn().mockResolvedValue({
        status: 'success',
        latencyMs: 12,
        output: 'ok',
        error: null,
        executed: true,
      }),
    },
    pluginApi: {
      list: jest.fn().mockResolvedValue({ plugins: [], total: 0, page: 1, page_size: 100 }),
      update: jest.fn().mockResolvedValue({}),
    },
    connectorsApi: {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'conn-1', name: 'test', type: 'rest' }),
      update: jest.fn().mockResolvedValue({ id: 'conn-1', name: 'test', type: 'rest' }),
      delete: jest.fn().mockResolvedValue(undefined),
      mcp: {
        builtin: jest.fn().mockResolvedValue({ builtin_servers: [] }),
        listTools: jest.fn().mockResolvedValue([]),
        refreshTools: jest.fn().mockResolvedValue([]),
        sync: jest
          .fn()
          .mockResolvedValue({ connector_id: 'conn-1', registered: [], bridged_total: 0 }),
        call: jest.fn().mockResolvedValue({ result: 'ok' }),
      },
      composio: {
        status: jest.fn().mockResolvedValue({ enabled: false, popular_apps: [], total_apps: 0 }),
        apps: jest
          .fn()
          .mockResolvedValue({ total: 0, limit: 1600, offset: 0, apps: [], categories: [] }),
        authUrl: jest.fn().mockResolvedValue({ url: 'https://example.com' }),
        sync: jest.fn().mockResolvedValue({ registered: [] }),
      },
    },
  };
});

// ─── Fake SWR ────────────────────────────────────────────────────────────────
//
// Real enough to drive the data path: the fetcher runs, its resolution becomes
// `data`, its rejection becomes `error`, and `mutate` refetches. Keyed cache is
// omitted because each test asserts on a freshly rendered tree.

jest.mock('swr', () => {
  const react = jest.requireActual('react');
  return {
    __esModule: true,
    default: (key: unknown, fetcher?: () => Promise<unknown>) => {
      const cacheKey = Array.isArray(key) ? key.join('|') : String(key);
      const [data, setData] = react.useState<unknown>(undefined);
      const [error, setError] = react.useState<unknown>(undefined);
      const fetcherRef = react.useRef(fetcher);
      fetcherRef.current = fetcher;

      const load = react.useCallback(() => {
        if (fetcherRef.current === undefined) return;
        Promise.resolve()
          .then(() => fetcherRef.current?.() as Promise<unknown>)
          .then(
            (value) => {
              setError(undefined);
              setData(value);
            },
            (err) => {
              setData(undefined);
              setError(err);
            },
          );
      }, []);

      react.useEffect(() => {
        load();
      }, [load, cacheKey]);

      return {
        data,
        error,
        isLoading: data === undefined && error === undefined,
        isValidating: false,
        mutate: load,
      };
    },
  };
});

jest.mock('../../../../hooks/useWorkspace', () => ({
  useWorkspaceConnectors: () => ({
    connectors: [],
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const apiClient = jest.requireMock('@/lib/api-client') as {
  capabilitiesApi: Record<string, jest.Mock>;
  connectorsApi: Record<string, jest.Mock>;
  pluginApi: Record<string, jest.Mock>;
};

const capsApi = () => apiClient.capabilitiesApi;
const agentCatalog = () => apiClient.agentCatalogApi;

/** Wait for the skills fetch to land and render. */
async function renderSkills() {
  const utils = render(<CapabilitiesPage />);
  await waitFor(() => {
    expect(capsApi()['listSkills']).toHaveBeenCalledWith('ws-test-123');
  });
  return utils;
}

async function openBrowse() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Browse \(/i }));
  });
}

/**
 * The row control for a skill name. A native button, so Enter and Space dispatch
 * a click; `aria-label` pins its accessible name to the skill name so the status
 * badges inside it cannot make the name ambiguous.
 */
function skillRowButton(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

/** The Install control inside the same list item as the named skill. */
function installButtonFor(name: string): HTMLElement {
  const item = skillRowButton(name).closest('li');
  if (!item) throw new Error(`No list item for ${name}`);
  return within(item as HTMLElement).getByRole('button', { name: 'Install' });
}

describe('CapabilitiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    fakeDb.skills = [];
    fakeDb.updates = [];
    fakeDb.creates = [];
    fakeDb.deletes = [];
    fakeDb.listSkillsError = null;
  });

  // ─── Structure ─────────────────────────────────────────────────────────────

  it('renders the canonical page heading and all 6 category tabs', async () => {
    await renderSkills();

    expect(screen.getByRole('heading', { level: 1, name: 'Capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /Capability category/i })).toBeInTheDocument();
    for (const label of ['Skills', 'Connectors', 'MCP', 'Plugins', 'Tools', 'Agents']) {
      expect(screen.getByRole('tab', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('wires the tablist to a labelled tabpanel and supports arrow-key navigation', async () => {
    await renderSkills();

    const skillsTab = screen.getByRole('tab', { name: /Skills/i });
    expect(skillsTab).toHaveAttribute('aria-controls', 'tabpanel-skills');
    const panel = document.getElementById('tabpanel-skills');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-skills');

    // Roving tabindex: exactly one tab is reachable with Tab.
    const reachable = screen
      .getAllByRole('tab')
      .filter((tab) => tab.getAttribute('tabindex') === '0');
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      fireEvent.keyDown(skillsTab, { key: 'ArrowRight' });
    });
    expect(screen.getByRole('tab', { name: /Connectors/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('tab', { name: /Connectors/i }), { key: 'End' });
    });
    expect(screen.getByRole('tab', { name: /Agents/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('reports an unrecognised server category instead of filing it under skills', async () => {
    capsApi()['list'].mockResolvedValue([
      { ...BASE_ROW, id: 'srv-wat', name: 'from-the-future', category: 'quantum' },
    ]);
    await renderSkills();

    await waitFor(() => expect(screen.getByText(/not shown/i)).toBeInTheDocument());
    // Never absorbed into a category it does not belong to.
    expect(screen.queryByText('from-the-future')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Skills/i })).toHaveTextContent('Skills0');
  });

  it('names the search field with a stable label and wires the "/" shortcut hook', async () => {
    await renderSkills();

    const search = screen.getByRole('searchbox', { name: 'Search capabilities' });
    expect(search).toHaveAttribute('data-search-input');
    // The placeholder tracks the active tab, so it must not be the accessible name.
    expect(search).toHaveAttribute('placeholder', 'Filter installed skills');

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Agents/i }));
    });
    expect(screen.getByRole('searchbox', { name: 'Search capabilities' })).toBeInTheDocument();
  });

  it('takes the CTA accessible name from its visible text, not a fixed label', async () => {
    await renderSkills();

    const cta = screen.getByRole('button', { name: 'New Skill' });
    expect(cta).not.toHaveAttribute('aria-label');
    expect(cta).toHaveTextContent('New Skill');

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Agents/i }));
    });
    expect(screen.getByRole('button', { name: 'New Agent' })).toBeInTheDocument();
  });

  // ─── B: category vocabulary ────────────────────────────────────────────────

  it('translates the plural UI category to the singular the server accepts on create', async () => {
    await renderSkills();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Skill' }));
    });

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText(/e\.g\. code-synthesizer/i), {
      target: { value: 'contract-review' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Create Capability/i }));
    });

    await waitFor(() => expect(fakeDb.creates.length).toBeGreaterThanOrEqual(1));
    // 'skills' is a UI-only plural; the backend VALID_CATEGORIES entry is 'skill'.
    expect(fakeDb.creates.map((body) => body['category'])).toEqual(['skill']);
  });

  it("routes a server row categorised 'skill' into the Skills tab", async () => {
    fakeDb.skills = [
      installedSkill({
        id: 'srv-agent-row',
        name: 'server-labelled-skill',
        category: 'skill',
      }),
    ];
    await renderSkills();

    expect(screen.getAllByText('server-labelled-skill').length).toBeGreaterThanOrEqual(1);
    expect(
      within(document.getElementById('tabpanel-skills') as HTMLElement).getByRole('heading', {
        level: 2,
      }),
    ).toHaveTextContent('server-labelled-skill');
  });

  // ─── D: installed vs browse ─────────────────────────────────────────────────

  it('splits installed from catalog rows using installed, never enabled', async () => {
    fakeDb.skills = [
      installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review', enabled: false }),
      catalogSkill({ name: 'catalog-only-skill', slug: 'catalog-only-skill' }),
    ];
    await renderSkills();

    // Installed, but disabled: it must still be counted and still be listed.
    expect(screen.getByRole('button', { name: /^Installed \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Browse \(/i })).toHaveTextContent('Browse (33)');
    expect(skillRowButton('acceptance-criteria-review')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1);

    // The tab badge and the Installed label come from one count.
    expect(screen.getByRole('tab', { name: /Skills/i })).toHaveTextContent('Skills1');

    // The catalog row has no server row, so it cannot be toggled or deleted.
    await openBrowse();
    expect(await screen.findByText('catalog-only-skill')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Install' }).length).toBeGreaterThan(0);
  });

  it('reports a catalog row with a null id as not installed instead of inventing telemetry', async () => {
    fakeDb.skills = [
      installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review' }),
      catalogSkill({
        name: 'never-run-skill',
        slug: 'never-run-skill',
        usageCount: 0,
        lastUsedAt: null,
        requiredScope: null,
        trustClass: null,
        autonomy: null,
        markdownDoc: null,
        tags: [],
      }),
    ];
    await renderSkills();

    await openBrowse();
    await userClickRow('never-run-skill');

    // Never fabricated: no scope, no trust class, no autonomy, no "Recently".
    expect(screen.getAllByText('Not declared by the server').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Never run')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.queryByText('Recently')).not.toBeInTheDocument();
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });

  it('renders the real last-used timestamp rather than a fixed phrase', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    fakeDb.skills = [
      installedSkill({
        id: 'srv-skill-1',
        name: 'acceptance-criteria-review',
        lastUsedAt: twoHoursAgo,
        usageCount: 7,
      }),
    ];
    await renderSkills();

    await userClickRow('acceptance-criteria-review');
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  // ─── C: writes ─────────────────────────────────────────────────────────────

  it('saves a skill doc with PATCH and reports the workspace write', async () => {
    fakeDb.skills = [installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review' })];
    await renderSkills();

    await userClickRow('acceptance-criteria-review');
    await userEditDoc('# Updated instructions\n\n- Custom rule 1');

    const docPatch = fakeDb.updates.filter((entry) => 'config' in entry.body);
    expect(docPatch).toHaveLength(1);
    expect(docPatch[0]?.id).toBe('srv-skill-1');
    expect(docPatch[0]?.body).toEqual({
      config: { doc: '# Updated instructions\n\n- Custom rule 1' },
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Saved instructions'),
        detail: expect.stringContaining('workspace capability row'),
      }),
    );
  });

  it('sends only the doc on a save, so the stored JSON Schema is never rewritten', async () => {
    const storedSchema = {
      type: 'object',
      properties: { resume_text: { type: 'string' }, max_results: { type: 'integer' } },
      required: ['resume_text'],
    };
    fakeDb.skills = [
      installedSkill({
        id: 'srv-skill-1',
        name: 'acceptance-criteria-review',
        // The schema subtree is on OPAQUE_DATA_KEYS, so these property names
        // arrive exactly as the server wrote them.
        config: { parameters: storedSchema },
      }),
    ];
    await renderSkills();

    await userClickRow('acceptance-criteria-review');
    await userEditDoc('# Schema must survive');

    expect(fakeDb.updates).toEqual([
      { id: 'srv-skill-1', body: { config: { doc: '# Schema must survive' } } },
    ]);
    // Nothing that could rename a property reached the server, and the stored
    // schema still has the author's spelling.
    const stored = fakeDb.skills[0]?.config['parameters'] as { properties: object };
    expect(Object.keys(stored.properties)).toEqual(['resume_text', 'max_results']);
  });

  it('falls back to the browser and says so when the skill has no server row', async () => {
    await renderSkills();
    await openBrowse();
    await userClickRow('accessibility-testing');

    await userEditDoc('# Local only edit');

    expect(fakeDb.updates).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
        title: expect.stringContaining('in this browser only'),
        detail: expect.stringContaining('not persisted to the workspace'),
      }),
    );
  });

  it('stays in edit mode and reports failure when the server rejects the save', async () => {
    fakeDb.skills = [installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review' })];
    await renderSkills();
    await userClickRow('acceptance-criteria-review');

    capsApi()['update'].mockRejectedValueOnce(httpError(500, 'Internal Server Error'));

    await userEditDoc('# Doomed edit', { expectSaved: false });

    expect(screen.getByText(/Nothing was written/i)).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'error',
        title: expect.stringContaining('Could not save'),
        detail: 'Internal Server Error',
      }),
    );
  });

  it('tells the user a 404 save landed in the browser only', async () => {
    fakeDb.skills = [installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review' })];
    await renderSkills();
    await userClickRow('acceptance-criteria-review');

    capsApi()['update'].mockRejectedValueOnce(httpError(404, 'Capability not found'));

    await userEditDoc('# Local fallback');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
        title: expect.stringContaining('in this browser only'),
        detail: expect.stringContaining('404'),
      }),
    );
  });

  it('surfaces the 409 a bundled skill returns from DELETE instead of claiming success', async () => {
    fakeDb.skills = [
      installedSkill({
        id: 'srv-skill-1',
        name: 'acceptance-criteria-review',
        bundled: true,
      }),
    ];
    await renderSkills();
    await userClickRow('acceptance-criteria-review');

    await userConfirmDelete();

    expect(fakeDb.deletes).toEqual(['srv-skill-1']);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'error',
        title: 'Bundled skills cannot be deleted',
        detail: expect.stringContaining('409'),
      }),
    );
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Skill deleted' }));
    // Still listed: a refused delete must not look like a successful one.
    expect(skillRowButton('acceptance-criteria-review')).toBeInTheDocument();
  });

  it('deletes a custom skill from the workspace and drops it from the list', async () => {
    fakeDb.skills = [
      installedSkill({
        id: 'srv-custom-1',
        name: 'acceptance-criteria-review',
        bundled: false,
      }),
    ];
    await renderSkills();
    await userClickRow('acceptance-criteria-review');

    await userConfirmDelete();

    expect(fakeDb.deletes).toEqual(['srv-custom-1']);
    expect(fakeDb.skills).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'info', title: 'Skill deleted' }),
    );
  });

  it('persists a disable with PATCH and leaves the skill recoverable in place', async () => {
    fakeDb.skills = [
      installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review', enabled: true }),
    ];
    await renderSkills();

    const toggle = screen.getByRole('switch', { name: 'Enable acceptance-criteria-review' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() =>
      expect(fakeDb.updates).toEqual([{ id: 'srv-skill-1', body: { enabled: false } }]),
    );

    // Disabling must not remove it from Installed, and must be reversible from
    // where the user already is.
    expect(screen.getByRole('button', { name: /^Installed \(1\)/i })).toBeInTheDocument();
    expect(skillRowButton('acceptance-criteria-review')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Enable acceptance-criteria-review' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    });
    await waitFor(() =>
      expect(fakeDb.updates).toEqual([
        { id: 'srv-skill-1', body: { enabled: false } },
        { id: 'srv-skill-1', body: { enabled: true } },
      ]),
    );
  });

  it('registers a catalog skill with the singular category when installing', async () => {
    fakeDb.skills = [catalogSkill({ name: 'catalog-only-skill', slug: 'catalog-only-skill' })];
    await renderSkills();
    await openBrowse();

    const installButtons = screen.getAllByRole('button', { name: 'Install' });
    expect(installButtons.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(installButtonFor('catalog-only-skill'));
    });

    await waitFor(() => expect(fakeDb.creates.length).toBeGreaterThanOrEqual(1));
    expect(fakeDb.creates[0]).toEqual(
      expect.objectContaining({ name: 'catalog-only-skill', category: 'skill' }),
    );
  });

  it('keeps the scope the catalog declares when it installs the skill', async () => {
    // POST stores only what it is handed, so an install that omits the scope
    // registers a capability with no scope at all -- and nothing reads it back.
    fakeDb.skills = [
      catalogSkill({
        name: 'catalog-only-skill',
        slug: 'catalog-only-skill',
        requiredScope: 'memory.read,memory.write',
      }),
    ];
    await renderSkills();
    await openBrowse();

    await act(async () => {
      fireEvent.click(installButtonFor('catalog-only-skill'));
    });

    await waitFor(() => expect(fakeDb.creates.length).toBeGreaterThanOrEqual(1));
    expect((fakeDb.creates[0]?.['config'] as Record<string, unknown>)['required_scope']).toBe(
      'memory.read,memory.write',
    );
  });

  it('writes the scope the user chose into the create payload, under the key the server reads', async () => {
    await renderSkills();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Tools/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Tool' }));
    });

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByPlaceholderText(/e\.g\. code-synthesizer/i), {
      target: { value: 'contract-review' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Create Capability/i }));
    });

    await waitFor(() => expect(fakeDb.creates.length).toBeGreaterThanOrEqual(1));
    // `CreateCapabilityRequest` has no top-level `required_scope` and Pydantic
    // drops unknown fields, so a POST can only carry it inside `config`.
    expect(fakeDb.creates[0]).not.toHaveProperty('requiredScope');
    const config = fakeDb.creates[0]?.['config'] as Record<string, unknown>;
    expect(config['required_scope']).toBe('memory.read');
  });

  // ─── Import: one layer owns the failure ────────────────────────────────────

  it('shows the import failure inline, registers nothing and leaves the URL on screen', async () => {
    await renderSkills();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /MCP/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New MCP Server' }));
    });

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('tab', { name: /Import Git \/ File/i }));
    });
    fireEvent.change(within(dialog).getByLabelText('Repository URL / endpoint'), {
      target: { value: 'https://github.com/acme/skills' },
    });
    capsApi()['create'].mockRejectedValueOnce(httpError(409, 'Capability already exists'));

    await act(async () => {
      fireEvent.submit(within(dialog).getByRole('button', { name: /Import & activate/i }));
    });

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was registered for https://github.com/acme/skills.');
    expect(alert).toHaveTextContent('Capability already exists');
    // Still open, so the URL the user typed is not lost.
    expect(within(dialog).getByLabelText('Repository URL / endpoint')).toHaveValue(
      'https://github.com/acme/skills',
    );
    // The page produces the message and the modal presents it: one report, not two.
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Import failed' }));
  });

  // ─── F: selection is keyboard reachable ────────────────────────────────────

  it('selects a skill from a real button that a keyboard can reach and activate', async () => {
    fakeDb.skills = [
      installedSkill({ id: 'srv-skill-1', name: 'acceptance-criteria-review' }),
      installedSkill({ id: 'srv-skill-2', name: 'agent-building' }),
    ];
    await renderSkills();

    const target = skillRowButton('agent-building');
    // A native button is what makes Enter and Space dispatch activation; the
    // previous control was a <div onClick>, unreachable and unactivatable.
    expect(target.tagName).toBe('BUTTON');
    expect(target).toHaveAttribute('type', 'button');
    expect(target.getAttribute('tabindex')).toBeNull();

    expect(target).not.toHaveAttribute('aria-current');
    await act(async () => {
      fireEvent.click(target);
    });
    expect(skillRowButton('agent-building')).toHaveAttribute('aria-current', 'true');
    expect(
      within(document.getElementById('tabpanel-skills') as HTMLElement).getByRole('heading', {
        level: 2,
        name: 'agent-building',
      }),
    ).toBeInTheDocument();
  });

  // ─── H: empty, error and degraded states ───────────────────────────────────

  it('distinguishes nothing-installed from no-results and offers the way out', async () => {
    await renderSkills();

    // Nothing installed: an empty Installed tab, with the catalog one click away.
    expect(screen.getByText('No skills installed')).toBeInTheDocument();
    const browseCta = screen.getByRole('button', { name: /Browse the catalog/i });

    await act(async () => {
      fireEvent.click(browseCta);
    });
    expect(screen.getAllByText('acceptance-criteria-review').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No skills installed')).not.toBeInTheDocument();
  });

  it('reports a search with no matches and can clear it', async () => {
    await renderSkills();
    await openBrowse();

    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search capabilities' }), {
        target: { value: 'zzz-no-such-skill' },
      });
    });

    expect(screen.getByText('No skills match this search')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Reset search$/i }));
    });
    expect(screen.queryByText('No skills match this search')).not.toBeInTheDocument();
    expect(screen.getAllByText('acceptance-criteria-review').length).toBeGreaterThanOrEqual(1);
  });

  it('reports an empty catalog as its own condition with a create call to action', async () => {
    fakeDb.skills = [];
    localStorage.setItem(
      `vaeloom.capabilities.dismissed.ws-test-123`,
      JSON.stringify({
        v: 1,
        data: (await import('@/lib/capabilities-data')).SEED_CAPABILITIES.map((s) => s.id),
      }),
    );
    await renderSkills();

    expect(screen.getByText('No skills available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create a skill$/i })).toBeInTheDocument();
  });

  it('surfaces a failing skills fetch with a retry that refetches', async () => {
    fakeDb.listSkillsError = httpError(503, 'Service Unavailable');
    await renderSkills();

    expect(screen.getByText('Skills could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Service Unavailable')).toBeInTheDocument();
    const callsBefore = capsApi()['listSkills'].mock.calls.length;

    fakeDb.listSkillsError = null;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    });

    await waitFor(() =>
      expect(capsApi()['listSkills'].mock.calls.length).toBeGreaterThan(callsBefore),
    );
    await waitFor(() =>
      expect(screen.queryByText('Skills could not be loaded')).not.toBeInTheDocument(),
    );
  });

  it('warns that the agent catalog is unavailable instead of hiding it', async () => {
    agentCatalog()['get'].mockRejectedValueOnce(httpError(502, 'Bad Gateway'));
    await renderSkills();

    expect(await screen.findByText('Live agent catalog unavailable')).toBeInTheDocument();
  });

  it('banners a corrupt local store rather than silently reverting to the seed', async () => {
    // A version this build cannot read: the reader refuses instead of guessing.
    localStorage.setItem(
      'vaeloom.capabilities.dismissed.ws-test-123',
      JSON.stringify({ v: 99, data: [] }),
    );
    await renderSkills();

    expect(screen.getByText('Local capability store is unreadable')).toBeInTheDocument();
    expect(screen.getByText(/newer app version/)).toBeInTheDocument();
  });

  // ─── Sibling views keep working ────────────────────────────────────────────

  it('switches to the Connectors tab and shows the canonical providers', async () => {
    await renderSkills();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Connectors/i }));
    });

    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText(/Custom Protocols/i)).toBeInTheDocument();
  });

  it('switches to the Agents tab and lists the seeded agents', async () => {
    await renderSkills();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Agents/i }));
    });

    expect(screen.getAllByText('organization').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /Chat with/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/chat?agent='),
    );
  });

  it('switches to the Tools tab and lists the seeded tools', async () => {
    await renderSkills();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Tools/i }));
    });

    expect(screen.getAllByText('search_documents').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to the Plugins tab and lists the real plugin rows, not invented ones', async () => {
    await renderSkills();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Plugins/i }));
    });

    // The real bundled plugins in this repo, which are the workspace rows.
    expect(await screen.findByText('tag-generator')).toBeInTheDocument();
    expect(screen.getByText('summarizer')).toBeInTheDocument();

    // The registry answered with zero rows and there is no "Bots / Kanban /
    // Radio" table: those three were hard-coded here and exist in no plugin
    // table, each behind a switch rendered as if it were live.
    const text = document.body.textContent ?? '';
    for (const invented of [
      'builtin-bots',
      'builtin-kanban',
      'builtin-radio',
      'Desktop UI',
      'Agent Runtime',
    ]) {
      expect(text).not.toContain(invented);
    }
    // The two unimplemented controls are gone: one toasted a directory path, the
    // other reported "Plugins scanned & reloaded" for an action that did nothing.
    expect(text).not.toContain('Plugins scanned & reloaded');
    expect(text).not.toContain('Browse local plugins directory');
  });

  it('switches to the MCP tab and shows its verified catalog', async () => {
    await renderSkills();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /MCP/i }));
    });

    await waitFor(() => expect(screen.getByText('Verified Catalog')).toBeInTheDocument());
  });

  it('does not synthesize MCP capabilities out of the connectors hook', async () => {
    await renderSkills();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /MCP/i }));
    });

    // The page used to manufacture `mcp-<connectorId>` rows with a usage count of
    // 12. No capability row named after a connector may exist anywhere on the route.
    const tabpanelText = document.body.textContent ?? '';
    expect(tabpanelText).not.toContain('mcp-conn');
    expect(fakeDb.skills.every((row) => row.category === 'skill')).toBe(true);
  });
});

// ─── Interaction helpers ─────────────────────────────────────────────────────

async function userClickRow(name: string) {
  await act(async () => {
    fireEvent.click(skillRowButton(name));
  });
}

async function userEditDoc(value: string, { expectSaved = true } = {}) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Edit instructions/i }));
  });
  const textarea = screen.getByRole('textbox', { name: /Skill instructions/i });
  await act(async () => {
    fireEvent.change(textarea, { target: { value } });
  });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /^Save changes$/i })[0] as HTMLElement);
  });
  if (expectSaved) {
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: /Skill instructions/i }),
      ).not.toBeInTheDocument(),
    );
  }
}

async function userConfirmDelete() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete skill' }));
  });
  await waitFor(() => expect(fakeDb.deletes.length).toBeGreaterThan(0));
}
