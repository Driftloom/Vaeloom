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
    // Subset of the 69 names registered in apps/api/src/api/tools/definitions.py.
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

describe('storage round-trip', () => {
  it('reads back exactly what was written', async () => {
    const data = await load();

    data.saveCustomCapability(WS, {
      id: 'skill-custom-a',
      name: 'custom-a',
      category: 'skills',
      tags: ['Custom'],
      description: 'A user-authored skill.',
      enabled: true,
      source: 'custom',
      usageCount: 0,
      lastUsedAt: null,
      markdownDoc: '# Custom A',
    });

    const stored = data.getStoredCapabilities(WS);
    const found = stored.find((c) => c.id === 'skill-custom-a');

    expect(found).toBeDefined();
    expect(found?.name).toBe('custom-a');
    expect(found?.tags).toEqual(['Custom']);
    expect(data.getStorageHealth()).toEqual({ ok: true });
  });

  it('wraps every payload in a versioned envelope', async () => {
    const data = await load();
    data.saveCustomCapability(WS, {
      id: 'skill-env',
      name: 'env',
      category: 'skills',
      tags: [],
      description: '',
      enabled: true,
      source: 'custom',
      usageCount: 0,
      lastUsedAt: null,
      markdownDoc: '',
    });
    data.setStoredCapabilityEnabled(WS, 'skill-env', false);

    const custom = JSON.parse(
      window.localStorage.getItem(`vaeloom.capabilities.custom.${WS}`) as string,
    );
    const state = JSON.parse(window.localStorage.getItem(`vaeloom.capabilities.${WS}`) as string);

    expect(data.STORAGE_VERSION).toBe(1);
    expect(custom.v).toBe(1);
    expect(Array.isArray(custom.data)).toBe(true);
    expect(state.v).toBe(1);
    expect(state.data['skill-env']).toBe(false);
  });

  it('applies an enable override without discarding other capabilities', async () => {
    const data = await load();
    const seedId = data.SEED_CAPABILITIES[0].id;
    const before = data.getStoredCapabilities(WS).length;

    const updated = data.setStoredCapabilityEnabled(WS, seedId, false);
    const after = data.getStoredCapabilities(WS);

    expect(updated.find((c) => c.id === seedId)?.enabled).toBe(false);
    expect(after.find((c) => c.id === seedId)?.enabled).toBe(false);
    expect(after).toHaveLength(before);
  });

  it('does not let one capability toggle clobber an unrelated one', async () => {
    const data = await load();
    const [first, second] = data.SEED_CAPABILITIES;

    data.setStoredCapabilityEnabled(WS, first.id, false);
    const result = data.setStoredCapabilityEnabled(WS, second.id, false);

    expect(result.find((c) => c.id === first.id)?.enabled).toBe(false);
    expect(result.find((c) => c.id === second.id)?.enabled).toBe(false);
  });

  it('does not clobber a concurrent custom save when toggling', async () => {
    const data = await load();

    data.setStoredCapabilityEnabled(WS, data.SEED_CAPABILITIES[0].id, false);
    data.saveCustomCapability(WS, {
      id: 'skill-survivor',
      name: 'survivor',
      category: 'skills',
      tags: [],
      description: '',
      enabled: true,
      source: 'custom',
      usageCount: 0,
      lastUsedAt: null,
      markdownDoc: '',
    });
    data.setStoredCapabilityEnabled(WS, data.SEED_CAPABILITIES[1].id, false);

    expect(data.getStoredCapabilities(WS).map((c) => c.id)).toContain('skill-survivor');
  });

  it('partially updates a custom capability instead of rewriting the record', async () => {
    const data = await load();
    data.saveCustomCapability(WS, {
      id: 'skill-patch',
      name: 'patch',
      category: 'skills',
      tags: ['Keep'],
      description: 'before',
      enabled: true,
      source: 'custom',
      usageCount: 0,
      lastUsedAt: null,
      markdownDoc: '# Patch',
      version: '1.0.0',
    });

    data.updateCustomCapability(WS, 'skill-patch', { description: 'after' });
    const found = data.getStoredCapabilities(WS).find((c) => c.id === 'skill-patch');

    expect(found?.description).toBe('after');
    expect(found?.tags).toEqual(['Keep']);
    expect(found?.markdownDoc).toBe('# Patch');
    expect(found?.version).toBe('1.0.0');
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

describe('delete does not resurrect a seed item', () => {
  it('keeps a deleted seed item deleted on every subsequent read', async () => {
    const data = await load();
    const seedId = data.SEED_CAPABILITIES[0].id;
    expect(data.getStoredCapabilities(WS).map((c) => c.id)).toContain(seedId);

    data.deleteCustomCapability(WS, seedId);

    expect(data.getStoredCapabilities(WS).map((c) => c.id)).not.toContain(seedId);
    expect(data.getStoredCapabilities(WS).map((c) => c.id)).not.toContain(seedId);
  });

  it('records the removal in the dismissed set', async () => {
    const data = await load();
    const seedId = data.SEED_CAPABILITIES[0].id;

    data.deleteCustomCapability(WS, seedId);

    const envelope = JSON.parse(
      window.localStorage.getItem(`vaeloom.capabilities.dismissed.${WS}`) as string,
    );
    expect(envelope.v).toBe(data.STORAGE_VERSION);
    expect(envelope.data).toEqual([seedId]);
  });

  it('does not log a deleted custom id in the dismissed set', async () => {
    const data = await load();
    data.saveCustomCapability(WS, {
      id: 'skill-gone',
      name: 'gone',
      category: 'skills',
      tags: [],
      description: '',
      enabled: true,
      source: 'custom',
      usageCount: 0,
      lastUsedAt: null,
      markdownDoc: '',
    });

    data.deleteCustomCapability(WS, 'skill-gone');

    expect(data.getStoredCapabilities(WS).map((c) => c.id)).not.toContain('skill-gone');
    const dismissed = window.localStorage.getItem(`vaeloom.capabilities.dismissed.${WS}`);
    expect(dismissed).toBeNull();
  });

  it('brings a dismissed seed item back when it is reinstalled', async () => {
    const data = await load();
    const seed = data.SEED_CAPABILITIES[0];
    data.deleteCustomCapability(WS, seed.id);
    expect(data.getStoredCapabilities(WS).map((c) => c.id)).not.toContain(seed.id);

    data.saveCustomCapability(WS, seed);

    expect(data.getStoredCapabilities(WS).map((c) => c.id)).toContain(seed.id);
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

  it('reports a failed write so a lost edit is not shown as saved', async () => {
    const data = await load();
    // Patch the prototype, not the instance: jsdom's Storage does not reliably
    // honour an own-property override, so this is the only way to simulate the
    // quota failure the browser actually throws.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };

    try {
      data.setStoredCapabilityEnabled(WS, data.SEED_CAPABILITIES[0].id, false);
      const health = data.getStorageHealth();
      expect(health.ok).toBe(false);
      expect(health.error).toMatch(/quota/i);
    } finally {
      Storage.prototype.setItem = original;
    }
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
