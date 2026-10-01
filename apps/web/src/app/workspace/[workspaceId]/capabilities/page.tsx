'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Banner, Button, SearchField, TabPanel, Tabs } from '@vaeloom/ui-kit';
import type { TabItem } from '@vaeloom/ui-kit';
import { CapabilityCategory, getStorageHealth } from '@/lib/capabilities-data';
import type { CapabilityItem, CapabilityAutonomy } from '@/lib/capabilities-data';
import {
  getStoredCapabilities,
  setStoredCapabilityEnabled,
  saveCustomCapability,
  deleteCustomCapability,
} from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import {
  agentCatalogApi,
  capabilitiesApi,
  connectorsApi,
  capabilityConfigMarkdownDoc,
  capabilityConfigTags,
  capabilityConfigRequiredScope,
  type SkillListItem,
} from '@/lib/api-client';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { AddCapabilityModal } from '@/components/capabilities/AddCapabilityModal';
import type { ImportOutcome } from '@/components/capabilities/AddCapabilityModal';
import { SkillsView } from '@/components/capabilities/SkillsView';
import type {
  SkillRow,
  SkillSaveOutcome,
  SkillSort,
  SkillTab,
} from '@/components/capabilities/SkillsView';
import { AgentsView } from '@/components/capabilities/AgentsView';
import { ToolsView } from '@/components/capabilities/ToolsView';
import { McpView } from '@/components/capabilities/McpView';
import { PluginsView } from '@/components/capabilities/PluginsView';
import { ConnectorsView } from '@/components/capabilities/ConnectorsView';
import { CapabilitiesWorkbenchSkeleton } from '@/components/capabilities/CapabilitiesWorkbenchSkeleton';

// ─── Category vocabulary (defect B) ──────────────────────────────────────────

/**
 * The one place the server's category vocabulary is reconciled with the UI's.
 *
 * WHY two tables instead of one plus an inverse scan: the exported
 * `CapabilityCategory` is PLURAL ('skills') because five sibling views and the
 * URL contract depend on it, and it is not mine to rename. The backend's
 * `VALID_CATEGORIES` is SINGULAR ('skill'). A single table plus a reverse scan
 * has to break ties between `skill` and `skills` by insertion order, which is
 * invisible at the definition site and silently changes behaviour if anyone
 * reorders the object -- so `toServerCategory` could send a plural category the
 * server rejects, while `item.category === 'skills'` matched no stored row at
 * all. Both directions are now written out, so the singular value the server
 * accepts is readable at the call site instead of inferred.
 */
const UI_TO_SERVER_CATEGORY: Record<CapabilityCategory, string> = {
  agents: 'agent',
  skills: 'skill',
  tools: 'tool',
  mcp: 'mcp',
  plugins: 'plugin',
  connectors: 'connector',
};

const SERVER_TO_UI_CATEGORY: Record<string, CapabilityCategory> = {
  agent: 'agents',
  agents: 'agents',
  skill: 'skills',
  skills: 'skills',
  tool: 'tools',
  tools: 'tools',
  mcp: 'mcp',
  plugin: 'plugins',
  plugins: 'plugins',
  connector: 'connectors',
  connectors: 'connectors',
};

const UI_CATEGORY_ORDER: CapabilityCategory[] = [
  'skills',
  'connectors',
  'mcp',
  'tools',
  'plugins',
  'agents',
];

const CATEGORY_TAB_LABEL: Record<CapabilityCategory, string> = {
  skills: 'Skills',
  connectors: 'Connectors',
  mcp: 'MCP',
  tools: 'Tools',
  plugins: 'Plugins',
  agents: 'Agents',
};

const CATEGORY_CTA_LABEL: Record<CapabilityCategory, string> = {
  skills: 'New Skill',
  connectors: 'Add Connector',
  mcp: 'New MCP Server',
  tools: 'New Tool',
  plugins: 'New Plugin',
  agents: 'New Agent',
};

const CATEGORY_SEARCH_PLACEHOLDER: Record<CapabilityCategory, string> = {
  skills: 'Filter installed skills',
  connectors: 'Search connectors',
  mcp: 'Search MCP servers',
  tools: 'Search tools and suites',
  plugins: 'Search plugins',
  agents: 'Search agents',
};

/**
 * Unrecognised categories are not silently absorbed into 'skills': a row the
 * server sent under a vocabulary this build does not know is a contract change,
 * and reporting it as a skill would file a server regression under the wrong
 * category's counts.
 */
function toUiCategory(serverCategory: string | null | undefined): CapabilityCategory | null {
  if (typeof serverCategory !== 'string') return null;
  return SERVER_TO_UI_CATEGORY[serverCategory] ?? null;
}

function toServerCategory(uiCategory: CapabilityCategory): string {
  return UI_TO_SERVER_CATEGORY[uiCategory];
}

