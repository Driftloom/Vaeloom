'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CapabilityCategory,
  CapabilityItem,
  getStoredCapabilities,
  setStoredCapabilityEnabled,
} from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';

type TabView = 'installed' | 'browse';
type SortOption = 'most-used' | 'alphabetical' | 'recent';
type DetailSubTab = 'doc' | 'schema' | 'test';

export default function CapabilitiesPage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const { toast } = useToast();

  // Primary State
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>('skills');
  const [tabView, setTabView] = useState<TabView>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('most-used');
  const [selectedId, setSelectedId] = useState<string>('');
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('doc');

  // Mobile detail view toggle
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCapName, setNewCapName] = useState('');
  const [newCapCategory, setNewCapCategory] = useState<CapabilityCategory>('skills');
  const [newCapDescription, setNewCapDescription] = useState('');
  const [newCapTags, setNewCapTags] = useState('');
  const [newCapDoc, setNewCapDoc] = useState('');

  // Interactive Test State
  const [testInputJson, setTestInputJson] = useState(
    '{\n  "query": "example test run",\n  "limit": 5\n}',
  );
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  // Load capabilities from storage / seed
  useEffect(() => {
    const loaded = getStoredCapabilities(workspaceId);
    setCapabilities(loaded);
  }, [workspaceId]);

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
        // default: most-used
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

  // Available tags in current category
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    capabilities
      .filter((c) => c.category === selectedCategory)
      .forEach((c) => c.tags.forEach((t) => set.add(t)));
    return ['All', ...Array.from(set)];
  }, [capabilities, selectedCategory]);

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

  // Copy Definition / Prompt
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
      detail: `${selectedItem.name} documentation copied to clipboard`,
    });
  }, [selectedItem, toast]);

  // Run Simulated Test
  const handleRunTest = useCallback(() => {
    if (!selectedItem) return;
    setTestRunning(true);
    setTestOutput(null);

    setTimeout(() => {
      let parsedInput: unknown = {};
      try {
        parsedInput = JSON.parse(testInputJson);
      } catch {
        parsedInput = { raw: testInputJson };
      }

      const mockResponse = {
        status: 'success',
        capability: selectedItem.name,
        category: selectedItem.category,
        timestamp: new Date().toISOString(),
        executionDurationMs: Math.floor(Math.random() * 85) + 24,
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
                  reason: 'Trajectory aligns with user goals',
                }
              : { message: 'Skill evaluated successfully with 0 violations', criteriaChecked: 6 },
      };

      setTestOutput(JSON.stringify(mockResponse, null, 2));
      setTestRunning(false);
      toast({
        tone: 'success',
        title: `Test completed: ${selectedItem.name}`,
        detail: `Execution returned 200 OK (${mockResponse.executionDurationMs}ms)`,
      });
    }, 450);
  }, [selectedItem, testInputJson, toast]);

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

      const updated = [newCap, ...capabilities];
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
    [newCapName, newCapCategory, newCapDescription, newCapTags, newCapDoc, capabilities, toast],
  );

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-5rem)] bg-bg text-text selection:bg-primary/20 selection:text-primary">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Top Header: Title, Category Tabs (with live counters) & Action */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-surface shrink-0 px-4 sm:px-6 pt-5 pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3"
                  />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text">
                Capabilities
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-surface-200 text-text-secondary border border-border">
                {capabilities.length} active units
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Autonomous agent skills, typed execution tools, Model Context Protocol bridges, and
              plugins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-action text-action-fg hover:bg-action-hover active:bg-action-active shadow-xs transition-colors"
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
              <span>New Capability</span>
            </button>
          </div>
        </div>

        {/* Category Tabs with live counts */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-transparent">
          {(
            [
              { id: 'agents', label: 'Agents', count: categoryCounts.agents },
              { id: 'skills', label: 'Skills', count: categoryCounts.skills },
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
                className={`relative flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-primary text-text font-semibold'
                    : 'border-transparent text-text-muted hover:text-text hover:border-border'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                      : 'bg-surface-200 text-text-dim border-border'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Sub-Header: Search bar, Subtabs (Installed / Browse), Sort & Tag Filters */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface-50 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left Controls: Search & Subtabs */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim"
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Try "general" or search ${selectedCategory}...`}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-surface-100 border border-border text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text p-0.5"
                title="Clear search"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Installed vs Browse Subtabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-surface-200 border border-border text-xs">
            <button
              onClick={() => setTabView('installed')}
              className={`px-3 py-1 rounded-md transition-colors font-medium ${
                tabView === 'installed'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Installed
            </button>
            <button
              onClick={() => setTabView('browse')}
              className={`px-3 py-1 rounded-md transition-colors font-medium ${
                tabView === 'browse'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Right Controls: Sort & Filter Badges */}
        <div className="flex items-center gap-2">
          {/* Tag Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="text-[11px] font-mono text-text-dim">Tag:</span>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-surface-100 border border-border rounded-md px-2 py-1 text-xs text-text focus:outline-none focus:border-primary"
            >
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="text-[11px] font-mono text-text-dim">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-surface-100 border border-border rounded-md px-2 py-1 text-xs text-text focus:outline-none focus:border-primary"
            >
              <option value="most-used">Most used</option>
              <option value="alphabetical">A - Z</option>
              <option value="recent">Recently used</option>
            </select>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Main 2-Pane Split View Layout */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Pane: Items List */}
        <div
          className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0 ${
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* List Toolbar / Count */}
          <div className="px-4 py-2 border-b border-border/70 flex items-center justify-between text-[11px] font-mono text-text-dim bg-surface/80 shrink-0">
            <span>
              {filteredItems.length} {selectedCategory} showing
            </span>
            <span>Click to inspect</span>
          </div>

          {/* Scrollable Capability Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-dim">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text">No capabilities found</p>
                <p className="text-xs text-text-muted mt-1 max-w-[220px] mx-auto">
                  Try adjusting your search query or switching from &quot;{tabView}&quot; to &quot;
                  {tabView === 'installed' ? 'Browse' : 'Installed'}&quot;.
                </p>
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
                    className={`group relative flex items-start justify-between gap-3 p-3.5 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-surface-200/80 border-l-2 border-l-primary shadow-xs'
                        : 'hover:bg-surface-hover/80 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {/* Name & Primary Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-sm font-medium tracking-tight font-mono truncate ${
                            isSelected
                              ? 'text-text font-semibold'
                              : 'text-text group-hover:text-text'
                          }`}
                        >
                          {item.name}
                        </span>

                        {item.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-surface-300/60 text-text-secondary border border-border"
                          >
                            {tag}
                          </span>
                        ))}

                        {item.source === 'learned' && (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
                            learned
                          </span>
                        )}
                      </div>

                      {/* Description preview */}
                      <p className="text-xs text-text-muted line-clamp-1 mt-1 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Footer usage & author */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-text-dim">
                        <span>{item.usageCount.toLocaleString()} uses</span>
                        <span>•</span>
                        <span>{item.lastUsed || 'idle'}</span>
                        {item.author && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{item.author}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right Toggle Switch (accessible) */}
                    <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.enabled}
                        aria-label={`Toggle ${item.name}`}
                        onClick={(e) => handleToggle(item.id, e)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary ${
                          item.enabled ? 'bg-primary' : 'bg-surface-300'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
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

        {/* Right Pane: Deep Detail View */}
        <div
          className={`flex-1 flex flex-col min-h-0 bg-bg overflow-hidden ${
            mobileDetailOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back Button */}
              <div className="lg:hidden px-4 py-2 border-b border-border bg-surface flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setMobileDetailOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-medium"
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

              {/* Detail Header */}
              <div className="p-5 sm:p-6 border-b border-border bg-surface shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-text">
                        {selectedItem.name}
                      </h2>
                      {selectedItem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs font-mono rounded bg-surface-200 text-text-secondary border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                      {selectedItem.enabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-success bg-success/10 border border-success/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-text-dim bg-surface-200 border border-border">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted mt-2 max-w-2xl leading-relaxed">
                      {selectedItem.description}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <button
                      onClick={() => handleToggle(selectedItem.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedItem.enabled
                          ? 'border-border text-text hover:bg-surface-hover'
                          : 'border-primary text-primary hover:bg-primary/10'
                      }`}
                    >
                      {selectedItem.enabled ? 'Archive / Disable' : 'Enable Unit'}
                    </button>

                    <button
                      onClick={() => setDetailSubTab('test')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-primary"
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
                      <span>Test Run</span>
                    </button>

                    <button
                      onClick={handleCopyDefinition}
                      title="Copy full definition"
                      className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
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
                </div>

                {/* Metadata Grid Card */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-100 border border-border rounded-xl p-3 text-xs">
                  <div>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-text-dim">
                      Identifier
                    </span>
                    <span className="font-mono text-text truncate block mt-0.5">
                      {selectedItem.name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-text-dim">
                      Category
                    </span>
                    <span className="font-mono text-text capitalize block mt-0.5">
                      {selectedItem.category}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-text-dim">
                      Required Scope
                    </span>
                    <span className="font-mono text-text truncate block mt-0.5">
                      {selectedItem.requiredScope || 'none'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-text-dim">
                      Autonomy / Class
                    </span>
                    <span className="font-mono text-text capitalize block mt-0.5">
                      {selectedItem.autonomy || selectedItem.trustClass || 'standard'}
                    </span>
                  </div>
                </div>

                {/* Subtabs Bar (Documentation | Schema | Interactive Test) */}
                <div className="flex items-center gap-4 mt-5 border-b border-border/80">
                  <button
                    onClick={() => setDetailSubTab('doc')}
                    className={`pb-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'doc'
                        ? 'border-primary text-text font-semibold'
                        : 'border-transparent text-text-muted hover:text-text'
                    }`}
                  >
                    Documentation & Rules
                  </button>
                  <button
                    onClick={() => setDetailSubTab('schema')}
                    className={`pb-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'schema'
                        ? 'border-primary text-text font-semibold'
                        : 'border-transparent text-text-muted hover:text-text'
                    }`}
                  >
                    Schema & Parameters
                  </button>
                  <button
                    onClick={() => setDetailSubTab('test')}
                    className={`pb-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'test'
                        ? 'border-primary text-text font-semibold'
                        : 'border-transparent text-text-muted hover:text-text'
                    }`}
                  >
                    Test Playground
                  </button>
                </div>
              </div>

              {/* Detail Content Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-bg min-h-0">
                {detailSubTab === 'doc' && (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-text prose-p:text-text-secondary prose-p:leading-relaxed prose-li:text-text-secondary prose-code:text-primary prose-code:bg-surface-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface-100 prose-pre:border prose-pre:border-border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedItem.markdownDoc}
                    </ReactMarkdown>
                  </div>
                )}

                {detailSubTab === 'schema' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-2">
                        Input Argument Schema
                      </h4>
                      <div className="bg-surface-100 border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text-secondary">
                        <pre>
                          {selectedItem.inputSchema
                            ? JSON.stringify(selectedItem.inputSchema, null, 2)
                            : '// No formal input schema required (ambient system context)'}
                        </pre>
                      </div>
                    </div>

                    {selectedItem.outputSchema && (
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-2">
                          Output Return Schema
                        </h4>
                        <div className="bg-surface-100 border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text-secondary">
                          <pre>{JSON.stringify(selectedItem.outputSchema, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailSubTab === 'test' && (
                  <div className="space-y-4 max-w-3xl">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5">
                        Test Input Payload (JSON)
                      </label>
                      <textarea
                        rows={6}
                        value={testInputJson}
                        onChange={(e) => setTestInputJson(e.target.value)}
                        className="w-full bg-surface-100 border border-border rounded-xl p-3 font-mono text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>

                    <div>
                      <button
                        onClick={handleRunTest}
                        disabled={testRunning}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-action text-action-fg hover:bg-action-hover disabled:opacity-50 transition-colors shadow-xs"
                      >
                        {testRunning ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Simulating execution...</span>
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
                      </button>
                    </div>

                    {testOutput && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-text-dim">
                            Execution Output
                          </h4>
                          <span className="text-[10px] font-mono text-success">200 OK</span>
                        </div>
                        <div className="bg-surface-100 border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-success-fg">
                          <pre>{testOutput}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Sticky Status Bar */}
              <footer className="px-5 py-2.5 border-t border-border bg-surface-50 flex items-center justify-between text-[11px] font-mono text-text-dim shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span>Changes apply to new sessions</span>
                </div>
                <div>
                  <span>Version: {selectedItem.version || '1.0.0'}</span>
                </div>
              </footer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
              <div className="w-12 h-12 rounded-full bg-surface-200 border border-border flex items-center justify-center text-text-dim mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-text">Select a capability</p>
              <p className="text-xs text-text-muted mt-1 max-w-xs">
                Select an agent, skill, tool, or plugin from the list to view its configuration,
                rules, and schema.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Modal: Create / Import New Capability */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-elevated p-6 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-text">Add Custom Capability</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-text-dim hover:text-text p-1 rounded-md"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="flex-1 overflow-y-auto py-4 space-y-4 text-xs"
            >
              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Capability Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCapName}
                  onChange={(e) => setNewCapName(e.target.value)}
                  placeholder="e.g. code-synthesizer or ats-scoring"
                  className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-text font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Category</label>
                  <select
                    value={newCapCategory}
                    onChange={(e) => setNewCapCategory(e.target.value as CapabilityCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-text focus:outline-none focus:border-primary"
                  >
                    <option value="skills">Skills</option>
                    <option value="agents">Agents</option>
                    <option value="tools">Tools</option>
                    <option value="mcp">MCP</option>
                    <option value="plugins">Plugins</option>
                  </select>
                </div>

                <div>
                  <label className="block text-text-secondary font-medium mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newCapTags}
                    onChange={(e) => setNewCapTags(e.target.value)}
                    placeholder="e.g. Review, Career, Custom"
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-text focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Summary Description
                </label>
                <input
                  type="text"
                  value={newCapDescription}
                  onChange={(e) => setNewCapDescription(e.target.value)}
                  placeholder="Brief 1-line description of when to use this capability"
                  className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-text focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Markdown Documentation / Prompt
                </label>
                <textarea
                  rows={6}
                  value={newCapDoc}
                  onChange={(e) => setNewCapDoc(e.target.value)}
                  placeholder="# Capability Title&#10;&#10;## When to Use&#10;- Use when...&#10;&#10;## Rules&#10;1. ..."
                  className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-text font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-action text-action-fg hover:bg-action-hover transition-colors shadow-xs"
                >
                  Create Capability
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
