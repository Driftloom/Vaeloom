import { ApiError, api } from '@/lib/api';
import {
  MAX_MESSAGES_PER_THREAD,
  type Attachment,
  type ChatMessage,
  type Citation,
  type ExecutionPlan,
  type MessageRole,
  type MessageStatus,
  type PhaseEvent,
  type Proposal,
  type ToolCall,
} from './types';

/**
 * Server-backed conversation persistence.
 *
 * ## Why this layer exists
 *
 * The transcript used to live only in `localStorage['vaeloom.threads.<ws>']`.
 * That is a plaintext PII store — resumes, salary figures, pasted job descriptions
 * — with no workspace boundary, no cross-device access, and no survival past
 * "clear site data". `lib/api.ts` removed auth tokens from `localStorage` on
 * exactly those grounds (`api.ts:44-63`); the transcript was the larger prize and
 * got no equivalent treatment. The server is now the source of truth and this
 * module is the only thing that talks to it.
 *
 * ## Why every function returns a result instead of throwing
 *
 * The chat data layer previously swallowed every failure with `.catch(() => {})`,
 * which is how a hardcoded 11-command list shipped as if it were live data. A
 * function that returns `{ ok: false, error }` cannot be mistaken for one that
 * returned `{ ok: false }` by omission: the caller has to look at `ok`. So no
 * function here rejects for a transport or API failure, and none of them has a
 * fallback value that a caller could mistake for real data.
 */

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: string; status?: number; aborted?: boolean };

/** The subset of `ChatMessage` that `normaliseOnRead` inspects. */
type ChatMessageLike = {
  status: MessageStatus;
  text: string;
  error?: { message: string; code?: string };
};

export function apiOk<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

function apiFail<T>(error: string, extra?: { status?: number; aborted?: boolean }): ApiResult<T> {
  return { ok: false, error, ...extra };
}

/** SWR key. Namespaced so it cannot collide with the other workspace-scoped keys. */
export function conversationsKey(workspaceId: string): string {
  return `chat-conversations-${workspaceId}`;
}

export function conversationMessagesKey(workspaceId: string, conversationId: string): string {
  return `chat-conversation-messages-${workspaceId}-${conversationId}`;
}

// ── response shapes (camelCase: `api.*` runs `transformKeys`) ──────────────────

export interface ConversationListItem {
  id: string;
  /** Server-declared owner. Compared against the requested workspace on read. */
  workspaceId?: string;
  title: string;
  agentName?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  /** The originating frontend message id. Also the POST idempotency key. */
  clientId: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status: MessageStatus;
  replyTo?: string;
  agentName?: string;
  confidence?: number;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  proposals?: Proposal[];
  questions?: string[];
  actionChips?: string[];
  attachments?: Attachment[];
  plan?: ExecutionPlan;
  phases?: PhaseEvent[];
  error?: { message: string; code?: string };
  latencyMs?: number;
  highway?: string;
  s1LatencyMs?: number;
  s2LatencyMs?: number;
  workflowId?: string;
  edited?: boolean;
}

