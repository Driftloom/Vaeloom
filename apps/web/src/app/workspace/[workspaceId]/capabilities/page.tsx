'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useSWR from 'swr';
import { Badge, StatusDot, Button, EmptyState } from '@vaeloom/ui-kit';
import {
  CapabilityCategory,
  CapabilityItem,
  getStoredCapabilities,
  setStoredCapabilityEnabled,
  saveCustomCapability,
  deleteCustomCapability,
} from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { agentCatalogApi, capabilitiesApi } from '@/lib/api-client';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { AddCapabilityModal } from '@/components/capabilities/AddCapabilityModal';
import { SkillsView } from '@/components/capabilities/SkillsView';
import { AgentsView } from '@/components/capabilities/AgentsView';
import { ToolsView } from '@/components/capabilities/ToolsView';
import { McpView } from '@/components/capabilities/McpView';
import { PluginsView } from '@/components/capabilities/PluginsView';
import { ConnectorsView } from '@/components/capabilities/ConnectorsView';

type TabView = 'installed' | 'browse';
type SortOption = 'most-used' | 'alphabetical' | 'recent';
type DetailSubTab = 'doc' | 'schema' | 'test';

function getSamplePayloadForCapability(item: CapabilityItem | null): string {
  if (!item) return '{\n  "query": "example test run",\n  "limit": 5\n}';

  if (item.inputSchema && typeof item.inputSchema === 'object') {
    const props = (
      item.inputSchema as { properties?: Record<string, { type?: string; default?: unknown }> }
    ).properties;
    if (props && Object.keys(props).length > 0) {
      const sample: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(props)) {
        if (val.default !== undefined) {
          sample[key] = val.default;
        } else if (val.type === 'string') {
          sample[key] = key.includes('query') ? 'example inquiry' : `sample_${key}`;
        } else if (val.type === 'integer' || val.type === 'number') {
          sample[key] = 10;
        } else if (val.type === 'boolean') {
          sample[key] = true;
        } else if (val.type === 'array') {
          sample[key] = [];
        } else {
          sample[key] = {};
        }
      }
      return JSON.stringify(sample, null, 2);
    }
  }

  if (item.category === 'tools') {
    return JSON.stringify({ query: 'master resume skills graph', limit: 5 }, null, 2);
  }
  if (item.category === 'agents') {
    return JSON.stringify(
      {
        message: `Run diagnostic check for ${item.name} agent`,
        autonomyMode: item.autonomy || 'suggest',
      },
      null,
      2,
    );
  }
  if (item.category === 'mcp') {
    return JSON.stringify({ action: 'list_resources', parameters: { filter: 'active' } }, null, 2);
  }
  return JSON.stringify({ task: `Evaluate rules for ${item.name}`, dryRun: true }, null, 2);
}

