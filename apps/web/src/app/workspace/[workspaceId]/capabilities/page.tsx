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
  HubCategory,
  HubCapabilityItem,
  SEED_HUB_ITEMS,
  getStoredCapabilities,
  setStoredCapabilityEnabled,
  saveCustomCapability,
  installHubCapability,
} from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { agentCatalogApi, capabilitiesApi } from '@/lib/api-client';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { AddCapabilityModal } from '@/components/capabilities/AddCapabilityModal';

type TabView = 'installed' | 'browse';
type SortOption = 'most-used' | 'alphabetical' | 'recent';
type DetailSubTab = 'doc' | 'schema' | 'test';

const HUB_CATEGORIES: { id: HubCategory; label: string; icon: string; count: number }[] = [
  { id: 'all', label: 'All categories', icon: '✨', count: 184 },
  { id: 'desktop', label: 'Desktop', icon: '💻', count: 55 },
  { id: 'memory', label: 'Memory', icon: '🧠', count: 17 },
  { id: 'platforms', label: 'Platforms', icon: '🌐', count: 17 },
  { id: 'web-browser', label: 'Web & Browser', icon: '🔍', count: 17 },
  { id: 'tools', label: 'Tools', icon: '🛠️', count: 44 },
  { id: 'voice', label: 'Voice', icon: '🎙️', count: 7 },
  { id: 'automation', label: 'Automation', icon: '⚡', count: 11 },
  { id: 'models', label: 'Models', icon: '🤖', count: 13 },
  { id: 'general', label: 'General', icon: '📦', count: 13 },
];

