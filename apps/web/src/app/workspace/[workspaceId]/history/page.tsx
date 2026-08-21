'use client';
import React, { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabPanel } from '@/components/shared/Tabs';
import { DiffViewer } from '@/components/shared/DiffViewer';
import { notificationApi, documentApi } from '@/lib/api-client';
import type { NotificationResponse, DocumentAction, AgentActionHistory } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
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
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [active, setActive] = useState('documents');
  const [busyUndo, setBusyUndo] = useState<string | null>(null);

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

  const docActions = docActionsRes?.actions ?? [];
  const tabs = [
    { id: 'documents', label: `Documents${docActions.length ? ` (${docActions.length})` : ''}` },
    { id: 'agents', label: `Agents${agentActions?.length ? ` (${agentActions.length})` : ''}` },
    {
      id: 'notifications',
      label: `Notifications${notifications?.length ? ` (${notifications.length})` : ''}`,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">History</h1>
          <p className="text-text-muted text-sm">
            Agent actions, document changes and system events — with diffs and undo.
          </p>
        </div>
        <button
          className="btn-secondary text-sm"
          onClick={handleExport}
          disabled={!docActions.length && !agentActions?.length && !notifications?.length}
        >
          Export Log
        </button>
      </header>

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
            description="Rename or archive a file from the Files page — changes appear here with before/after diffs and undo."
          />
        ) : (
          <div className="space-y-3">
            {docActions.map((a) => {
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
                      className={`rounded-full border px-2 py-0.5 font-mono ${undone ? 'bg-surface-hover text-text-dim border-border' : actionType === 'document_archive' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' : actionType === 'document_restore' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}
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
                        {busyUndo === a.id ? 'Undoing…' : 'Undo'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="agents" activeTab={active}>
        {agentLoading ? (
          <LoadingSpinner text="Loading agent history..." />
        ) : agentError ? (
          <ErrorState
            title="Failed to load agent history"
            message={String((agentError as Error).message ?? agentError)}
            onRetry={() => window.location.reload()}
          />
        ) : !agentActions || agentActions.length === 0 ? (
          <EmptyState
            title="No agent actions yet"
            description="Run an agent from the workspace — executions appear here with input/output, approval state and duration."
          />
        ) : (
          <div className="space-y-3">
            {agentActions.map((a) => (
              <div key={a.id} className="card">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 font-mono text-violet-700">
                    {a.agentName}
                  </span>
                  <span className="rounded-full bg-surface-hover border border-border px-2 py-0.5 font-mono text-text-muted">
                    {a.actionType}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 ${a.status === 'completed' || a.status === 'success' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' : a.status?.toLowerCase().includes('fail') || a.error ? 'bg-red-500/10 text-red-700 border-red-500/20' : 'bg-surface-hover text-text-muted border-border'}`}
                  >
                    {a.status}
                  </span>
                  {a.approvalRequestId && (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-700">
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
                    <p className="font-mono text-text break-all">{a.inputRef ?? '—'}</p>
                  </div>
                  <div className="rounded bg-surface-hover border border-border p-2 overflow-auto">
                    <p className="font-mono text-text-dim mb-1">Output</p>
                    <p className="font-mono text-text break-all">{a.outputRef ?? a.error ?? '—'}</p>
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
        ) : (
          <div className="card">
            <table className="w-full text-left">
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
                {notifications.map((n) => (
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
      </TabPanel>
    </div>
  );
}