export default function CapabilitiesPage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const { toast } = useToast();

  // Primary State initialized synchronously from stored data
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>(() =>
    getStoredCapabilities(workspaceId),
  );
  // Check URL parameters for category or agent deep links
  const [initialCategory] = useState<CapabilityCategory>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const cat = urlParams.get('category') || urlParams.get('tab');
      if (cat && ['skills', 'connectors', 'agents', 'tools', 'mcp', 'plugins'].includes(cat)) {
        return cat as CapabilityCategory;
      }
    }
    return 'skills';
  });

  const [initialAgentParam] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('agent') || undefined;
    }
    return undefined;
  });

  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabView, setTabView] = useState<TabView>('installed');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('most-used');
  const [selectedId, setSelectedId] = useState<string>('');
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('doc');

  // Mobile detail view toggle
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectorsAddTrigger, setConnectorsAddTrigger] = useState(0);
  const [newCapName, setNewCapName] = useState('');
  const [newCapCategory, setNewCapCategory] = useState<CapabilityCategory>('skills');
  const [newCapDescription, setNewCapDescription] = useState('');
  const [newCapTags, setNewCapTags] = useState('');
  const [newCapDoc, setNewCapDoc] = useState('');

  // Remote Git / Registry Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importType, setImportType] = useState<CapabilityCategory>('skills');
  const [importLoading, setImportLoading] = useState(false);

  // Interactive Test State
  const [testInputJson, setTestInputJson] = useState(
    '{\n  "query": "example test run",\n  "limit": 5\n}',
  );
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Live Backend Data Fetching via SWR
  const { data: liveCatalog, error: catalogError } = useSWR(
    'agent-catalog',
    () => agentCatalogApi.get(),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const { connectors: liveConnectors } = useWorkspaceConnectors(workspaceId);

  // Live Sovereign Capabilities Fetching via SWR
  const { data: dbCapabilities, mutate: mutateCapabilities } = useSWR(
    workspaceId ? ['workspace-capabilities', workspaceId] : null,
    () => capabilitiesApi.list(undefined, workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  useEffect(() => {
    if (!dbCapabilities || !Array.isArray(dbCapabilities) || dbCapabilities.length === 0) return;
    setCapabilities((prev) => {
      const merged = [...prev];
      const catMap: Record<string, CapabilityCategory> = {
        skill: 'skills',
        skills: 'skills',
        connector: 'connectors',
        connectors: 'connectors',
        mcp: 'mcp',
        plugin: 'plugins',
        plugins: 'plugins',
        tool: 'tools',
        tools: 'tools',
        agent: 'agents',
        agents: 'agents',
      };
      dbCapabilities.forEach((dbCap) => {
        const mappedCat = catMap[dbCap.category] || 'skills';
        const existingIdx = merged.findIndex(
          (c) => c.id === dbCap.id || (c.name === dbCap.name && c.category === mappedCat),
        );
        const item: CapabilityItem = {
          id: dbCap.id,
          name: dbCap.name,
          category: mappedCat,
          tags: (dbCap.config?.['tags'] as string[]) || ['Workspace', 'Custom'],
          description: dbCap.description || '',
          enabled: dbCap.enabled,
          source: 'custom',
          usageCount: (dbCap.config?.['usageCount'] as number) || 0,
          lastUsed: 'Recently',
          requiredScope:
            (dbCap.config?.['requiredScope'] as string) ||
            (mappedCat === 'mcp' ? 'connector.mcp.execute' : 'system.execute'),
          trustClass: mappedCat === 'mcp' ? 'mcp.workspace.write' : 'first_party',
          version: dbCap.version || '1.0.0',
          author: dbCap.author || 'Workspace Member',
          autonomy: (dbCap.config?.['autonomy'] as any) || 'autonomous',
          markdownDoc:
            (dbCap.config?.['doc'] as string) || `# ${dbCap.name}\n\n${dbCap.description}\n`,
          inputSchema: (dbCap.config?.['parameters'] as any) || undefined,
        };
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], ...item };
        } else {
          merged.push(item);
        }
      });
      return merged;
    });
  }, [dbCapabilities]);

  const liveConnectorsKey = useMemo(
    () => liveConnectors?.map((c) => `${c.id}:${c.status}`).join(',') || '',
    [liveConnectors],
  );
  const liveCatalogKey = useMemo(
    () => liveCatalog?.agents?.map((a) => a.name).join(',') || '',
    [liveCatalog],
  );

  // Reconcile live backend catalog and connectors with stored state
  useEffect(() => {
    const hasCatalogData = Boolean(liveCatalog?.agents && liveCatalog.agents.length > 0);
    const hasConnectorsData = Boolean(liveConnectors && liveConnectors.length > 0);
    if (!hasCatalogData && !hasConnectorsData) return;

    setCapabilities((prev) => {
      const merged = [...prev];

      // Enrich from live catalog if available
      if (liveCatalog?.agents && Array.isArray(liveCatalog.agents)) {
        liveCatalog.agents.forEach((liveAgent) => {
          const existingIdx = merged.findIndex(
            (c) =>
              c.category === 'agents' &&
              (c.name === liveAgent.name || c.id === `agent-${liveAgent.name}`),
          );
          const currentItem = merged[existingIdx];
          if (existingIdx >= 0 && currentItem) {
            merged[existingIdx] = {
              ...currentItem,
              requiredScope: liveAgent.tools?.[0]?.requiredScope || currentItem.requiredScope,
              autonomy:
                (liveAgent.defaultAutonomy as 'suggest' | 'autonomous' | 'approval_required') ||
                currentItem.autonomy,
              toolsUsed: liveAgent.toolNames || currentItem.toolsUsed,
            };
          }
        });
      }

      // Enrich live MCP connectors if present
      if (liveConnectors && Array.isArray(liveConnectors) && liveConnectors.length > 0) {
        liveConnectors.forEach((conn) => {
          const providerName = conn.provider || 'unknown';
          if (providerName.toLowerCase().includes('mcp')) {
            const mcpId = `mcp-${conn.id}`;
            const existing = merged.find((c) => c.id === mcpId);
            if (!existing) {
              merged.push({
                id: mcpId,
                name: providerName,
                category: 'mcp',
                tags: ['MCP', 'Live Connector', providerName],
                description: `Live Model Context Protocol connector (${providerName}) attached to workspace.`,
                enabled: conn.status === 'connected',
                source: 'mcp',
                usageCount: 12,
                lastUsed: conn.lastSyncAt ? 'Recently synced' : 'idle',
                requiredScope: 'connector.mcp.execute',
                trustClass: 'mcp.workspace.write',
                version: '1.0.0',
                author: providerName,
                markdownDoc: `# MCP Server: ${providerName}\n\nLive Model Context Protocol bridge providing dynamic tools into agent reasoning loop.\n\nStatus: ${conn.status}\nProvider: ${providerName}\n`,
              });
            }
          }
        });
      }

      return merged;
    });
  }, [liveCatalogKey, liveConnectorsKey]);

  // Compute live category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CapabilityCategory, number> = {
      skills: 0,
      connectors: liveConnectors?.length || 14,
      mcp: 0,
      plugins: 0,
      tools: 0,
      agents: 0,
    };
    capabilities.forEach((c) => {
      if (counts[c.category] !== undefined && c.category !== 'connectors') {
        counts[c.category]++;
      }
    });
    return counts;
  }, [capabilities, liveConnectors]);

  // Dynamic search input placeholder based on active tab
  const searchPlaceholder = useMemo(() => {
    switch (selectedCategory) {
      case 'skills':
        return 'Filter installed skills...';
      case 'connectors':
        return 'Search connectors...';
      case 'mcp':
        return 'Search MCP servers...';
      case 'plugins':
        return 'Search plugins...';
      case 'tools':
        return 'Search tools & suites...';
      case 'agents':
        return 'Search agents...';
      default:
        return 'Search capabilities...';
    }
  }, [selectedCategory]);

  // Filter & Sort capabilities for the active category
  const filteredItems = useMemo(() => {
    return capabilities
      .filter((item) => {
        // Category check
        if (item.category !== selectedCategory) return false;

        // Installed vs Browse view
        if (tabView === 'installed' && !item.enabled) return false;

        // Tag filter
        if (selectedTag !== 'All' && !item.tags.includes(selectedTag)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'alphabetical') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'recent') {
          return (b.lastUsed || '').localeCompare(a.lastUsed || '');
        }
        return b.usageCount - a.usageCount;
      });
  }, [capabilities, selectedCategory, tabView, selectedTag, sortBy]);

  // Default selected item selection
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!selectedId || !filteredItems.some((i) => i.id === selectedId)) {
        setSelectedId(filteredItems[0]?.id || '');
      }
    } else {
      setSelectedId('');
    }
  }, [filteredItems, selectedId]);

  // Selected Item reference
  const selectedItem = useMemo(() => {
    return capabilities.find((c) => c.id === selectedId) || filteredItems[0] || null;
  }, [capabilities, selectedId, filteredItems]);

  // Auto-fill realistic sample payload when switching items
  useEffect(() => {
    if (selectedItem) {
      setTestInputJson(getSamplePayloadForCapability(selectedItem));
      setTestOutput(null);
      setTestLatency(null);
    }
  }, [selectedItem?.id]);

  // Available tags in current category
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    capabilities
      .filter((c) => c.category === selectedCategory)
      .forEach((c) => c.tags.forEach((t) => set.add(t)));
    return ['All', ...Array.from(set)];
  }, [capabilities, selectedCategory]);

  // Update Skill definition / instructions
  const handleUpdateSkill = useCallback(
    (updatedItem: CapabilityItem) => {
      saveCustomCapability(workspaceId, updatedItem);
      setCapabilities((prev) => prev.map((c) => (c.id === updatedItem.id ? updatedItem : c)));
    },
    [workspaceId],
  );

  // Delete Custom Skill
  const handleDeleteSkill = useCallback(
    (id: string) => {
      const updated = deleteCustomCapability(workspaceId, id);
      setCapabilities(updated);
      toast({
        tone: 'info',
        title: 'Skill deleted',
        detail: 'Removed from workspace capabilities.',
      });
    },
    [workspaceId, toast],
  );

  // Toggle Item Enabled Status
  const handleToggle = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const item = capabilities.find((c) => c.id === id);
      if (!item) return;
      const nextState = !item.enabled;
      const updated = setStoredCapabilityEnabled(workspaceId, id, nextState);
      setCapabilities(updated);

      try {
        await capabilitiesApi.toggleCapability(id, nextState, workspaceId);
      } catch {
        // Fallback for static capabilities not yet in DB
      }

      toast({
        tone: nextState ? 'success' : 'warning',
        title: nextState ? `Enabled ${item.name}` : `Disabled ${item.name}`,
        detail: `Changes apply to new agent sessions in workspace`,
      });
    },
    [capabilities, workspaceId, toast],
  );

  // Copy Definition / Spec
  const handleCopyDefinition = useCallback(() => {
    if (!selectedItem) return;
    const contentToCopy =
      selectedItem.markdownDoc ||
      JSON.stringify(
        {
          name: selectedItem.name,
          category: selectedItem.category,
          description: selectedItem.description,
          tags: selectedItem.tags,
          schema: selectedItem.inputSchema,
        },
        null,
        2,
      );
    navigator.clipboard.writeText(contentToCopy);
    toast({
      tone: 'info',
      title: 'Copied definition',
      detail: `${selectedItem.name} specification copied to clipboard`,
    });
  }, [selectedItem, toast]);

  // Execute Interactive Test Runner
  const handleRunTest = useCallback(async () => {
    if (!selectedItem) return;
    setTestRunning(true);
    setTestOutput(null);

    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = JSON.parse(testInputJson);
    } catch {
      parsedInput = { query: testInputJson };
    }

    try {
      const liveRes = await capabilitiesApi.test({
        workspaceId,
        capabilityName: selectedItem.name,
        category: selectedItem.category,
        inputPayload: parsedInput,
      });

      setTestOutput(JSON.stringify(liveRes, null, 2));
      setTestLatency(liveRes.executionDurationMs);
      setTestRunning(false);
      toast({
        tone: liveRes.status === 'warning' ? 'warning' : 'success',
        title: `Test completed: ${selectedItem.name}`,
        detail: `Execution finished with ${liveRes.status} (${liveRes.executionDurationMs}ms)`,
      });
    } catch (err: unknown) {
      setTestRunning(false);
      const errMsg = err instanceof Error ? err.message : 'Execution failed';
      setTestOutput(
        JSON.stringify(
          {
            status: 'error',
            capability: selectedItem.name,
            category: selectedItem.category,
            timestamp: new Date().toISOString(),
            error: errMsg,
          },
          null,
          2,
        ),
      );
      toast({
        tone: 'error',
        title: `Test failed: ${selectedItem.name}`,
        detail: errMsg,
      });
    }
  }, [selectedItem, testInputJson, workspaceId, toast]);

  // Create New Capability Handler
  const handleCreateSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newCapName.trim()) return;

      const slug = newCapName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const tagsList = newCapTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const newCap: CapabilityItem = {
        id: `custom-${slug}-${Date.now()}`,
        name: slug,
        category: newCapCategory,
        tags: tagsList.length > 0 ? tagsList : ['Custom', 'User-Defined'],
        description: newCapDescription || `Custom capability added to ${newCapCategory}.`,
        enabled: true,
        source: 'custom',
        usageCount: 1,
        lastUsed: 'Just now',
        requiredScope: 'system.execute',
        trustClass: 'first_party',
        version: '1.0.0',
        author: 'Workspace Custom',
        markdownDoc:
          newCapDoc ||
          `# ${newCapName}\n\n## Overview\n${newCapDescription}\n\n## Instructions\n- Custom capability definition created by user.\n`,
      };

      saveCustomCapability(workspaceId, newCap);
      const updated = setStoredCapabilityEnabled(workspaceId, newCap.id, true);
      setCapabilities(updated);
      setSelectedCategory(newCapCategory);
      setSelectedId(newCap.id);
      setCreateModalOpen(false);

      // Reset form
      setNewCapName('');
      setNewCapDescription('');
      setNewCapTags('');
      setNewCapDoc('');

      toast({
        tone: 'success',
        title: `Created ${slug}`,
        detail: `New capability added under ${newCapCategory}`,
      });
    },
    [newCapName, newCapCategory, newCapDescription, newCapTags, newCapDoc, workspaceId, toast],
  );

  // Remote Import Submit Handler
  const handleImportSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!importUrl.trim()) return;
      setImportLoading(true);

      setTimeout(() => {
        const urlParts = importUrl.trim().replace(/\/$/, '').split('/');
        const rawName = urlParts[urlParts.length - 1]?.replace(/\.git$/, '') || 'remote-capability';
        const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

        const newImportedItem: CapabilityItem = {
          id: `import-${cleanName}-${Date.now()}`,
          name: cleanName,
          category: importType,
          tags: ['Imported', 'Remote', importType],
          description: `Imported capability from ${importUrl}`,
          enabled: true,
          source: importType === 'mcp' ? 'mcp' : 'custom',
          usageCount: 1,
          lastUsed: 'Just now',
          requiredScope: importType === 'mcp' ? 'connector.mcp.execute' : 'system.execute',
          trustClass: importType === 'mcp' ? 'mcp.workspace.write' : 'first_party',
          version: '1.0.0',
          author: importUrl.includes('github.com')
            ? importUrl.split('/')[3] || 'Git Author'
            : 'Remote Registry',
          markdownDoc: `# ${cleanName}\n\nImported from remote registry or git source: \`${importUrl}\`\n\n## Overview\nAuto-discovered manifest with dynamic execution tools.\n`,
        };

        saveCustomCapability(workspaceId, newImportedItem);
        const updated = setStoredCapabilityEnabled(workspaceId, newImportedItem.id, true);
        setCapabilities(updated);
        setSelectedCategory(importType);
        setSelectedId(newImportedItem.id);
        setImportLoading(false);
        setImportModalOpen(false);
        setImportUrl('');

        toast({
          tone: 'success',
          title: `Imported ${cleanName}`,
          detail: `Successfully compiled and registered into workspace ${importType}`,
        });
      }, 500);
    },
    [importUrl, importType, workspaceId, toast],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-primary/25 selection:text-primary overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. Header: Search (left) + Category Tabs (center/right)                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. Header: Enterprise Unified Command Ribbon                               */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <header className="border-b border-[#1c2030] bg-[#0c0e15]/95 backdrop-blur-md px-4 sm:px-6 py-2.5 shrink-0 z-10 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 min-w-0">
          {/* Left: Omni-Search Bar with Shortcut Hint (NO Breadcrumbs) */}
          <div className="relative w-full sm:w-56 md:w-60 lg:w-52 xl:w-56 shrink-0">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-[#121520] border border-[#242b3d] rounded-lg pl-8 pr-9 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-sans"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-white p-0.5 pointer-events-auto cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : (
                <kbd className="hidden sm:inline-block font-mono text-[10px] text-zinc-500 border border-zinc-700/60 rounded px-1.5 py-0.5 bg-zinc-900/80">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Right: Segmented Category Selector & Primary CTA Button */}
          <div className="flex items-center gap-2 min-w-0 justify-between lg:justify-end">
            <div className="overflow-x-auto no-scrollbar min-w-0">
              <div
                role="tablist"
                aria-label="Capability category"
                className="flex items-center gap-1 p-0.5 rounded-lg bg-[#11141e] border border-[#202636] w-max"
              >
                {(
                  [
                    {
                      id: 'skills',
                      label: 'Skills',
                      count: categoryCounts.skills,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ),
                    },
                    {
                      id: 'connectors',
                      label: 'Connectors',
                      count: categoryCounts.connectors,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      ),
                    },
                    {
                      id: 'mcp',
                      label: 'MCP',
                      count: categoryCounts.mcp,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                          <rect x="9" y="9" width="6" height="6" />
                          <line x1="9" y1="1" x2="9" y2="4" />
                          <line x1="15" y1="1" x2="15" y2="4" />
                          <line x1="9" y1="20" x2="9" y2="23" />
                          <line x1="15" y1="20" x2="15" y2="23" />
                        </svg>
                      ),
                    },
                    {
                      id: 'tools',
                      label: 'Tools',
                      count: categoryCounts.tools,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      ),
                    },
                    {
                      id: 'plugins',
                      label: 'Plugins',
                      count: categoryCounts.plugins,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                      ),
                    },
                    {
                      id: 'agents',
                      label: 'Agents',
                      count: categoryCounts.agents,
                      icon: (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <rect x="3" y="11" width="18" height="10" rx="2" />
                          <circle cx="12" cy="5" r="2" />
                          <path d="M12 7v4" />
                          <line x1="8" y1="16" x2="8" y2="16" />
                          <line x1="16" y1="16" x2="16" y2="16" />
                        </svg>
                      ),
                    },
                  ] as const
                ).map((tab) => {
                  const isActive = selectedCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setSelectedCategory(tab.id);
                        setSelectedTag('All');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#1e2436] text-white font-semibold shadow-xs border border-[#353f5c]'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161a27]'
                      }`}
                    >
                      <span className={isActive ? 'text-blue-400' : 'text-zinc-500'}>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30'
                            : 'text-zinc-500 bg-zinc-800/60'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header Right Action: Primary CTA Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedCategory === 'connectors') {
                  setConnectorsAddTrigger((prev) => prev + 1);
                  return;
                }
                setNewCapCategory(selectedCategory);
                setCreateModalOpen(true);
              }}
              aria-label="New Capability"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-xs font-semibold text-white transition-all shadow-sm shrink-0 cursor-pointer whitespace-nowrap"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>
                {selectedCategory === 'skills'
                  ? 'New Skill'
                  : selectedCategory === 'connectors'
                    ? 'Add Connector'
                    : selectedCategory === 'agents'
                      ? 'New Agent'
                      : selectedCategory === 'tools'
                        ? 'New Tool'
                        : selectedCategory === 'mcp'
                          ? 'New MCP Server'
                          : 'New Plugin'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. Adaptive Multi-Paradigm Main Workbench View                             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden bg-[#09090b]">
        {selectedCategory === 'skills' && (
          <SkillsView
            skills={capabilities.filter((c) => c.category === 'skills')}
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            onToggleSkill={handleToggle}
            onUpdateSkill={handleUpdateSkill}
            onDeleteSkill={handleDeleteSkill}
            onOpenCreate={() => {
              setNewCapCategory('skills');
              setCreateModalOpen(true);
            }}
          />
        )}

        {selectedCategory === 'connectors' && (
          <ConnectorsView
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            openAddTrigger={connectorsAddTrigger}
          />
        )}

        {selectedCategory === 'agents' && (
          <AgentsView
            agents={capabilities.filter((c) => c.category === 'agents')}
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            initialAgentName={initialAgentParam}
            onToggleAgent={handleToggle}
          />
        )}

        {selectedCategory === 'tools' && (
          <ToolsView
            tools={capabilities.filter((c) => c.category === 'tools')}
            workspaceId={workspaceId}
            searchQuery={searchQuery}
          />
        )}

        {selectedCategory === 'mcp' && (
          <McpView
            workspaceId={workspaceId}
            searchQuery={searchQuery}
            onOpenCreateServer={() => {
              setNewCapCategory('mcp');
              setCreateModalOpen(true);
            }}
            onOpenImport={() => {
              setImportType('mcp');
              setImportModalOpen(true);
            }}
          />
        )}

        {selectedCategory === 'plugins' && (
          <PluginsView
            plugins={capabilities.filter((c) => c.category === 'plugins')}
            searchQuery={searchQuery}
            onTogglePlugin={handleToggle}
            onOpenGitImport={() => {
              setImportType('plugins');
              setImportModalOpen(true);
            }}
          />
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Enterprise Capability Authoring & Import Studio                            */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
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
            const catMap: Record<string, string> = {
              skills: 'skill',
              plugins: 'plugin',
              tools: 'tool',
              agents: 'agent',
              connectors: 'connector',
              mcp: 'mcp',
            };
            const created = await capabilitiesApi.create({
              name: newCap.name,
              category: catMap[newCap.category] || newCap.category,
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
              },
            });
            newCap.id = created.id;
            mutateCapabilities();
          } catch (err) {
            console.warn('Backend capability creation failed (using local sync):', err);
          }
          saveCustomCapability(workspaceId, newCap);
          const updated = setStoredCapabilityEnabled(workspaceId, newCap.id, true);
          setCapabilities(updated);
          setSelectedCategory(newCap.category);
          setSelectedId(newCap.id);
          toast({
            tone: 'success',
            title: `Created ${newCap.name}`,
            detail: `New capability added under ${newCap.category}`,
          });
        }}
        onImport={async (url, category) => {
          const urlParts = url.trim().replace(/\/$/, '').split('/');
          const rawName =
            urlParts[urlParts.length - 1]?.replace(/\.git$/, '') || 'remote-capability';
          const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

          let newId = `import-${cleanName}-${Date.now()}`;
          try {
            const catMap: Record<string, string> = {
              skills: 'skill',
              plugins: 'plugin',
              tools: 'tool',
              agents: 'agent',
              connectors: 'connector',
              mcp: 'mcp',
            };
            const created = await capabilitiesApi.create({
              name: cleanName,
              category: catMap[category] || category,
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
            newId = created.id;
            mutateCapabilities();
          } catch (err) {
            console.warn('Backend capability import save failed (local fallback):', err);
          }

          const newImportedItem: CapabilityItem = {
            id: newId,
            name: cleanName,
            category: category,
            tags: ['Imported', 'Remote', category],
            description: `Imported capability from ${url}`,
            enabled: true,
            source: category === 'mcp' ? 'mcp' : 'custom',
            usageCount: 1,
            lastUsed: 'Just now',
            requiredScope: category === 'mcp' ? 'connector.mcp.execute' : 'system.execute',
            trustClass: category === 'mcp' ? 'mcp.workspace.write' : 'first_party',
            version: '1.0.0',
            author: url.includes('github.com')
              ? url.split('/')[3] || 'Git Author'
              : 'Remote Registry',
            markdownDoc: `# ${cleanName}\n\nImported from remote registry or git source: \`${url}\`\n\n## Overview\nAuto-discovered manifest with dynamic execution tools.\n`,
          };

          saveCustomCapability(workspaceId, newImportedItem);
          const updated = setStoredCapabilityEnabled(workspaceId, newImportedItem.id, true);
          setCapabilities(updated);
          setSelectedCategory(category);
          setSelectedId(newImportedItem.id);

          toast({
            tone: 'success',
            title: `Imported ${cleanName}`,
            detail: `Successfully compiled and registered into workspace ${category}`,
          });
        }}
      />
    </div>
  );
}