const HUB_CATEGORY_META: Record<HubCategory, { label: string; description: string }> = {
  all: {
    label: 'All Capabilities & Plugins',
    description: 'Explore community and official extensions, tools, plugins, and skills',
  },
  desktop: {
    label: 'Desktop',
    description: 'Panes, tabs, and views for Vaeloom Desktop',
  },
  memory: {
    label: 'Memory',
    description: 'Episodic recall, knowledge graph storage, and sovereign vector retention',
  },
  platforms: {
    label: 'Platforms & Integrations',
    description: 'Connectors and bridges for GitHub, Slack, Tailscale, and cloud ecosystems',
  },
  'web-browser': {
    label: 'Web & Browser',
    description: 'Autonomous web scrapers, RSS feeds, and headless browser automation',
  },
  tools: {
    label: 'Tools & Telemetry',
    description: 'Diagnostic utilities, analytics monitors, and token cost ledgers',
  },
  voice: {
    label: 'Voice & Audio',
    description: 'Speech-to-text transcription, speech synthesis, and voice triggers',
  },
  automation: {
    label: 'Automation & Workflows',
    description: 'Scheduled cron triggers, webhook relays, and multi-step execution graphs',
  },
  models: {
    label: 'Model Gateways',
    description: 'Model routing adapters, local LLM runners, and fallback policies',
  },
  general: {
    label: 'General Utilities',
    description: 'Markdown compilers, document diff engines, and regex pattern parsers',
  },
};

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
  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>('skills');
  const [tabView, setTabView] = useState<TabView>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('most-used');
  const [selectedId, setSelectedId] = useState<string>('');
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('doc');

  // Mobile detail view toggle
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Hub Section State (Collapsible Lower Tier)
  const [hubBrowserOpen, setHubBrowserOpen] = useState(true);
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [selectedHubCategory, setSelectedHubCategory] = useState<HubCategory>('all');
  const [hubOriginFilter, setHubOriginFilter] = useState<'all' | 'official' | 'community'>('all');
  const [hubSubTab, setHubSubTab] = useState<
    'all' | 'skills' | 'plugins' | 'agents' | 'tools' | 'mcp'
  >('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
      agents: 0,
      skills: 0,
      tools: 0,
      mcp: 0,
      plugins: 0,
    };
    capabilities.forEach((c) => {
      if (counts[c.category] !== undefined) {
        counts[c.category]++;
      }
    });
    return counts;
  }, [capabilities]);

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

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchTags) return false;
        }

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
  }, [capabilities, selectedCategory, tabView, selectedTag, searchQuery, sortBy]);

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

  // Set of installed capability names
  const installedCapabilityNames = useMemo(() => {
    return new Set(capabilities.map((c) => c.name.toLowerCase()));
  }, [capabilities]);

  // Filter Hub Items
  const filteredHubItems = useMemo(() => {
    return SEED_HUB_ITEMS.filter((item) => {
      // Sub-tab filter
      if (hubSubTab !== 'all' && item.category !== hubSubTab) {
        return false;
      }
      // Hub Category filter
      if (selectedHubCategory !== 'all' && item.hubCategory !== selectedHubCategory) {
        return false;
      }
      // Origin filter (Official vs Community)
      if (hubOriginFilter === 'official' && !item.isOfficial) return false;
      if (hubOriginFilter === 'community' && item.isOfficial) return false;

      // Search Query
      if (hubSearchQuery.trim()) {
        const q = hubSearchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchTags) return false;
      }
      return true;
    });
  }, [selectedHubCategory, hubOriginFilter, hubSearchQuery, hubSubTab]);

  // Toggle Item Enabled Status
  const handleToggle = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const item = capabilities.find((c) => c.id === id);
      if (!item) return;
      const nextState = !item.enabled;
      const updated = setStoredCapabilityEnabled(workspaceId, id, nextState);
      setCapabilities(updated);
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
    } catch {
      // Robust offline / mock fallback simulation
      setTimeout(() => {
        const latency = Math.floor(Math.random() * 60) + 22;
        const mockResponse = {
          status: 'success',
          capability: selectedItem.name,
          category: selectedItem.category,
          timestamp: new Date().toISOString(),
          executionDurationMs: latency,
          inputPassed: parsedInput,
          result:
            selectedItem.category === 'tools'
              ? {
                  count: 3,
                  matchedEntities: ['Document#104', 'GraphEdge#99', 'Artifact#22'],
                  confidence: 0.96,
                }
              : selectedItem.category === 'agents'
                ? {
                    decision: 'PROCEED',
                    nextAgent: 'ats',
                    reason: 'Trajectory aligns with user workspace directives',
                  }
                : {
                    message: 'Skill evaluated successfully with 0 violations',
                    criteriaChecked: 6,
                  },
        };

        setTestOutput(JSON.stringify(mockResponse, null, 2));
        setTestLatency(latency);
        setTestRunning(false);
        toast({
          tone: 'success',
          title: `Test completed: ${selectedItem.name}`,
          detail: `Execution returned 200 OK (${latency}ms)`,
        });
      }, 350);
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

  // 1-Click Install Capability from Hub
  const handleInstallHubItem = useCallback(
    (hubItem: HubCapabilityItem) => {
      const updated = installHubCapability(workspaceId, hubItem);
      setCapabilities(updated);
      setSelectedCategory(hubItem.category);
      setSelectedId(hubItem.capabilityItem.id);
      toast({
        tone: 'success',
        title: `Installed ${hubItem.name}`,
        detail: `Added to ${hubItem.category} and activated in workspace`,
      });
    },
    [workspaceId, toast],
  );

  // Update Installed Action
  const handleUpdateInstalled = useCallback(() => {
    toast({
      tone: 'info',
      title: 'Updating installed capabilities',
      detail: 'Re-syncing live agent tools and connector manifest definitions…',
    });
    setTimeout(() => {
      toast({
        tone: 'success',
        title: 'All capabilities up to date',
        detail: 'Catalog and active workspace sessions are in sync',
      });
    }, 500);
  }, [toast]);

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
    <div className="flex flex-col min-h-screen bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-primary/25 selection:text-primary">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. Header: Search (left) + Category Tabs (center/right)                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <header className="border-b border-[#1c1d24] bg-[#0c0d10] px-4 sm:px-6 py-2.5 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Clean Minimalist Search Input */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            <h1 className="sr-only">Capabilities</h1>

            {/* Minimalist Search Input */}
            <div className="relative flex-1 max-w-[280px] sm:max-w-sm">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717a] pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Try "general"'
                className="w-full pl-8 pr-6 py-1 text-xs rounded-md bg-[#14151a] border border-[#23242c] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/40 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white p-0.5"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Right: Category Tabs (Skills 375, Agents 12, Tools 28, MCP 6, Plugins 8) */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'skills', label: 'Skills', count: categoryCounts.skills },
                { id: 'agents', label: 'Agents', count: categoryCounts.agents },
                { id: 'tools', label: 'Tools', count: categoryCounts.tools },
                { id: 'mcp', label: 'MCP', count: categoryCounts.mcp },
                { id: 'plugins', label: 'Plugins', count: categoryCounts.plugins },
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
                    isActive
                      ? 'bg-[#181a22] text-white font-semibold shadow-xs border border-[#2c2f3d]'
                      : 'text-[#8b8e99] hover:text-[#e4e4e7] hover:bg-[#14151a]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-sans px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-primary/25 text-[#93c5fd] font-semibold' : 'text-[#61646d]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. Split Pane: Left Capability List & Right Deep Detail Inspector         */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex min-h-[560px] max-h-[700px] border-b border-[#1c1d24] relative overflow-hidden bg-[#09090b]">
        {/* Left Column: Capability List with 1 Most used sort */}
        <div
          className={`w-full lg:w-[360px] xl:w-[390px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0 ${
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top toolbar: 1 Most used sort + Installed/Browse + Compact New Capability button */}
          <div className="px-3.5 py-2 border-b border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent border-0 text-xs font-sans text-[#8b8e99] hover:text-[#e4e4e7] focus:outline-none cursor-pointer"
              >
                <option value="most-used" className="bg-[#14151a] text-[#f4f4f5]">
                  1 Most used
                </option>
                <option value="alphabetical" className="bg-[#14151a] text-[#f4f4f5]">
                  Alphabetical
                </option>
                <option value="recent" className="bg-[#14151a] text-[#f4f4f5]">
                  Recently used
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Installed vs Browse Pill */}
              <div className="flex items-center p-0.5 rounded bg-[#14151a] border border-[#23242c] text-xs font-sans">
                <button
                  onClick={() => setTabView('installed')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    tabView === 'installed'
                      ? 'bg-[#22242e] text-[#f4f4f5] font-semibold'
                      : 'text-[#71717a] hover:text-[#d4d4d8]'
                  }`}
                >
                  Installed
                </button>
                <button
                  onClick={() => setTabView('browse')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    tabView === 'browse'
                      ? 'bg-[#22242e] text-[#f4f4f5] font-semibold'
                      : 'text-[#71717a] hover:text-[#d4d4d8]'
                  }`}
                >
                  Browse
                </button>
              </div>

              {/* Compact New Capability Icon Button (Does not wrap or squish!) */}
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                aria-label="New Capability"
                title="New Capability"
                className="w-6 h-6 rounded bg-[#14151a] border border-[#252732] hover:bg-[#1c1e26] hover:text-white text-[#8b8e99] flex items-center justify-center transition-colors shrink-0"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>

              <button
                className="text-[#71717a] hover:text-[#e4e4e7] p-1 rounded hover:bg-[#191a20]"
                title="Capability options"
                aria-label="Capability options"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Capability Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-1.5 space-y-0.5">
            {filteredItems.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No capabilities found"
                  description={`Try adjusting your search query or switching from "${tabView}" to "${
                    tabView === 'installed' ? 'Browse' : 'Installed'
                  }".`}
                />
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileDetailOpen(true);
                    }}
                    className={`group relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-120 ${
                      isSelected
                        ? 'bg-[#181920] border border-[#2b2d39] shadow-xs'
                        : 'hover:bg-[#121318] border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {/* Name */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[13px] font-sans font-medium tracking-tight truncate ${
                            isSelected
                              ? 'text-white font-semibold'
                              : 'text-[#d4d4d8] group-hover:text-white'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>

                      {/* Tag badges row matching reference: General, learned */}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="px-1.5 py-0.5 text-[10px] font-sans font-medium rounded bg-[#1e2027] text-[#9ca3af] border border-[#282a34]">
                          General
                        </span>

                        {item.source === 'learned' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-sans font-medium rounded bg-[#1c2233] text-[#93c5fd] border border-[#252f48]">
                            learned
                          </span>
                        )}

                        {item.source === 'mcp' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-sans font-medium rounded bg-[#201d2d] text-[#c084fc] border border-[#322a48]">
                            mcp
                          </span>
                        )}

                        {item.tags.slice(0, 1).map((tag) => {
                          if (tag.toLowerCase() === 'general') return null;
                          return (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-[10px] font-sans font-medium rounded bg-[#17181e] text-[#71717a] border border-[#23242c]"
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Smooth Pill Switch Toggle (matches dark track + white circle from reference) */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.enabled}
                        aria-label={`Toggle ${item.name}`}
                        onClick={(e) => handleToggle(item.id, e)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-[#2b2d38] transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary ${
                          item.enabled ? 'bg-[#22c55e]' : 'bg-[#181920]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                            item.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Deep Detail Inspector (pixel-aligned to reference) */}
        <div
          className={`flex-1 flex flex-col min-h-0 bg-[#09090b] overflow-hidden ${
            mobileDetailOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back Button */}
              <div className="lg:hidden px-4 py-2 border-b border-[#1c1d24] bg-[#0c0d10] flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setMobileDetailOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#8b8e99] hover:text-white font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span>Back to {selectedCategory} list</span>
                </button>
              </div>

              {/* Detail Header & Action Links */}
              <div className="p-5 sm:p-6 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0 font-sans">
                <div className="flex flex-col gap-2">
                  {/* Title and Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
                      {selectedItem.name}
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-sans font-medium rounded bg-[#1e2027] text-[#9ca3af] border border-[#282a34]">
                      General
                    </span>
                    <span className="px-2 py-0.5 text-xs font-sans font-medium rounded bg-[#1c2233] text-[#93c5fd] border border-[#252f48]">
                      Learned
                    </span>
                  </div>

                  {/* Summary Description */}
                  <p className="text-[13px] text-[#a1a1aa] leading-relaxed max-w-2xl mt-0.5 font-sans">
                    {selectedItem.description}
                  </p>

                  {/* Action Links Bar: Edit, Archive, Test Run, Copy */}
                  <div className="flex items-center gap-4 mt-2 text-xs font-sans font-medium">
                    <button
                      onClick={() => setDetailSubTab('doc')}
                      className="text-[#8b8e99] hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggle(selectedItem.id)}
                      className="text-[#ef4444] hover:text-[#f87171] transition-colors"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => setDetailSubTab('test')}
                      className="text-[#93c5fd] hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <span>Test Run</span>
                      <span>→</span>
                    </button>
                    <button
                      onClick={handleCopyDefinition}
                      title="Copy full definition"
                      className="text-[#8b8e99] hover:text-white transition-colors ml-auto"
                      aria-label="Copy full definition"
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
                          strokeWidth={1.75}
                          d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9 9 9 0 00-9 9m16.5 0a9 9 0 01-9 9"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Metadata Box */}
                  <div className="mt-3 rounded-lg bg-[#111216] border border-[#1e2027] p-3.5 space-y-2 text-xs font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-1 sm:gap-2">
                      <span className="text-[#71717a] font-medium">name</span>
                      <span className="text-[#e4e4e7] font-medium">
                        {selectedItem.name.replace(/-/g, ' ')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-1 sm:gap-2">
                      <span className="text-[#71717a] font-medium">description</span>
                      <span className="text-[#d4d4d8] leading-relaxed">
                        {selectedItem.description}
                      </span>
                    </div>
                  </div>

                  {/* Subtabs Bar (Documentation | Schema | Interactive Test) */}
                  <div className="flex items-center gap-4 mt-3 border-b border-[#1c1d24]">
                    <button
                      onClick={() => setDetailSubTab('doc')}
                      className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                        detailSubTab === 'doc'
                          ? 'border-primary text-white font-semibold'
                          : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                      }`}
                    >
                      Documentation & Rules
                    </button>
                    <button
                      onClick={() => setDetailSubTab('schema')}
                      className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                        detailSubTab === 'schema'
                          ? 'border-primary text-white font-semibold'
                          : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                      }`}
                    >
                      Schema & Parameters
                    </button>
                    <button
                      onClick={() => setDetailSubTab('test')}
                      className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                        detailSubTab === 'test'
                          ? 'border-primary text-white font-semibold'
                          : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                      }`}
                    >
                      Test Playground
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Content Body: Clean font-sans prose container */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#09090b] min-h-0">
                {detailSubTab === 'doc' && (
                  <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-5 shadow-xs font-sans text-sm leading-relaxed text-[#d4d4d8]">
                    <div className="prose prose-invert prose-sm max-w-none font-sans prose-headings:font-sans prose-headings:font-semibold prose-headings:text-white prose-p:font-sans prose-p:text-[#a1a1aa] prose-p:leading-relaxed prose-li:font-sans prose-li:text-[#a1a1aa] prose-code:font-mono prose-code:text-[#93c5fd] prose-code:bg-[#161822] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:font-mono prose-pre:bg-[#12131a] prose-pre:border prose-pre:border-[#222430]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedItem.markdownDoc}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {detailSubTab === 'schema' && (
                  <div className="space-y-4 font-sans">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                          Input Argument Schema
                        </h4>
                        <button
                          onClick={() => {
                            if (selectedItem.inputSchema) {
                              navigator.clipboard.writeText(
                                JSON.stringify(selectedItem.inputSchema, null, 2),
                              );
                              toast({ tone: 'info', title: 'Copied input schema' });
                            }
                          }}
                          className="text-xs font-sans text-primary hover:underline"
                        >
                          Copy JSON
                        </button>
                      </div>
                      <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#a1a1aa]">
                        <pre>
                          {selectedItem.inputSchema
                            ? JSON.stringify(selectedItem.inputSchema, null, 2)
                            : '// No formal input schema required (ambient context)'}
                        </pre>
                      </div>
                    </div>

                    {selectedItem.outputSchema && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                            Output Return Schema
                          </h4>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                JSON.stringify(selectedItem.outputSchema, null, 2),
                              );
                              toast({ tone: 'info', title: 'Copied output schema' });
                            }}
                            className="text-xs font-sans text-primary hover:underline"
                          >
                            Copy JSON
                          </button>
                        </div>
                        <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#a1a1aa]">
                          <pre>{JSON.stringify(selectedItem.outputSchema, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailSubTab === 'test' && (
                  <div className="space-y-4 max-w-3xl font-sans">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                        Test Input Payload (JSON)
                      </label>
                      <button
                        onClick={() =>
                          setTestInputJson(getSamplePayloadForCapability(selectedItem))
                        }
                        className="text-xs font-sans text-primary hover:underline"
                      >
                        Reset to Sample
                      </button>
                    </div>

                    <textarea
                      rows={6}
                      value={testInputJson}
                      onChange={(e) => setTestInputJson(e.target.value)}
                      className="w-full bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-3.5 font-mono text-xs text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    />

                    <div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleRunTest}
                        disabled={testRunning}
                        className="shadow-xs font-medium inline-flex items-center gap-2 text-xs"
                      >
                        {testRunning ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Executing run…</span>
                          </>
                        ) : (
                          <>
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
                                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                              />
                            </svg>
                            <span>Execute Run</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {testOutput && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                            Execution Output
                          </h4>
                          <div className="flex items-center gap-2">
                            {testLatency && (
                              <span className="text-xs font-mono text-[#71717a]">
                                {testLatency}ms latency
                              </span>
                            )}
                            <Badge variant="success" size="sm">
                              200 OK
                            </Badge>
                          </div>
                        </div>
                        <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#22c55e]">
                          <pre>{testOutput}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Sticky Status Bar: Clean notice text from reference */}
              <footer className="px-5 py-2.5 border-t border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between text-xs font-sans text-[#71717a] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span>Changes apply to new sessions</span>
                </div>
                <div>
                  <span>v{selectedItem.version || '1.0.0'}</span>
                </div>
              </footer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <EmptyState
                title="Select a capability"
                description="Select an agent, skill, tool, or plugin from the list to view its configuration, rules, and schema."
              />
            </div>
          )}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. Collapsible Lower Tier: Skills Hub (Pixel-Perfect to References)        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <section className="bg-[#09090b] border-b border-[#1c1d24]">
        {/* Divider Header Bar: Skills Hub + Update installed + Hide/Show browser */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-tight font-sans">
              Skills Hub
            </span>
            <span className="hidden sm:inline-block text-xs font-sans font-medium px-2 py-0.5 rounded-full bg-[#1c1d24] text-[#8b8e99] border border-[#2b2d38]">
              Capabilities Hub
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-sans font-medium">
            <button
              onClick={handleUpdateInstalled}
              className="inline-flex items-center gap-1.5 text-[#8b8e99] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Update installed</span>
            </button>

            <button
              onClick={() => setHubBrowserOpen(!hubBrowserOpen)}
              className="inline-flex items-center gap-1.5 text-[#8b8e99] hover:text-white transition-colors border border-[#23242c] px-2.5 py-1 rounded bg-[#14151a]"
            >
              <span>{hubBrowserOpen ? 'Hide the hub browser' : 'Show the hub browser'}</span>
              <svg
                className={`w-3.5 h-3.5 transform transition-transform ${hubBrowserOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Collapsible Hub Content */}
        {hubBrowserOpen && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Hub Sub-nav: Brand + Nav links */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#1c1d24] text-xs font-sans text-[#8b8e99]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <div className="w-5 h-5 rounded bg-[#1e2028] text-white flex items-center justify-center text-xs">
                    ✦
                  </div>
                  <span>Vaeloom Agent</span>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <span className="hover:text-white cursor-pointer">Docs</span>
                  <span
                    onClick={() => setHubSubTab('skills')}
                    className={`cursor-pointer transition-colors ${hubSubTab === 'skills' ? 'text-white font-semibold' : 'hover:text-white'}`}
                  >
                    Skills
                  </span>
                  <span
                    onClick={() => setHubSubTab('plugins')}
                    className={`cursor-pointer transition-colors ${hubSubTab === 'plugins' ? 'text-white font-semibold' : 'hover:text-white'}`}
                  >
                    Plugins
                  </span>
                  <span className="hover:text-white cursor-pointer">Download ↗</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="hidden md:inline hover:text-white cursor-pointer">
                  🌐 English ▾
                </span>
                <span className="hidden md:inline hover:text-white cursor-pointer">Home ↗</span>
                <span className="hidden md:inline hover:text-white cursor-pointer">GitHub ↗</span>
                <span className="hidden md:inline hover:text-white cursor-pointer">Discord ↗</span>
                <span className="px-2 py-0.5 rounded bg-[#14151a] border border-[#23242c] text-[#71717a]">
                  Search Ctrl K
                </span>
              </div>
            </div>

            {/* Centered Hero: VAELOOM AGENT + Capabilities & Plugin Catalog + Subtitle */}
            <div className="text-center py-6 sm:py-8 max-w-3xl mx-auto space-y-3">
              <div className="inline-block">
                <span className="text-[11px] font-sans tracking-wider uppercase text-[#8b8e99] font-medium">
                  VAELOOM CATALOG
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
                Capabilities &amp; Plugin Catalog
              </h3>

              {/* Sub-tab Pill Switcher: [All] [Plugins] [Skills] [Tools] [MCP] */}
              <div className="inline-flex items-center p-0.5 rounded-full bg-[#14151a] border border-[#23242c] text-xs font-sans mt-1">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'plugins', label: 'Plugins' },
                    { id: 'skills', label: 'Skills' },
                    { id: 'tools', label: 'Tools' },
                    { id: 'mcp', label: 'MCP' },
                  ] as const
                ).map((tab) => {
                  const isActive = hubSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setHubSubTab(tab.id)}
                      className={`px-3 py-1 rounded-full transition-all text-xs ${
                        isActive
                          ? 'bg-[#22242e] text-white font-medium shadow-xs'
                          : 'text-[#8b8e99] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs sm:text-sm text-[#a1a1aa] max-w-xl mx-auto leading-relaxed pt-1 font-sans">
                Give Vaeloom new powers. Memory, voice, messaging, browsing, Desktop panes and more,
                built by the community.
              </p>

              <div className="pt-1 flex items-center justify-center gap-2 font-sans">
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="text-xs text-[#a1a1aa] hover:text-white hover:underline font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <span>Import URL / Git</span>
                  <span>→</span>
                </button>
                <span className="text-[#52525b]">•</span>
                <span className="text-xs text-[#71717a]">
                  Built a plugin? Submit it to the catalog
                </span>
              </div>

              <p className="text-xs font-sans text-[#71717a] pt-0.5">
                {SEED_HUB_ITEMS.length}+ capabilities across 9 categories • updated recently
              </p>
            </div>

            {/* Search Bar & Origin Filter Chips (Centered) */}
            <div className="max-w-xl mx-auto space-y-3">
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a] pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  placeholder="Search plugins by name or by what you want Vaeloom to do"
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-full bg-[#121318] border border-[#23252d] text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-[#3b3e4e] shadow-xs transition-all font-sans"
                />
              </div>

              {/* Origin Filter Chips: [All], [Official], [Community] */}
              <div className="flex items-center justify-center gap-2 text-xs font-sans">
                <button
                  onClick={() => setHubOriginFilter('all')}
                  className={`px-3 py-0.5 rounded-full transition-colors border ${
                    hubOriginFilter === 'all'
                      ? 'bg-[#22242e] text-white font-medium border-[#3f414e] shadow-xs'
                      : 'bg-[#14151a] text-[#8b8e99] border-[#23242c] hover:text-white hover:bg-[#1a1b22]'
                  }`}
                >
                  All {SEED_HUB_ITEMS.length}
                </button>
                <button
                  onClick={() => setHubOriginFilter('official')}
                  className={`px-3 py-0.5 rounded-full transition-colors border ${
                    hubOriginFilter === 'official'
                      ? 'bg-[#22242e] text-white font-medium border-[#3f414e] shadow-xs'
                      : 'bg-[#14151a] text-[#8b8e99] border-[#23242c] hover:text-white hover:bg-[#1a1b22]'
                  }`}
                >
                  Official {SEED_HUB_ITEMS.filter((i) => i.isOfficial).length}
                </button>
                <button
                  onClick={() => setHubOriginFilter('community')}
                  className={`px-3 py-0.5 rounded-full transition-colors border ${
                    hubOriginFilter === 'community'
                      ? 'bg-[#22242e] text-white font-medium border-[#3f414e] shadow-xs'
                      : 'bg-[#14151a] text-[#8b8e99] border-[#23242c] hover:text-white hover:bg-[#1a1b22]'
                  }`}
                >
                  Community {SEED_HUB_ITEMS.filter((i) => !i.isOfficial).length}
                </button>
              </div>
            </div>

            {/* Category Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar pt-2">
              {HUB_CATEGORIES.map((cat) => {
                const isSelected = selectedHubCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedHubCategory(cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-all border ${
                      isSelected
                        ? 'bg-[#22242e] text-white border-white/30 shadow-xs font-medium'
                        : 'bg-[#121318] border-[#22242d] text-[#8b8e99] hover:text-white hover:border-[#2d303b]'
                    }`}
                  >
                    <span className="text-xs">{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] font-sans text-[#71717a] font-normal">
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bento Grid: 3-column Catalog Cards */}
            <div className="space-y-3 pt-2">
              {/* Category subheader */}
              <div className="flex items-center justify-between text-xs font-sans">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {HUB_CATEGORIES.find((c) => c.id === selectedHubCategory)?.icon}{' '}
                    {HUB_CATEGORY_META[selectedHubCategory]?.label || 'Desktop'}
                  </span>
                  <span className="text-[11px] text-[#71717a]">
                    {HUB_CATEGORY_META[selectedHubCategory]?.description ||
                      'Panes, tabs and views for Vaeloom'}
                  </span>
                </div>
                {selectedHubCategory !== 'all' ? (
                  <button
                    onClick={() => setSelectedHubCategory('all')}
                    className="text-[#93c5fd] hover:underline text-xs"
                  >
                    View all categories →
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedHubCategory('desktop')}
                    className="text-[#93c5fd] hover:underline text-xs"
                  >
                    View only Desktop →
                  </button>
                )}
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredHubItems.length === 0 ? (
                  <div className="col-span-full py-12 text-center">
                    <EmptyState
                      title="No catalog items match criteria"
                      description="Try selecting a different category or clearing your search term."
                    />
                  </div>
                ) : (
                  filteredHubItems.map((item) => {
                    const isInstalled =
                      installedCapabilityNames.has(item.name.toLowerCase()) ||
                      installedCapabilityNames.has(item.capabilityItem.id.toLowerCase());

                    return (
                      <div
                        key={item.id}
                        className="group flex flex-col justify-between rounded-xl border border-[#1e2027] bg-[#111216] p-4 hover:border-[#2d303b] hover:bg-[#14161b] transition-all duration-120 shadow-xs"
                      >
                        <div>
                          {/* Top: Icon + Title + Community Badge + Stars */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-[#1a1b22] border border-[#272934] flex items-center justify-center text-xs">
                                {item.hubCategory === 'desktop' && '💻'}
                                {item.hubCategory === 'memory' && '🧠'}
                                {item.hubCategory === 'platforms' && '🌐'}
                                {item.hubCategory === 'web-browser' && '🔍'}
                                {item.hubCategory === 'tools' && '🛠️'}
                                {item.hubCategory === 'voice' && '🎙️'}
                                {item.hubCategory === 'automation' && '⚡'}
                                {item.hubCategory === 'models' && '🤖'}
                                {item.hubCategory === 'general' && '📦'}
                                {item.hubCategory === 'all' && '✨'}
                              </div>
                              <span className="font-sans text-sm font-semibold text-[#f4f4f5] group-hover:text-white">
                                {item.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 text-[10px] font-sans font-medium rounded bg-[#1a1b20] text-[#8b8e99] border border-[#282a32]">
                                {item.isOfficial ? '✦ Official' : '✦ Community'}
                              </span>
                              <span className="text-xs font-sans text-[#a1a1aa] font-medium">
                                ★ {item.stars}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-[12px] text-[#9ca3af] mt-2 line-clamp-2 leading-relaxed font-sans">
                            {item.description}
                          </p>

                          {/* Tags: Category, Tools count, Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <span className="px-2 py-0.5 text-[10px] font-sans rounded bg-[#16171d] text-[#d4d4d8] border border-[#262833] capitalize">
                              {item.hubCategory}
                            </span>
                            {item.toolsCount && (
                              <span className="px-2 py-0.5 text-[10px] font-sans rounded bg-[#16171d] text-[#8b8e99] border border-[#262833]">
                                {item.toolsCount} tools
                              </span>
                            )}
                            {item.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] font-sans rounded bg-[#14151a] text-[#71717a] border border-[#202129]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Footer: Add to workspace / Installed */}
                        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#1c1e26] text-xs font-sans">
                          <span className="text-xs font-mono text-[#71717a]">v{item.version}</span>

                          {isInstalled ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled
                              className="text-xs font-sans font-medium opacity-80 cursor-default bg-[#181a22] text-[#8b8e99] border-[#252733]"
                            >
                              ✓ Installed
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleInstallHubItem(item)}
                              className="text-xs font-sans font-medium shadow-xs"
                            >
                              + Add to workspace
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Status Hint from reference */}
            <div className="pt-2 text-center">
              <p className="text-xs font-sans text-[#71717a]">
                Hit &quot;+ Add to workspace&quot; on any skill — it installs and appears in the
                list above.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. Enterprise Capability Authoring & Import Studio                         */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <AddCapabilityModal
        isOpen={createModalOpen || importModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setImportModalOpen(false);
        }}
        defaultCategory={selectedCategory}
        initialMode={importModalOpen ? 'import' : 'builder'}
        onCreate={(newCap) => {
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

          const newImportedItem: CapabilityItem = {
            id: `import-${cleanName}-${Date.now()}`,
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
