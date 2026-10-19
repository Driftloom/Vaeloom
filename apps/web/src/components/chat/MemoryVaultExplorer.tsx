'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Badge, ErrorState } from '@vaeloom/ui-kit';
import { memoryApi, vaultSyncApi, type VaultSyncStatus } from '@/lib/api-client';

export interface MemoryVaultExplorerProps {
  workspaceId: string;
  onCiteMemory: (citation: string) => void;
  onOpenVaultDrawer?: () => void;
}

// The API caps `page_size` at 100 (`MemoryQuery` in schemas/memory.py).
const LIST_PAGE_SIZE = 100;

/**
 * What the card grid renders. The route returns the backend's `MemoryResponse`
 * (camelCased in transit), which differs from the shared `Memory` entity: the
 * source arrives as `sourceType`/`sourceLabel` strings, `title` is optional and
 * the body text lives in `content`/`summary`. We read only these fields.
 */
interface ApiMemoryRow {
  id: string;
  type?: string | null;
  status?: string | null;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  sourceType?: string | null;
  sourceLabel?: string | null;
  createdAt?: string | null;
}

interface VaultRow {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  source: string | null;
  createdAt?: string | null;
}

function toRow(m: ApiMemoryRow): VaultRow {
  const title = (m.title ?? '').trim();
  const body = (m.content ?? m.summary ?? '').trim();
  return {
    id: m.id,
    type: m.type ?? 'memory',
    status: m.status ?? 'active',
    title: title || 'Untitled memory',
    body,
    // Better to omit than to invent: the server does not always know the origin.
    source: m.sourceLabel || m.sourceType || null,
    createdAt: m.createdAt,
  };
}

/** Local copy of the app's timestamp-age idiom (see memory/page.tsx). */
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type VaultTone = 'neutral' | 'success' | 'warning' | 'error';

interface VaultBanner {
  tone: VaultTone;
  pulse?: boolean;
  label: string;
  detail: string;
}

const BANNER_CLASSES: Record<VaultTone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'border-border/60 bg-surface-50', dot: 'bg-text-dim' },
  success: { wrap: 'border-success/30 bg-success/5', dot: 'bg-success' },
  warning: { wrap: 'border-warning/30 bg-warning/5', dot: 'bg-warning' },
  error: { wrap: 'border-error/30 bg-error/5', dot: 'bg-error' },
};

/**
 * Derives the banner from the server's own status payload. The previous
 * header hard-coded "Obsidian Vault Connected - CRDT Local Mirror Active"
 * and stayed green through a full API outage; every branch below is
 * evidence-based and the neutral branches never claim health.
 */
function deriveBanner(status: VaultSyncStatus | undefined, statusError: unknown): VaultBanner {
  if (!status) {
    if (statusError) {
      return {
        tone: 'warning',
        label: 'Vault status unavailable',
        detail: 'The status check failed; retrying automatically. Memories below are unaffected.',
      };
    }
    return {
      tone: 'neutral',
      pulse: true,
      label: 'Checking vault status…',
      detail: 'Waiting for the first response.',
    };
  }
  if (status.lastError) {
    // A client-reported failure outranks every other signal (see VaultSyncPanel).
    return { tone: 'error', label: 'Vault sync error', detail: status.lastError };
  }
  const conflicts = status.conflictsCount ?? 0;
  if (status.status === 'conflict' || conflicts > 0) {
    return {
      tone: 'warning',
      label: `${conflicts || 'Unresolved'} conflict${conflicts === 1 ? '' : 's'}`,
      detail: 'Resolve conflicts in the vault panel to let syncing resume.',
    };
  }
  if (status.status === 'syncing') {
    return {
      tone: 'neutral',
      pulse: true,
      label: 'Syncing…',
      detail: 'Your vault client is pushing or pulling changes.',
    };
  }
  if (status.daemonStatus === 'running') {
    return {
      tone: 'success',
      label: 'Vault client connected',
      detail: status.lastClientHeartbeat
        ? `Last contact ${formatRelative(status.lastClientHeartbeat)}`
        : 'Reported recently.',
    };
  }
  if (status.daemonStatus === 'stale') {
    return {
      tone: 'warning',
      label: 'Vault client unresponsive',
      detail: `Last contact ${formatRelative(status.lastClientHeartbeat)} - the client may be offline.`,
    };
  }
  if (status.daemonStatus === 'paused') {
    return {
      tone: 'neutral',
      label: 'Vault client paused',
      detail: 'Sync is paused on your machine.',
    };
  }
  return {
    tone: 'neutral',
    label: 'No vault client connected',
    detail: 'No client has reported from this workspace yet. Memories still load from the API.',
  };
}

