'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { notificationApi, documentApi } from '@/lib/api-client';
import type { NotificationResponse, DocumentAction, AgentActionHistory } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'â€”';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getActionField<T>(a: DocumentAction, snake: string, camel: string): T | undefined {
  const r = a as unknown as Record<string, T>;
  return r[snake] ?? r[camel];
}

export default function HistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [active, setActive] = useState(() => searchParams.get('tab') ?? 'documents');
  const [busyUndo, setBusyUndo] = useState<string | null>(null);
  // Odissian polish: paginated history â€” avoids rendering 100+ cards at once
  const PAGE_SIZE = 15;
  const [docPage, setDocPage] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [notifPage, setNotifPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('from') ?? '');
  const [dateTo, setDateTo] = useState(() => searchParams.get('to') ?? '');

  // URL persistence for deep-linking / back-button
  useEffect(() => {
    const sp = new URLSearchParams();
    if (active !== 'documents') sp.set('tab', active);
    if (searchQuery) sp.set('q', searchQuery);
    if (dateFrom) sp.set('from', dateFrom);
    if (dateTo) sp.set('to', dateTo);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [active, searchQuery, dateFrom, dateTo, router]);

  const {
    data: docActionsRes,
    error: docError,
    isLoading: docLoading,
    mutate: mutateDocs,
  } = useSWR(workspaceId ? `doc-actions-${workspaceId}` : null, () =>
    documentApi.workspaceActions(workspaceId!),
  );
  const {
    data: agentActions,
    error: agentError,
    isLoading: agentLoading,
    mutate: mutateAgentActions,
  } = useSWR(workspaceId ? `agent-actions-${workspaceId}` : null, () =>
    documentApi.workspaceAgentActions(workspaceId!),
  );
  const {
    data: notifications,
    error: notifError,
    isLoading: notifLoading,
    mutate: mutateNotif,
  } = useSWR<NotificationResponse[]>(workspaceId ? `notifications-${workspaceId}` : null, () =>
    notificationApi.list(),
  );

  const handleUndoDoc = useCallback(
    async (action: DocumentAction) => {
      setBusyUndo(action.id);
      try {
        const ws = getActionField<string>(action, 'workspace_id', 'workspaceId') ?? workspaceId!;
        await documentApi.undo(action.id, ws);
        await mutateDocs();
        toast({
          tone: 'success',
          title: 'Undone',
          detail: getActionField<string>(action, 'action_type', 'actionType') ?? action.id,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Undo failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setBusyUndo(null);
      }
    },
    [workspaceId, mutateDocs, toast],
  );

  const handleExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      workspaceId,
      documentActions: docActionsRes?.actions ?? [],
      agentActions: agentActions ?? [],
      notifications: notifications ?? [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `history-${workspaceId?.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workspaceId, docActionsRes, agentActions, notifications]);

  const docActions = useMemo(() => docActionsRes?.actions ?? [], [docActionsRes]);

  const sq = searchQuery.toLowerCase();

  const isDateMatch = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return true;
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo + 'T23:59:59') return false;
      return true;
    },
    [dateFrom, dateTo],
  );

  const filteredDocs = useMemo(() => {
    return docActions.filter((a) => {
      if (sq) {
        const actionType = getActionField<string>(a, 'action_type', 'actionType') ?? '';
        const oldPath = getActionField<string>(a, 'old_path', 'oldPath') ?? '';
        const newPath = getActionField<string>(a, 'new_path', 'newPath') ?? '';
        if (
          !actionType.toLowerCase().includes(sq) &&
          !oldPath.toLowerCase().includes(sq) &&
          !newPath.toLowerCase().includes(sq)
        )
          return false;
      }
      if (!isDateMatch(getActionField<string>(a, 'created_at', 'createdAt'))) return false;
      return true;
    });
  }, [docActions, sq, isDateMatch]);

  const filteredAgents = useMemo(() => {
    return (agentActions ?? []).filter((a) => {
      if (sq) {
        if (
          !a.agentName.toLowerCase().includes(sq) &&
          !a.actionType.toLowerCase().includes(sq) &&
          !(a.inputRef ?? '').toLowerCase().includes(sq) &&
          !(a.outputRef ?? '').toLowerCase().includes(sq)
        )
          return false;
      }
      if (!isDateMatch(a.createdAt)) return false;
      return true;
    });
  }, [agentActions, sq, isDateMatch]);

  const filteredNotifs = useMemo(() => {
    return (notifications ?? []).filter((n) => {
      if (sq) {
        const subject = n.subject ?? '';
        const body = n.body ?? '';
        const channel = n.channel ?? '';
        if (
          !subject.toLowerCase().includes(sq) &&
          !body.toLowerCase().includes(sq) &&
          !channel.toLowerCase().includes(sq)
        )
          return false;
      }
      if (!isDateMatch(n.created_at)) return false;
      return true;
    });
  }, [notifications, sq, isDateMatch]);

  const hasFilters = sq !== '' || dateFrom !== '' || dateTo !== '';

  const pagedDocs = filteredDocs.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE);
  const pagedAgents = filteredAgents.slice((agentPage - 1) * PAGE_SIZE, agentPage * PAGE_SIZE);
  const pagedNotifs = filteredNotifs.slice((notifPage - 1) * PAGE_SIZE, notifPage * PAGE_SIZE);
  const tabs = [
    {
      id: 'documents',
      label: `Documents${hasFilters ? ` (${filteredDocs.length}/${docActions.length})` : docActions.length ? ` (${docActions.length})` : ''}`,
    },
    {
      id: 'agents',
      label: `Agents${hasFilters ? ` (${filteredAgents.length}/${agentActions?.length ?? 0})` : agentActions?.length ? ` (${agentActions.length})` : ''}`,
    },
    {
      id: 'notifications',
      label: `Notifications${hasFilters ? ` (${filteredNotifs.length}/${notifications?.length ?? 0})` : notifications?.length ? ` (${notifications.length})` : ''}`,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* F-23 exemplar: canonical PageHeader structure (single h1 + actions). */}
      <PageHeader
        className="mb-6"
        title="History"
        description="Agent actions, document changes and system events — with diffs and undo."
        actions={
          <button
            className="btn-secondary text-sm"
            onClick={handleExport}
            disabled={!docActions.length && !agentActions?.length && !notifications?.length}
          >
            Export Log
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search history…"
          aria-label="Search history"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setDocPage(1);
            setAgentPage(1);
            setNotifPage(1);
          }}
          className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 w-64"
        />
        <input
          type="date"
          aria-label="From date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setDocPage(1);
            setAgentPage(1);
            setNotifPage(1);
          }}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="date"
          aria-label="To date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setDocPage(1);
            setAgentPage(1);
            setNotifPage(1);
          }}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {hasFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setDateFrom('');
              setDateTo('');
              setDocPage(1);
              setAgentPage(1);
              setNotifPage(1);
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
          >
            Clear filters
          </button>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={active} onChange={setActive} />

      <TabPanel id="documents" activeTab={active}>
        {docLoading ? (
          <LoadingSpinner text="Loading document history..." />
        ) : docError ? (
          <ErrorState
            title="Failed to load document history"
            message={String((docError as Error).message ?? docError)}
            onRetry={() => mutateDocs()}
          />
        ) : docActions.length === 0 ? (
          <EmptyState
            title="No document changes yet"
            description="Rename or archive a file from the Files page â€” changes appear here with before/after diffs and undo."
          />
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            title="No results match your filters"
            description="Try adjusting your search or date range."
          />
        ) : (
          <>
            <div className="space-y-3">
              {pagedDocs.map((a) => {
                const actionType = getActionField<string>(a, 'action_type', 'actionType') ?? '';
                const oldPath = getActionField<string>(a, 'old_path', 'oldPath');
                const newPath = getActionField<string>(a, 'new_path', 'newPath');
                const undoneAt = getActionField<string | null>(a, 'undone_at', 'undoneAt');
                const createdAt = getActionField<string>(a, 'created_at', 'createdAt') ?? '';
                const isRename = actionType === 'document_rename';
                const undone = Boolean(undoneAt);
                return (
                  <div key={a.id} className={`card ${undone ? 'opacity-60 border-border/40' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono ${undone ? 'bg-surface-hover text-text-dim border-border' : actionType === 'document_archive' ? 'bg-warning/10 text-warning border-warning/30' : actionType === 'document_restore' ? 'bg-success/10 text-success border-success/30' : 'bg-primary/10 text-primary border-primary/20'}`}
                      >
                        {actionType}
                      </span>
                      <span className="text-text-dim font-mono">{formatTimestamp(createdAt)}</span>
                      {undone && (
                        <span className="rounded-full bg-surface-hover border border-border px-2 py-0.5 text-text-dim">
                          undone {formatTimestamp(undoneAt)}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-text-dim truncate max-w-[12rem]">
                        {getActionField<string>(a, 'document_id', 'documentId')?.slice(0, 8)}
                      </span>
                    </div>
                    {isRename && oldPath != null && newPath != null ? (
                      <div className="mt-3">
                        <DiffViewer oldText={oldPath} newText={newPath} />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-muted">
                        {actionType === 'document_archive'
                          ? 'File archived (soft delete)'
                          : actionType === 'document_restore'
                            ? 'File restored from archive'
                            : actionType}
                      </p>
                    )}
                    {!undone && (
                      <div className="mt-3 flex justify-end">
                        <button
                          disabled={busyUndo === a.id}
                          onClick={() => handleUndoDoc(a)}
                          className="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
                        >
                          {busyUndo === a.id ? 'Undoingâ€¦' : 'Undo'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {filteredDocs.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-xs font-mono text-text-muted border-t border-border pt-3">
                <span>
                  Showing {(docPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(docPage * PAGE_SIZE, filteredDocs.length)} of {filteredDocs.length}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={docPage <= 1}
                    onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                  >
                    Prev
                  </button>
                  <button
                    disabled={docPage * PAGE_SIZE >= filteredDocs.length}
                    onClick={() => setDocPage((p) => p + 1)}
                    className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </TabPanel>

      <TabPanel id="agents" activeTab={active}>
        {agentLoading ? (
          <LoadingSpinner text="Loading agent history..." />
        ) : agentError ? (
          <ErrorState
            title="Failed to load agent history"
            message={String((agentError as Error).message ?? agentError)}
            onRetry={() => {
              void mutateDocs();
              void mutateAgentActions();
              void mutateNotif();
            }}
          />
        ) : !agentActions || agentActions.length === 0 ? (
          <EmptyState
            title="No agent actions yet"
            description="Run an agent from the workspace â€” executions appear here with input/output, approval state and duration."
          />
        ) : filteredAgents.length === 0 ? (
          <EmptyState
            title="No results match your filters"
            description="Try adjusting your search or date range."
          />
        ) : (
          <>
            <div className="space-y-3">
              {pagedAgents.map((a) => (
                <div key={a.id} className="card">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 font-mono text-violet-700">
                      {a.agentName}
                    </span>
                    <span className="rounded-full bg-surface-hover border border-border px-2 py-0.5 font-mono text-text-muted">
                      {a.actionType}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 ${a.status === 'completed' || a.status === 'success' ? 'bg-success/10 text-success border-success/30' : a.status?.toLowerCase().includes('fail') || a.error ? 'bg-error/10 text-error border-error/30' : 'bg-surface-hover text-text-muted border-border'}`}
                    >
                      {a.status}
                    </span>
                    {a.approvalRequestId && (
                      <span className="rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-warning">
                        approval {a.approvalRequestId.slice(0, 8)}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-text-dim">
                      {formatTimestamp(a.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-surface-hover border border-border p-2 overflow-auto">
                      <p className="font-mono text-text-dim mb-1">Input</p>
                      <p className="font-mono text-text break-all">{a.inputRef ?? 'â€”'}</p>
                    </div>
                    <div className="rounded bg-surface-hover border border-border p-2 overflow-auto">
                      <p className="font-mono text-text-dim mb-1">Output</p>
                      <p className="font-mono text-text break-all">
                        {a.outputRef ?? a.error ?? 'â€”'}
                      </p>
                    </div>
                  </div>
                  {a.inputRef && a.outputRef && a.inputRef !== a.outputRef && (
                    <div className="mt-3">
                      <DiffViewer oldText={a.inputRef} newText={a.outputRef} />
                    </div>
                  )}
                  {a.durationMs != null && (
                    <p className="mt-2 text-xs text-text-dim font-mono">{a.durationMs}ms</p>
                  )}
                </div>
              ))}
            </div>
            {filteredAgents.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-xs font-mono text-text-muted border-t border-border pt-3">
                <span>
                  Showing {(agentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(agentPage * PAGE_SIZE, filteredAgents.length)} of{' '}
                  {filteredAgents.length}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={agentPage <= 1}
                    onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                  >
                    Prev
                  </button>
                  <button
                    disabled={agentPage * PAGE_SIZE >= filteredAgents.length}
                    onClick={() => setAgentPage((p) => p + 1)}
                    className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </TabPanel>

      <TabPanel id="notifications" activeTab={active}>
        {notifLoading ? (
          <LoadingSpinner text="Loading notifications..." />
        ) : notifError ? (
          <ErrorState
            title="Failed to load notifications"
            message={String((notifError as Error).message ?? notifError)}
            onRetry={() => mutateNotif()}
          />
        ) : !notifications || notifications.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Notifications and system events will appear here once you start using the workspace."
          />
        ) : filteredNotifs.length === 0 ? (
          <EmptyState
            title="No results match your filters"
            description="Try adjusting your search or date range."
          />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                  <th scope="col" className="pb-3 font-normal">
                    Time
                  </th>
                  <th scope="col" className="pb-3 font-normal">
                    Event
                  </th>
                  <th scope="col" className="pb-3 font-normal">
                    Channel
                  </th>
                  <th scope="col" className="pb-3 font-normal">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedNotifs.map((n) => (
                  <tr key={n.id} className="border-b border-border/50 hover:bg-background/50">
                    <td
                      className="py-3 text-text-muted text-sm"
                      title={new Date(n.created_at).toLocaleString()}
                    >
                      {formatTimestamp(n.created_at)}
                    </td>
                    <td className="py-3">
                      <div className="text-text text-sm font-medium">{n.subject || n.channel}</div>
                      <div className="text-text-muted text-xs truncate max-w-xs">{n.body}</div>
                    </td>
                    <td className="py-3">
                      <span className="text-xs font-mono px-2 py-1 rounded border border-border bg-surface">
                        {n.channel.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-xs text-text-muted">{n.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredNotifs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3 text-xs font-mono text-text-muted">
            <span>
              Showing {(notifPage - 1) * PAGE_SIZE + 1}-
              {Math.min(notifPage * PAGE_SIZE, filteredNotifs.length)} of {filteredNotifs.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={notifPage <= 1}
                onClick={() => setNotifPage((p) => Math.max(1, p - 1))}
                className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
              >
                Prev
              </button>
              <button
                disabled={notifPage * PAGE_SIZE >= filteredNotifs.length}
                onClick={() => setNotifPage((p) => p + 1)}
                className="rounded-full border border-border px-3 py-1 disabled:opacity-40 hover:bg-surface-hover"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </TabPanel>
    </div>
  );
}
