'use client';

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';
import { memoryApi, memoryFeedApi } from '@/lib/api-client';
import { Modal } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function formatRelative(iso: string | null | undefined) {
  if (!iso) return 'â€”';
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

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    memory_created: 'bg-success/10 text-success border-success/30',
    memory_corrected: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
    memory_superseded: 'bg-warning/10 text-warning border-warning/30',
    agent_created: 'bg-primary/10 text-primary border-primary/20',
    agent_memory_text: 'bg-primary/10 text-primary border-primary/20',
  };
  const cls =
    map[kind] ||
    (kind.startsWith('agent_')
      ? 'bg-violet-500/10 text-violet-700 border-violet-500/20'
      : 'bg-surface-hover text-text-muted border-border');
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-mono ${cls}`}>
      {kind.replace(/_/g, ' ')}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number | undefined }) {
  // F-02: absent confidence renders an honest label instead of a fake bar.
  if (value === undefined || value === null) {
    return <span className="font-mono text-xs text-text-muted">confidence: not reported</span>;
  }
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-surface-hover overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-text-muted">{pct}%</span>
    </div>
  );
}

export default function MemoryGraphPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const [active, setActive] = useState('feed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLineage, setShowLineage] = useState(false);
  const { toast } = useToast();

  const {
    data: feedData,
    isLoading: feedLoading,
    mutate: mutateFeed,
  } = useSWR(workspaceId ? `memory-feed-${workspaceId}` : null, () =>
    memoryFeedApi.feed({ workspace_id: workspaceId, page: 1, page_size: 25 }),
  );

  const { data: lineage, isLoading: lineageLoading } = useSWR(
    selectedId ? `lineage-${selectedId}` : null,
    () => memoryFeedApi.lineage(selectedId!),
  );

  const { data: memoriesRes } = useSWR(workspaceId ? `memories-${workspaceId}` : null, () =>
    memoryApi.list({ page_size: 25 }),
  );

  const memories = memoriesRes as { items?: unknown[] } | unknown[] as unknown;
  const memItems: Array<Record<string, unknown>> = Array.isArray(memories)
    ? (memories as Array<Record<string, unknown>>)
    : (((memoriesRes as { memories?: unknown[] })?.memories ?? []) as Array<
        Record<string, unknown>
      >);

  const openLineage = useCallback((id: string) => {
    setSelectedId(id);
    setShowLineage(true);
  }, []);

  const tabs = [
    { id: 'feed', label: `Agentic Updates${feedData?.feed ? ` (${feedData.feed.length})` : ''}` },
    { id: 'graph', label: 'Graph' },
    { id: 'list', label: 'All Memories' },
    { id: 'corrections', label: 'Corrections' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text">Memory</h1>
          <p className="text-sm text-text-muted mt-1">
            Agentic memory with provenance & supersession. Workspace{' '}
            <span className="font-mono text-xs bg-surface-hover px-1 py-0.5 rounded">
              {workspaceId.slice(0, 8)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface border border-border px-3 py-1 text-xs text-text-muted">
            {feedData?.stats?.totalMemories ?? memItems.length} memories â€¢{' '}
            {feedData?.stats?.superseded ?? 0} superseded â€¢ {feedData?.stats?.agentCreated ?? 0}{' '}
            agent-created
          </span>
          <button onClick={() => mutateFeed()} className="btn-secondary text-xs !px-3 !py-1.5">
            Refresh
          </button>
        </div>
      </header>

      {feedData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card py-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim">Total</p>
            <p className="text-2xl font-display text-text mt-1">{feedData.stats.totalMemories}</p>
          </div>
          <div className="card py-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
              Agent-created
            </p>
            <p className="text-2xl font-display text-primary mt-1">{feedData.stats.agentCreated}</p>
          </div>
          <div className="card py-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim">Superseded</p>
            <p className="text-2xl font-display text-warning mt-1">{feedData.stats.superseded}</p>
          </div>
          <div className="card py-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
              Recent AI actions
            </p>
            <p className="text-2xl font-display text-violet-600 mt-1">
              {feedData.stats.recentActions}
            </p>
          </div>
        </div>
      )}

      <Tabs tabs={tabs} activeTab={active} onChange={setActive} />

      <TabPanel id="feed" activeTab={active}>
        {feedLoading ? (
          <LoadingSpinner text="Loading agentic feed..." />
        ) : !feedData || feedData.feed.length === 0 ? (
          <EmptyState
            title="No agentic updates yet"
            description="Upload a document or let an agent extract memories. This feed shows agent-created, corrected and superseded chains with provenance."
          />
        ) : (
          <div className="space-y-3">
            {feedData.feed.map((item) => {
              const mem = item.memory as unknown as Record<string, unknown> | null;
              const title =
                (mem?.['title'] as string) || (mem?.['summary'] as string) || 'Untitled';
              const summary = (mem?.['summary'] as string) || (mem?.['content'] as string) || '';
              const type = (mem?.['type'] as string) || 'document';
              const status = (mem?.['status'] as string) || '';
              const tags: string[] = (mem?.['tags'] as string[]) || [];
              const sourceType =
                (mem?.['sourceType'] as string) || (mem?.['source_type'] as string) || '';
              const id = (mem?.['id'] as string) || '';
              const metadata = (mem?.['metadata'] as Record<string, unknown>) || {};
              // F-02: confidence is shown only when the backend supplies it;
              // the previous 0.85 default was fabricated.
              const confidence =
                (metadata?.['confidence'] as number | undefined) ??
                (mem?.['confidence'] as number | undefined);

              return (
                <div
                  key={`${item.kind}-${id || item.timestamp}-${item.agentName}`}
                  className="card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <KindBadge kind={item.kind} />
                        <span className="rounded bg-surface-hover border border-border px-1.5 py-0.5 text-xs font-mono text-text-muted">
                          {type}
                        </span>
                        {sourceType && (
                          <span className="text-xs text-text-dim">via {sourceType}</span>
                        )}
                        {item.agentName && (
                          <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-xs text-violet-700">
                            @{item.agentName}
                          </span>
                        )}
                        {status === 'superseded' && (
                          <span className="rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning">
                            superseded
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-medium text-text truncate">{title}</h3>
                      {summary && <p className="text-sm text-text-muted line-clamp-2">{summary}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-dim font-mono">
                          {formatRelative(item.timestamp)}
                        </span>
                        <ConfidenceBar value={confidence} />
                        {tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded bg-surface-hover border border-border px-1.5 py-0.5 text-xs text-text-muted"
                          >
                            {t}
                          </span>
                        ))}
                        {mem?.['supersedes_id'] || (mem?.['supersedesId'] as string) ? (
                          <span className="rounded bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-xs text-sky-700">
                            correction
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1">
                      {id && (
                        <button
                          onClick={() => openLineage(id)}
                          className="btn-secondary text-xs !px-3 !py-1"
                        >
                          Lineage
                        </button>
                      )}
                      {item.action && (
                        <span className="text-[10px] font-mono text-text-dim text-right">
                          {item.action.actionType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-text-dim mt-3">
          Provenance: each memory links source document â†’ embedding â†’ graph node â†’ agent
          action. Superseded versions stay visible; corrections create new rows with{' '}
          <span className="font-mono">supersedes_id</span>.
        </p>
      </TabPanel>

      <TabPanel id="graph" activeTab={active}>
        <DynamicGraphViewer workspaceId={workspaceId} />
      </TabPanel>

      <TabPanel id="list" activeTab={active}>
        {memItems.length === 0 ? (
          <EmptyState
            title="No memories yet"
            description="Memories will appear here after ingestion. Check the feed for agent activity."
          />
        ) : (
          <div className="space-y-2">
            {memItems.map((m) => {
              const id = (m['id'] as string) || '';
              const title = (m['title'] as string) || 'Untitled';
              const type = (m['type'] as string) || '';
              const status = (m['status'] as string) || '';
              const sourceType = (m['sourceType'] as string) || (m['source_type'] as string) || '';
              const summary = (m['summary'] as string) || '';
              return (
                <div key={id} className="card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs rounded bg-surface-hover border border-border px-1.5 py-0.5">
                        {type}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 border ${status === 'superseded' ? 'bg-warning/10 text-warning border-warning/30' : status === 'READY' || status === 'active' ? 'bg-success/10 text-success border-success/30' : 'bg-surface-hover text-text-muted border-border'}`}
                      >
                        {status || 'active'}
                      </span>
                      {sourceType && <span className="text-xs text-text-dim">{sourceType}</span>}
                    </div>
                    <p className="font-medium text-text truncate mt-1">{title}</p>
                    <p className="text-xs text-text-muted truncate">{summary || 'No summary'}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={`/workspace/${workspaceId}/memory/${id}`}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover transition-colors"
                    >
                      Details
                    </a>
                    <button
                      onClick={() => openLineage(id)}
                      className="btn-secondary text-xs !px-3 !py-1"
                    >
                      Lineage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="corrections" activeTab={active}>
        <MemoryCorrectionPanel />
      </TabPanel>

      <Modal
        isOpen={showLineage}
        onClose={() => setShowLineage(false)}
        title={
          lineage?.memory
            ? `Lineage: ${((lineage.memory as unknown as Record<string, unknown>)['title'] as string) || ((lineage.memory as unknown as Record<string, unknown>)['id'] as string)}`
            : 'Lineage'
        }
        size="lg"
      >
        {lineageLoading ? (
          <LoadingSpinner text="Loading lineage..." />
        ) : lineage ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-text mb-1">
                Supersession chain (backwards â€” supersedes)
              </h3>
              {lineage.chainBackwards.length === 0 ? (
                <p className="text-xs text-text-muted">No ancestors</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {lineage.chainBackwards.map((m: unknown, idx: number) => {
                    const mem = m as Record<string, unknown>;
                    return (
                      <div
                        key={String(mem['id'])}
                        className={`shrink-0 w-48 rounded border p-2 ${idx === 0 ? 'border-primary bg-primary/5' : 'border-border bg-surface-hover'}`}
                      >
                        <p className="font-mono text-xs text-text-dim">
                          {idx === 0 ? 'current' : `#${idx} superseded`}
                        </p>
                        <p className="text-sm font-medium text-text truncate">
                          {String(mem['title'] || mem['id']).slice(0, 28)}
                        </p>
                        <p className="text-xs text-text-muted line-clamp-2">
                          {String(mem['summary'] || '')}
                        </p>
                        <p className="font-mono text-[10px] text-text-dim mt-1">
                          {String(mem['id']).slice(0, 8)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {lineage.chainForwards.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text mb-1">
                  Forward chain (what supersedes this)
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {lineage.chainForwards.map((m: unknown) => {
                    const mem = m as Record<string, unknown>;
                    return (
                      <div
                        key={String(mem['id'])}
                        className="shrink-0 w-48 rounded border border-warning/30 bg-warning/10 p-2"
                      >
                        <p className="text-sm font-medium text-text truncate">
                          {String(mem['title'] || mem['id']).slice(0, 28)}
                        </p>
                        <p className="text-xs text-text-muted line-clamp-2">
                          {String(mem['summary'] || '')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-text mb-1">Provenance</h3>
                {lineage.provenance.length === 0 ? (
                  <p className="text-xs text-text-muted">No provenance trace (older record)</p>
                ) : (
                  <ol className="space-y-1">
                    {lineage.provenance.map(
                      (n: { table: string; id: string; type: string; detail: string }) => (
                        <li key={`${n.table}-${n.id}`} className="flex items-center gap-2 text-xs">
                          <span className="rounded bg-surface-hover border border-border px-1.5 py-0.5 font-mono text-text-dim">
                            {n.table}
                          </span>
                          <span className="font-mono text-text-dim">{n.id.slice(0, 8)}</span>
                          <span className="text-text-muted truncate">{n.detail || n.type}</span>
                        </li>
                      ),
                    )}
                  </ol>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-text mb-1">Linked agent actions</h3>
                {lineage.agentActions.length === 0 ? (
                  <p className="text-xs text-text-muted">No linked actions</p>
                ) : (
                  <ul className="space-y-1">
                    {lineage.agentActions.map(
                      (a: {
                        id: string;
                        agentName: string;
                        actionType: string;
                        status: string;
                        createdAt: string | null;
                      }) => (
                        <li
                          key={a.id}
                          className="rounded border border-border bg-surface-hover px-2 py-1 text-xs"
                        >
                          <span className="font-medium text-text">{a.agentName}</span>
                          <span className="mx-1 text-text-dim">â€¢</span>
                          <span className="text-text-muted">{a.actionType}</span>
                          <span
                            className={`ml-2 rounded px-1 py-0.5 text-[10px] border ${a.status === 'completed' ? 'bg-success/10 text-success border-success/30' : 'bg-surface text-text-muted border-border'}`}
                          >
                            {a.status}
                          </span>
                          <span className="ml-2 font-mono text-text-dim">
                            {a.createdAt ? formatRelative(a.createdAt) : ''}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-border flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowLineage(false)}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  toast({
                    tone: 'info',
                    title: 'Export lineage',
                    detail: 'Copy from History or request GDPR export for full chain.',
                  });
                  setShowLineage(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No lineage data</p>
        )}
      </Modal>
    </div>
  );
}
