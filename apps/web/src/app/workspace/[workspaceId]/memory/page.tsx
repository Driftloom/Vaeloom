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
import { memoryApi, memoryFeedApi } from '@/lib/api-client';
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

const TYPE_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All Types' },
  { id: 'note', label: 'Notes' },
  { id: 'document', label: 'Documents' },
  { id: 'insight', label: 'Insights' },
  { id: 'decision', label: 'Decisions' },
  { id: 'task', label: 'Tasks' },
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
        title="Second Brain & Memory"
        eyebrow={`WORKSPACE ${workspaceId.slice(0, 8).toUpperCase()}`}
        description="Autonomous second brain combining plain Markdown vault sync, cognitive embeddings, multiscale hierarchy, and provenance."
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
        <StatCard label="Vault Git Sync" value="Healthy" caption="30s debounce & 5m rebase" />
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

          {memoriesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading memories..." />
            </div>
          ) : filteredMemories.length === 0 ? (
            <EmptyState
              title={
                searchQuery || selectedType !== 'all'
                  ? 'No matching memories'
                  : 'Your Second Brain is ready'
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
                const confScore = (m.metadata?.['confidence'] as number) ?? 0.85;
                const sourceText =
                  m.source?.label || m.source?.type || (m.source?.uri ? 'file' : 'manual');
                const contentStr =
                  ((m as unknown as Record<string, unknown>)['content'] as string) ||
                  m.summary ||
                  m.title;
                const relTime = formatRelative(m.createdAt);

                return (
                  <div
                    key={m.id}
                    className="relative group cursor-pointer"
                    onClick={() => router.push(`/workspace/${workspaceId}/memory/${m.id}`)}
                  >
                    <MemoryCard
                      id={m.id}
                      content={contentStr}
                      confidence={confScore}
                      source={sourceText}
                      timestamp={relTime}
                      entityCount={Array.isArray(m.tags) ? m.tags.length : undefined}
                      onEdit={(id) => {
                        openLineage(id);
                      }}
                      onDelete={(id) => {
                        void handleDeleteMemory(id);
                      }}
                    />
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
              placeholder="e.g. Distributed Consensus in Second Brain"
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
              placeholder="e.g. second-brain, architecture, notes"
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
    </div>
  );
}

export default function MemoryGraphPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" text="Loading second brain..." />
        </div>
      }
    >
      <MemoryGraphPageContent />
    </Suspense>
  );
}