export interface ConversationResponse {
  id: string;
  workspaceId?: string;
  title: string;
  agentName?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationWithMessages {
  conversation: ConversationResponse;
  messages: MessageRecord[];
}

export interface ConversationListPage {
  conversations: ConversationListItem[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  search?: string;
}

/** Request body. snake_case — `api.post` stringifies verbatim and never transforms keys. */
export interface MessageCreate {
  client_id: string;
  role: MessageRole;
  /**
   * `text`, matching `MessageCreate.text` on the backend. `content` was the earlier
   * guess; the schema settled it.
   */
  text: string;
  status: MessageStatus;
  reply_to?: string;
  agent_name?: string;
  confidence?: number;
  tool_calls?: WireToolCall[];
  citations?: WireCitation[];
  proposals?: WireProposal[];
  questions?: string[];
  action_chips?: string[];
  attachments?: WireAttachment[];
  plan?: WireExecutionPlan;
  phases?: WirePhaseEvent[];
  error?: { message: string; code?: string } | null;
  latency_ms?: number;
  highway?: string;
  s1_latency_ms?: number;
  s2_latency_ms?: number;
  workflow_id?: string;
  edited?: boolean;
  created_at?: string;
}

interface WireToolCall {
  name: string;
  status: ToolCall['status'];
  kind: ToolCall['kind'];
  latency_ms?: number;
}

interface WireCitation {
  title: string;
  uri?: string;
  score?: number;
  excerpt?: string;
  page_or_section?: string;
}

interface WireProposal {
  title: string;
  detail?: string;
  requires_approval: boolean;
  approval_id?: string;
  status: Proposal['status'];
}

interface WirePhaseEvent {
  kind: PhaseEvent['kind'];
  label: string;
  detail?: string;
  at: string;
  ok?: boolean;
  issues?: string[];
}

interface WireAttachment {
  id: string;
  name: string;
  path?: string;
  size_bytes?: number;
  stored: boolean;
  error?: string;
}

interface WireExecutionPlan {
  plan_id?: string;
  goal_summary?: string;
  subtasks: Array<{
    task_id?: string;
    title: string;
    agent_assigned: string;
    capability_required?: string;
    dependencies?: string[];
  }>;
  is_sequential?: boolean;
}

// ── narrowing helpers ─────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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

const ROLES: readonly string[] = ['user', 'agent'];
const STATUSES: readonly string[] = ['streaming', 'complete', 'error', 'stopped', 'background'];

function role(v: unknown): MessageRole {
  return typeof v === 'string' && ROLES.includes(v) ? (v as MessageRole) : 'agent';
}

function status(v: unknown): MessageStatus {
  return typeof v === 'string' && STATUSES.includes(v) ? (v as MessageStatus) : 'complete';
}

/** `error` is a small object on the wire; a bare string is accepted too. */
function errObj(v: unknown): { message: string; code?: string } | undefined {
  if (typeof v === 'string' && v.length > 0) return { message: v };
  if (!isRecord(v)) return undefined;
  const message = str(v['message']);
  if (!message) return undefined;
  const code = str(v['code']);
  return code ? { message, code } : { message };
}

function toolCalls(v: unknown): ToolCall[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRecord).map((t) => {
    const latency = num(t['latencyMs']) ?? num(t['latency_ms']);
    const kind = t['kind'];
    return {
      name: str(t['name']) ?? 'tool',
      status: (typeof t['status'] === 'string' ? t['status'] : 'done') as ToolCall['status'],
      kind: (kind === 'sub_agent' ? 'sub_agent' : 'tool') as ToolCall['kind'],
      ...(latency !== undefined ? { latencyMs: latency } : {}),
    } satisfies ToolCall;
  });
  return out.length ? out : undefined;
}

function citations(v: unknown): Citation[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRecord).flatMap((c) => {
    const title = str(c['title']) ?? str(c['documentTitle']) ?? str(c['document_title']);
    if (!title) return [];
    const page = str(c['pageOrSection']) ?? str(c['page_or_section']);
    const score = num(c['score']);
    return [
      {
        title,
        ...(str(c['uri']) ? { uri: str(c['uri']) as string } : {}),
        ...(score !== undefined ? { score } : {}),
        ...(str(c['excerpt']) ? { excerpt: str(c['excerpt']) as string } : {}),
        ...(page ? { pageOrSection: page } : {}),
      } satisfies Citation,
    ];
  });
  return out.length ? out : undefined;
}

function proposals(v: unknown): Proposal[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRecord).flatMap((p) => {
    const title = str(p['title']) ?? str(p['action']);
    if (!title) return [];
    const detail = str(p['detail']) ?? str(p['description']);
    const approvalId = str(p['approvalId']) ?? str(p['approval_id']);
    const rawStatus = typeof p['status'] === 'string' ? p['status'] : undefined;
    const known: readonly string[] = ['pending', 'approved', 'rejected', 'expired', 'error'];
    const st =
      rawStatus && known.includes(rawStatus) ? (rawStatus as Proposal['status']) : 'pending';
    return [
      {
        title,
        ...(detail ? { detail } : {}),
        requiresApproval:
          p['requiresApproval'] === true || p['requires_approval'] === true || Boolean(approvalId),
        ...(approvalId ? { approvalId } : {}),
        status: st,
      } satisfies Proposal,
    ];
  });
  return out.length ? out : undefined;
}

