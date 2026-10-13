'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { Banner, Button, SearchField, TabPanel, Tabs } from '@vaeloom/ui-kit';
import type { TabItem } from '@vaeloom/ui-kit';
import { CapabilityCategory, SEED_CAPABILITIES } from '@/lib/capabilities-data';
import type { CapabilityItem, CapabilityAutonomy } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import {
  agentCatalogApi,
  capabilitiesApi,
  connectorsApi,
  capabilityConfigMarkdownDoc,
  capabilityConfigTags,
  capabilityConfigRequiredScope,
} from '@/lib/api-client';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { SkillsView } from '@/components/capabilities/SkillsView';
import type { ImportOutcome } from '@/components/capabilities/AddCapabilityModal';
import type {
  SkillRow,
  SkillSaveOutcome,
  SkillSort,
  SkillTab,
} from '@/components/capabilities/SkillsView';
import { isSkill, mergeSkillRows } from '@/components/capabilities/skills/skill-row-helpers';
import { CapabilitiesWorkbenchSkeleton } from '@/components/capabilities/CapabilitiesWorkbenchSkeleton';

// ─── Code-split heavy panes (plan E4) ────────────────────────────────────────
const paneFallback = () => <CapabilitiesWorkbenchSkeleton />;

const ConnectorsView = dynamic(
  () =>
    import('@/components/capabilities/ConnectorsView').then((m) => ({
      default: m.ConnectorsView,
    })),
  { ssr: false, loading: paneFallback },
);
const AgentsView = dynamic(
  () => import('@/components/capabilities/AgentsView').then((m) => ({ default: m.AgentsView })),
  { ssr: false, loading: paneFallback },
);
const ToolsView = dynamic(
  () => import('@/components/capabilities/ToolsView').then((m) => ({ default: m.ToolsView })),
  { ssr: false, loading: paneFallback },
);
const McpView = dynamic(
  () => import('@/components/capabilities/McpView').then((m) => ({ default: m.McpView })),
  { ssr: false, loading: paneFallback },
);
const PluginsView = dynamic(
  () => import('@/components/capabilities/PluginsView').then((m) => ({ default: m.PluginsView })),
  { ssr: false, loading: paneFallback },
);
const AddCapabilityModal = dynamic(
  () =>
    import('@/components/capabilities/AddCapabilityModal').then((m) => ({
      default: m.AddCapabilityModal,
    })),
  { ssr: false },
);

