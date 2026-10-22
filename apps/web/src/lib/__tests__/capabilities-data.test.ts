/**
 * @jest-environment jsdom
 */

/**
 * These tests are regression guards for two specific classes of defect, both of
 * which shipped before: the catalog claimed execution telemetry that never
 * existed, and the storage layer failed in ways the user could not see.
 *
 * The telemetry assertions are blunt on purpose. Asserting "the seed has no
 * fabricated telemetry" is easier to reintroduce by accident than asserting one
 * field's value, so the seed is checked as a whole.
 */

const WS = 'ws-test-0000-0000-0000-000000000001';

interface CapabilityItemLike {
  id: string;
  name: string;
  category: string;
  tags: string[];
  description: string;
  enabled: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  requiredScope?: string;
  trustClass?: string;
  markdownDoc: string;
}

type Module = typeof import('@/lib/capabilities-data');

async function load(): Promise<Module> {
  return import('@/lib/capabilities-data');
}

beforeEach(() => {
  window.localStorage.clear();
  jest.resetModules();
});

describe('SEED_CAPABILITIES telemetry honesty', () => {
  it('stamps no execution count on any seeded capability', async () => {
    const { SEED_CAPABILITIES } = await load();

    const offenders = SEED_CAPABILITIES.filter((c) => c.usageCount !== 0);
    expect(offenders.map((c) => `${c.id}=${c.usageCount}`)).toEqual([]);
  });

  it('claims no last-used timestamp for any seeded capability', async () => {
    const { SEED_CAPABILITIES } = await load();

    const offenders = SEED_CAPABILITIES.filter((c) => c.lastUsedAt !== null);
    expect(offenders.map((c) => c.id)).toEqual([]);
  });

  it('carries no leftover pre-ISO lastUsed field', async () => {
    const { SEED_CAPABILITIES } = await load();

    for (const item of SEED_CAPABILITIES) {
      expect(item).not.toHaveProperty('lastUsed');
    }
  });

  it('never labels a community capability as first-party', async () => {
    const { SEED_CAPABILITIES } = await load();

    for (const item of SEED_CAPABILITIES) {
      if (item.source === 'community') {
        expect(item.trustClass).toBe('community');
      }
    }
  });

  it('only uses required scopes the backend actually emits', async () => {
    // Copied from apps/api/src/api/tools/definitions.py, mcp_client_service.py
    // and routers/capabilities.py. A scope outside this set fails closed at
    // execution time with a permission error the user cannot act on.
    const { SEED_CAPABILITIES } = await load();
    const backendScopes = new Set([
      'agent.spawn',
      'connector.calendar.read',
      'connector.calendar.write',
      'connector.docs.read',
      'connector.docs.write',
      'connector.drive.read',
      'connector.github.read',
      'connector.github.write',
      'connector.gmail.read',
      'connector.gmail.write',
      'connector.jobs.read',
      'connector.mcp.execute',
      'connector.notion.read_write',
      'connector.outlook.read',
      'connector.outlook.write',
      'connector.read',
      'connector.slack.write',
      'connector.write',
      'memory.read',
      'memory.write',
      'system.browser.read',
      'system.document.compile',
      'system.notify',
      'system.sandbox_exec',
      'system.web_search',
      'workspace.write',
    ]);

    const offenders: string[] = [];
    for (const item of SEED_CAPABILITIES) {
      if (!item.requiredScope) continue;
      for (const scope of item.requiredScope.split(',')) {
        const trimmed = scope.trim();
        // Custom plugins get `tool.<name>` from routers/capabilities.py.
        const isCustomPlugin = trimmed.startsWith('tool.');
        if (!isCustomPlugin && !backendScopes.has(trimmed)) {
          offenders.push(`${item.id} -> ${trimmed}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only names tools that exist in the backend registry', async () => {
    const { SEED_CAPABILITIES } = await load();
    // Subset of the 68 names registered in apps/api/src/api/tools/definitions.py.
    const known = new Set([
      'append_google_doc',
      'audit_ats_formatting',
      'browse_job_page',
      'calculate_semantic_ats_score',
      'compile_cover_letter',
      'compile_resume_docx',
      'compile_resume_pdf',
      'create_calendar_event',
      'create_entity',
      'create_github_issue',
      'create_google_doc',
      'draft_email',
      'execute_code_sandbox',
      'extract_missing_hard_skills',
      'get_entity',
      'list_calendar_events',
      'merge_entities',
      'query_graph',
      'scrape_company_insights',
      'search_documents',
      'search_gmail',
      'send_slack_message',
      'verify_application_link',
    ]);

    const offenders: string[] = [];
    for (const item of SEED_CAPABILITIES) {
      for (const tool of item.toolsUsed ?? []) {
        if (!known.has(tool)) offenders.push(`${item.id} -> ${tool}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('generated tool fallback manifest', () => {
  // The tool rows in SEED_CAPABILITIES are generated, not hand-written: they
  // must be exactly what scripts/gen_tool_fallback.py renders from ALL_TOOLS.
  // These tests fail if the manifest and the seed grow apart in either
  // direction -- a hand-edited row sneaking back in, or a generated row being
  // filtered out of the seed.
  it('renders the seed tool rows from TOOL_FALLBACK, not hand-written literals', async () => {
    const data = await load();
    const { TOOL_FALLBACK } = await import('@/lib/tool-fallback.generated');

    const manifestNames = TOOL_FALLBACK.map((row) => row.name);
    expect(new Set(manifestNames).size).toBe(manifestNames.length);

    const seedToolRows = data.SEED_CAPABILITIES.filter((c) => c.category === 'tools');
    expect(seedToolRows.length).toBeGreaterThan(0);
    const seedToolNames = new Set(seedToolRows.map((c) => c.name));
    for (const row of TOOL_FALLBACK) {
      expect(seedToolNames.has(row.name)).toBe(true);
    }
    // The seed spreads the whole manifest; a filtered-out row would orphan a
    // generated tool silently.
    expect(seedToolRows.length).toBe(TOOL_FALLBACK.length);
  });

  it('carries no requiredScope the manifest does not declare', async () => {
    const data = await load();
    const { TOOL_FALLBACK } = await import('@/lib/tool-fallback.generated');
    const manifestScopes = new Set(TOOL_FALLBACK.map((row) => row.requiredScope));
    const offenders = data.SEED_CAPABILITIES.filter(
      (c) => c.category === 'tools' && c.requiredScope && !manifestScopes.has(c.requiredScope),
    ).map((c) => `${c.id} -> ${c.requiredScope}`);
    expect(offenders).toEqual([]);
  });

  it('keeps manifest telemetry honest', async () => {
    const { TOOL_FALLBACK } = await import('@/lib/tool-fallback.generated');
    expect(TOOL_FALLBACK.length).toBeGreaterThan(0);
    for (const row of TOOL_FALLBACK) {
      expect(row.usageCount).toBe(0);
      expect(row.lastUsedAt).toBeNull();
      expect(row.isSeed).toBe(true);
    }
  });
});

describe('SEED composition shape', () => {
  it('carries no mcp rows -- live server state belongs to the connector hook, not the seed', async () => {
    const { SEED_CAPABILITIES } = await load();

    const mcpRows = SEED_CAPABILITIES.filter((item) => item.category === 'mcp');
    expect(mcpRows.map((row) => row.id)).toEqual([]);
  });

  it('pins the hand-written categories exactly: 10 agents, 28 skills, 4 plugins, 0 mcp', async () => {
    const { SEED_CAPABILITIES } = await load();

    const counts: Record<string, number> = {};
    for (const item of SEED_CAPABILITIES) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    expect(counts['agents']).toBe(10);
    expect(counts['skills']).toBe(28);
    expect(counts['plugins']).toBe(4);
    expect(counts['mcp'] ?? 0).toBe(0);
  });

  it('totals the hand-written rows plus the generated tool manifest, with nothing else', async () => {
    const { SEED_CAPABILITIES } = await load();
    const { TOOL_FALLBACK } = await import('@/lib/tool-fallback.generated');

    // 42 = 10 agents + 28 skills + 4 plugins + 0 mcp. Tool rows are generated
    // (asserted == TOOL_FALLBACK.length by the direct count below), so the seed
    // is 42 hand-written rows plus the manifest, and any other row class is
    // invented.
    expect(SEED_CAPABILITIES.filter((item) => item.category !== 'tools')).toHaveLength(42);
    expect(SEED_CAPABILITIES.filter((item) => item.category === 'tools')).toHaveLength(
      TOOL_FALLBACK.length,
    );
    expect(SEED_CAPABILITIES).toHaveLength(42 + TOOL_FALLBACK.length);
  });
});

describe('formatRelativeTime', () => {
  it('says Never for a capability that has never run', async () => {
    const { formatRelativeTime } = await load();
    expect(formatRelativeTime(null)).toBe('Never');
  });

  it('does not invent a relative string for an unparseable timestamp', async () => {
    const { formatRelativeTime } = await load();
    expect(formatRelativeTime('not-a-date')).toBe('Unknown');
    expect(formatRelativeTime('')).toBe('Unknown');
    expect(formatRelativeTime('   ')).toBe('Unknown');
  });

  it('reports clock skew instead of rendering a plausible past', async () => {
    const { formatRelativeTime } = await load();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(formatRelativeTime(future)).toBe('In the future');
  });

  it('renders a real past relative string', async () => {
    const { formatRelativeTime } = await load();
    const ago = (ms: number) => formatRelativeTime(new Date(Date.now() - ms).toISOString());

    expect(ago(5_000)).toBe('Just now');
    expect(ago(90 * 1000)).toBe('1m ago');
    expect(ago(45 * 60 * 1000)).toBe('45m ago');
    expect(ago(3 * 3_600_000)).toBe('3h ago');
    expect(ago(2 * 86_400_000)).toBe('2d ago');
    expect(ago(10 * 86_400_000)).toBe('1w ago');
    expect(ago(60 * 86_400_000)).toBe('2mo ago');
  });

  it('rolls past a year into years rather than an unbounded month count', async () => {
    const { formatRelativeTime } = await load();
    const ago = (days: number) =>
      formatRelativeTime(new Date(Date.now() - days * 86_400_000).toISOString());

    expect(ago(300)).toBe('10mo ago');
    // MONTH is a fixed 30 days, so the last stretch before a year reads as
    // 12mo rather than 11mo. Pinned here so a change to the unit is visible.
    expect(ago(364)).toBe('12mo ago');
    expect(ago(365)).toBe('1y ago');
    expect(ago(365 * 3 + 40)).toBe('3y ago');
  });

  it('sorts by recency on ISO strings with never-used entries last', async () => {
    const { SEED_CAPABILITIES } = await load();
    const { formatRelativeTime } = await load();

    const now = Date.now();
    const rows: CapabilityItemLike[] = [
      { ...SEED_CAPABILITIES[0], id: 'never', lastUsedAt: null },
      {
        ...SEED_CAPABILITIES[0],
        id: 'recent',
        lastUsedAt: new Date(now - 60_000).toISOString(),
      },
      {
        ...SEED_CAPABILITIES[0],
        id: 'old',
        lastUsedAt: new Date(now - 40 * 86_400_000).toISOString(),
      },
    ];

    const byRecency = [...rows].sort((a, b) => {
      if (a.lastUsedAt === null) return 1;
      if (b.lastUsedAt === null) return -1;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    });

    expect(byRecency.map((r) => r.id)).toEqual(['recent', 'old', 'never']);
    expect(formatRelativeTime(byRecency[2].lastUsedAt)).toBe('Never');
  });
});

describe('v0 to v1 migration', () => {
  it('migrates a bare v0 array and discards the fabricated telemetry in it', async () => {
    // What the old build wrote: a bare array, a human phrase for recency, and a
    // usage count copied from a seed literal rather than measured.
    window.localStorage.setItem(
      `vaeloom.capabilities.custom.${WS}`,
      JSON.stringify([
        {
          id: 'skill-old',
          name: 'old',
          category: 'skills',
          tags: ['Legacy'],
          description: 'Written by the pre-envelope build.',
          enabled: true,
          source: 'custom',
          usageCount: 1420,
          lastUsed: '10m ago',
          markdownDoc: '# Old',
        },
      ]),
    );

    const data = await load();
    const stored = data.getStoredCapabilities(WS);
    const migrated = stored.find((c) => c.id === 'skill-old');

    expect(migrated).toBeDefined();
    expect(migrated?.tags).toEqual(['Legacy']);
    expect(migrated?.description).toBe('Written by the pre-envelope build.');
    expect(migrated?.usageCount).toBe(0);
    expect(migrated?.lastUsedAt).toBeNull();
    expect(migrated).not.toHaveProperty('lastUsed');
  });

  it('rewrites the v0 payload as a v1 envelope', async () => {
    window.localStorage.setItem(
      `vaeloom.capabilities.custom.${WS}`,
      JSON.stringify([
        {
          id: 'skill-v0',
          name: 'v0',
          category: 'skills',
          tags: [],
          description: '',
          enabled: true,
          source: 'custom',
          usageCount: 5,
          lastUsed: 'Yesterday',
          markdownDoc: '',
        },
      ]),
    );

    const data = await load();
    data.getStoredCapabilities(WS);

    const envelope = JSON.parse(
      window.localStorage.getItem(`vaeloom.capabilities.custom.${WS}`) as string,
    );
    expect(envelope.v).toBe(data.STORAGE_VERSION);
    expect(envelope.data[0].id).toBe('skill-v0');
    expect(envelope.data[0].lastUsedAt).toBeNull();
  });

  it('migrates a bare v0 enable-state map', async () => {
    const seedId = (await load()).SEED_CAPABILITIES[0].id;
    window.localStorage.setItem(`vaeloom.capabilities.${WS}`, JSON.stringify({ [seedId]: false }));

    const data = await load();
    expect(data.getStoredCapabilities(WS).find((c) => c.id === seedId)?.enabled).toBe(false);

    const envelope = JSON.parse(
      window.localStorage.getItem(`vaeloom.capabilities.${WS}`) as string,
    );
    expect(envelope.v).toBe(data.STORAGE_VERSION);
    expect(envelope.data[seedId]).toBe(false);
  });
});

describe('a newer app version is refused, not overwritten', () => {
  it('leaves a future-versioned payload byte-identical', async () => {
    const future = { v: 99, data: [{ id: 'skill-from-the-future' }] };
    const raw = JSON.stringify(future);
    window.localStorage.setItem(`vaeloom.capabilities.custom.${WS}`, raw);

    const data = await load();
    const stored = data.getStoredCapabilities(WS);

    expect(window.localStorage.getItem(`vaeloom.capabilities.custom.${WS}`)).toBe(raw);
    expect(stored.map((c) => c.id)).not.toContain('skill-from-the-future');
  });

  it('reports the refusal through storage health', async () => {
    window.localStorage.setItem(
      `vaeloom.capabilities.custom.${WS}`,
      JSON.stringify({ v: 99, data: [] }),
    );

    const data = await load();
    data.getStoredCapabilities(WS);

    const health = data.getStorageHealth();
    expect(health.ok).toBe(false);
    expect(health.error).toMatch(/newer app version/);
  });
});

describe('getStoredCapabilities never hands out the seed constant', () => {
  it('does not let a caller mutate SEED_CAPABILITIES through the return value', async () => {
    const data = await load();
    const originalName = data.SEED_CAPABILITIES[0].name;

    const first = data.getStoredCapabilities(WS);
    first[0].name = 'MUTATED';
    first[0].enabled = false;
    first[0].tags.push('INJECTED');

    const second = data.getStoredCapabilities(WS);

    expect(second[0].name).toBe(originalName);
    expect(second[0].enabled).toBe(data.SEED_CAPABILITIES[0].enabled);
    expect(second[0].tags).not.toContain('INJECTED');
    expect(data.SEED_CAPABILITIES[0].name).toBe(originalName);
  });

  it('does not leak the shared array reference itself', async () => {
    const data = await load();
    expect(data.getStoredCapabilities(WS)).not.toBe(data.SEED_CAPABILITIES);
    expect(data.getStoredCapabilities(WS)).not.toBe(data.getStoredCapabilities(WS));
  });
});

describe('getStorageHealth surfaces silent failures', () => {
  it('reports a corrupt store instead of pretending the list is intact', async () => {
    window.localStorage.setItem(`vaeloom.capabilities.custom.${WS}`, '{ not json at all');

    const data = await load();
    const stored = data.getStoredCapabilities(WS);

    expect(stored).toHaveLength(data.SEED_CAPABILITIES.length);
    const health = data.getStorageHealth();
    expect(health.ok).toBe(false);
    expect(typeof health.error).toBe('string');
    expect(health.error).not.toBe('');
  });

  it('reports a structurally wrong payload, not just an unparseable one', async () => {
    window.localStorage.setItem(
      `vaeloom.capabilities.custom.${WS}`,
      JSON.stringify({ v: 1, data: { not: 'an array' } }),
    );

    const data = await load();
    data.getStoredCapabilities(WS);

    expect(data.getStorageHealth().ok).toBe(false);
  });

  it('reports a capability entry with no id', async () => {
    window.localStorage.setItem(
      `vaeloom.capabilities.custom.${WS}`,
      JSON.stringify({ v: 1, data: [{ name: 'nameless' }] }),
    );

    const data = await load();
    data.getStoredCapabilities(WS);

    expect(data.getStorageHealth().ok).toBe(false);
  });

  it('is healthy again once the store reads cleanly', async () => {
    window.localStorage.setItem(`vaeloom.capabilities.custom.${WS}`, 'broken');
    const data = await load();
    data.getStoredCapabilities(WS);
    expect(data.getStorageHealth().ok).toBe(false);

    window.localStorage.clear();
    data.getStoredCapabilities(WS);
    expect(data.getStorageHealth()).toEqual({ ok: true });
  });
});
