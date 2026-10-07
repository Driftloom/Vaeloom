import type {
  Citation,
  ExecutionPlan,
  GroundingDossier,
  ParallelAgentOutput,
  PhaseEvent,
  PhaseKind,
  Proposal,
  TokenUsageStats,
  ToolCall,
  ToolCallStatus,
} from './types';

/**
 * SSE event reducer for the agent chat stream.
 *
 * The backend emits 14 event types (see `orchestrator/loop.py:2952-3200` and
 * `routers/agents.py:400-614`). The previous UI handled 9 and silently dropped
 * `act`, `observe`, `reflect`, `qa` and `approval_required` — so the reasoning
 * trace the user saw was a hardcoded string ("Thinking · routing + QA") rather
 * than what the orchestrator actually did, and approval-gated proposals only
 * rendered on the non-streaming fallback path.
 *
 * This is a pure function: `(accumulator, event) -> accumulator`. Keeping it pure
 * means the whole event vocabulary is unit-testable without a component, a
 * network, or a fake `setState`.
 */

export type TerminalKind = 'done' | 'clarification' | 'out_of_scope' | 'error';

/**
 * Wire shape of an SSE `data:` payload.
 *
 * Keys are declared (not just an index signature) for three reasons: it documents
 * the orchestrator's event vocabulary in one place, dot access stays legal under
 * the repo's `noPropertyAccessFromIndexSignature`, and a typo becomes a type error
 * instead of a silent `undefined`.
 *
 * Keys are snake_case because the SSE parser in `api-client.ts` does NOT run
 * `transformKeys` — the previous `raw fetch` for commands did, and this did not.
 * Both spellings are declared wherever the backend is inconsistent about it.
 */
export interface StreamEventData {
  // intent
  agent?: string;
  agent_name?: string;
  confidence?: unknown;
  request_id?: string;
  // token / done / error
  token?: string;
  text?: string;
  result?: unknown;
  summary?: string;
  status?: string;
  message?: string;
  termination_reason?: string;
  action_chips?: unknown;
  actionChips?: unknown;
  // plan
  plan?: unknown;
  subtasks?: unknown;
  task_id?: string;
  taskId?: string;
  title?: string;
  action?: string;
  agent_assigned?: string;
  agentAssigned?: string;
  capability_required?: string;
  capabilityRequired?: string;
  dependencies?: unknown;
  plan_id?: string;
  planId?: string;
  goal_summary?: string;
  goalSummary?: string;
  is_sequential?: boolean;
  isSequential?: boolean;
  // tools / sub-agents
  tool?: string;
  name?: string;
  latency_ms?: unknown;
  latencyMs?: unknown;
  duration_ms?: unknown;
  durationMs?: unknown;
  child_agent?: string;
  childAgent?: string;
  // reflect / qa
  observation?: unknown;
  is_satisfied?: boolean;
  reason?: string;
  decision?: string;
  issues?: unknown;
  // approvals
  approval_id?: string;
  approvalId?: string;
  requires_approval?: boolean;
  requiresApproval?: boolean;
  detail?: string;
  description?: string;
  proposals?: unknown;
  tool_calls?: unknown;
  citations?: unknown;
  rag_status?: unknown;
  questions?: unknown;
  // citations
  document_title?: string;
  uri?: string;
  url?: string;
  path?: string;
  score?: unknown;
  excerpt?: string;
  page_or_section?: string;
  pageOrSection?: string;
  details?: unknown;
  // supervisor
  layer?: unknown;
  depth?: unknown;
  agents?: unknown;
  count?: unknown;
  fallback?: string;
  // buffered-response extras
  reply?: string;
  agentActions?: unknown;
  telemetry?: unknown;
  highway?: string;
  s1_ms?: unknown;
  s2_ms?: unknown;
  /** Tolerate forward-compatible additions without a type change. */
  [key: string]: unknown;
}