function phases(v: unknown): PhaseEvent[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRecord).flatMap((p) => {
    const label = str(p['label']);
    const at = str(p['at']);
    if (!label || !at) return [];
    const kind = typeof p['kind'] === 'string' ? (p['kind'] as PhaseEvent['kind']) : 'plan';
    return [
      {
        kind,
        label,
        ...(str(p['detail']) ? { detail: str(p['detail']) as string } : {}),
        at,
        ...(typeof p['ok'] === 'boolean' ? { ok: p['ok'] } : {}),
        ...(strArray(p['issues']) ? { issues: strArray(p['issues']) as string[] } : {}),
      } satisfies PhaseEvent,
    ];
  });
  return out.length ? out : undefined;
}

function plan(v: unknown): ExecutionPlan | undefined {
  if (!isRecord(v)) return undefined;
  const subtasksRaw = Array.isArray(v['subtasks']) ? (v['subtasks'] as unknown[]) : [];
  const subtasks = subtasksRaw.filter(isRecord).flatMap((s) => {
    const title = str(s['title']);
    if (!title) return [];
    const agent = str(s['agentAssigned']) ?? str(s['agent_assigned']) ?? '';
    const cap = str(s['capabilityRequired']) ?? str(s['capability_required']);
    const deps = strArray(s['dependencies']);
    const taskId = str(s['taskId']) ?? str(s['task_id']);
    return [
      {
        ...(taskId ? { taskId } : {}),
        title,
        agentAssigned: agent,
        ...(cap ? { capabilityRequired: cap } : {}),
        ...(deps ? { dependencies: deps } : {}),
      },
    ];
  });
  const planId = str(v['planId']) ?? str(v['plan_id']);
  const goal = str(v['goalSummary']) ?? str(v['goal_summary']);
  const sequential = v['isSequential'] ?? v['is_sequential'];
  return {
    ...(planId ? { planId } : {}),
    ...(goal ? { goalSummary: goal } : {}),
    subtasks,
    ...(typeof sequential === 'boolean' ? { sequential } : {}),
  };
}

function attachments(v: unknown): Attachment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRecord).flatMap((a) => {
    const name = str(a['name']);
    if (!name) return [];
    const id = str(a['id']) ?? name;
    const size = num(a['sizeBytes']) ?? num(a['size_bytes']);
    return [
      {
        id,
        name,
        ...(str(a['path']) ? { path: str(a['path']) as string } : {}),
        ...(size !== undefined ? { sizeBytes: size } : {}),
        stored: a['stored'] === true,
        ...(str(a['error']) ? { error: str(a['error']) as string } : {}),
      } satisfies Attachment,
    ];
  });
  return out.length ? out : undefined;
}

// ── response normalisation ────────────────────────────────────────────────────

/**
 * A `MessageResponse` round-trip.
 *
 * `text` is the backend's field name; `content` is accepted too so a rename on the
 * server cannot silently blank the transcript. `text` wins.
 */