export function MemoryVaultExplorer({
  workspaceId,
  onCiteMemory,
  onOpenVaultDrawer,
}: MemoryVaultExplorerProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    data: listData,
    isLoading,
    error: listError,
    mutate: mutateList,
  } = useSWR(
    workspaceId ? ['chat-vault-memories', workspaceId, LIST_PAGE_SIZE] : null,
    () => memoryApi.list({ workspace_id: workspaceId, page_size: LIST_PAGE_SIZE }),
    { revalidateOnFocus: false },
  );

  // Same SWR key the memory-page tile and the vault panel use, so the three
  // surfaces dedupe to a single status poll.
  const { data: vaultStatus, error: vaultStatusError } = useSWR<VaultSyncStatus>(
    workspaceId ? ['vault-sync-status', workspaceId] : null,
    () => vaultSyncApi.getStatus(workspaceId),
    { refreshInterval: 15000 },
  );

  // List pages can still carry soft-deleted rows; never render them.
  const rows = useMemo<VaultRow[]>(() => {
    const raw = (listData?.memories ?? []) as unknown as ApiMemoryRow[];
    return raw.filter((m) => m.status !== 'deleted').map(toRow);
  }, [listData]);
  const total = listData?.total ?? 0;

  const categories = useMemo(
    () => [
      'all',
      ...Array.from(new Set(rows.map((r) => r.type)))
        .sort()
        .map((t) => `#${t}`),
    ],
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesCategory = activeCategory === 'all' || `#${r.type}` === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery, activeCategory]);

  const banner = useMemo(
    () => deriveBanner(vaultStatus, vaultStatusError),
    [vaultStatus, vaultStatusError],
  );
  const bannerClasses = BANNER_CLASSES[banner.tone];

  const countText = !listData
    ? isLoading
      ? 'Loading memories…'
      : 'Memory count unavailable'
    : total > rows.length
      ? `Showing ${rows.length} of ${total} memories`
      : `${rows.length} ${rows.length === 1 ? 'memory' : 'memories'}`;

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const corpusEmpty = !isLoading && !listError && rows.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-border/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <span>📌</span>
            <span>Memory &amp; Vault Grounding</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            Memories from this workspace that agents can ground on. Cites go into your next turn.
          </p>
        </div>
        {onOpenVaultDrawer && (
          <button
            type="button"
            onClick={onOpenVaultDrawer}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-action text-action-fg hover:bg-action-hover transition-colors shadow-xs"
          >
            Inspect Vault Drawer →
          </button>
        )}
      </div>

      {/* Vault status banner - every claim comes from the server's status payload */}
      <div
        role="status"
        aria-live="polite"
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${bannerClasses.wrap}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${bannerClasses.dot} ${
              banner.pulse ? 'animate-pulse motion-reduce:animate-none' : ''
            }`}
          />
          <span className="font-medium text-text">{banner.label}</span>
          <span className="text-text-dim hidden sm:inline">·</span>
          <span className="text-text-muted hidden sm:inline truncate">{banner.detail}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-text-muted">
          <span>{countText}</span>
          <span className="text-text-dim">·</span>
          <span className="text-[11px] text-text-dim">Workspace · {workspaceId.slice(0, 8)}</span>
        </div>
      </div>

      {listError && !listData ? (
        <ErrorState
          title="Memories unavailable"
          message="The memory list request failed. Memories will appear again once the API responds."
          onRetry={() => void mutateList()}
          actionText="Retry"
        />
      ) : (
        <>
          {listError && (
            <p role="alert" className="text-xs text-warning">
              Couldn&rsquo;t refresh memories — showing the last loaded list.{' '}
              <button
                type="button"
                onClick={() => void mutateList()}
                className="underline hover:text-text"
              >
                Retry
              </button>
            </p>
          )}

          {isLoading && !listData ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              aria-busy="true"
              aria-label="Loading memories"
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-xl bg-surface-100 animate-pulse motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : corpusEmpty ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-2xl">🧠</span>
              <p className="text-xs text-text-muted font-medium">No memories yet</p>
              <p className="text-[11px] text-text-dim max-w-md mx-auto">
                Save an answer with &ldquo;📌 Save to Memory Vault&rdquo;, upload documents, or
                ingest from your vault — they will appear here and become citable in chat.
              </p>
            </div>
          ) : (
            <>
              {/* Filter and Search Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-dim text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search memories, skills, notes, or entities…"
                      aria-label="Search memories, skills, notes"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/60 bg-surface-50 text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-action transition-colors"
                    />
                  </div>

                  {/* Category Tag Pills - derived from the loaded corpus */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categories.map((cat) => {
                      const isActive = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-label={cat}
                          aria-pressed={isActive}
                          onClick={() => setActiveCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                            isActive
                              ? 'bg-action text-action-fg font-medium'
                              : 'bg-surface-100 hover:bg-surface-200 text-text-muted border border-border/50'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Memories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRows.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-text-dim text-xs">
                    {searchQuery.trim() ? (
                      <>No memories match &ldquo;{searchQuery}&rdquo;.</>
                    ) : (
                      <>Nothing in {activeCategory} yet.</>
                    )}
                  </div>
                ) : (
                  filteredRows.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-4 rounded-xl border border-border/60 bg-surface-50 hover:border-border transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text line-clamp-1">
                            {mem.title}
                          </span>
                          <Badge variant="mono" size="sm" className="shrink-0">
                            #{mem.type}
                          </Badge>
                        </div>
                        {mem.body ? (
                          <p className="text-xs text-text-muted leading-relaxed line-clamp-4">
                            {mem.body}
                          </p>
                        ) : null}
                        <div className="pt-2 text-[10px] font-mono text-text-dim flex items-center justify-between gap-2">
                          <span className="truncate">
                            {mem.source ? `Source: ${mem.source}` : 'Source: not reported'}
                          </span>
                          <span className="shrink-0">{formatRelative(mem.createdAt)}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(mem.id, mem.body)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-dim hover:text-text hover:bg-surface-200 border border-border/50 transition-colors"
                        >
                          {copiedId === mem.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onCiteMemory(`[Memory Citation: ${mem.title}]\n${mem.body}`)
                          }
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-action/15 hover:bg-action text-action hover:text-action-fg border border-action/40 transition-colors"
                        >
                          Cite in Chat
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
