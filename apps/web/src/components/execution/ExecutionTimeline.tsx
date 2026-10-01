'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, temporalApi, type TemporalWorkflowStatus } from '@/lib/api-client';

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

const TERMINAL_STATUSES: readonly string[] = ['completed', 'failed', 'cancelled', 'expired'];

/**
 * The stepper's own polling cadence.
 *
 * Two pollers read the same workflow and both are load-bearing, so neither can be
 * removed. `chat-store.ts` (runDurableTurn) polls at 1.5s to collect the final
 * result that the chat message needs; this hook polls to render the stepper. They
 * also cover different mounts — a timeline opened from History has no store
 * poller behind it, and a chat turn's message never waits on this component.
 *
 * Rather than restructure two ownership boundaries into one, this ticks at an
 * integer multiple of the store's interval so its requests land *between* two
 * store polls instead of racing them.
 */
const TIMELINE_POLL_INTERVAL_MS = 3000;

type StepState = 'done' | 'active' | 'pending' | 'error';

/**
 * WCAG 1.4.1: done/active/pending were distinguishable only by colour. Each state
 * now carries a word (announced) and a glyph (visible), so the distinction
 * survives both a screen reader and colour blindness.
 */
const STEP_STATE_NAME: Record<StepState, string> = {
  done: 'completed',
  active: 'in progress',
  pending: 'pending',
  error: 'failed here',
};

const STEP_STATE_GLYPH: Record<StepState, string> = {
  done: '&#10003;',
  active: '&#9679;',
  pending: '&#9675;',
  error: '&#10007;',
};

const STEP_STATE_CLASS: Record<StepState, string> = {
  done: 'border-border bg-success/10 text-success',
  active: 'border-border bg-info/10 text-info font-medium animate-pulse motion-reduce:animate-none',
  pending: 'border-border-subtle bg-surface-200 text-text-dim',
  error: 'border-error/30 bg-error/10 text-error font-medium',
};