function isNotFound(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 404;
}

function isConflict(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 409;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ─── Skill row mapping (defects C, D, E) ─────────────────────────────────────

const VALID_SOURCES = new Set<CapabilityItem['source']>([
  'built-in',
  'learned',
  'custom',
  'mcp',
  'community',
]);

function toSource(raw: string | null | undefined): CapabilityItem['source'] {
  return typeof raw === 'string' && VALID_SOURCES.has(raw as CapabilityItem['source'])
    ? (raw as CapabilityItem['source'])
    : 'custom';
}

const VALID_AUTONOMY = new Set<string>(['suggest', 'autonomous', 'approval_required']);

const VALID_TRUST_CLASSES = new Set<string>([
  'core_trusted',
  'first_party',
  'community',
  'mcp.read',
  'mcp.workspace.write',
  'mcp.external.write',
  'untrusted',
]);

/**
 * Trust class and autonomy are `string | null` on the wire precisely so an
 * undeclared value stays undeclared. Converting null here is how the UI ended up
 * presenting a hard-coded 'first_party' / 'autonomous' as if the server had
 * classified the capability; the detail pane prints "Not declared by the server"
 * instead.
 */
function toAutonomy(raw: string | null | undefined): CapabilityAutonomy | undefined {
  return typeof raw === 'string' && VALID_AUTONOMY.has(raw)
    ? (raw as CapabilityAutonomy)
    : undefined;
}

function readTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');
}

/**
 * `installed` -- not `enabled` -- is the single definition of "this workspace has
 * this skill". The catalog contributes rows with `installed: false` and a null id,
 * so every branch that needs a row to exist server-side must check `installed`
 * before it touches `id`.
 */
function mapSkillRow(server: SkillListItem): SkillRow {
  const installed = server.installed === true;
  const config = server.config as Record<string, unknown> | undefined;
  const slug = server.slug ?? (typeof server.name === 'string' ? server.name : null);
  const parameters = config?.['parameters'];

  const item: CapabilityItem = {
    id: server.id ?? `catalog:${slug ?? server.name}`,
    name: server.name,
    category: 'skills',
    tags: readTags(server.tags).length
      ? readTags(server.tags)
      : capabilityConfigTags(server.config),
    description: server.description ?? '',
    // A catalog row has no workspace enablement to report, so it renders as
    // not-enabled rather than borrowing the seed's flag.
    enabled: installed ? server.enabled : false,
    source: toSource(server.type),
    usageCount: typeof server.usageCount === 'number' ? server.usageCount : 0,
    lastUsedAt: server.lastUsedAt ?? null,
    markdownDoc: server.markdownDoc ?? capabilityConfigMarkdownDoc(server.config) ?? '',
    triggers: Array.isArray(server.triggers) ? server.triggers : [],
    inputSchema:
      parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? (parameters as Record<string, unknown>)
        : undefined,
  };

  if (server.requiredScope) item.requiredScope = server.requiredScope;
  // `CapabilityItem.trustClass` is a closed union, so an unrecognised server value
  // is dropped rather than widened into a claim the runtime does not support.
  if (server.trustClass && VALID_TRUST_CLASSES.has(server.trustClass)) {
    item.trustClass = server.trustClass as CapabilityItem['trustClass'];
  }
  const autonomy = toAutonomy(server.autonomy);
  if (autonomy) item.autonomy = autonomy;
  if (server.version) item.version = server.version;
  if (server.author) item.author = server.author;

  return {
    key: installed ? (server.id as string) : `catalog:${slug ?? server.name}`,
    item,
    installed,
    bundled: server.bundled === true,
    slug,
    serverBacked: installed && typeof server.id === 'string',
  };
}

/**
 * The merge direction is the defect: `{...existing, ...serverRow}` let the DB
 * row win every field, which erased a doc the user had just written whenever the
 * list refetched. The server owns identity, enablement and telemetry; the local
 * store only gets to supply what the server does not have.
 */
function mergeSkillRows(localRows: CapabilityItem[], serverRows: SkillListItem[]): SkillRow[] {
  const byId = new Map<string, CapabilityItem>();
  const byName = new Map<string, CapabilityItem>();
  for (const row of localRows) {
    byId.set(row.id, row);
    byName.set(row.name, row);
  }

  const consumed = new Set<string>();
  const merged: SkillRow[] = serverRows.map((server) => {
    const local = (server.id !== null ? byId.get(server.id) : undefined) ?? byName.get(server.name);
    if (local) consumed.add(local.id);

    const row = mapSkillRow(server);
    if (!local) return row;

    const item = row.item;
    const localTriggers = local.triggers ?? [];
    if (item.markdownDoc === '' && local.markdownDoc) item.markdownDoc = local.markdownDoc;
    if (item.inputSchema === undefined && local.inputSchema) item.inputSchema = local.inputSchema;
    if ((item.triggers?.length ?? 0) === 0 && localTriggers.length > 0) {
      item.triggers = localTriggers;
    }
    row.item = item;
    return row;
  });

  // Local-only capabilities have no server row at all. They are reported as
  // NOT installed rather than optimistically counted: the definition of
  // installed is "the workspace registry holds a row", and a localStorage entry
  // is not that registry.
  for (const local of localRows) {
    if (consumed.has(local.id)) continue;
    merged.push({
      key: local.id,
      item: local,
      installed: false,
      bundled: isSeedSkill(local),
      slug: local.id.startsWith('skill-') ? local.id.slice('skill-'.length) : null,
      serverBacked: false,
    });
  }

  return merged;
}