export interface StreamAccumulator {
  text: string;
  agentName?: string;
  /** Only ever a real number from the wire. See types.ts. */
  confidence?: number;
  toolCalls: ToolCall[];
  citations?: Citation[];
  proposals: Proposal[];
  questions?: string[];
  actionChips?: string[];
  plan?: ExecutionPlan;
  phases: PhaseEvent[];
  /** Distinct from `sawAny`: the old code set one flag for both and mislabelled it. */
  sawToken: boolean;
  sawAny: boolean;
  terminal: TerminalKind | null;
  terminalMessage?: string;
  status?: string;
  highway?: string;
  s1LatencyMs?: number;
  s2LatencyMs?: number;
  /** Client-measured round trip for the turn. */
  latencyMs?: number;
  parallelOutputs: Record<string, ParallelAgentOutput>;
  groundingDossier?: GroundingDossier;
  tokenUsage?: TokenUsageStats;
  fallbackNotice?: string;
}

export function emptyAccumulator(): StreamAccumulator {
  return {
    text: '',
    toolCalls: [],
    proposals: [],
    phases: [],
    sawToken: false,
    sawAny: false,
    terminal: null,
    parallelOutputs: {},
  };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return out.length ? out : undefined;
}

function now(): string {
  return new Date().toISOString();
}

function phase(kind: PhaseKind, label: string, extra: Partial<PhaseEvent> = {}): PhaseEvent {
  return { kind, label, at: now(), ...extra };
}

/**
/**
 * Collapse a phase trace to one row per (kind, label).
 *
 * Resume replays events from the start of a run, so an append-only trace would
 * double every row the second time a turn was rendered. Approval cards are the
 * concrete case: `mergeProposals` dedupes the proposal, the trace did not.
 */