// ─── Category vocabulary (defect B) ──────────────────────────────────────────

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

  const seedSkills = useMemo(() => SEED_CAPABILITIES.filter(isSkill), []);

  const urlCategory = searchParams?.get('category') || searchParams?.get('tab');
  const validUrlCategory =
    urlCategory && (UI_CATEGORY_ORDER as string[]).includes(urlCategory)
      ? (urlCategory as CapabilityCategory)
      : null;

  const initialAgentParam = searchParams?.get('agent') || undefined;
  const initialSkillParam = searchParams?.get('skill') || undefined;
  const initialSkillTab =
    searchParams?.get('skillTab') === 'browse' ||
    (searchParams?.get('tab') === 'browse' && urlCategory === 'skills')
      ? 'browse'
      : 'installed';

  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>(
    validUrlCategory ?? 'skills',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [skillTab, setSkillTab] = useState<SkillTab>(initialSkillTab);
  const [skillSort, setSkillSort] = useState<SkillSort>('most-used');
  const [selectedSkillKey, setSelectedSkillKey] = useState(initialSkillParam ?? '');
  const [pendingSkillKey, setPendingSkillKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectorsAddTrigger, setConnectorsAddTrigger] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    if (initialSkillParam) {
      setSelectedSkillKey(initialSkillParam);
    }
  }, [initialSkillParam]);

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

  const { data: mcpConnectors } = useSWR(
    workspaceId ? ['workspace-mcp-count', workspaceId] : null,
    () => connectorsApi.list(workspaceId, 'mcp'),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const allSkills = useMemo(
    () => mergeSkillRows(seedSkills, serverSkills ?? []),
    [seedSkills, serverSkills],
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

  const [nonSkillRows, setNonSkillRows] = useState<CapabilityItem[]>(() =>
    SEED_CAPABILITIES.filter((item) => !isSkill(item)),
  );

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
        if (!mapped) continue;
        const item: CapabilityItem = {
          id: row.id,
          name: row.name,
          category: mapped,
          tags: capabilityConfigTags(row.config),
          description: row.description ?? '',
          enabled: row.enabled,
          source: (row.type as CapabilityItem['source']) || 'custom',
          usageCount: typeof row.usageCount === 'number' ? row.usageCount : 0,
          lastUsedAt: row.lastUsedAt ?? null,
          markdownDoc: capabilityConfigMarkdownDoc(row.config) ?? '',
          // Explicitly false, not merely absent. A seed row can share an id with
          // a real one (agent-organization), and the merge spreads `item` over
          // the seed -- an omitted key would leave isSeed true and keep labelling
          // a server-sourced capability as a sample.
          isSeed: false,
        };
        const requiredScope = capabilityConfigRequiredScope(row.config);
        if (requiredScope) item.requiredScope = requiredScope;
        if (row.version) item.version = row.version;
        if (row.author) item.author = row.author;
        const index = next.findIndex((existing) => existing.id === row.id);
        if (index >= 0) {
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
          autonomy: (live.defaultAutonomy as CapabilityAutonomy) ?? item.autonomy,
          toolsUsed: live.toolNames ?? item.toolsUsed,
        };
      }),
    );
  }, [liveCatalogKey, liveCatalog]);

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
      // `mcp` is counted from the connector hook above and then from
      // `nonSkillRows`, which also carries the four seeded MCP rows that
      // `McpView` never receives. Counting both reported +4 over a badge whose
      // whole job is to describe what the tab will actually list.
      if (item.category === 'mcp') return;
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

  const handleToggleSkill = useCallback(
    async (key: string, next: boolean) => {
      const row = findSkillRow(key);
      if (!row) return;
      const name = row.item.name;

      if (!row.serverBacked || row.item.id === null) {
        toast({
          tone: 'warning',
          title: `Cannot ${next ? 'enable' : 'disable'} ${name}`,
          detail:
            'This skill has no workspace capability row, so nothing was written to the server.',
        });
        return;
      }

      setPendingSkillKey(key);
      try {
        await capabilitiesApi.update(row.item.id, { enabled: next });
        void mutateSkills();
        toast({
          tone: next ? 'success' : 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${name}`,
          detail: 'Saved to the workspace capability row.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not ${next ? 'enable' : 'disable'} ${name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
      } finally {
        setPendingSkillKey(null);
      }
    },
    [findSkillRow, mutateSkills, toast],
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
          // `markdown_doc` is the key the runtime reads (`skill_injection.py`
          // build_skill_directive) and the only one `GET /capabilities` returns.
          // Writing `doc` here leaves the skill inert: it is never injected.
          config: {
            markdown_doc: row.item.markdownDoc,
            tags: row.item.tags,
            autonomy: row.item.autonomy,
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

  const handleSaveSkillDoc = useCallback(
    async (key: string, doc: string): Promise<SkillSaveOutcome> => {
      const row = findSkillRow(key);
      if (!row) return 'failed';

      if (!row.serverBacked || row.item.id === null) {
        toast({
          tone: 'error',
          title: `Could not save instructions for ${row.item.name}`,
          detail:
            'This skill has no workspace capability row, so it was not persisted to the workspace.',
        });
        return 'failed';
      }

      try {
        await capabilitiesApi.update(row.item.id, { config: { markdown_doc: doc } });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Saved instructions for ${row.item.name}`,
          detail: 'Written to the workspace capability row.',
        });
        return 'server';
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not save ${row.item.name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
        return 'failed';
      }
    },
    [findSkillRow, mutateSkills, toast],
  );

  const handleDeleteSkill = useCallback(
    async (key: string) => {
      const row = findSkillRow(key);
      if (!row || row.item.id === null) {
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

      setSelectedSkillKey('');
      void mutateSkills();
      toast({
        tone: 'info',
        title: 'Skill deleted',
        detail: 'Removed from this workspace.',
      });
    },
    [findSkillRow, mutateSkills, toast],
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

      setNonSkillRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, enabled: nextState } : row)),
      );

      try {
        await capabilitiesApi.update(id, { enabled: nextState });
        void mutateServerRows();
      } catch (err) {
        // Roll the optimistic flip back on every failure, 404 included.
        //
        // A 404 used to be swallowed and fall through to the success toast.
        // `nonSkillRows` is seeded from SEED_CAPABILITIES, so the seeded
        // agents and plugins carry ids that are not server rows -- toggling one
        // PATCHed nothing, got a 404, and still reported "Enabled organization".
        setNonSkillRows((prev) =>
          prev.map((row) => (row.id === id ? { ...row, enabled: item.enabled } : row)),
        );

        if (isNotFound(err)) {
          toast({
            tone: 'warning',
            title: `${item.name} is not registered in this workspace`,
            detail:
              'Nothing was written. Install it as a capability first, then its enable state can be saved.',
          });
          return;
        }

        toast({
          tone: 'error',
          title: nextState ? `Could not enable ${item.name}` : `Could not disable ${item.name}`,
          detail: errorMessage(err, 'The change was not saved.'),
        });
        return;
      }
      toast({
        tone: nextState ? 'success' : 'warning',
        title: `${nextState ? 'Enabled' : 'Disabled'} ${item.name}`,
        detail: 'Applies to new agent sessions in this workspace.',
      });
    },
    [nonSkillRows, mutateServerRows, toast],
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
              aria-label="Search capabilities"
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
            workspaceId={workspaceId}
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
            workspaceId={workspaceId}
            plugins={nonSkillRows.filter((item) => item.category === 'plugins')}
            searchQuery={searchQuery}
            onTogglePlugin={(id) => void handleToggleCapability(id)}
            onOpenGitImport={() => setImportModalOpen(true)}
          />
        </TabPanel>
      </section>

      {(createModalOpen || importModalOpen) && (
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
                  markdown_doc: newCap.markdownDoc || '',
                  tags: newCap.tags || [],
                  autonomy: newCap.autonomy || 'autonomous',
                  ...(newCap.requiredScope ? { required_scope: newCap.requiredScope } : {}),
                },
              });
              newCap.id = created.id;
              void mutateServerRows();
              void mutateSkills();
            } catch (err) {
              toast({
                tone: 'error',
                title: `Could not create ${newCap.name}`,
                detail: `${errorMessage(err, 'The server write failed.')} It was not registered in this workspace.`,
              });
              return;
            }
            setSelectedCategory(newCap.category);
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
      )}
    </div>
  );
}

export default function CapabilitiesPage() {
  return (
    <Suspense fallback={<CapabilitiesWorkbenchSkeleton />}>
      <CapabilitiesContent />
    </Suspense>
  );
}