function isSeedSkill(item: CapabilityItem): boolean {
  return item.source === 'built-in' || item.source === 'learned';
}

function isSkill(item: CapabilityItem): boolean {
  return item.category === 'skills';
}

const isInstalledRow = (row: SkillRow): boolean => row.installed;
const countInstalled = (rows: SkillRow[]): number => rows.filter(isInstalledRow).length;

function matchesQuery(row: SkillRow, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const { name, description, tags, triggers } = row.item;
  return (
    name.toLowerCase().includes(needle) ||
    description.toLowerCase().includes(needle) ||
    tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    (triggers ?? []).some((trigger) => trigger.toLowerCase().includes(needle))
  );
}

function sortSkillRows(rows: SkillRow[], sort: SkillSort): SkillRow[] {
  const sorted = [...rows];
  if (sort === 'alphabetical') {
    sorted.sort((a, b) => a.item.name.localeCompare(b.item.name));
    return sorted;
  }
  if (sort === 'recent') {
    sorted.sort((a, b) => (b.item.lastUsedAt ?? '').localeCompare(a.item.lastUsedAt ?? ''));
    return sorted;
  }
  sorted.sort(
    (a, b) => b.item.usageCount - a.item.usageCount || a.item.name.localeCompare(b.item.name),
  );
  return sorted;
}

function CapabilitiesContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const { toast } = useToast();

  const [localCapabilities, setLocalCapabilities] = useState<CapabilityItem[]>(() =>
    getStoredCapabilities(workspaceId),
  );
  const [storageHealth, setStorageHealth] = useState(() => getStorageHealth());

  const urlCategory = searchParams?.get('category') || searchParams?.get('tab');
  const validUrlCategory =
    urlCategory && (UI_CATEGORY_ORDER as string[]).includes(urlCategory)
      ? (urlCategory as CapabilityCategory)
      : null;

  const initialAgentParam = searchParams?.get('agent') || undefined;

  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>(
    validUrlCategory ?? 'skills',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [skillTab, setSkillTab] = useState<SkillTab>('installed');
  const [skillSort, setSkillSort] = useState<SkillSort>('most-used');
  const [selectedSkillKey, setSelectedSkillKey] = useState('');
  const [pendingSkillKey, setPendingSkillKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectorsAddTrigger, setConnectorsAddTrigger] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    if (validUrlCategory && validUrlCategory !== selectedCategory) {
      setSelectedCategory(validUrlCategory);
    }
  }, [validUrlCategory, selectedCategory]);

  const {
    data: liveCatalog,
    error: catalogError,
    mutate: mutateCatalog,
  } = useSWR('agent-catalog', () => agentCatalogApi.get(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const { connectors: liveConnectors } = useWorkspaceConnectors(workspaceId);

  /**
   * Installed skills and the catalog in one response. The backend owns this merge,
   * so the page never re-implements it -- a client-side join is how the two lists
   * came to disagree about what was installed.
   */
  const {
    data: serverSkills,
    error: skillsError,
    isLoading: skillsLoading,
    mutate: mutateSkills,
  } = useSWR(
    workspaceId ? ['workspace-skills', workspaceId] : null,
    () => capabilitiesApi.listSkills(workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const { data: serverRows, mutate: mutateServerRows } = useSWR(
    workspaceId ? ['workspace-capabilities', workspaceId] : null,
    () => capabilitiesApi.list(undefined, workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  // MCP has no row in `capabilities`; McpView reads the connectors endpoint
  // directly. This only produces the tab badge, and it reads a real `type`
  // rather than pattern-matching a provider name for the substring "mcp".
  const { data: mcpConnectors } = useSWR(
    workspaceId ? ['workspace-mcp-count', workspaceId] : null,
    () => connectorsApi.list(workspaceId, 'mcp'),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const localSkills = useMemo(() => localCapabilities.filter(isSkill), [localCapabilities]);

  const allSkills = useMemo(
    () => mergeSkillRows(localSkills, serverSkills ?? []),
    [localSkills, serverSkills],
  );

  const installedCount = useMemo(() => countInstalled(allSkills), [allSkills]);
  const browseCount = allSkills.length - installedCount;

  const visibleSkillRows = useMemo(() => {
    const scoped = allSkills.filter((row) =>
      skillTab === 'installed' ? row.installed : !row.installed,
    );
    return sortSkillRows(
      scoped.filter((row) => matchesQuery(row, searchQuery.trim())),
      skillSort,
    );
  }, [allSkills, skillTab, searchQuery, skillSort]);

  const activeSkillKey = useMemo(() => {
    if (visibleSkillRows.some((row) => row.key === selectedSkillKey)) return selectedSkillKey;
    return visibleSkillRows[0]?.key ?? '';
  }, [visibleSkillRows, selectedSkillKey]);

  // Rows for the non-skill categories keep the seed + workspace-row shape the
  // sibling views already consume. They are untouched by the skill merge.
  const [nonSkillRows, setNonSkillRows] = useState<CapabilityItem[]>(() =>
    getStoredCapabilities(workspaceId).filter((item) => !isSkill(item)),
  );

  /**
   * Rows the server filed under a category this build does not know.
   *
   * Counted outside the `setState` updater on purpose: an updater body runs during
   * React's render phase, so a counter mutated inside it is still 0 when the code
   * right after it tries to read it.
   */
  const unknownCategoryCount = useMemo(
    () => (serverRows ?? []).filter((row) => !toUiCategory(row.category)).length,
    [serverRows],
  );

  useEffect(() => {
    if (!serverRows || !Array.isArray(serverRows) || serverRows.length === 0) return;
    setNonSkillRows((prev) => {
      const next = [...prev];
      for (const row of serverRows) {
        const mapped = toUiCategory(row.category);
        // An unrecognised category is not filed under one it does not belong to.
        // `unknownCategoryCount` reports it, because dropping it silently is how a
        // server vocabulary change looks like data loss on the user's side.
        if (!mapped) continue;
        const item: CapabilityItem = {
          id: row.id,
          name: row.name,
          category: mapped,
          tags: capabilityConfigTags(row.config),
          description: row.description ?? '',
          enabled: row.enabled,
          source: toSource(row.type),
          usageCount: typeof row.usageCount === 'number' ? row.usageCount : 0,
          lastUsedAt: row.lastUsedAt ?? null,
          markdownDoc: capabilityConfigMarkdownDoc(row.config) ?? '',
        };
        const requiredScope = capabilityConfigRequiredScope(row.config);
        if (requiredScope) item.requiredScope = requiredScope;
        if (row.version) item.version = row.version;
        if (row.author) item.author = row.author;
        const index = next.findIndex((existing) => existing.id === row.id);
        if (index >= 0) {
          // The server row owns the doc when it has one; the local copy only fills
          // the gap for a seeded capability the server has no documentation for.
          const localDoc = next[index]?.markdownDoc ?? '';
          next[index] = { ...next[index], ...item, markdownDoc: item.markdownDoc || localDoc };
        } else {
          next.push(item);
        }
      }
      return next;
    });
  }, [serverRows]);

  const liveCatalogKey = useMemo(
    () => liveCatalog?.agents?.map((agent) => agent.name).join(',') ?? '',
    [liveCatalog],
  );

  /**
   * Agents get their scopes and autonomy from the agent catalog, which is the
   * only place those values exist for a built-in agent. Nothing else is
   * synthesized here: the MCP-connector block that used to live in this effect
   * invented `mcp-*` capabilities, their usage counts and their markdown from the
   * connectors hook, and duplicated McpView's real endpoint with numbers nobody
   * measured.
   */
  useEffect(() => {
    const agents = liveCatalog?.agents;
    if (!agents || !Array.isArray(agents) || agents.length === 0) return;
    setNonSkillRows((prev) =>
      prev.map((item) => {
        if (item.category !== 'agents') return item;
        const live = agents.find(
          (agent) => agent.name === item.name || item.id === `agent-${agent.name}`,
        );
        if (!live) return item;
        return {
          ...item,
          requiredScope: live.tools?.[0]?.requiredScope ?? item.requiredScope,
          autonomy: toAutonomy(live.defaultAutonomy) ?? item.autonomy,
          toolsUsed: live.toolNames ?? item.toolsUsed,
        };
      }),
    );
    // `liveCatalogKey` rather than the object so a stable SWR reference does not
    // re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCatalogKey]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CapabilityCategory, number> = {
      skills: installedCount,
      connectors: liveConnectors?.length ?? 0,
      mcp: (mcpConnectors ?? []).filter((connector) => connector.type === 'mcp').length,
      tools: 0,
      plugins: 0,
      agents: 0,
    };
    nonSkillRows.forEach((item) => {
      if (item.category === 'connectors') return;
      counts[item.category] += 1;
    });
    return counts;
  }, [installedCount, liveConnectors, mcpConnectors, nonSkillRows]);

  const tabs = useMemo<TabItem[]>(
    () =>
      UI_CATEGORY_ORDER.map((category) => ({
        id: category,
        label: CATEGORY_TAB_LABEL[category],
        badge: categoryCounts[category],
      })),
    [categoryCounts],
  );

  const findSkillRow = useCallback(
    (key: string): SkillRow | undefined => allSkills.find((row) => row.key === key),
    [allSkills],
  );

  /**
   * The storage helpers disagree about their return type: the enable/delete
   * helpers hand back the re-read merged list, `saveCustomCapability` returns
   * nothing. Both are re-read here so the local mirror and the banner always come
   * from the same source rather than from a partially updated snapshot.
   *
   * Health is captured immediately after the write and BEFORE the re-read, because
   * `getStoredCapabilities()` clears the recorded error as its first statement --
   * reading afterwards would erase a failed write and report success.
   */
  const syncLocalStorage = useCallback(
    (mutate: (workspaceId: string) => unknown) => {
      mutate(workspaceId);
      const writeHealth = getStorageHealth();
      const merged = getStoredCapabilities(workspaceId);
      const readHealth = getStorageHealth();
      setLocalCapabilities(merged);
      setStorageHealth(writeHealth.ok ? readHealth : writeHealth);
    },
    [workspaceId],
  );

  const handleToggleSkill = useCallback(
    async (key: string, next: boolean) => {
      const row = findSkillRow(key);
      if (!row) return;
      const name = row.item.name;

      if (!row.serverBacked || row.item.id === null) {
        // Nothing to write server-side. Say so rather than reporting a workspace
        // change that did not happen.
        syncLocalStorage((id) => setStoredCapabilityEnabled(id, row.item.id, next));
        toast({
          tone: 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${name} in this browser only`,
          detail:
            'This skill has no workspace capability row, so nothing was written to the server.',
        });
        return;
      }

      setPendingSkillKey(key);
      try {
        await capabilitiesApi.update(row.item.id, { enabled: next });
        syncLocalStorage((id) => setStoredCapabilityEnabled(id, row.item.id, next));
        void mutateSkills();
        toast({
          tone: next ? 'success' : 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${name}`,
          detail: 'Saved to the workspace capability row.',
        });
      } catch (err) {
        if (!isNotFound(err)) {
          toast({
            tone: 'error',
            title: `Could not ${next ? 'enable' : 'disable'} ${name}`,
            detail: errorMessage(err, 'The workspace was not changed.'),
          });
          return;
        }
        syncLocalStorage((id) => setStoredCapabilityEnabled(id, row.item.id, next));
        toast({
          tone: 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${name} in this browser only`,
          detail: 'The server has no row for this skill (404), so nothing was written remotely.',
        });
      } finally {
        setPendingSkillKey(null);
      }
    },
    [findSkillRow, mutateSkills, syncLocalStorage, toast],
  );

  const handleInstallSkill = useCallback(
    async (key: string) => {
      const row = findSkillRow(key);
      if (!row || row.installed) return;

      setPendingSkillKey(key);
      try {
        const created = await capabilitiesApi.create({
          name: row.item.name,
          category: toServerCategory('skills'),
          description: row.item.description,
          version: row.item.version ?? '1.0.0',
          author: row.item.author ?? 'Catalog',
          type: row.item.source,
          config: {
            doc: row.item.markdownDoc,
            tags: row.item.tags,
            autonomy: row.item.autonomy,
            // The catalog entry declares the scope this skill runs under, and
            // POST stores only what it is given, so a bare register installs a
            // capability with no scope at all.
            ...(row.item.requiredScope ? { required_scope: row.item.requiredScope } : {}),
          },
        });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Installed ${row.item.name}`,
          detail: `Registered in this workspace as ${created.id}.`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not install ${row.item.name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
      } finally {
        setPendingSkillKey(null);
      }
    },
    [findSkillRow, mutateSkills, toast],
  );

  /**
   * Saving a doc used to write localStorage and then report "Changes persisted
   * to workspace configuration", which was false. A skill that has a server row is
   * now written with PATCH; only a genuinely local capability falls back to the
   * browser, and the toast says which of the two happened.
   */
  const handleSaveSkillDoc = useCallback(
    async (key: string, doc: string): Promise<SkillSaveOutcome> => {
      const row = findSkillRow(key);
      if (!row) return 'failed';

      if (row.serverBacked && row.item.id !== null) {
        try {
          // Only `doc` is sent. `config` is merged server-side, and sending the
          // camel-cased `parameters` back would corrupt the stored JSON Schema.
          await capabilitiesApi.update(row.item.id, { config: { doc } });
          syncLocalStorage((id) => saveCustomCapability(id, { ...row.item, markdownDoc: doc }));
          void mutateSkills();
          toast({
            tone: 'success',
            title: `Saved instructions for ${row.item.name}`,
            detail: 'Written to the workspace capability row.',
          });
          return 'server';
        } catch (err) {
          if (!isNotFound(err)) {
            toast({
              tone: 'error',
              title: `Could not save ${row.item.name}`,
              detail: errorMessage(err, 'The workspace was not changed.'),
            });
            return 'failed';
          }
          toast({
            tone: 'warning',
            title: `Saved ${row.item.name} in this browser only`,
            detail: 'The server has no row for this skill (404).',
          });
        }
      }

      syncLocalStorage((id) => saveCustomCapability(id, { ...row.item, markdownDoc: doc }));
      toast({
        tone: 'warning',
        title: `Saved instructions for ${row.item.name} in this browser only`,
        detail:
          'This skill has no workspace capability row, so it was not persisted to the workspace.',
      });
      return 'local';
    },
    [findSkillRow, mutateSkills, syncLocalStorage, toast],
  );

  const handleDeleteSkill = useCallback(
    async (key: string) => {
      const row = findSkillRow(key);
      if (!row || row.item.id === null) {
        syncLocalStorage((id) => deleteCustomCapability(id, key));
        toast({
          tone: 'info',
          title: 'Removed from this browser',
          detail: 'The skill had no workspace capability row to delete.',
        });
        return;
      }

      try {
        await capabilitiesApi.delete(row.item.id);
      } catch (err) {
        if (isConflict(err)) {
          toast({
            tone: 'error',
            title: 'Bundled skills cannot be deleted',
            detail:
              'The server answers 409 for any capability that is not custom. Disable it instead if you want it out of an agent run.',
          });
          return;
        }
        if (!isNotFound(err)) {
          toast({
            tone: 'error',
            title: 'Delete failed',
            detail: errorMessage(err, 'The capability was not deleted.'),
          });
          return;
        }
      }

      syncLocalStorage((id) => deleteCustomCapability(id, row.item.id));
      setSelectedSkillKey('');
      void mutateSkills();
      toast({
        tone: 'info',
        title: 'Skill deleted',
        detail: 'Removed from this workspace.',
      });
    },
    [findSkillRow, mutateSkills, syncLocalStorage, toast],
  );

  const handleCopySkillDoc = useCallback(
    (key: string) => {
      const row = findSkillRow(key);
      if (!row) return;
      const text = row.item.markdownDoc;
      if (!text) {
        toast({
          tone: 'warning',
          title: `Nothing to copy for ${row.item.name}`,
          detail: 'The server sent no markdown for this skill.',
        });
        return;
      }
      const clipboard = navigator.clipboard;
      if (!clipboard?.writeText) {
        toast({
          tone: 'error',
          title: 'Clipboard unavailable',
          detail: 'This browser blocked clipboard access.',
        });
        return;
      }
      clipboard
        .writeText(text)
        .then(() =>
          toast({
            tone: 'info',
            title: `Copied instructions for ${row.item.name}`,
          }),
        )
        .catch(() =>
          toast({
            tone: 'error',
            title: 'Copy failed',
            detail: 'The browser refused clipboard access.',
          }),
        );
    },
    [findSkillRow, toast],
  );

  const handleToggleCapability = useCallback(
    async (id: string, event?: React.MouseEvent) => {
      event?.stopPropagation();
      const item = nonSkillRows.find((row) => row.id === id);
      if (!item) return;
      const nextState = !item.enabled;

      syncLocalStorage((workspace) => setStoredCapabilityEnabled(workspace, id, nextState));
      try {
        await capabilitiesApi.update(id, { enabled: nextState });
        void mutateServerRows();
      } catch (err) {
        if (!isNotFound(err)) {
          syncLocalStorage((workspace) => setStoredCapabilityEnabled(workspace, id, item.enabled));
          toast({
            tone: 'error',
            title: nextState ? `Could not enable ${item.name}` : `Could not disable ${item.name}`,
            detail: errorMessage(err, 'The change was not saved.'),
          });
          return;
        }
      }
      toast({
        tone: nextState ? 'success' : 'warning',
        title: `${nextState ? 'Enabled' : 'Disabled'} ${item.name}`,
        detail: 'Applies to new agent sessions in this workspace.',
      });
    },
    [nonSkillRows, syncLocalStorage, mutateServerRows, toast],
  );

  const handleCategoryChange = useCallback((id: string) => {
    setSelectedCategory(id as CapabilityCategory);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setCreateModalOpen(true);
  }, []);

  const ctaLabel = CATEGORY_CTA_LABEL[selectedCategory];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4">
        <PageHeader
          title="Capabilities"
          description="Author, install and govern the skills, agents, tools, MCP servers, plugins and connectors available to this workspace's agents."
          actions={
            <Button
              variant="secondary"
              size="sm"
              data-new-item
              onClick={() => {
                void mutateCatalog();
                void mutateSkills();
                void mutateServerRows();
              }}
            >
              Refresh from server
            </Button>
          }
        />
      </div>

      {/*
        A corrupt or over-quota local store used to fall back to the seed with an
        empty catch, so custom capabilities silently vanished and the user was
        told nothing. `getStorageHealth()` records why; this says so out loud.
      */}
      {!storageHealth.ok && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
          <Banner
            variant="danger"
            title="Local capability store is unreadable"
            description={storageHealth.error ?? 'The browser store could not be read.'}
          />
        </div>
      )}

      {/* A catalog fetch failure only costs live agent enrichment, so it is a
          notice rather than a page-level error: the stored and workspace
          capabilities below are still real. */}
      {unknownCategoryCount > 0 && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
          <Banner
            variant="warning"
            title={`${unknownCategoryCount} capabilit${unknownCategoryCount === 1 ? 'y is' : 'ies are'} not shown`}
            description="The server returned rows in a category this build does not recognise, so they are not filed under a category they do not belong to."
          />
        </div>
      )}

      {catalogError && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
          <Banner
            variant="warning"
            title="Live agent catalog unavailable"
            description={`Agents are shown without server-supplied scopes and autonomy. ${catalogError.message}`}
            action={{ label: 'Retry', onClick: () => void mutateCatalog() }}
          />
        </div>
      )}

      <header className="border-b border-border-subtle bg-surface px-4 sm:px-6 py-2.5 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 min-w-0">
          <div className="w-full sm:w-56 md:w-60 lg:w-52 xl:w-56 shrink-0">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              placeholder={CATEGORY_SEARCH_PLACEHOLDER[selectedCategory]}
              // The placeholder changes with the category, so it cannot be the
              // accessible name: an unstable name breaks voice control and makes
              // the field unlabelled for screen readers on 5 of 6 tabs.
              aria-label="Search capabilities"
              // `useKeyboardShortcuts` focuses `[data-search-input]` for the `/`
              // shortcut. The attribute existed nowhere, so the advertised key
              // did nothing.
              data-search-input
              className="text-xs"
            />
          </div>

          <div className="flex items-center gap-2 min-w-0 justify-between lg:justify-end">
            <div className="overflow-x-auto no-scrollbar min-w-0">
              <Tabs
                ariaLabel="Capability category"
                size="sm"
                tabs={tabs}
                activeTab={selectedCategory}
                onTabChange={handleCategoryChange}
              />
            </div>

            {/*
              No `aria-label`: it would override the visible words and leave
              voice-control users with a name they cannot see on screen.
            */}
            <Button
              data-new-item
              size="sm"
              onClick={() => {
                if (selectedCategory === 'connectors') {
                  setConnectorsAddTrigger((prev) => prev + 1);
                  return;
                }
                setCreateModalOpen(true);
              }}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden bg-background">
        <TabPanel
          id="skills"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <SkillsView
            rows={visibleSkillRows}
            installedCount={installedCount}
            browseCount={browseCount}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            tab={skillTab}
            onTabChange={setSkillTab}
            sort={skillSort}
            onSortChange={setSkillSort}
            selectedKey={activeSkillKey}
            onSelect={setSelectedSkillKey}
            onToggleEnabled={(key, next) => void handleToggleSkill(key, next)}
            onInstall={(key) => void handleInstallSkill(key)}
            onSaveDoc={handleSaveSkillDoc}
            onDelete={(key) => void handleDeleteSkill(key)}
            onCopyDoc={handleCopySkillDoc}
            onOpenCreate={handleOpenCreate}
            isLoading={skillsLoading}
            error={skillsError as Error | undefined}
            onRetry={() => void mutateSkills()}
            pendingKey={pendingSkillKey}
          />
        </TabPanel>

        <TabPanel
          id="connectors"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <ConnectorsView
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            openAddTrigger={connectorsAddTrigger}
          />
        </TabPanel>

        <TabPanel
          id="agents"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <AgentsView
            agents={nonSkillRows.filter((item) => item.category === 'agents')}
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            initialAgentName={initialAgentParam}
            onToggleAgent={(id) => void handleToggleCapability(id)}
          />
        </TabPanel>

        <TabPanel
          id="tools"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <ToolsView
            tools={nonSkillRows.filter((item) => item.category === 'tools')}
            workspaceId={workspaceId}
            searchQuery={searchQuery}
          />
        </TabPanel>

        <TabPanel
          id="mcp"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <McpView
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            onOpenCreateServer={handleOpenCreate}
            onOpenImport={() => setImportModalOpen(true)}
          />
        </TabPanel>

        <TabPanel
          id="plugins"
          activeTab={selectedCategory}
          className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden"
        >
          <PluginsView
            plugins={nonSkillRows.filter((item) => item.category === 'plugins')}
            searchQuery={searchQuery}
            onTogglePlugin={(id) => void handleToggleCapability(id)}
            onOpenGitImport={() => setImportModalOpen(true)}
          />
        </TabPanel>
      </section>

      <AddCapabilityModal
        isOpen={createModalOpen || importModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setImportModalOpen(false);
        }}
        defaultCategory={selectedCategory}
        initialMode={importModalOpen ? 'import' : 'builder'}
        workspaceId={workspaceId}
        onCreate={async (newCap) => {
          try {
            const created = await capabilitiesApi.create({
              name: newCap.name,
              category: toServerCategory(newCap.category),
              description: newCap.description,
              version: newCap.version || '1.0.0',
              author: newCap.author || 'Workspace Member',
              type: newCap.source || 'custom',
              config: {
                ...(newCap.metadata || {}),
                parameters: newCap.inputSchema || {},
                doc: newCap.markdownDoc || '',
                tags: newCap.tags || [],
                autonomy: newCap.autonomy || 'autonomous',
                // After the metadata spread, and named for the wire, because
                // `CreateCapabilityRequest` has no top-level `required_scope`
                // and Pydantic drops unknown fields: `config.required_scope` is
                // the only place a POST can put it, and it is the only key the
                // list endpoint reads back (`routers/capabilities.py`). Reading
                // the field the user chose rather than a metadata entry also
                // means a scope cannot be lost to a rename on the modal side.
                ...(newCap.requiredScope ? { required_scope: newCap.requiredScope } : {}),
              },
            });
            newCap.id = created.id;
            void mutateServerRows();
            void mutateSkills();
          } catch (err) {
            // Keep the local record so the authoring is not lost, but say plainly
            // that the workspace copy was not written.
            syncLocalStorage((id) => saveCustomCapability(id, newCap));
            toast({
              tone: 'warning',
              title: `Saved locally only: ${newCap.name}`,
              detail: `${errorMessage(err, 'The server write failed.')} It was not registered in this workspace.`,
            });
            return;
          }
          syncLocalStorage((id) => saveCustomCapability(id, newCap));
          setSelectedCategory(newCap.category);
          // Selecting by the id the server minted: the row only exists once the
          // refetch lands, and `activeSkillKey` picks it up when it does.
          setSelectedSkillKey(newCap.id);
          toast({
            tone: 'success',
            title: `Created ${newCap.name}`,
            detail: `New capability added under ${newCap.category}`,
          });
        }}
        onImport={async (url, category): Promise<ImportOutcome> => {
          const urlParts = url.trim().replace(/\/$/, '').split('/');
          const rawName =
            urlParts[urlParts.length - 1]?.replace(/\.git$/, '') || 'remote-capability';
          const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

          // The one and only import path. Vaeloom has no remote compiler or
          // fetcher, so this records the source URL against a real server row and
          // says exactly that. It must not claim to have compiled anything, and
          // it must not fall back to a local-only record that looks identical to
          // a successful import.
          //
          // This layer produces the failure message and the modal presents it.
          // Nothing awaits the handler that calls this, so a re-throw here would
          // have no owner: it either becomes an unhandled rejection or, once
          // swallowed, leaves the modal closing on a failure it cannot see.
          let created;
          try {
            created = await capabilitiesApi.create({
              name: cleanName,
              category: toServerCategory(category),
              description: `Imported capability from ${url}`,
              author: url.includes('github.com')
                ? url.split('/')[3] || 'Git Author'
                : 'Remote Registry',
              type: category === 'mcp' ? 'mcp' : 'custom',
              config: {
                url,
                importedAt: new Date().toISOString(),
                tags: ['Imported', 'Remote', category],
              },
            });
          } catch (err) {
            return {
              ok: false,
              message:
                `Nothing was registered for ${url}. ${errorMessage(err, 'The server rejected the import.')}`.trim(),
            };
          }

          void mutateServerRows();
          void mutateSkills();
          setSelectedCategory(category);
          setSelectedSkillKey(created.id);
          toast({
            tone: 'success',
            title: `Registered ${cleanName}`,
            detail: `Source URL recorded under ${category}. Nothing was fetched, compiled or executed from ${url}.`,
          });
          return { ok: true };
        }}
      />
    </div>
  );
}

/**
 * The route is a master/detail surface, so the fallback mirrors that shape. It
 * is the same component `loading.tsx` renders: the two are shown at the same
 * moment for the same data, so there is nothing for them to independently get
 * right.
 */
export default function CapabilitiesPage() {
  return (
    <Suspense fallback={<CapabilitiesWorkbenchSkeleton />}>
      <CapabilitiesContent />
    </Suspense>
  );
}