function dedupePhases(phases: PhaseEvent[]): PhaseEvent[] {
  const seen = new Set<string>();
  const out: PhaseEvent[] = [];
  for (const p of phases) {
    const key = `${p.kind}::${p.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Read a real duration off a tool/sub-agent payload. Returns undefined when absent. */
function readLatency(data: StreamEventData): number | undefined {
  return (
    num(data.latency_ms) ?? num(data.latencyMs) ?? num(data.duration_ms) ?? num(data.durationMs)
  );
}

function toToolStatus(raw: unknown): ToolCallStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'error' || s === 'failed' || s === 'failure') return 'error';
  if (s === 'done' || s === 'success' || s === 'completed' || s === 'ok') return 'done';
  return 'running';
}

function parsePlan(data: StreamEventData): ExecutionPlan | undefined {
  // `plan` arrives either as the payload itself (routers/agents.py) or wrapped as
  // `{iteration, plan}` (orchestrator/loop.py:3024).
  const src = (data.plan ?? data) as StreamEventData;
  if (!src || typeof src !== 'object') return undefined;
  const rawSubtasks = src.subtasks;
  if (!Array.isArray(rawSubtasks) || rawSubtasks.length === 0) return undefined;
  const subtasks = rawSubtasks
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const t = s as StreamEventData;
      const title = str(t.title);
      if (!title) return null;
      return {
        taskId: str(t.task_id) ?? str(t.taskId),
        title,
        agentAssigned: str(t.agent_assigned) ?? str(t.agentAssigned) ?? 'unassigned',
        capabilityRequired: str(t.capability_required) ?? str(t.capabilityRequired),
        dependencies: strArray(t.dependencies),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (!subtasks.length) return undefined;
  return {
    planId: str(src.plan_id) ?? str(src.planId),
    goalSummary: str(src.goal_summary) ?? str(src.goalSummary),
    subtasks,
    sequential: src.is_sequential === true || src.isSequential === true,
  };
}

function parseProposals(raw: unknown): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const out: Proposal[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const q = p as StreamEventData;
    const title = str(q.title) ?? str(q.action);
    if (!title) continue;
    const approvalId = str(q.approval_id) ?? str(q.approvalId);
    const requiresApproval = q.requires_approval === true || q.requiresApproval === true;
    out.push({
      title,
      detail: str(q.detail) ?? str(q.description),
      requiresApproval,
      approvalId,
      status: requiresApproval || approvalId ? 'pending' : 'expired',
    });
  }
  return out;
}

function parseCitations(raw: unknown): Citation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Citation[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const q = c as StreamEventData;
    const title = str(q.document_title) ?? str(q.title);
    if (!title) continue;
    out.push({
      title,
      uri: str(q.uri) ?? str(q.url) ?? str(q.path),
      score: num(q.score),
      excerpt: str(q.excerpt),
      pageOrSection: str(q.page_or_section) ?? str(q.pageOrSection),
    });
  }
  return out.length ? out : undefined;
}

function upsertTool(calls: ToolCall[], match: (t: ToolCall) => boolean, patch: Partial<ToolCall>) {
  const idx = calls.findIndex(match);
  const existing = idx >= 0 ? calls[idx] : undefined;
  if (!existing) return calls;
  const next = calls.slice();
  next[idx] = { ...existing, ...patch };
  return next;
}

/** Merge new proposals, de-duplicating by approval id (replays happen on resume). */
function mergeProposals(existing: Proposal[], incoming: Proposal[]): Proposal[] {
  if (!incoming.length) return existing;
  const out = existing.slice();
  for (const p of incoming) {
    const dup = p.approvalId
      ? out.findIndex((x) => x.approvalId === p.approvalId)
      : out.findIndex((x) => x.title === p.title && x.status === 'pending');
    if (dup >= 0) out[dup] = { ...out[dup], ...p };
    else out.push(p);
  }
  return out;
}

/**
 * Fold one SSE event into the accumulator.
 *
 * Deduplication of the phase trace happens here rather than at each of the ~12
 * call sites that append one, so a replayed event cannot slip past a branch that
 * forgot to check.
 */
export function applyStreamEvent(
  acc: StreamAccumulator,
  event: string,
  data: StreamEventData,
): StreamAccumulator {
  const next = reduceEvent(acc, event, data);
  return next.phases === acc.phases ? next : { ...next, phases: dedupePhases(next.phases) };
}

function reduceEvent(
  acc: StreamAccumulator,
  event: string,
  data: StreamEventData,
): StreamAccumulator {
  const next: StreamAccumulator = { ...acc, sawAny: true };

  switch (event) {
    case 'intent': {
      const agent = str(data.agent) ?? str(data.agent_name);
      const conf = num(data.confidence);
      if (agent) next.agentName = agent;
      // Absent confidence stays absent. It is not replaced with a default.
      if (conf !== undefined) next.confidence = conf;
      return next;
    }

    case 'plan': {
      const plan = parsePlan(data);
      if (plan) next.plan = plan;
      return next;
    }

    case 'token': {
      const tok = str(data.token) ?? str(data.text) ?? '';
      // A whitespace-only delta is not output. Counting it as a token would
      // suppress the buffered retry and leave the user staring at
      // "No response — try rephrasing" when a working answer was available.
      if (tok.trim()) {
        next.text += tok;
        next.sawToken = true;
      }
      return next;
    }

    case 'act': {
      const result = data.result as StreamEventData | undefined;
      const action = result ? str(result.action) : undefined;
      const summary = result ? str(result.summary) : undefined;
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('act', action ? `Act · ${action}` : 'Act', { detail: summary }),
        ],
      };
    }

    case 'observe': {
      const observation = str(data.observation) ?? str(data.summary);
      return {
        ...next,
        phases: [...next.phases, phase('observe', 'Observe', { detail: observation })],
      };
    }

    case 'reflect': {
      const satisfied = data.is_satisfied;
      const reason = str(data.reason);
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('reflect', satisfied === true ? 'Reflect · satisfied' : 'Reflect · retrying', {
            detail: reason,
            ok: satisfied === true,
          }),
        ],
      };
    }

    case 'qa': {
      const decision = String(data.decision ?? '').toLowerCase();
      const issues = strArray(data.issues);
      const approved = decision === 'approved' || decision === 'pass' || decision === 'ok';
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('qa', approved ? 'QA gate · passed' : `QA gate · ${decision || 'review'}`, {
            issues,
            ok: approved,
          }),
        ],
      };
    }

    case 'tool_start': {
      const name = str(data.tool) ?? str(data.name);
      if (!name) return next;
      if (next.toolCalls.some((t) => t.name === name && t.status === 'running')) return next;
      return {
        ...next,
        toolCalls: [...next.toolCalls, { name, status: 'running', kind: 'tool' }],
      };
    }

    case 'tool_result': {
      const name = str(data.tool) ?? str(data.name);
      if (!name) return next;
      const status = toToolStatus(data.status);
      const latencyMs = readLatency(data);
      return {
        ...next,
        toolCalls: upsertTool(next.toolCalls, (t) => t.name === name, {
          status,
          // Only set when the backend actually reported a duration.
          ...(latencyMs !== undefined ? { latencyMs } : {}),
        }),
      };
    }

    case 'sub_agent_spawned': {
      const child = str(data.child_agent) ?? str(data.childAgent) ?? 'specialist';
      const name = `@${child}`;
      if (next.toolCalls.some((t) => t.name === name && t.status === 'running')) return next;
      return {
        ...next,
        toolCalls: [...next.toolCalls, { name, status: 'running', kind: 'sub_agent' }],
        phases: [...next.phases, phase('supervisor', `Delegated to @${child}`)],
      };
    }

    case 'sub_agent_completed': {
      const child = str(data.child_agent) ?? str(data.childAgent) ?? 'specialist';
      const name = `@${child}`;
      const status = toToolStatus(data.status);
      const latencyMs = readLatency(data);
      return {
        ...next,
        toolCalls: upsertTool(next.toolCalls, (t) => t.name === name, {
          status,
          ...(latencyMs !== undefined ? { latencyMs } : {}),
        }),
      };
    }

    case 'approval_required': {
      const parsed = parseProposals([data]);
      if (!parsed.length) return next;
      return {
        ...next,
        proposals: mergeProposals(next.proposals, parsed),
        phases: [
          ...next.phases,

          phase('approval', `Approval required · ${parsed[0]?.title ?? 'action'}`, { ok: false }),
        ],
      };
    }

    case 'supervisor_start': {
      return {
        ...next,
        phases: [...next.phases, phase('supervisor', str(data.message) ?? 'Supervisor engaged')],
      };
    }

    case 'supervisor_layer_start': {
      const layer = data.layer ?? data.depth;
      return {
        ...next,
        phases: [
          ...next.phases,

          phase(
            'supervisor',
            layer !== undefined ? `Supervisor layer ${String(layer)}` : 'Supervisor layer',
          ),
        ],
      };
    }

    case 'supervisor_parallel': {
      const n = Array.isArray(data.agents) ? data.agents.length : num(data.count);
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('supervisor', n ? `Running ${n} agents in parallel` : 'Running agents in parallel'),
        ],
      };
    }

    case 'supervisor_agent_done': {
      const name = str(data.agent) ?? str(data.agent_name);
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('supervisor', name ? `@${name} finished` : 'Specialist finished', { ok: true }),
        ],
      };
    }

    case 'agent_start': {
      const agent = str(data['agent']) ?? 'specialist';
      const existing = next.parallelOutputs[agent];
      const parallelOutputs = {
        ...next.parallelOutputs,
        [agent]: {
          agent,
          status: 'streaming' as const,
          tokens: existing?.tokens ?? '',
          phase: str(data['phase']) ?? 'executing',
          summary: existing?.summary,
        },
      };
      return {
        ...next,
        parallelOutputs,
        phases: [...next.phases, phase('supervisor', `@${agent} started`)],
      };
    }

    case 'agent_token': {
      const agent = str(data['agent']) ?? 'specialist';
      const tok = str(data['token']) ?? str(data['text']) ?? '';
      if (!tok) return next;
      const existing = next.parallelOutputs[agent] ?? {
        agent,
        status: 'streaming' as const,
        tokens: '',
      };
      const parallelOutputs = {
        ...next.parallelOutputs,
        [agent]: {
          ...existing,
          tokens: existing.tokens + tok,
          status: 'streaming' as const,
        },
      };
      return {
        ...next,
        parallelOutputs,
      };
    }

    case 'agent_phase': {
      const agent = str(data['agent']) ?? 'specialist';
      const ph = str(data['phase']) ?? str(data['label']) ?? 'working';
      const existing = next.parallelOutputs[agent] ?? {
        agent,
        status: 'streaming' as const,
        tokens: '',
      };
      const parallelOutputs = {
        ...next.parallelOutputs,
        [agent]: {
          ...existing,
          phase: ph,
        },
      };
      return {
        ...next,
        parallelOutputs,
      };
    }

    case 'agent_done': {
      const agent = str(data['agent']) ?? 'specialist';
      const isOk =
        data['status'] === 'success' || data['status'] === 'done' || data['status'] === 'completed';
      const summary = str(data['summary']) ?? str(data['result']);
      const existing = next.parallelOutputs[agent] ?? {
        agent,
        status: 'streaming' as const,
        tokens: '',
      };
      const parallelOutputs = {
        ...next.parallelOutputs,
        [agent]: {
          ...existing,
          status: isOk ? ('completed' as const) : ('error' as const),
          summary: summary ?? existing.summary,
        },
      };
      return {
        ...next,
        parallelOutputs,
      };
    }

    case 'supervisor_synthesis_start': {
      return {
        ...next,
        phases: [
          ...next.phases,
          phase('supervisor', str(data['message']) ?? 'Synthesizing specialist findings'),
        ],
      };
    }

    case 'supervisor_error': {
      return {
        ...next,
        phases: [
          ...next.phases,

          phase('error', str(data['message']) ?? 'Supervisor failed', {
            detail: str(data['fallback']),
            ok: false,
          }),
        ],
      };
    }

    case 'grounding_dossier': {
      const dossier = (data['grounding_dossier'] ?? data['dossier'] ?? data) as Record<
        string,
        unknown
      >;
      if (dossier && typeof dossier === 'object') {
        const recalled = Array.isArray(dossier['recalledMemories'] ?? dossier['recalled_memories'])
          ? (
              (dossier['recalledMemories'] ?? dossier['recalled_memories']) as Array<
                Record<string, unknown>
              >
            ).map((m) => ({
              id: String(m['id'] || ''),
              title: String(m['title'] || 'Recalled Memory'),
              score: typeof m['score'] === 'number' ? m['score'] : undefined,
              type: typeof m['type'] === 'string' ? m['type'] : undefined,
              snippet: String(m['snippet'] || m['summary'] || ''),
            }))
          : [];
        const docs = Array.isArray(
          dossier['authoritativeDocuments'] ?? dossier['authoritative_documents'],
        )
          ? (
              (dossier['authoritativeDocuments'] ?? dossier['authoritative_documents']) as Array<
                Record<string, unknown>
              >
            ).map((d) => ({
              id: String(d['id'] || ''),
              title: String(d['title'] || 'Document'),
              path: typeof d['path'] === 'string' ? d['path'] : undefined,
            }))
          : undefined;

        next.groundingDossier = {
          model: str(dossier['model']) ?? 'gemma4:31b',
          provider: str(dossier['provider']) ?? 'ollama',
          cognitiveHighway: (str(dossier['cognitiveHighway']) ??
            str(dossier['cognitive_highway']) ??
            'system2') as 'system1' | 'system2' | 'byok',
          temperature: num(dossier['temperature']) ?? 0.7,
          systemTokens: num(dossier['systemTokens'] ?? dossier['system_tokens']),
          contextTokens: num(dossier['contextTokens'] ?? dossier['context_tokens']),
          historyTokens: num(dossier['historyTokens'] ?? dossier['history_tokens']),
          outputTokens: num(dossier['outputTokens'] ?? dossier['output_tokens']),
          totalTokens: num(dossier['totalTokens'] ?? dossier['total_tokens']),
          recalledMemories: recalled,
          authoritativeDocuments: docs,
          injectedProfile: (dossier['injectedProfile'] ??
            dossier['injected_profile']) as GroundingDossier['injectedProfile'],
          xmlFencingVerified: Boolean(
            dossier['xmlFencingVerified'] ?? dossier['xml_fencing_verified'] ?? true,
          ),
          overrideMarkersNeutralized: Boolean(
            dossier['overrideMarkersNeutralized'] ??
            dossier['override_markers_neutralized'] ??
            false,
          ),
        };
      }
      return next;
    }

    case 'token_usage': {
      const u = (data['token_usage'] ?? data['usage'] ?? data) as Record<string, unknown>;
      if (u && typeof u === 'object') {
        const pTok = num(u['prompt_tokens'] ?? u['promptTokens']) ?? 0;
        const cTok = num(u['completion_tokens'] ?? u['completionTokens']) ?? 0;
        const tTok = num(u['total_tokens'] ?? u['totalTokens']) ?? pTok + cTok;
        const cost = num(u['cost_usd'] ?? u['costUsd']);
        const lat = num(u['latency_ms'] ?? u['latencyMs']);
        next.tokenUsage = {
          promptTokens: pTok,
          completionTokens: cTok,
          totalTokens: tTok,
          costUsd: cost,
          latencyMs: lat,
        };
      }
      return next;
    }

    case 'model_fallback': {
      const orig = str(data['original_model'] ?? data['originalModel']) ?? 'primary';
      const fb = str(data['fallback_model'] ?? data['fallbackModel']) ?? 'fallback';
      const reason = str(data['reason']) ?? 'provider rate limit or outage';
      const notice = `⚡ Resilient Fallback: Executed via ${fb} (originally ${orig} failed due to ${reason})`;
      next.fallbackNotice = notice;
      return {
        ...next,
        phases: [
          ...next.phases,
          phase('observe', `Circuit Breaker Fallback: ${orig} → ${fb}`, {
            detail: reason,
            ok: true,
          }),
        ],
      };
    }

    case 'ask_clarification': {
      const qs = strArray(data.questions);
      const message =
        str(data.message) ??
        (qs?.length
          ? qs.join('\n\n')
          : "I wasn't sure what you meant — could you clarify what you need help with?");
      const chips = strArray(data.action_chips) ?? strArray(data.actionChips);
      return {
        ...next,
        text: message,
        questions: qs,
        actionChips: chips,
        terminal: 'clarification',
        terminalMessage: message,
      };
    }

    case 'out_of_scope': {
      const message =
        str(data.message) ??
        'That request is outside the current scope. Try asking about resumes, jobs, files, or coding.';
      return { ...next, text: message, terminal: 'out_of_scope', terminalMessage: message };
    }

    case 'error': {
      const message = str(data.result) ?? str(data.message) ?? 'The run failed.';
      return {
        ...next,
        text: next.text || message,
        terminal: 'error',
        terminalMessage: message,
        status: str(data.status),
        phases: [...next.phases, phase('error', message, { ok: false })],
      };
    }

    case 'done': {
      const res = data.result;
      const summary =
        typeof res === 'string'
          ? res
          : res && typeof res === 'object'
            ? str((res as StreamEventData).summary)
            : str(data.summary);
      // Only adopt the summary when the stream produced no tokens, so we never
      // clobber a partially streamed answer with a duplicate.
      if (!next.sawToken && summary) next.text = summary;
      const resObj = res && typeof res === 'object' ? (res as StreamEventData) : undefined;
      const chips =
        strArray(data.action_chips) ??
        strArray(data.actionChips) ??
        strArray(resObj?.action_chips) ??
        strArray(resObj?.actionChips);
      if (chips) next.actionChips = chips;
      const details = resObj?.details as StreamEventData | undefined;
      if (details) {
        const citations = parseCitations(details['citations']);
        if (citations) next.citations = citations;
      }
      const proposals = parseProposals(resObj?.proposals);
      if (proposals.length) next.proposals = mergeProposals(next.proposals, proposals);
      const status = str(data.status);
      if (status) next.status = status;
      const failed = status === 'failed' || status === 'cancelled';
      // The backend always follows `ask_clarification` / `out_of_scope` with a
      // `done` frame (routers/agents.py:710-711), so assigning 'done' here erased
      // the real outcome of the turn. Only an unremarkable run ends as 'done'.
      const settled: TerminalKind =
        next.terminal === 'clarification' || next.terminal === 'out_of_scope'
          ? next.terminal
          : failed
            ? 'error'
            : 'done';
      return {
        ...next,
        terminal: settled,
        terminalMessage:
          failed && next.terminal !== 'clarification'
            ? (str(data.result) ?? 'The run did not complete.')
            : next.terminalMessage,
      };
    }

    default:
      return next;
  }
}

/** True when the stream produced no usable text and a buffered retry is worth attempting. */
export function shouldFallBackToBuffered(acc: StreamAccumulator): boolean {
  return !acc.sawToken && !acc.text.trim();
}