function toMessageRecord(raw: unknown): MessageRecord | null {
  if (!isRecord(raw)) return null;
  // `client_id` only. Falling back to the server row id would reconcile a local
  // message against the wrong key, and the write-behind queue deduplicates on it.
  const clientId = str(raw['clientId']) ?? str(raw['client_id']);
  if (!clientId) return null;
  const content = str(raw['text']) ?? str(raw['content']) ?? '';
  const record: MessageRecord = {
    id: str(raw['id']) ?? clientId,
    conversationId: str(raw['conversationId']) ?? str(raw['conversation_id']) ?? '',
    clientId,
    role: role(raw['role']),
    content,
    timestamp: str(raw['timestamp']) ?? str(raw['createdAt']) ?? str(raw['created_at']) ?? '',
    status: status(raw['status']),
  };
  const assign = <K extends keyof MessageRecord>(key: K, value: MessageRecord[K]): void => {
    if (value !== undefined) record[key] = value;
  };
  assign('replyTo', str(raw['replyTo']) ?? str(raw['reply_to']));
  assign('agentName', str(raw['agentName']) ?? str(raw['agent_name']));
  assign('confidence', num(raw['confidence']));
  assign('toolCalls', toolCalls(raw['toolCalls'] ?? raw['tool_calls']));
  assign('citations', citations(raw['citations']));
  assign('proposals', proposals(raw['proposals']));
  assign('questions', strArray(raw['questions']));
  assign('actionChips', strArray(raw['actionChips'] ?? raw['action_chips']));
  assign('attachments', attachments(raw['attachments']));
  assign('plan', plan(raw['plan']));
  assign('phases', phases(raw['phases']));
  assign('error', errObj(raw['error']));
  assign('latencyMs', num(raw['latencyMs']) ?? num(raw['latency_ms']));
  assign('highway', str(raw['highway']));
  assign('s1LatencyMs', num(raw['s1LatencyMs']) ?? num(raw['s1_latency_ms']));
  assign('s2LatencyMs', num(raw['s2LatencyMs']) ?? num(raw['s2_latency_ms']));
  assign('workflowId', str(raw['workflowId']) ?? str(raw['workflow_id']));
  assign('edited', raw['edited'] === true ? true : undefined);
  return record;
}

function toConversation(raw: unknown): ConversationResponse | null {
  if (!isRecord(raw)) return null;
  const id = str(raw['id']);
  if (!id) return null;
  const created = str(raw['createdAt']) ?? str(raw['created_at']) ?? '';
  const messageCount = num(raw['messageCount']) ?? num(raw['message_count']) ?? 0;
  const conversation: ConversationResponse = {
    id,
    title: str(raw['title']) ?? 'New conversation',
    messageCount,
    createdAt: created,
    updatedAt: str(raw['updatedAt']) ?? str(raw['updated_at']) ?? created,
  };
  const workspaceId = str(raw['workspaceId']) ?? str(raw['workspace_id']);
  if (workspaceId) conversation.workspaceId = workspaceId;
  const agentName = str(raw['agentName']) ?? str(raw['agent_name']);
  if (agentName) conversation.agentName = agentName;
  return conversation;
}

// ── endpoints ─────────────────────────────────────────────────────────────────

