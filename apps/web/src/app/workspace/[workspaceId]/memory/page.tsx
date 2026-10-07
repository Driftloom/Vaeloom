'use client';

import React, { useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Tabs,
  TabPanel,
  Modal,
  EmptyState,
  StatCard,
  Button,
  Badge,
  FilterBar,
  MemoryCard,
  MemoryTimeline,
  type MemoryTimelineItem,
  type FilterOption,
} from '@vaeloom/ui-kit';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';
import { PageHeader } from '@/components/shared/Page';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';
import { ScaleMemoryViewer } from '@/components/memory/ScaleMemoryViewer';
import { VaultSyncPanel } from '@/components/memory/VaultSyncPanel';
import { memoryApi, memoryFeedApi, vaultSyncApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Memory } from '@vaeloom/shared-types';

function formatRelative(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Must match the backend `MemoryType` literal (apps/api/src/api/schemas/memory.py).
// This list was wrong twice: first it used a source-format set
// (email/code/conversation/webpage/structured) that the API rejects, and before
// that it used profile/career/skill/project/decision/goal/insight/task/
// relationship, where `task`/`insight`-style values were not all real either.
// Either way every non-matching option filtered all rows out and the UI looked
// empty rather than broken. Exported so a test can assert the invariant.
export const TYPE_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All Types' },
  { id: 'profile', label: 'Profile' },
  { id: 'document', label: 'Documents' },
  { id: 'career', label: 'Career' },
  { id: 'episodic', label: 'Episodic' },
  { id: 'preference', label: 'Preferences' },
  { id: 'working', label: 'Working' },
  { id: 'note', label: 'Notes' },
  { id: 'fact', label: 'Facts' },
  { id: 'project', label: 'Projects' },
  { id: 'skill', label: 'Skills' },
  { id: 'organization', label: 'Organizations' },
  { id: 'relationship', label: 'Relationships' },
  { id: 'event', label: 'Events' },
  { id: 'insight', label: 'Insights' },
  { id: 'goal', label: 'Goals' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'decision', label: 'Decisions' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'reference', label: 'References' },
  { id: 'contact', label: 'Contacts' },
  { id: 'financial', label: 'Financial' },
  { id: 'health', label: 'Health' },
  { id: 'learning', label: 'Learning' },
  { id: 'workflow', label: 'Workflows' },
];