/** Workflow state arrives as `unknown`; only non-empty strings are safe to surface. */
function queryString(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * A 404 is the API's answer for a workflow Temporal has accepted but not yet
 * registered, so it is a normal "not ready yet" during startup rather than a
 * failure — the original code acknowledged this in a comment and then had no way
 * to tell the two cases apart. Every other status (401/403/5xx) is a real
 * failure and is surfaced.
 */
function isNotReadyYet(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

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
  const intervalMs = opts?.intervalMs ?? TIMELINE_POLL_INTERVAL_MS;
  const [data, setData] = useState<TemporalWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!workflowId || !enabled) return;
    try {
      const res = await temporalApi.getStatus(workflowId);
      setData(res);
      // A previous failure must not outlive its recovery. Without this the
      // timeline rendered `Error: …` indefinitely beside a healthy stepper,
      // because only the catch path ever touched the error state.
      setError(null);
      const s = (res.status || '').toLowerCase();
      const qs = (
        (res.query as Record<string, unknown> | undefined)?.['status'] as string | undefined
      )?.toLowerCase();
      if (TERMINAL_STATUSES.includes(s) || (qs !== undefined && TERMINAL_STATUSES.includes(qs))) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (e: unknown) {
      // Expected while the workflow registers — keep polling quietly.
      if (isNotReadyYet(e)) return;
      setError(e instanceof Error ? e.message : String(e));
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
    };
  }, [workflowId, enabled, intervalMs, fetchStatus]);

  const cancel = useCallback(async () => {
    if (!workflowId || cancelling) return;
    setCancelling(true);
    try {
      await temporalApi.cancel(workflowId);
      await fetchStatus();
    } catch (e: unknown) {
      // Surface it in the timeline rather than as an unhandled rejection.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelling(false);
    }
  }, [workflowId, cancelling, fetchStatus]);

  return {
    data,
    error,
    loading,
    cancelling,
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
  const { data, error, stage, cancel, cancelling } = useExecutionPolling(workflowId, {
    enabled: !!workflowId,
  });

  // Everything the panel shows is resolved here, once, rather than re-derived
  // inside the JSX where two sources for the same value could drift.
  const query: Record<string, unknown> =
    (data?.query as Record<string, unknown> | null | undefined) ?? {};
  const isTerminal = stage === 'completed' || stage === 'failed' || stage === 'cancelled';

  // `STAGE_ORDER.indexOf` returns -1 for the terminal stages, which are outcomes
  // rather than steps. Left as-is, `idx < -1` and `idx === -1` are both false, so a
  // run that FAILED or was CANCELLED rendered every step as "pending" — the same
  // picture as a run that had not started, which is the opposite of what happened.
  // The run's own status is the authority; the stepper just needs a floor so the
  // failed step is visible rather than the whole list reading as untouched.
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const effectiveIdx = currentIdx >= 0 ? currentIdx : Math.max(0, STAGE_ORDER.length - 1);

  // `rag_status` has two sources. Precedence is fixed in this one place: the
  // `ragStatus` prop is the store's value, and the store polls the same workflow
  // more often (1.5s vs 3s), so it wins when both exist. The query-derived value
  // is the fallback for a timeline rendered with no store poller behind it.
  const resolvedRagStatus = ragStatus || queryString(query, 'rag_status') || null;
  const resolvedAgent = agentName || queryString(query, 'selected_agent') || '—';
  // Only the tool *name* is safe here — query.result may carry arguments or
  // payload fragments, so the intermediate tool is read from its own key.
  const resolvedTool =
    toolName || queryString(query, 'selected_tool') || queryString(query, 'tool');
  const workflowError = queryString(query, 'error');

  return (
    <div
      className="rounded-lg border border-border bg-surface p-4 shadow-sm"
      aria-live="polite"
      aria-label="Execution timeline"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-sans text-sm font-semibold text-text">Execution</h3>
        <div className="flex items-center gap-2">
          {workflowId ? (
            <span className="font-mono text-xs text-text-muted" title={workflowId}>
              {workflowId.slice(0, 28)}…
            </span>
          ) : (
            <span className="text-xs text-text-muted">No workflow</span>
          )}
          {workflowId && !isTerminal ? (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              aria-busy={cancelling ? 'true' : undefined}
              aria-label={cancelling ? 'Cancelling execution' : 'Cancel execution'}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-1.5" role="list">
        {STAGE_ORDER.map((s, idx) => {
          let state: StepState =
            idx < effectiveIdx ? 'done' : idx === effectiveIdx ? 'active' : 'pending';
          // A failed or cancelled run did not finish its last step. Marking it
          // "in progress" would be false, and "completed" worse — the run's own
          // status line above already carries the outcome.
          if (stage === 'failed' && idx === effectiveIdx) state = 'error';
          if (stage === 'cancelled' && idx === effectiveIdx) state = 'error';
          const suffix = s === 'retrieving' && resolvedRagStatus ? ` · ${resolvedRagStatus}` : '';
          const text = `${STAGE_LABEL[s]}${suffix}`;
          return (
            <li
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${STEP_STATE_CLASS[state]}`}
              aria-current={state === 'active' ? 'step' : undefined}
              // Names the step and its state. The visible label alone says nothing
              // about progress, and a raw stage id here leaked the internal name
              // (`running_agents`) while the page showed "Running agents".
              aria-label={`${text} — ${STEP_STATE_NAME[state]}`}
            >
              <span aria-hidden="true">{STEP_STATE_GLYPH[state]}</span>
              {text}
            </li>
          );
        })}
      </ol>

      {/* Safe metadata only — never chain-of-thought / secrets */}
      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <span className="text-text-muted">Agent: </span>
          <span className="font-mono text-text">{resolvedAgent}</span>
        </div>
        <div>
          <span className="text-text-muted">Tool: </span>
          <span className="font-mono text-text">{resolvedTool ?? '—'}</span>
        </div>
        <div>
          <span className="text-text-muted">RAG: </span>
          <span className="font-mono text-text">{resolvedRagStatus ?? '—'}</span>
        </div>
        <div>
          <span className="text-text-muted">Stage: </span>
          <span className="font-mono text-text">{STAGE_LABEL[stage]}</span>
        </div>
        {dag && dag.length > 0 ? (
          <div className="col-span-2">
            <span className="text-text-muted">DAG: </span>
            <span className="font-mono text-text">
              {dag.map((l) => `[${l.join(', ')}]`).join(' → ')}
            </span>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-error">Error: {error.slice(0, 200)}</p> : null}
      {isTerminal && workflowError ? (
        <p className="mt-2 text-xs text-error">Workflow error: {workflowError.slice(0, 300)}</p>
      ) : null}
      {stage === 'waiting_approval' ? (
        <p className="mt-2 text-xs text-warning">
          Waiting for approval — check the Approvals inbox to continue.
        </p>
      ) : null}
    </div>
  );
}

export default ExecutionTimeline;