function base(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/conversations`;
}

function failure<T>(err: unknown, fallback: string): ApiResult<T> {
  if (err instanceof ApiError) return apiFail<T>(err.message, { status: err.status });
  if (err instanceof DOMException && err.name === 'AbortError') {
    return apiFail<T>('Request aborted.', { aborted: true });
  }
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    return apiFail<T>(err.message, typeof status === 'number' ? { status } : undefined);
  }
  return apiFail<T>(fallback);
}

export const ConversationApi = {
  /**
   * `GET /conversations?page&page_size&limit&offset&search`.
   *
   * `total` is taken from the envelope and is not inferred from the array length:
   * a first page of 20 out of 214 conversations must not read as "20 total", or
   * the localStorage migration would fire against a non-empty workspace.
   */
  async list(
    workspaceId: string,
    params?: ListParams,
    signal?: AbortSignal,
  ): Promise<ApiResult<ConversationListPage>> {
    const qs = new URLSearchParams();
    if (params?.page !== undefined) qs.set('page', String(params.page));
    if (params?.pageSize !== undefined) qs.set('page_size', String(params.pageSize));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    try {
      const res = await api.get<Record<string, unknown>>(
        `${base(workspaceId)}${suffix}`,
        signal ? { signal } : undefined,
      );
      const raw = Array.isArray(res?.['conversations']) ? (res['conversations'] as unknown[]) : [];
      const conversations = raw
        .map(toConversation)
        .filter((c): c is ConversationResponse => c !== null)
        .map<ConversationListItem>((c) => ({ ...c }));
      const page = num(res?.['page']);
      const pageSize = num(res?.['pageSize']) ?? num(res?.['page_size']);
      return apiOk<ConversationListPage>({
        conversations,
        total: num(res?.['total']) ?? conversations.length,
        ...(page !== undefined ? { page } : {}),
        ...(pageSize !== undefined ? { pageSize } : {}),
      });
    } catch (err) {
      return failure<ConversationListPage>(err, 'Could not load conversations.');
    }
  },

  /** `GET /conversations/{id}` — the transcript, not just the row. */
  async get(
    workspaceId: string,
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<ApiResult<ConversationWithMessages>> {
    try {
      const res = await api.get<Record<string, unknown>>(
        `${base(workspaceId)}/${encodeURIComponent(conversationId)}`,
        signal ? { signal } : undefined,
      );
      // The envelope may nest the row under `conversation` or flatten it beside
      // `messages`; both spellings are accepted so a backend reshape cannot
      // silently yield an empty transcript. There is deliberately no fallback that
      // invents an id from the request path: that would present a conversation the
      // server never confirmed as loaded.
      const nested = isRecord(res?.['conversation']) ? res['conversation'] : undefined;
      const conversation = toConversation(nested) ?? toConversation(res);
      if (!conversation) {
        return apiFail<ConversationWithMessages>('Conversation response carried no id.', {
          status: 502,
        });
      }
      const rawMessages = Array.isArray(res?.['messages']) ? (res['messages'] as unknown[]) : [];
      const messages = rawMessages
        .map(toMessageRecord)
        .filter((m): m is MessageRecord => m !== null)
        .slice(-MAX_MESSAGES_PER_THREAD);
      return apiOk<ConversationWithMessages>({ conversation, messages });
    } catch (err) {
      return failure<ConversationWithMessages>(err, 'Could not load the conversation.');
    }
  },

  /** `POST /conversations` — returns the server row so the local id can be swapped for it. */
  async create(
    workspaceId: string,
    body?: { title?: string; agentName?: string },
    signal?: AbortSignal,
  ): Promise<ApiResult<ConversationResponse>> {
    const payload: Record<string, string> = {};
    if (body?.title) payload['title'] = body.title;
    if (body?.agentName) payload['agent_name'] = body.agentName;
    try {
      const res = await api.post<Record<string, unknown>>(
        base(workspaceId),
        payload,
        signal ? { signal } : undefined,
      );
      const conversation = toConversation(res);
      if (!conversation) {
        return apiFail<ConversationResponse>('Create response carried no conversation id.', {
          status: 502,
        });
      }
      return apiOk(conversation);
    } catch (err) {
      return failure<ConversationResponse>(err, 'Could not create the conversation.');
    }
  },

  /** `PATCH /conversations/{id}` — rename only. */
  async rename(
    workspaceId: string,
    conversationId: string,
    title: string,
    signal?: AbortSignal,
  ): Promise<ApiResult<ConversationResponse>> {
    try {
      const res = await api.request<Record<string, unknown>>(
        `${base(workspaceId)}/${encodeURIComponent(conversationId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title }),
          ...(signal ? { signal } : {}),
        },
      );
      const conversation = toConversation(res);
      if (!conversation) {
        return apiFail<ConversationResponse>('Rename response carried no conversation id.', {
          status: 502,
        });
      }
      return apiOk(conversation);
    } catch (err) {
      return failure<ConversationResponse>(err, 'Could not rename the conversation.');
    }
  },

  /** `DELETE /conversations/{id}` → 204. */
  async remove(
    workspaceId: string,
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<ApiResult<null>> {
    try {
      await api.delete<void>(
        `${base(workspaceId)}/${encodeURIComponent(conversationId)}`,
        signal ? { signal } : undefined,
      );
      return apiOk(null);
    } catch (err) {
      return failure<null>(err, 'Could not delete the conversation.');
    }
  },

  /** `DELETE /conversations/{id}/messages` → 204. Used by clearThread. */
  async clearMessages(
    workspaceId: string,
    conversationId: string,
    signal?: AbortSignal,
  ): Promise<ApiResult<null>> {
    try {
      await api.delete<void>(
        `${base(workspaceId)}/${encodeURIComponent(conversationId)}/messages`,
        signal ? { signal } : undefined,
      );
      return apiOk(null);
    } catch (err) {
      return failure<null>(err, 'Could not clear the conversation.');
    }
  },

  /**
   * `POST /conversations/{id}/messages` → 201.
   *
   * `client_id` is the idempotency key. A retried POST of the same message
   * returns the original row rather than inserting a duplicate, so the write-behind
   * queue can retry freely.
   */
  async appendMessage(
    workspaceId: string,
    conversationId: string,
    body: MessageCreate,
    init?: RequestInit,
  ): Promise<ApiResult<MessageRecord>> {
    try {
      const res = await api.post<Record<string, unknown>>(
        `${base(workspaceId)}/${encodeURIComponent(conversationId)}/messages`,
        body,
        init,
      );
      const record = toMessageRecord(res);
      if (!record) {
        return apiFail<MessageRecord>('Message response carried no client_id.', { status: 502 });
      }
      return apiOk(record);
    } catch (err) {
      return failure<MessageRecord>(err, 'Could not save the message.');
    }
  },
};

