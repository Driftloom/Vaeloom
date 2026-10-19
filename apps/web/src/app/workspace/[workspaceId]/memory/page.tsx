'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Tabs,
  TabPanel,
  Modal,
  EmptyState,
  ErrorState,
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
import type { MemorySearchResultItem } from '@/lib/api-client';
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

// Server-side search returns at most this many hits; when the cap is reached
// the UI must say so instead of implying the list is exhaustive.
const SEARCH_TOP_K = 20;
// List pages are fetched in windows of this size; the API caps page_size at 100.
const LIST_PAGE_SIZE = 100;
// The activity feed is capped here; beyond it the UI shows its own Load more.
const FEED_PAGE_SIZE_MAX = 100;

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
  const [loadedPages, setLoadedPages] = useState(1);
  const [feedPageSize, setFeedPageSize] = useState(50);
  const [searchResults, setSearchResults] = useState<MemorySearchResultItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRetryTick, setSearchRetryTick] = useState(0);
  const searchSeqRef = useRef(0);

  const { toast } = useToast();

  // Apply ?query= deep links without ever erasing what the user typed: a
  // navigation that carries no query parameter leaves the search box alone.
  useEffect(() => {
    const q = searchParams.get('query') || searchParams.get('q') || '';
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // Feed API query
  const {
    data: feedData,
    isLoading: feedLoading,
    error: feedError,
    mutate: mutateFeed,
  } = useSWR(workspaceId ? [`memory-feed-${workspaceId}`, feedPageSize] : null, () =>
    memoryFeedApi.feed({ workspace_id: workspaceId, page: 1, page_size: feedPageSize }),
  );

  // Lineage query
  const {
    data: lineage,
    isLoading: lineageLoading,
    error: lineageError,
    mutate: mutateLineage,
  } = useSWR(selectedId ? `lineage-${selectedId}` : null, () => memoryFeedApi.lineage(selectedId!));

  // Memories query with explicit workspace scoping. The type filter runs
  // server-side, and only `loadedPages` windows are fetched; the total is kept
  // separately so a truncated window never reads as "no records".
  const {
    data: memoriesRes,
    isLoading: memoriesLoading,
    error: memoriesError,
    mutate: mutateMemories,
  } = useSWR(
    workspaceId ? [`memories-${workspaceId}`, loadedPages, selectedType] : null,
    async () => {
      const pages = await Promise.all(
        Array.from({ length: loadedPages }, (_, i) =>
          memoryApi.list({
            page: i + 1,
            page_size: LIST_PAGE_SIZE,
            workspace_id: workspaceId,
            ...(selectedType !== 'all' ? { type: selectedType } : {}),
          }),
        ),
      );
      return {
        memories: pages.flatMap((p) => (Array.isArray(p.memories) ? p.memories : [])),
        total: pages[0]?.total ?? 0,
      };
    },
  );

  const memItems: Memory[] = useMemo(() => {
    if (!memoriesRes) return [];
    if (Array.isArray(memoriesRes)) return memoriesRes as Memory[];
    const res = memoriesRes as { memories?: Memory[]; items?: Memory[] };
    return res.memories ?? res.items ?? [];
  }, [memoriesRes]);

  const memoriesTotal = useMemo(() => {
    if (!memoriesRes || Array.isArray(memoriesRes)) return memItems.length;
    const total = (memoriesRes as { total?: number }).total;
    return typeof total === 'number' ? total : memItems.length;
  }, [memoriesRes, memItems]);

  // A new type filter restarts the paginated window.
  useEffect(() => {
    setLoadedPages(1);
  }, [selectedType]);

  // `task` is no longer a valid memory type, but rows written with it may still
  // exist. Probe once so they stay reachable through a labelled legacy filter
  // instead of being silently orphaned. (List reads accept any type string; the
  // pack registry only guards writes.)
  const { data: legacyTaskProbe } = useSWR(
    workspaceId ? `legacy-task-probe-${workspaceId}` : null,
    () => memoryApi.list({ type: 'task', page_size: 1, workspace_id: workspaceId }),
  );
  const legacyTaskCount = legacyTaskProbe?.total ?? 0;

  // Real vault client state for the sync stat. This tile previously rendered a
  // hardcoded "Healthy" with no query behind it, on a page where the Vault panel
  // polls real status 500ms later.
  const {
    data: vaultStatus,
    error: vaultStatusError,
    mutate: mutateVaultStatus,
  } = useSWR(
    workspaceId ? ['vault-sync-status', workspaceId] : null,
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
    const heartbeat = vaultStatus.lastClientHeartbeat
      ? `Last contact ${formatRelative(vaultStatus.lastClientHeartbeat)}`
      : 'No client has reported yet';
    const base = vaultStatus.lastError ? `Last error: ${vaultStatus.lastError}` : heartbeat;
    return vaultStatusError ? `${base} · status not refreshed` : base;
  }, [vaultStatus, vaultStatusError]);

  // Type filtering is server-side now; the client only drops soft-deleted rows
  // that list pages may still return.
  const filteredMemories = useMemo(() => {
    return memItems.filter((m) => m.status !== 'deleted');
  }, [memItems]);

  const searchActive = searchQuery.trim().length > 0;

  const searchMemories: Memory[] = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.map((r) => r.memory).filter((m) => m && m.status !== 'deleted');
  }, [searchResults]);

  // Server-side search (hybrid retrieval), debounced. Every query/filter change
  // invalidates the previous in-flight request so a slow response cannot
  // overwrite a newer one.
  useEffect(() => {
    searchSeqRef.current += 1;
    const seq = searchSeqRef.current;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      memoryApi
        .search({
          query: q,
          workspace_id: workspaceId,
          top_k: SEARCH_TOP_K,
          ...(selectedType !== 'all' ? { type: selectedType } : {}),
        })
        .then((results) => {
          if (seq !== searchSeqRef.current) return;
          setSearchResults(Array.isArray(results) ? results : []);
        })
        .catch((err: unknown) => {
          if (seq !== searchSeqRef.current) return;
          setSearchResults(null);
          setSearchError(err instanceof Error ? err.message : 'Search failed.');
        })
        .finally(() => {
          if (seq === searchSeqRef.current) setSearchLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedType, workspaceId, searchRetryTick]);

  const displayMemories = searchActive ? searchMemories : filteredMemories;

  const loadMoreMemories = useCallback(() => setLoadedPages((p) => p + 1), []);
  const loadMoreFeed = useCallback(
    () => setFeedPageSize((s) => Math.min(s + 50, FEED_PAGE_SIZE_MAX)),
    [],
  );

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
    if (selectedMemoryIds.size === displayMemories.length) {
      setSelectedMemoryIds(new Set());
    } else {
      setSelectedMemoryIds(new Set(displayMemories.map((m) => m.id)));
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

  const feedTruncated = !!feedData && feedData.feed.length < feedData.total;

  const tabs = [
    {
      id: 'list',
      label: `Notes & Memories (${searchActive ? searchMemories.length : memoriesTotal})`,
    },
    {
      id: 'feed',
      label: `Agentic Activity${feedData?.feed ? ` (${feedData.feed.length}${feedTruncated ? '+' : ''})` : ''}`,
    },
    { id: 'scale', label: 'SCALE Temporal' },
    { id: 'graph', label: 'Knowledge Graph' },
    { id: 'corrections', label: 'Corrections' },
    { id: 'sync', label: 'Vault & Git Sync' },
  ];

  // A labelled legacy option so `task` rows (no longer a valid type) stay
  // reachable. Appended to the filter categories only — never TYPE_FILTERS,
  // which mirrors the canonical taxonomy.
  const filterCategories: FilterOption[] = useMemo(() => {
    if (legacyTaskCount > 0) {
      return [...TYPE_FILTERS, { id: 'task', label: 'Tasks (legacy)' }];
    }
    return TYPE_FILTERS;
  }, [legacyTaskCount]);

  const renderMemoryGrid = (items: Memory[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((m) => {
        // Only surface a confidence score the backend actually stored.
        // The old `?? 0.85` invented a number for every memory that had
        // none, so the UI displayed a confident-looking 85% that was
        // never computed.
        const storedConfidence = m.metadata?.['confidence'];
        const confScore =
          typeof storedConfidence === 'number' && storedConfidence > 0
            ? storedConfidence
            : undefined;
        const sourceText = m.source?.label || m.source?.type || (m.source?.uri ? 'file' : 'manual');
        const contentStr =
          ((m as unknown as Record<string, unknown>)['content'] as string) || m.summary || m.title;
        const relTime = formatRelative(m.createdAt);
        const isSelected = selectedMemoryIds.has(m.id);

        return (
          <div
            key={m.id}
            className={`relative group rounded-xl transition border ${
              isSelected ? 'border-accent ring-1 ring-accent' : 'border-transparent'
            }`}
          >
            <div
              className="absolute top-3 left-3 z-10 p-1 flex items-center justify-center"
              onClick={(e: React.MouseEvent) => toggleSelectMemory(m.id, e)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => toggleSelectMemory(m.id, e)}
                aria-label={`Select memory ${m.title || m.id}`}
                className="w-6 h-6 min-w-[24px] min-h-[24px] rounded border-border text-accent focus:ring-accent cursor-pointer"
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
  );

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
        {vaultStatusError && !vaultStatus ? (
          <ErrorState
            title="Vault status unavailable"
            message={
              vaultStatusError instanceof Error
                ? vaultStatusError.message
                : 'Could not load vault sync status.'
            }
            onRetry={() => void mutateVaultStatus()}
          />
        ) : (
          <StatCard label="Vault Git Sync" value={vaultSyncLabel} caption={vaultSyncCaption} />
        )}
      </div>

      {/* Dedicated Workbench Quick Navigation Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href={`/workspace/${workspaceId}/memory/vault`}
          className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-text group-hover:text-accent">
              Vault Git Sync →
            </p>
            <p className="text-[11px] text-text-muted">Status, conflicts &amp; sync requests</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/graph`}
          className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-text group-hover:text-accent">
              Graph Workbench →
            </p>
            <p className="text-[11px] text-text-muted">Interactive ontology view</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/scale`}
          className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-text group-hover:text-accent">
              SCALE Hierarchy →
            </p>
            <p className="text-[11px] text-text-muted">Multiscale rollups</p>
          </div>
        </Link>

        <Link
          href={`/workspace/${workspaceId}/memory/corrections`}
          className="p-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition flex items-center justify-between group shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold text-text group-hover:text-accent">
              Corrections Ledger →
            </p>
            <p className="text-[11px] text-text-muted">Audit trail &amp; diffs</p>
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
            categories={filterCategories}
            activeCategory={selectedType}
            onCategoryChange={setSelectedType}
          />

          {legacyTaskCount > 0 && (
            <p className="text-xs text-text-muted">
              {legacyTaskCount} memory item{legacyTaskCount === 1 ? '' : 's'} still use the retired
              “task” type. They remain readable through the Tasks (legacy) filter.
            </p>
          )}

          {selectedMemoryIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-surface-100 border border-accent rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-accent">
                  {selectedMemoryIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs text-text-muted hover:underline"
                >
                  {selectedMemoryIds.size === displayMemories.length
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

          {memoriesError && !memoriesRes ? (
            <ErrorState
              title="Couldn't load memories"
              message={
                memoriesError instanceof Error
                  ? memoriesError.message
                  : 'The memory list could not be loaded.'
              }
              onRetry={() => void mutateMemories()}
            />
          ) : searchActive ? (
            <div aria-busy={searchLoading}>
              {searchError ? (
                <ErrorState
                  title="Search failed"
                  message={searchError}
                  onRetry={() => setSearchRetryTick((n) => n + 1)}
                />
              ) : searchLoading || searchResults === null ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner text="Searching memories..." />
                </div>
              ) : searchMemories.length === 0 ? (
                <EmptyState
                  title="No strong matches"
                  description="No memories scored above the relevance threshold for this query. Try different keywords or a type filter."
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-muted">
                    {searchResults.length >= SEARCH_TOP_K
                      ? `Top ${SEARCH_TOP_K} matches`
                      : `${searchMemories.length} ${searchMemories.length === 1 ? 'match' : 'matches'}`}
                  </p>
                  {renderMemoryGrid(searchMemories)}
                </div>
              )}
            </div>
          ) : memoriesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner text="Loading memories..." />
            </div>
          ) : memoriesTotal === 0 ? (
            <EmptyState
              title={selectedType !== 'all' ? 'No matching memories' : 'Your Memory is ready'}
              description={
                selectedType !== 'all'
                  ? 'No stored memories use the selected type. Try a different filter.'
                  : 'Capture ideas, notes, or connect your local vault to automatically populate memories.'
              }
              action={{
                label: '+ Create Note / Memory',
                onClick: () => setCreateModalOpen(true),
              }}
            />
          ) : memItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-text-muted">
                This window of memories is empty. Load more to continue through the list.
              </p>
              <Button variant="secondary" size="sm" onClick={loadMoreMemories}>
                Load more
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {renderMemoryGrid(filteredMemories)}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">
                  {`Showing ${filteredMemories.length} of ${memoriesTotal} memories`}
                </p>
                {filteredMemories.length < memoriesTotal && (
                  <Button variant="secondary" size="sm" onClick={loadMoreMemories}>
                    Load more
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Tab 2: Agentic Activity & Provenance */}
      <TabPanel id="feed" activeTab={activeTab}>
        {feedError && !feedData ? (
          <ErrorState
            title="Couldn't load agentic activity"
            message={
              feedError instanceof Error
                ? feedError.message
                : 'The activity feed could not be loaded.'
            }
            onRetry={() => void mutateFeed()}
          />
        ) : feedLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner text="Loading agentic timeline..." />
          </div>
        ) : timelineItems.length === 0 ? (
          <EmptyState
            title="No agentic activity yet"
            description="Agentic actions, synthesis rollups, and memory corrections will appear here in chronological order with provenance."
          />
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider mb-4">
                Memory Lifecycle &amp; Agent Trajectory
              </h3>
              <MemoryTimeline items={timelineItems} />
            </div>
            {feedData && feedTruncated && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">
                  {`Showing the latest ${feedData.feed.length} of ${feedData.total} activity events`}
                </p>
                {feedPageSize < FEED_PAGE_SIZE_MAX && (
                  <Button variant="secondary" size="sm" onClick={loadMoreFeed}>
                    Load more
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </TabPanel>

      {/* Tab 3: SCALE Temporal Hierarchy */}
      <TabPanel id="scale" activeTab={activeTab}>
        {workspaceId && <ScaleMemoryViewer workspaceId={workspaceId} />}
      </TabPanel>

      {/* Tab 4: Knowledge Graph */}
      <TabPanel id="graph" activeTab={activeTab}>
        <div className="min-h-[600px] h-[70vh] bg-surface border border-border rounded-xl overflow-hidden relative shadow-sm">
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
        {lineageError && !lineage ? (
          <ErrorState
            title="Couldn't load lineage"
            message={
              lineageError instanceof Error
                ? lineageError.message
                : 'Provenance for this record could not be loaded.'
            }
            onRetry={() => void mutateLineage()}
          />
        ) : lineageLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner text="Tracing provenance..." />
          </div>
        ) : lineage ? (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Supersession Lineage Chain
              </h4>
              {lineage.chainBackwards.length === 0 ? (
                <p className="text-xs text-text-muted">Origin record (no previous versions).</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {lineage.chainBackwards.map((m: unknown, idx: number) => {
                    const mem = m as Record<string, unknown>;
                    return (
                      <div
                        key={String(mem['id'])}
                        className={`shrink-0 w-52 rounded-lg border p-3 ${
                          idx === 0
                            ? 'border-accent bg-accent/10 text-text'
                            : 'border-border bg-surface-100 text-text-secondary'
                        }`}
                      >
                        <p className="font-mono text-[10px] uppercase font-semibold">
                          {idx === 0 ? 'Current Active' : `v-${idx} Superseded`}
                        </p>
                        <p className="text-xs font-medium truncate mt-1">
                          {String(mem['title'] || mem['id']).slice(0, 32)}
                        </p>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
                          {String(mem['summary'] || '')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button variant="secondary" onClick={() => setShowLineage(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No lineage available for this record.</p>
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
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
              Title / Concept
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Consensus in Distributed Systems"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-50 p-2.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
              Memory Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-50 p-2.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent font-sans"
            >
              {TYPE_FILTERS.filter((f) => f.id !== 'all').map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
              Content &amp; Insights
            </label>
            <textarea
              required
              rows={4}
              placeholder="Enter note or markdown content..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-50 p-2.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. memory, architecture, notes"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-50 p-2.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-accent font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
              JSON Payload (Array or Export Format)
            </label>
            <p className="text-[11px] text-text-muted mb-2">
              Paste exported JSON or an array of items with title, content, type, tags, and
              metadata.
            </p>
            <textarea
              required
              rows={10}
              placeholder={`[\n  {\n    "title": "System Architecture Decisions",\n    "content": "Decided on SQLite/PostgreSQL RLS with event stream...",\n    "type": "decision",\n    "tags": ["architecture", "database"]\n  }\n]`}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              className="w-full font-mono text-xs rounded-md border border-border bg-surface-50 p-2.5 text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dedup"
              checked={importDeduplicate}
              onChange={(e) => setImportDeduplicate(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent cursor-pointer"
            />
            <label htmlFor="dedup" className="text-xs text-text cursor-pointer">
              Deduplicate by SHA-256 content hash (skip existing identical records)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
