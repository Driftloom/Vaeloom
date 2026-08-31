'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { temporalApi, type TemporalWorkflowStatus } from '@/lib/api-client';

/**
 * ExecutionTimeline — LangGraph durable execution stepper (LG-18).
 *
 * Maps VaeloomGraphState execution_status → user-facing stages
 * without exposing chain-of-thought / hidden prompts / secrets.
 *
 * Exposed safe metadata only: currentStage, agentName, toolName,
 * approvalStatus, progress, sourceReferences, result, error.
 */

export type ExecutionStage =
  | 'queued'
  | 'planning'
  | 'retrieving'
  | 'running_agents'
  | 'waiting_approval'
  | 'executing_action'
  | 'evaluating'
  | 'completed'
  | 'failed'
  | 'cancelled';

const STAGE_LABEL: Record<ExecutionStage, string> = {
  queued: 'Queued',
  planning: 'Planning',
  retrieving: 'Retrieving context',
  running_agents: 'Running agents',
  waiting_approval: 'Waiting for approval',
  executing_action: 'Executing action',
  evaluating: 'Evaluating',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STAGE_ORDER: ExecutionStage[] = [
  'queued',
  'planning',
  'retrieving',
  'running_agents',
  'waiting_approval',
  'executing_action',
  'evaluating',
  'completed',
];

function mapStatusToStage(
  status: string | undefined,
  query: Record<string, unknown> | null | undefined,
): ExecutionStage {
  const qStatus = (query as Record<string, unknown> | undefined)?.['status'] as string | undefined;
  const qStep = (query as Record<string, unknown> | undefined)?.['step'] as string | undefined;
  const s = (qStatus || status || '').toLowerCase();
  if (s === 'cancelled' || s === 'cancel_requested') return 'cancelled';
  if (s === 'failed') return 'failed';
  if (s === 'completed' || s === 'success') return 'completed';
  if (s === 'waiting_approval' || status === 'waiting_approval') return 'waiting_approval';
  if (s === 'running' && qStep === 'waiting_approval') return 'waiting_approval';
  if (qStep === 'evaluating' || status === 'evaluating') return 'evaluating';
  if (qStep === 'executing_tool' || status === 'executing_tool') return 'executing_action';
  if (status === 'planning' || s === 'planning') return 'planning';
  if (status === 'routing' || status === 'retrieving' || s === 'retrieving') return 'retrieving';
  if (status === 'running_agents') return 'running_agents';
  // default based on Temporal running
  if (s === 'running' || s === 'accepted' || s === 'queued') return 'running_agents';
  return 'queued';
}

export function useExecutionPolling(
  workflowId: string | null,
  opts?: { enabled?: boolean; intervalMs?: number },
) {
  const enabled = opts?.enabled ?? true;
  const intervalMs = opts?.intervalMs ?? 3000;
  const [data, setData] = useState<TemporalWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!workflowId || !enabled) return;
    try {
      const res = await temporalApi.getStatus(workflowId);
      setData(res);
      const s = (res.status || '').toLowerCase();
      const qs = (
        (res.query as Record<string, unknown> | undefined)?.['status'] as string | undefined
      )?.toLowerCase();
      const terminal = ['completed', 'failed', 'cancelled', 'expired'];
      if (terminal.includes(s) || (qs && terminal.includes(qs))) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // 404 while starting is not fatal — keep polling briefly
      setError(msg);
    }
  }, [workflowId, enabled]);

  useEffect(() => {
    if (!workflowId || !enabled) return;
    setLoading(true);
    void fetchStatus().finally(() => setLoading(false));
    timerRef.current = setInterval(() => {
      void fetchStatus();
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [workflowId, enabled, intervalMs, fetchStatus]);

  const cancel = useCallback(async () => {
    if (!workflowId) return;
    abortRef.current = new AbortController();
    await temporalApi.cancel(workflowId);
    await fetchStatus();
  }, [workflowId, fetchStatus]);

  return {
    data,
    error,
    loading,
    stage: mapStatusToStage(
      data?.status,
      data?.query as Record<string, unknown> | null | undefined,
    ),
    cancel,
    refresh: fetchStatus,
  };
}

export function ExecutionTimeline({
  workflowId,
  agentName,
  toolName,
  ragStatus,
  dag,
}: {
  workflowId: string | null;
  agentName?: string;
  toolName?: string;
  ragStatus?: string | null;
  dag?: string[][];
}) {
  const { data, error, stage, cancel } = useExecutionPolling(workflowId, { enabled: !!workflowId });
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const isTerminal = stage === 'completed' || stage === 'failed' || stage === 'cancelled';
  const query = (data?.query as Record<string, unknown> | undefined) || {};

  return (
    <div
      className="rounded-lg border bg-card p-4 shadow-sm"
      aria-live="polite"
      aria-label="Execution timeline"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Execution</h3>
        <div className="flex items-center gap-2">
          {workflowId ? (
            <span className="text-xs text-muted-foreground" title={workflowId}>
              {workflowId.slice(0, 28)}…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No workflow</span>
          )}
          {workflowId && !isTerminal ? (
            <button
              onClick={() => void cancel()}
              className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-1.5" role="list">
        {STAGE_ORDER.map((s, idx) => {
          const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending';
          const label = STAGE_LABEL[s];
          return (
            <li
              key={s}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                state === 'done'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : state === 'active'
                    ? 'border-primary bg-primary/10 text-primary font-medium animate-pulse'
                    : 'border-muted bg-muted text-muted-foreground'
              }`}
              aria-current={state === 'active' ? 'step' : undefined}
              title={s}
            >
              {label}
              {s === 'retrieving' && ragStatus ? ` · ${ragStatus}` : ''}
            </li>
          );
        })}
      </ol>

      {/* Safe metadata only — never chain-of-thought / secrets */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Agent: </span>
          <span className="font-mono">
            {agentName || ((query as Record<string, unknown>)['selected_agent'] as string) || '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Tool: </span>
          <span className="font-mono">
            {toolName ||
              ((query as Record<string, unknown>)['selected_tool'] as string) ||
              (stateToolFallback(data) ?? '—')}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">RAG: </span>
          <span className="font-mono">
            {ragStatus ||
              ((query as Record<string, unknown>)['rag_status'] as string) ||
              ((data?.query as Record<string, unknown> | undefined)?.['rag_status'] as string) ||
              '—'}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Stage: </span>
          <span className="font-mono">{STAGE_LABEL[stage]}</span>
        </div>
        {dag && dag.length > 0 ? (
          <div className="col-span-2">
            <span className="text-muted-foreground">DAG: </span>
            <span className="font-mono">{dag.map((l) => `[${l.join(', ')}]`).join(' → ')}</span>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-destructive">Error: {error.slice(0, 200)}</p> : null}
      {isTerminal && (query as Record<string, unknown>)['error'] ? (
        <p className="mt-2 text-xs text-destructive">
          Workflow error: {String((query as Record<string, unknown>)['error']).slice(0, 300)}
        </p>
      ) : null}
      {stage === 'waiting_approval' ? (
        <p className="mt-2 text-xs text-amber-600">
          Waiting for approval — check the Approvals inbox to continue.
        </p>
      ) : null}
    </div>
  );
}

function stateToolFallback(data: TemporalWorkflowStatus | null): string | null {
  if (!data?.query) return null;
  const q = data.query as Record<string, unknown>;
  // LangGraph intermediate tool stored in query.result?.tool etc. (avoid exposing raw)
  const tool = (q as Record<string, unknown>)['tool'] as string | undefined;
  return tool || null;
}

export default ExecutionTimeline;