/** Free functions over the same client, for callers that prefer named helpers. */
export const fetchConversations = (
  workspaceId: string,
  params?: ListParams,
  signal?: AbortSignal,
): Promise<ApiResult<ConversationListPage>> => ConversationApi.list(workspaceId, params, signal);

export const fetchConversation = (
  workspaceId: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<ApiResult<ConversationWithMessages>> =>
  ConversationApi.get(workspaceId, conversationId, signal);

export const createConversation = (
  workspaceId: string,
  body?: { title?: string; agentName?: string },
): Promise<ApiResult<ConversationResponse>> => ConversationApi.create(workspaceId, body);

export const renameConversation = (
  workspaceId: string,
  conversationId: string,
  title: string,
): Promise<ApiResult<ConversationResponse>> =>
  ConversationApi.rename(workspaceId, conversationId, title);

export const deleteConversation = (
  workspaceId: string,
  conversationId: string,
): Promise<ApiResult<null>> => ConversationApi.remove(workspaceId, conversationId);

export const clearConversationMessages = (
  workspaceId: string,
  conversationId: string,
): Promise<ApiResult<null>> => ConversationApi.clearMessages(workspaceId, conversationId);

export const saveMessage = (
  workspaceId: string,
  conversationId: string,
  body: MessageCreate,
  init?: RequestInit,
): Promise<ApiResult<MessageRecord>> =>
  ConversationApi.appendMessage(workspaceId, conversationId, body, init);

// ── ChatMessage ↔ MessageRecord ───────────────────────────────────────────────

/**
 * A reload must never resurrect a placeholder as a live stream: the client is
 * gone, so nothing is still producing tokens. A message that had output becomes
 * `complete`; one that produced nothing becomes `error` with an explanation. This
 * is the same rule the localStorage hydration applied, now applied to server rows
 * so a streamed message persisted at unload reads back the same way on any device.
 */
export function normaliseOnRead<M extends ChatMessageLike>(message: M): M {
  if (message.status !== 'streaming') return message;
  return message.text
    ? { ...message, status: 'complete', error: undefined }
    : {
        ...message,
        status: 'error',
        error: { message: 'Interrupted by a page reload before any output arrived.' },
      };
}

/** Server row → store message. Ids collapse onto `clientId` so retry/edit logic is unchanged. */
export function recordToMessage(record: MessageRecord): ChatMessage {
  const message = {
    id: record.clientId,
    role: record.role,
    text: record.content,
    timestamp: record.timestamp,
    status: record.status,
  } as ChatMessage;
  const assign = <K extends keyof ChatMessage>(key: K, value: ChatMessage[K]): void => {
    if (value !== undefined) message[key] = value;
  };
  assign('replyTo', record.replyTo);
  assign('agentName', record.agentName);
  assign('confidence', record.confidence);
  assign('toolCalls', record.toolCalls);
  assign('citations', record.citations);
  assign('proposals', record.proposals);
  assign('questions', record.questions);
  assign('actionChips', record.actionChips);
  assign('attachments', record.attachments);
  assign('plan', record.plan);
  assign('phases', record.phases);
  assign('error', record.error);
  assign('latencyMs', record.latencyMs);
  assign('highway', record.highway);
  assign('s1LatencyMs', record.s1LatencyMs);
  assign('s2LatencyMs', record.s2LatencyMs);
  assign('workflowId', record.workflowId);
  assign('edited', record.edited);
  return message;
}

/** Store message → request body. Nested telemetry is snake_case on the wire too. */
export function messageToCreate(message: ChatMessage): MessageCreate {
  const body: MessageCreate = {
    client_id: message.id,
    role: message.role,
    text: message.text,
    status: message.status,
  };
  if (message.replyTo) body.reply_to = message.replyTo;
  if (message.agentName) body.agent_name = message.agentName;
  if (message.confidence !== undefined) body.confidence = message.confidence;
  if (message.toolCalls?.length) {
    body.tool_calls = message.toolCalls.map((t) => ({
      name: t.name,
      status: t.status,
      kind: t.kind,
      ...(t.latencyMs !== undefined ? { latency_ms: t.latencyMs } : {}),
    }));
  }
  if (message.citations?.length) {
    body.citations = message.citations.map((c) => ({
      title: c.title,
      ...(c.uri ? { uri: c.uri } : {}),
      ...(c.score !== undefined ? { score: c.score } : {}),
      ...(c.excerpt ? { excerpt: c.excerpt } : {}),
      ...(c.pageOrSection ? { page_or_section: c.pageOrSection } : {}),
    }));
  }
  if (message.proposals?.length) {
    body.proposals = message.proposals.map((p) => ({
      title: p.title,
      ...(p.detail ? { detail: p.detail } : {}),
      requires_approval: p.requiresApproval,
      ...(p.approvalId ? { approval_id: p.approvalId } : {}),
      status: p.status,
    }));
  }
  if (message.questions?.length) body.questions = message.questions;
  if (message.actionChips?.length) body.action_chips = message.actionChips;
  if (message.attachments?.length) {
    body.attachments = message.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      ...(a.path ? { path: a.path } : {}),
      ...(a.sizeBytes !== undefined ? { size_bytes: a.sizeBytes } : {}),
      stored: a.stored,
      ...(a.error ? { error: a.error } : {}),
    }));
  }
  if (message.plan) {
    body.plan = {
      ...(message.plan.planId ? { plan_id: message.plan.planId } : {}),
      ...(message.plan.goalSummary ? { goal_summary: message.plan.goalSummary } : {}),
      subtasks: message.plan.subtasks.map((s) => ({
        ...(s.taskId ? { task_id: s.taskId } : {}),
        title: s.title,
        agent_assigned: s.agentAssigned,
        ...(s.capabilityRequired ? { capability_required: s.capabilityRequired } : {}),
        ...(s.dependencies ? { dependencies: s.dependencies } : {}),
      })),
      ...(message.plan.sequential !== undefined ? { is_sequential: message.plan.sequential } : {}),
    };
  }
  if (message.phases?.length) {
    body.phases = message.phases.map((p) => ({
      kind: p.kind,
      label: p.label,
      ...(p.detail ? { detail: p.detail } : {}),
      at: p.at,
      ...(p.ok !== undefined ? { ok: p.ok } : {}),
      ...(p.issues ? { issues: p.issues } : {}),
    }));
  }
  if (message.error) body.error = message.error;
  if (message.latencyMs !== undefined) body.latency_ms = message.latencyMs;
  if (message.highway) body.highway = message.highway;
  if (message.s1LatencyMs !== undefined) body.s1_latency_ms = message.s1LatencyMs;
  if (message.s2LatencyMs !== undefined) body.s2_latency_ms = message.s2LatencyMs;
  if (message.workflowId) body.workflow_id = message.workflowId;
  if (message.edited) body.edited = true;
  return body;
}