function MemoryGraphPageContent() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLineage, setShowLineage] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importDeduplicate, setImportDeduplicate] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('note');
  const [newTags, setNewTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { toast } = useToast();

  // Feed API query
  const {
    data: feedData,
    isLoading: feedLoading,
    mutate: mutateFeed,
  } = useSWR(workspaceId ? `memory-feed-${workspaceId}` : null, () =>
    memoryFeedApi.feed({ workspace_id: workspaceId, page: 1, page_size: 50 }),
  );

  // Lineage query
  const { data: lineage, isLoading: lineageLoading } = useSWR(
    selectedId ? `lineage-${selectedId}` : null,
    () => memoryFeedApi.lineage(selectedId!),
  );

  // Memories query with explicit workspace scoping
  const {
    data: memoriesRes,
    isLoading: memoriesLoading,
    mutate: mutateMemories,
  } = useSWR(workspaceId ? `memories-${workspaceId}` : null, () =>
    memoryApi.list({ page_size: 100, workspace_id: workspaceId }),
  );

  const memItems: Memory[] = useMemo(() => {
    if (!memoriesRes) return [];
    if (Array.isArray(memoriesRes)) return memoriesRes as Memory[];
    const res = memoriesRes as { memories?: Memory[]; items?: Memory[] };
    return res.memories ?? res.items ?? [];
  }, [memoriesRes]);

  // Real vault client state for the sync stat. This tile previously rendered a
  // hardcoded "Healthy" with no query behind it, on a page where the Vault panel
  // polls real status 500ms later.
  const { data: vaultStatus } = useSWR(
    workspaceId ? `vault-sync-status-${workspaceId}` : null,
    () => vaultSyncApi.getStatus(workspaceId),
    { refreshInterval: 15000 },
  );

  const vaultSyncLabel = useMemo(() => {
    if (!vaultStatus) return 'Loading…';
    switch (vaultStatus.daemonStatus) {
      case 'running':
        return 'Connected';
      case 'stale':
        return 'Unresponsive';
      case 'paused':
        return 'Paused';
      default:
        return 'Not Connected';
    }
  }, [vaultStatus]);

  const vaultSyncCaption = useMemo(() => {
    if (!vaultStatus) return 'Checking vault client';
    if (vaultStatus.daemonStatus !== 'running') {
      return 'No vault client reporting';
    }
    return `${vaultStatus.debounceSeconds}s debounce & ${vaultStatus.rebaseIntervalMinutes}m rebase`;
  }, [vaultStatus]);

  // Client-side search and filtering
  const filteredMemories = useMemo(() => {
    return memItems.filter((m) => {
      if (m.status === 'deleted') return false;
      if (selectedType !== 'all' && m.type !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title?.toLowerCase().includes(q);
        const matchesSummary = m.summary?.toLowerCase().includes(q);
        const contentStr = ((m as unknown as Record<string, unknown>)['content'] as string) || '';
        const matchesContent = contentStr.toLowerCase().includes(q);
        const matchesTags =
          Array.isArray(m.tags) && m.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesSummary && !matchesContent && !matchesTags) return false;
      }
      return true;
    });
  }, [memItems, selectedType, searchQuery]);

  const openLineage = useCallback((id: string) => {
    setSelectedId(id);
    setShowLineage(true);
  }, []);

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      try {
        await memoryApi.delete(id);
        toast({
          tone: 'success',
          title: 'Memory removed',
          detail: 'Memory soft-deleted and archived.',
        });
        await mutateMemories();
        await mutateFeed();
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete failed',
          detail: err instanceof Error ? err.message : 'Could not delete memory.',
        });
      }
    },
    [toast, mutateMemories, mutateFeed],
  );

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await memoryApi.create({
        title: newTitle.trim(),
        content: newContent.trim(),
        summary: newContent.slice(0, 160).trim(),
        type: newType,
        tags: tagsArray,
      });

      toast({
        tone: 'success',
        title: 'Note & Memory Created',
        detail: 'Indexed into vector store and knowledge graph.',
      });

      setCreateModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      await mutateMemories();
      await mutateFeed();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Creation Failed',
        detail: err instanceof Error ? err.message : 'Could not save memory note.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportMemories = async () => {
    try {
      const res = await memoryApi.export(workspaceId, true);
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaeloom-memory-export-${workspaceId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        tone: 'success',
        title: 'Memory Export Completed',
        detail: `Exported ${res.total_count} memories successfully.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Export Failed',
        detail: err instanceof Error ? err.message : 'Could not export memories.',
      });
    }
  };

  const handleImportMemories = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJsonText.trim() || isImporting) return;
    setIsImporting(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(importJsonText);
      } catch {
        throw new Error('Invalid JSON format. Please paste valid JSON.');
      }
      let items: Record<string, unknown>[] = [];
      if (Array.isArray(parsed)) {
        items = parsed as Record<string, unknown>[];
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'items' in parsed &&
        Array.isArray((parsed as { items: unknown[] }).items)
      ) {
        items = (parsed as { items: Record<string, unknown>[] }).items;
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'memories' in parsed &&
        Array.isArray((parsed as { memories: unknown[] }).memories)
      ) {
        items = (parsed as { memories: Record<string, unknown>[] }).memories;
      } else {
        throw new Error(
          'JSON must contain an array of memory objects or an object with an items/memories array.',
        );
      }

      const res = await memoryApi.import({
        workspace_id: workspaceId,
        memories: items as unknown as import('@/lib/api-client').MemoryImportItem[],
        deduplicate_by_hash: importDeduplicate,
      });

      toast({
        tone: 'success',
        title: 'Import Completed',
        detail: `Imported: ${res.imported_count}, Skipped: ${res.skipped_count}, Errors: ${res.error_count}`,
      });
      setImportModalOpen(false);
      setImportJsonText('');
      await mutateMemories();
      await mutateFeed();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Import Failed',
        detail: err instanceof Error ? err.message : 'Could not import memories.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedMemoryIds.size === 0) return;
    try {
      const res = await memoryApi.bulkStatus(
        workspaceId,
        Array.from(selectedMemoryIds),
        'archived',
      );
      toast({
        tone: 'success',
        title: 'Memories Archived',
        detail: `Archived ${res.success_count} memories.`,
      });
      setSelectedMemoryIds(new Set());
      await mutateMemories();
      await mutateFeed();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Bulk Archive Failed',
        detail: err instanceof Error ? err.message : 'Could not archive selected memories.',
      });
    }
  };

  const toggleSelectMemory = (id: string, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedMemoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedMemoryIds.size === filteredMemories.length) {
      setSelectedMemoryIds(new Set());
    } else {
      setSelectedMemoryIds(new Set(filteredMemories.map((m) => m.id)));
    }
  };

  // Convert feed items to MemoryTimelineItems
  const timelineItems: MemoryTimelineItem[] = useMemo(() => {
    if (!feedData?.feed) return [];
    return feedData.feed.map((f) => {
      let action: MemoryTimelineItem['action'] = 'ingested';
      if (f.kind === 'memory_corrected') action = 'updated';
      else if (f.kind === 'memory_superseded') action = 'archived';
      else if (f.kind === 'agent_created') action = 'synthesized';

      const mem = f.memory as Record<string, unknown> | null;
      const title =
        (mem?.['title'] as string) ||
        (mem?.['summary'] as string) ||
        (f.action?.actionType ?? 'Memory Event');

      return {
        id: `${f.kind}-${f.timestamp}-${mem?.['id'] || ''}`,
        action,
        title,
        source: f.agentName ? `@${f.agentName}` : f.action?.actionType || 'Direct Ingest',
        timestamp: formatRelative(f.timestamp),
      };
    });
  }, [feedData]);

  const tabs = [
    { id: 'list', label: `Notes & Memories (${filteredMemories.length})` },
    { id: 'feed', label: `Agentic Activity${feedData?.feed ? ` (${feedData.feed.length})` : ''}` },
    { id: 'scale', label: 'SCALE Temporal' },
    { id: 'graph', label: 'Knowledge Graph' },
    { id: 'corrections', label: 'Corrections' },
    { id: 'sync', label: 'Vault & Git Sync' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Memory"
        eyebrow={`WORKSPACE ${workspaceId.slice(0, 8).toUpperCase()}`}
        description="Autonomous dynamic memory combining plain Markdown vault sync, cognitive embeddings, multiscale hierarchy, and provenance."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void mutateMemories();
                void mutateFeed();
              }}
            >
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportMemories}>
              Export Backup
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(true)}>
              Import JSON
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              + New Note / Memory
            </Button>
          </div>
        }
      />

      {/* Top Metric Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Memories"
          value={String(feedData?.stats?.totalMemories ?? memItems.length)}
          caption="Indexed knowledge items"
        />
        <StatCard
          label="Agent Synthesized"
          value={String(feedData?.stats?.agentCreated ?? 0)}
          caption="Autonomous background extractions"
        />
        <StatCard
          label="Superseded / Corrected"
          value={String(feedData?.stats?.superseded ?? 0)}
          caption="Immutable version audit trail"
        />
        <StatCard label="Vault Git Sync" value={vaultSyncLabel} caption={vaultSyncCaption} />
      </div>

      {/* Dedicated Workbench Quick Navigation Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href={`/workspace/${workspaceId}/memory/vault`}
          className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary,#818cf8)]">
              Vault Git Sync →
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">30s auto-push & rebase</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/graph`}
          className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary,#818cf8)]">
              Graph Workbench →
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Interactive ontology view</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/scale`}
          className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary,#818cf8)]">
              SCALE Hierarchy →
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Multiscale rollups</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/corrections`}
          className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary,#818cf8)]">
              Corrections Ledger →
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Audit trail & diffs</p>
          </div>
        </Link>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Notes & Memories Explorer */}
      <TabPanel id="list" activeTab={activeTab}>
        <div className="space-y-4">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search memories, notes, tags, or concepts..."
            categories={TYPE_FILTERS}
            activeCategory={selectedType}
            onCategoryChange={setSelectedType}
          />

          {selectedMemoryIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-brand-primary,#818cf8)] rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-brand-primary,#818cf8)]">
                  {selectedMemoryIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs text-[var(--color-text-muted)] hover:underline"
                >
                  {selectedMemoryIds.size === filteredMemories.length
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleBulkArchive}>
                  Archive Selected
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedMemoryIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {memoriesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading memories..." />
            </div>
          ) : filteredMemories.length === 0 ? (
            <EmptyState
              title={
                searchQuery || selectedType !== 'all'
                  ? 'No matching memories'
                  : 'Your Memory is ready'
              }
              description={
                searchQuery || selectedType !== 'all'
                  ? 'No records match your active query and filters. Try resetting search.'
                  : 'Capture ideas, notes, or connect your local vault to automatically populate memories.'
              }
              action={{
                label: '+ Create Note / Memory',
                onClick: () => setCreateModalOpen(true),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMemories.map((m) => {
                // Only surface a confidence score the backend actually stored.
                // The old `?? 0.85` invented a number for every memory that had
                // none, so the UI displayed a confident-looking 85% that was
                // never computed.
                const storedConfidence = m.metadata?.['confidence'];
                const confScore =
                  typeof storedConfidence === 'number' && storedConfidence > 0
                    ? storedConfidence
                    : undefined;
                const sourceText =
                  m.source?.label || m.source?.type || (m.source?.uri ? 'file' : 'manual');
                const contentStr =
                  ((m as unknown as Record<string, unknown>)['content'] as string) ||
                  m.summary ||
                  m.title;
                const relTime = formatRelative(m.createdAt);
                const isSelected = selectedMemoryIds.has(m.id);

                return (
                  <div
                    key={m.id}
                    className={`relative group rounded-xl transition border ${
                      isSelected
                        ? 'border-[var(--color-brand-primary,#818cf8)] ring-1 ring-[var(--color-brand-primary,#818cf8)]'
                        : 'border-transparent'
                    }`}
                  >
                    <div
                      className="absolute top-3 left-3 z-10 p-1 flex items-center justify-center"
                      onClick={(e: React.MouseEvent) => toggleSelectMemory(m.id, e)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          toggleSelectMemory(m.id, e)
                        }
                        aria-label={`Select memory ${m.title || m.id}`}
                        className="w-6 h-6 min-w-[24px] min-h-[24px] rounded border-[var(--color-border)] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div
                      className="cursor-pointer pl-7"
                      onClick={() => router.push(`/workspace/${workspaceId}/memory/${m.id}`)}
                    >
                      <MemoryCard
                        id={m.id}
                        content={contentStr}
                        confidence={confScore}
                        source={sourceText}
                        timestamp={relTime}
                        entityCount={Array.isArray(m.tags) ? m.tags.length : undefined}
                        onEdit={(id: string) => {
                          openLineage(id);
                        }}
                        onDelete={(id: string) => {
                          void handleDeleteMemory(id);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TabPanel>

      {/* Tab 2: Agentic Activity & Provenance */}
      <TabPanel id="feed" activeTab={activeTab}>
        {feedLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner text="Loading agentic timeline..." />
          </div>
        ) : timelineItems.length === 0 ? (
          <EmptyState
            title="No agentic activity yet"
            description="Agentic actions, synthesis rollups, and memory corrections will appear here in chronological order with provenance."
          />
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-4">
              Memory Lifecycle & Agent Trajectory
            </h3>
            <MemoryTimeline items={timelineItems} />
          </div>
        )}
      </TabPanel>

      {/* Tab 3: SCALE Temporal Hierarchy */}
      <TabPanel id="scale" activeTab={activeTab}>
        {workspaceId && <ScaleMemoryViewer workspaceId={workspaceId} />}
      </TabPanel>

      {/* Tab 4: Knowledge Graph */}
      <TabPanel id="graph" activeTab={activeTab}>
        <div className="min-h-[600px] h-[70vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden relative shadow-sm">
          <DynamicGraphViewer workspaceId={workspaceId} />
        </div>
      </TabPanel>

      {/* Tab 5: Memory Corrections */}
      <TabPanel id="corrections" activeTab={activeTab}>
        <MemoryCorrectionPanel workspaceId={workspaceId} />
      </TabPanel>

      {/* Tab 6: Vaeloom Vault Git Sync */}
      <TabPanel id="sync" activeTab={activeTab}>
        <VaultSyncPanel workspaceId={workspaceId} />
      </TabPanel>

      {/* Lineage & Provenance Modal */}
      <Modal
        isOpen={showLineage}
        onClose={() => setShowLineage(false)}
        title={
          lineage?.memory
            ? `Lineage: ${((lineage.memory as unknown as Record<string, unknown>)['title'] as string) || lineage.memory.id.slice(0, 8)}`
            : 'Lineage & Provenance'
        }
        size="lg"
      >
        {lineageLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner text="Tracing provenance..." />
          </div>
        ) : lineage ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Supersession Lineage Chain
              </h4>
              {lineage.chainBackwards.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Origin record (no previous versions).
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {lineage.chainBackwards.map((m: unknown, idx: number) => {
                    const mem = m as Record<string, unknown>;
                    return (
                      <div
                        key={String(mem['id'])}
                        className={`shrink-0 w-52 rounded-lg border p-3 ${
                          idx === 0
                            ? 'border-[var(--color-brand-primary,#818cf8)] bg-[var(--color-brand-primary,#818cf8)]/10 text-[var(--color-text-primary)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                        }`}
                      >
                        <p className="font-mono text-[10px] uppercase font-semibold">
                          {idx === 0 ? 'Current Active' : `v-${idx} Superseded`}
                        </p>
                        <p className="text-xs font-medium truncate mt-1">
                          {String(mem['title'] || mem['id']).slice(0, 32)}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mt-0.5">
                          {String(mem['summary'] || '')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
              <Button variant="secondary" onClick={() => setShowLineage(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            No lineage available for this record.
          </p>
        )}
      </Modal>

      {/* New Note / Memory Creation Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Note / Memory"
        size="md"
      >
        <form onSubmit={handleCreateMemory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
              Title / Concept
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Consensus in Distributed Systems"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
              Memory Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-sans"
            >
              <option value="note">Note</option>
              <option value="document">Document</option>
              <option value="insight">Insight</option>
              <option value="decision">Decision</option>
              <option value="task">Task</option>
              <option value="profile">Profile</option>
              <option value="career">Career</option>
              <option value="skill">Skill</option>
              <option value="project">Project</option>
              <option value="goal">Goal</option>
              <option value="relationship">Relationship</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
              Content & Insights
            </label>
            <textarea
              required
              rows={4}
              placeholder="Enter note or markdown content..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. memory, architecture, notes"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)] font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isCreating}>
              Save to Memory
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import Memories Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Memories (Batch JSON)"
        size="lg"
      >
        <form onSubmit={handleImportMemories} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-1">
              JSON Payload (Array or Export Format)
            </label>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
              Paste exported JSON or an array of items with title, content, type, tags, and
              metadata.
            </p>
            <textarea
              required
              rows={10}
              placeholder={`[\n  {\n    "title": "System Architecture Decisions",\n    "content": "Decided on SQLite/PostgreSQL RLS with event stream...",\n    "type": "decision",\n    "tags": ["architecture", "database"]\n  }\n]`}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              className="w-full font-mono text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#818cf8)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dedup"
              checked={importDeduplicate}
              onChange={(e) => setImportDeduplicate(e.target.checked)}
              className="rounded border-[var(--color-border)] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label
              htmlFor="dedup"
              className="text-xs text-[var(--color-text-primary)] cursor-pointer"
            >
              Deduplicate by SHA-256 content hash (skip existing identical records)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isImporting}>
              Import Memories
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function MemoryGraphPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" text="Loading memory..." />
        </div>
      }
    >
      <MemoryGraphPageContent />
    </Suspense>
  );
}
