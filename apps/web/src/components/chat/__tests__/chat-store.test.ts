import { createElement } from 'react';
import { renderHook, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { parseBufferedResponse, readPendingQueue, useChatStore } from '../chat-store';
import { agentApi, approvalApi, documentApi, temporalApi } from '@/lib/api-client';
import { ConversationApi, type MessageCreate, type MessageRecord } from '../conversation-api';
import {
  DURABLE_MAX_POLLS,
  DURABLE_POLL_INTERVAL_MS,
  type ChatMessage,
  type Proposal,
  type Thread,
} from '../types';

/**
 * The store is where every "the network lied to us" bug in this UI lived:
 * a retry button that resent the wrong question, a Stop button that did nothing in
 * durable mode, a Durable checkbox that silently unticked itself, an optimistic
 * placeholder carrying a fabricated 98% confidence and a fake running tool, and a
 * transcript that lived only in `localStorage` until now.
 *
 * The transcript is now server-backed, so `ConversationApi` is replaced by an
 * in-memory fake with the same idempotency guarantee the real endpoint promises:
 * a repeated `client_id` returns the original row instead of inserting a second
 * one. Every other module boundary is mocked too, so each test drives the real
 * reducer and send pipeline with a scripted transport and asserts on what the user
 * would actually see.
 *
 * Broad status checks (`in (200, 401, 403)`) are not used anywhere here: the point
 * is that `status: 'stopped'` is `stopped`, and that a write the server refused is
 * reported as unsynced rather than displayed as saved.
 */

const toastMock = jest.fn();

jest.mock('@/lib/api-client', () => ({
  agentApi: { chatStream: jest.fn(), chat: jest.fn() },
  agentCatalogApi: { get: jest.fn() },
  approvalApi: { approve: jest.fn(), reject: jest.fn() },
  documentApi: { upload: jest.fn() },
  temporalApi: { startDurableAgent: jest.fn(), getStatus: jest.fn(), cancel: jest.fn() },
}));

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

jest.mock('../chat-api', () => ({
  fetchSlashCommands: jest.fn(() => Promise.resolve({ commands: [], state: 'ready' })),
  fetchAgentCatalog: jest.fn(() => Promise.resolve({ agents: [], state: 'ready' })),
}));

// The pure helpers are real — they are the wire↔store mapping under test. Only the
// transport is faked.
jest.mock('../conversation-api', () => ({
  ...jest.requireActual('../conversation-api'),
  ConversationApi: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
    clearMessages: jest.fn(),
    appendMessage: jest.fn(),
  },
}));

const chatStream = agentApi.chatStream as unknown as jest.Mock;
const chat = agentApi.chat as unknown as jest.Mock;
const approve = approvalApi.approve as unknown as jest.Mock;
const rejectApproval = approvalApi.reject as unknown as jest.Mock;
const startDurableAgent = temporalApi.startDurableAgent as unknown as jest.Mock;
const getStatus = temporalApi.getStatus as unknown as jest.Mock;
const cancelWorkflow = temporalApi.cancel as unknown as jest.Mock;
const uploadDocument = documentApi.upload as unknown as jest.Mock;

const convList = ConversationApi.list as unknown as jest.Mock;
const convGet = ConversationApi.get as unknown as jest.Mock;
const convCreate = ConversationApi.create as unknown as jest.Mock;
const convRename = ConversationApi.rename as unknown as jest.Mock;
const convRemove = ConversationApi.remove as unknown as jest.Mock;
const convClear = ConversationApi.clearMessages as unknown as jest.Mock;
const convAppend = ConversationApi.appendMessage as unknown as jest.Mock;

const WORKSPACE = 'ws-1';
const STORAGE_KEY = `vaeloom.threads.${WORKSPACE}`;
const MIGRATED_KEY = `vaeloom.chat.migrated.${WORKSPACE}`;
const PENDING_KEY = `vaeloom.chat.pending.${WORKSPACE}`;

// ── the fake server ───────────────────────────────────────────────────────────

interface StoredConversation {
  id: string;
  workspaceId: string;
  title: string;
  agentName?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages: MessageRecord[];
}

/** Keyed by server conversation id, in insertion order (newest last). */
let server: Map<string, StoredConversation>;
let createCount: number;

function recordFor(conversationId: string, m: ChatMessage): MessageRecord {
  const record: MessageRecord = {
    id: `row_${m.id}`,
    conversationId,
    clientId: m.id,
    role: m.role,
    content: m.text,
    timestamp: m.timestamp,
    status: m.status,
  };
  if (m.replyTo) record.replyTo = m.replyTo;
  if (m.agentName) record.agentName = m.agentName;
  if (m.confidence !== undefined) record.confidence = m.confidence;
  if (m.toolCalls) record.toolCalls = m.toolCalls;
  if (m.citations) record.citations = m.citations;
  if (m.proposals) record.proposals = m.proposals;
  if (m.actionChips) record.actionChips = m.actionChips;
  if (m.latencyMs !== undefined) record.latencyMs = m.latencyMs;
  if (m.workflowId) record.workflowId = m.workflowId;
  if (m.error) record.error = m.error;
  return record;
}

function recordFromCreate(conversationId: string, body: MessageCreate): MessageRecord {
  return {
    id: `row_${body.client_id}`,
    conversationId,
    clientId: body.client_id,
    role: body.role,
    content: body.text,
    timestamp: body.created_at ?? '2026-01-01T00:00:00.000Z',
    status: body.status,
    ...(body.reply_to ? { replyTo: body.reply_to } : {}),
    ...(body.agent_name ? { agentName: body.agent_name } : {}),
    ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
    ...(body.tool_calls
      ? {
          toolCalls: body.tool_calls.map((t) => ({
            name: t.name,
            status: t.status,
            kind: t.kind,
            ...(t.latency_ms !== undefined ? { latencyMs: t.latency_ms } : {}),
          })),
        }
      : {}),
    ...(body.latency_ms !== undefined ? { latencyMs: body.latency_ms } : {}),
    ...(body.workflow_id ? { workflowId: body.workflow_id } : {}),
    ...(body.error ? { error: body.error } : {}),
  };
}

function row(c: StoredConversation) {
  const { messages: _messages, ...rest } = c;
  return rest;
}

/** The real endpoints' behaviour, including the `client_id` idempotency guarantee. */
function installFakeServer(): void {
  convList.mockImplementation(async () => {
    const conversations = [...server.values()].reverse().map(row);
    return { ok: true, data: { conversations, total: conversations.length } };
  });
  convGet.mockImplementation(async (_ws: string, id: string) => {
    const found = server.get(id);
    if (!found) return { ok: false as const, error: 'not found', status: 404 };
    return {
      ok: true as const,
      data: { conversation: row(found), messages: found.messages.map((m) => ({ ...m })) },
    };
  });
  convCreate.mockImplementation(
    async (_ws: string, body?: { title?: string; agentName?: string }) => {
      createCount += 1;
      const id = `cv-created-${createCount}`;
      const now = '2026-01-01T00:00:00.000Z';
      server.set(id, {
        id,
        workspaceId: WORKSPACE,
        title: body?.title ?? 'New conversation',
        ...(body?.agentName ? { agentName: body.agentName } : {}),
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
        messages: [],
      });
      return { ok: true as const, data: row(server.get(id) as StoredConversation) };
    },
  );
  convAppend.mockImplementation(
    async (_ws: string, conversationId: string, body: MessageCreate) => {
      const found = server.get(conversationId);
      if (!found) return { ok: false as const, error: 'no such conversation', status: 404 };
      // Idempotency: a retried POST returns the original row, never a duplicate.
      const existing = found.messages.find((m) => m.clientId === body.client_id);
      if (existing) return { ok: true as const, data: { ...existing } };
      const record = recordFromCreate(conversationId, body);
      found.messages.push(record);
      found.messageCount = found.messages.length;
      return { ok: true as const, data: { ...record } };
    },
  );
  convRename.mockImplementation(async (_ws: string, id: string, title: string) => {
    const found = server.get(id);
    if (!found) return { ok: false as const, error: 'not found', status: 404 };
    found.title = title;
    return { ok: true as const, data: row(found) };
  });
  convRemove.mockImplementation(async (_ws: string, id: string) => {
    server.delete(id);
    return { ok: true as const, data: null };
  });
  convClear.mockImplementation(async (_ws: string, id: string) => {
    const found = server.get(id);
    if (!found) return { ok: false as const, error: 'not found', status: 404 };
    found.messages = [];
    found.messageCount = 0;
    return { ok: true as const, data: null };
  });
}

/** Seed server-side history, the way a real workspace that already has rows looks. */
function seedThread(messages: ChatMessage[], id = 'cv-seed'): Thread {
  const stored: StoredConversation = {
    id,
    workspaceId: WORKSPACE,
    title: 'Seeded',
    messageCount: messages.length,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: messages.map((m) => recordFor(id, m)),
  };
  server.set(id, stored);
  return {
    id,
    title: 'Seeded',
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    messages,
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function msg(overrides: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role'>): ChatMessage {
  return {
    text: '',
    timestamp: '2026-01-01T00:00:00.000Z',
    status: 'complete',
    ...overrides,
  };
}

function byId(messages: ChatMessage[], id: string): ChatMessage {
  const found = messages.find((m) => m.id === id);
  if (!found)
    throw new Error(`expected a message with id "${id}", got ${messages.map((m) => m.id)}`);
  return found;
}

function lastAgent(messages: ChatMessage[]): ChatMessage {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.role === 'agent') return m;
  }
  throw new Error('expected at least one agent message');
}

function proposalAt(messages: ChatMessage[], messageId: string, index: number): Proposal {
  const found = byId(messages, messageId).proposals?.[index];
  if (!found) throw new Error(`expected a proposal at ${messageId}[${index}]`);
  return found;
}

/**
 * Mount the hook and let the list load, transcript read and catalog effects settle.
 *
 * SWR keeps a module-level cache, so without a private provider every test after the
 * first would be served the previous test's conversation list and the fetcher would
 * never run. `createElement` rather than JSX because this file is `.ts`.
 */
async function renderStore(workspaceId = WORKSPACE) {
  const view = renderHook(() => useChatStore(workspaceId), {
    wrapper: ({ children }: { children?: React.ReactNode }) =>
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        children,
      ),
  });
  for (let i = 0; i < 8; i += 1) {
    // Microtasks only, so this works identically under real and fake timers.
    await act(async () => {
      await Promise.resolve();
    });
  }
  return view;
}

/**
 * Let the debounced write-behind flush run. Real timers only — a test that needs the
 * fake clock drives `advanceTimersByTimeAsync` itself.
 */
async function settleFlush(ms = 500) {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** A durable run that starts, registers its workflow id, then stalls mid-poll. */
function stallDurableRun(workflowId: string): Deferred<Record<string, unknown>> {
  startDurableAgent.mockResolvedValue({ workflow_id: workflowId, status: 'started' });
  const gate = deferred<Record<string, unknown>>();
  getStatus.mockReturnValue(gate.promise);
  return gate;
}

function terminalPoll(): Record<string, unknown> {
  return { status: 'completed', query: { result: 'finished' } };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('parseBufferedResponse', () => {
  it('reads the text out of result.summary', () => {
    expect(parseBufferedResponse({ result: { summary: 'hi' } }).text).toBe('hi');
  });

  it('falls back to reply when there is no result envelope', () => {
    expect(parseBufferedResponse({ reply: 'yo' }).text).toBe('yo');
  });

  it('falls back to a top-level summary when neither result nor reply is present', () => {
    expect(parseBufferedResponse({ summary: 's' }).text).toBe('s');
  });

  it('accepts a bare string body', () => {
    const acc = parseBufferedResponse('just text');
    expect(acc.text).toBe('just text');
    expect(acc.terminal).toBe('done');
  });

  it('marks a non-empty buffered answer as already streamed, so no retry is attempted', () => {
    expect(parseBufferedResponse({ reply: 'yo' }).sawToken).toBe(true);
    expect(parseBufferedResponse({}).sawToken).toBe(false);
  });

  it('extracts proposals, pending when an approval id is present and expired when it is not', () => {
    const acc = parseBufferedResponse({
      result: {
        proposals: [
          {
            title: 'Send resume',
            detail: 'draft ready',
            approval_id: 'ap-1',
            requires_approval: true,
          },
          { action: 'Delete old memories' },
        ],
      },
    });

    expect(acc.proposals).toEqual([
      {
        title: 'Send resume',
        detail: 'draft ready',
        requiresApproval: true,
        approvalId: 'ap-1',
        status: 'pending',
      },
      {
        title: 'Delete old memories',
        detail: undefined,
        requiresApproval: false,
        approvalId: undefined,
        status: 'expired',
      },
    ]);
  });

  it('reads real tool calls with status done and the backend duration when there is one', () => {
    const acc = parseBufferedResponse({
      result: {
        details: {
          tool_calls: [
            { name: 'search_jobs', latency_ms: 88 },
            { tool: 'verify_application_link' },
          ],
        },
      },
    });

    expect(acc.toolCalls).toEqual([
      { name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 },
      // No duration reported means no duration claimed. The old durable fallback
      // filled a dummy tool in instead.
      { name: 'verify_application_link', status: 'done', kind: 'tool' },
    ]);
    expect(acc.toolCalls[1]).not.toHaveProperty('latencyMs');
  });

  it('extracts citations, taking the title from document_title', () => {
    const acc = parseBufferedResponse({
      result: {
        details: {
          citations: [
            {
              document_title: 'Resume v3',
              uri: 's3://resume.pdf',
              page_or_section: 'p1',
              excerpt: '…',
            },
          ],
        },
      },
    });

    expect(acc.citations).toEqual([
      { title: 'Resume v3', uri: 's3://resume.pdf', pageOrSection: 'p1', excerpt: '…' },
    ]);
  });

  it('extracts action chips from either spelling', () => {
    expect(parseBufferedResponse({ result: { action_chips: ['a', 'b'] } }).actionChips).toEqual([
      'a',
      'b',
    ]);
    expect(parseBufferedResponse({ result: { actionChips: ['c'] } }).actionChips).toEqual(['c']);
  });

  it('extracts clarification questions', () => {
    const acc = parseBufferedResponse({ result: { summary: 'x', questions: ['Which one?'] } });
    expect(acc.questions).toEqual(['Which one?']);
  });

  it('does not synthesise a confidence when the response carries none', () => {
    const acc = parseBufferedResponse({ result: { summary: 'hi' } });

    expect(acc.confidence).toBeUndefined();
    expect(acc).not.toHaveProperty('confidence');
  });

  it('adopts a reported confidence verbatim', () => {
    expect(parseBufferedResponse({ result: { summary: 'x' }, confidence: 0.61 }).confidence).toBe(
      0.61,
    );
  });

  it('extracts s1_ms, s2_ms and the highway from telemetry', () => {
    const acc = parseBufferedResponse({
      result: { summary: 'x' },
      telemetry: { s1_ms: 14, s2_ms: 2200, highway: 'green' },
    });

    expect(acc.s1LatencyMs).toBe(14);
    expect(acc.s2LatencyMs).toBe(2200);
    expect(acc.highway).toBe('green');
  });

  it('leaves telemetry absent rather than zero-filled', () => {
    const acc = parseBufferedResponse({ result: { summary: 'x' } });

    expect(acc.s1LatencyMs).toBeUndefined();
    expect(acc.s2LatencyMs).toBeUndefined();
    expect(acc.highway).toBeUndefined();
  });

  it('reports a terminal of done, since a buffered response is by definition finished', () => {
    expect(parseBufferedResponse({ reply: 'yo' }).terminal).toBe('done');
  });
});

describe('useChatStore', () => {
  beforeEach(() => {
    // `resetAllMocks`, not `clearAllMocks`: a queued `mockRejectedValueOnce` from an
    // earlier test would otherwise leak into this one and look like a store defect.
    jest.resetAllMocks();
    jest.useRealTimers();
    localStorage.clear();
    server = new Map();
    createCount = 0;
    installFakeServer();

    const chatApi = jest.requireMock('../chat-api') as {
      fetchSlashCommands: jest.Mock;
      fetchAgentCatalog: jest.Mock;
    };
    chatApi.fetchSlashCommands.mockImplementation(() =>
      Promise.resolve({ commands: [], state: 'ready' }),
    );
    chatApi.fetchAgentCatalog.mockImplementation(() =>
      Promise.resolve({ agents: [], state: 'ready' }),
    );

    chatStream.mockResolvedValue(undefined);
    chat.mockResolvedValue({ reply: 'buffered answer' });
    cancelWorkflow.mockResolvedValue({});
    approve.mockResolvedValue({ status: 'approved' });
    rejectApproval.mockResolvedValue({ status: 'rejected' });
    startDurableAgent.mockResolvedValue({ workflow_id: 'wf-default', status: 'started' });
    uploadDocument.mockResolvedValue({ path: 's3://ws/default/file.pdf' });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  describe('the server is the source of truth', () => {
    it('loads threads from the API, not from localStorage', async () => {
      // The old store read `vaeloom.threads.<ws>` on mount. A transcript parked in
      // localStorage by an older build is now migrated, never read back as truth.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: 'th-local',
            title: 'From localStorage',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            messages: [msg({ id: 'local-u', role: 'user', text: 'old question' })],
          },
        ]),
      );
      seedThread([msg({ id: 'u1', role: 'user', text: 'from the server' })], 'cv-1');

      const { result } = await renderStore();

      expect(result.current.threads.map((t) => t.id)).toEqual(['cv-1']);
      expect(result.current.messages.map((m) => m.id)).toEqual(['u1']);
      expect(result.current.threads.some((t) => t.title === 'From localStorage')).toBe(false);
    });

    it('requests every call with the workspace in scope', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');
      await renderStore();

      expect(convList).toHaveBeenCalledWith(WORKSPACE, { pageSize: 20 });
      expect(convGet).toHaveBeenCalledWith(WORKSPACE, 'cv-1');
    });

    it('reports an error rather than pretending the workspace has no history', async () => {
      convList.mockRejectedValue(new Error('502 Bad Gateway'));

      const { result } = await renderStore();

      expect(result.current.conversationsState).toBe('error');
      expect(result.current.conversationsError).toBe('502 Bad Gateway');
      expect(result.current.persistenceError).toContain('could not be read from the server');
    });

    it('does not migrate over real server history when the list fails', async () => {
      // A failed list reports zero conversations. Migrating then would upload the
      // local transcript on top of history the server already has.
      convList.mockRejectedValue(new Error('502'));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: 'th-local',
            title: 'Legacy',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            messages: [msg({ id: 'local-u', role: 'user', text: 'old question' })],
          },
        ]),
      );

      const { result } = await renderStore();

      expect(convCreate).not.toHaveBeenCalled();
      expect(result.current.threads).toEqual([]);
    });
  });

  describe('optimistic writes and reconciliation', () => {
    it('persists the user turn and the settled agent turn, then clears the outbox', async () => {
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('tailor my resume');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      expect(result.current.unsyncedCount).toBe(0);
      expect(result.current.persistenceError).toBeNull();

      const conversationId = result.current.activeId;
      expect(conversationId).not.toBeNull();
      const stored = server.get(conversationId as string);
      expect(stored?.messages.map((m) => m.clientId)).toEqual(
        result.current.messages.map((m) => m.id),
      );
      expect(stored?.messages[1]?.status).toBe('complete');
      expect(stored?.messages[1]?.content).toBe('buffered answer');
    });

    it('shows the message immediately, before the server has confirmed it', async () => {
      // The optimistic path is the reason the UI stays instant: a POST round trip
      // cannot gate a rendered message.
      let release!: () => void;
      convAppend.mockImplementation(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ok: true, data: { clientId: 'x', content: '' } });
          }),
      );
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hi');
      });
      await act(async () => {
        void result.current.send();
      });

      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
      expect(result.current.unsyncedCount).toBeGreaterThan(0);
      release?.();
    });

    it('replaces the optimistic message with the server row on reconcile', async () => {
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      const conversationId = result.current.activeId as string;
      const stored = server.get(conversationId);
      // The server is stamped with its own row id; the store keeps the client id so
      // retry/edit logic is unaffected.
      expect(stored?.messages[0]?.id).toBe(`row_${stored?.messages[0]?.clientId}`);
      expect(result.current.messages.map((m) => m.id)).toEqual(
        stored?.messages.map((m) => m.clientId),
      );
    });

    it('does not POST once per streamed token', async () => {
      chatStream.mockImplementation(
        async (_body: unknown, onEvent: (event: string, data: Record<string, unknown>) => void) => {
          for (let i = 1; i <= 12; i += 1) {
            onEvent('token', { text: `tok${i}` });
            await Promise.resolve();
          }
        },
      );
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('stream this');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      // Two POSTs: the user turn and the settled agent turn. Nothing in between.
      expect(convAppend).toHaveBeenCalledTimes(2);
      const bodies = convAppend.mock.calls.map((c) => c[2] as MessageCreate);
      expect(bodies.every((b) => b.status !== 'streaming')).toBe(true);
      expect(result.current.unsyncedCount).toBe(0);
    });

    it('does not duplicate a message when the same client_id is posted twice', async () => {
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      const conversationId = result.current.activeId as string;
      const before = server.get(conversationId)?.messages.length ?? 0;
      // Re-post every message with its original client_id, exactly as a retry of the
      // write-behind queue would.
      const bodies = convAppend.mock.calls.map((c) => c[2] as MessageCreate);
      for (const body of bodies) {
        const res = await convAppend(WORKSPACE, conversationId, body);
        expect(res.ok).toBe(true);
      }

      expect(server.get(conversationId)?.messages).toHaveLength(before);
    });

    it('renames optimistically and adopts the server title', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');
      const { result } = await renderStore();

      act(() => {
        result.current.renameThread('cv-1', 'Renamed');
      });
      expect(result.current.threads[0]?.title).toBe('Renamed');

      await settleFlush();
      expect(convRename).toHaveBeenCalledWith(WORKSPACE, 'cv-1', 'Renamed');
      expect(server.get('cv-1')?.title).toBe('Renamed');
    });

    it('rolls a failed rename back instead of leaving a title that was never saved', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');
      convRename.mockResolvedValue({ ok: false, error: '403 not permitted', status: 403 });

      const { result } = await renderStore();
      act(() => {
        result.current.renameThread('cv-1', 'Renamed');
      });
      expect(result.current.threads[0]?.title).toBe('Renamed');

      await settleFlush();
      expect(result.current.threads[0]?.title).toBe('Seeded');
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Rename failed' }),
      );
      expect(result.current.persistenceError).toContain('403 not permitted');
    });

    it('restores a conversation whose delete the server refused', async () => {
      seedThread([msg({ id: 'u2', role: 'user', text: 'other' })], 'cv-2');
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');
      convRemove.mockResolvedValue({ ok: false, error: '500 boom', status: 500 });

      const { result } = await renderStore();
      act(() => {
        result.current.deleteThread('cv-2');
      });
      expect(result.current.threads.some((t) => t.id === 'cv-2')).toBe(false);

      await settleFlush();
      // Back in its original position, not appended at the end.
      expect(result.current.threads.map((t) => t.id)).toEqual(['cv-1', 'cv-2']);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Delete failed' }),
      );
    });

    it('clears through the messages endpoint, not by truncating local state alone', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
        ],
        'cv-1',
      );
      const { result } = await renderStore();
      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearThread('cv-1');
      });
      await settleFlush();

      expect(convClear).toHaveBeenCalledWith(WORKSPACE, 'cv-1');
      expect(server.get('cv-1')?.messages).toEqual([]);
      expect(result.current.messages).toEqual([]);
    });

    it('creates the conversation row once, even when several messages are written', async () => {
      seedThread([], 'cv-1');
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('first');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();
      act(() => {
        result.current.setInput('second');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      // The seeded conversation already exists, so no extra create is issued.
      expect(convCreate).not.toHaveBeenCalled();
      expect(server.get('cv-1')?.messages).toHaveLength(4);
    });
  });

  describe('a failed write is surfaced, never silently dropped', () => {
    it('keeps the message in the outbox and counts it as unsynced', async () => {
      convAppend.mockResolvedValue({ ok: false, error: '503 storage unavailable', status: 503 });
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('do not lose me');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      // The message is still on screen — the write failed, the turn did not vanish.
      expect(result.current.messages.map((m) => m.text)).toContain('do not lose me');
      expect(result.current.unsyncedCount).toBe(2);
      expect(result.current.syncError).toContain('503 storage unavailable');
      expect(result.current.persistenceError).toContain('not confirmed by the server');
      expect(result.current.persistenceError).toContain('2 messages');
    });

    it('persists the outbox so an unsynced message survives a reload', async () => {
      convAppend.mockResolvedValue({ ok: false, error: 'offline', status: 0 });
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('survive me');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      const queue = readPendingQueue(WORKSPACE);
      expect(queue.length).toBe(2);
      expect(queue.map((q) => q.body.text)).toContain('survive me');
      expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
    });

    it('rehydrates the outbox on mount, so a closed tab does not lose the write', async () => {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify([
          {
            conversationId: 'cv-1',
            attempts: 2,
            body: {
              client_id: 'm-queued',
              role: 'user',
              content: 'queued earlier',
              status: 'complete',
            },
          },
        ]),
      );
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');

      const { result } = await renderStore();

      expect(result.current.unsyncedCount).toBe(1);
      expect(result.current.persistenceError).toContain('1 message is');
      await settleFlush();
      // The queue is drained once the server accepts it.
      expect(server.get('cv-1')?.messages.map((m) => m.clientId)).toContain('m-queued');
      expect(result.current.unsyncedCount).toBe(0);
    });

    it('clears the outbox once the server accepts the write', async () => {
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      expect(result.current.unsyncedCount).toBe(0);
      expect(localStorage.getItem(PENDING_KEY)).toBeNull();
      expect(result.current.persistenceError).toBeNull();
    });

    it('restores the transcript when the server refuses to clear it', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
        ],
        'cv-1',
      );
      convClear.mockResolvedValue({ ok: false, error: '500 boom', status: 500 });

      const { result } = await renderStore();
      act(() => {
        result.current.clearThread('cv-1');
      });
      await settleFlush();

      expect(result.current.messages.map((m) => m.id)).toEqual(['u1', 'a1']);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Clear failed' }),
      );
    });

    it('reports a failed conversation create instead of writing messages nowhere', async () => {
      convCreate.mockResolvedValue({ ok: false, error: '500 boom', status: 500 });
      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      expect(result.current.unsyncedCount).toBeGreaterThan(0);
      expect(result.current.syncError).toContain('500 boom');
    });
  });

  describe('offline', () => {
    it('says how many messages are unsynced and does not claim they were saved', async () => {
      const { result } = await renderStore();
      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        window.dispatchEvent(new Event('offline'));
      });

      act(() => {
        result.current.setInput('sent with no network');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();

      expect(result.current.isOffline).toBe(true);
      expect(convAppend).not.toHaveBeenCalled();
      expect(result.current.unsyncedCount).toBe(2);
      expect(result.current.persistenceError).toContain('Offline');
      expect(result.current.persistenceError).toContain('not yet sent to the server');
      expect(result.current.messages.map((m) => m.text)).toContain('sent with no network');
    });

    it('flushes the queue when the connection returns', async () => {
      const { result } = await renderStore();
      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        window.dispatchEvent(new Event('offline'));
      });
      act(() => {
        result.current.setInput('queued while offline');
      });
      await act(async () => {
        await result.current.send();
      });
      await settleFlush();
      const queued = result.current.unsyncedCount;
      expect(queued).toBeGreaterThan(0);

      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        window.dispatchEvent(new Event('online'));
      });
      await settleFlush();

      expect(convAppend).toHaveBeenCalled();
      expect(result.current.unsyncedCount).toBe(0);
      expect(result.current.persistenceError).toBeNull();
    });
  });

  describe('a message left streaming at unload', () => {
    it('is posted with status streaming and normalised when it is read back', async () => {
      // The tab goes away mid-run. What was true is "streaming", so that is what is
      // stored — and the read path turns it into complete/error, exactly as the old
      // localStorage hydration did. Claiming `complete` here would be a lie about a
      // run that never finished.
      chatStream.mockImplementation(() => new Promise<void>(() => undefined));
      seedThread([], 'cv-1');

      const { result } = await renderStore();
      act(() => {
        result.current.setInput('long run');
      });
      await act(async () => {
        void result.current.send();
      });
      const streamingId = lastAgent(result.current.messages).id;
      expect(lastAgent(result.current.messages).status).toBe('streaming');

      // jsdom does not set `visibilityState`, so it is defined explicitly here.
      await act(async () => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await settleFlush();

      const stored = server.get('cv-1')?.messages.find((m) => m.clientId === streamingId);
      expect(stored?.status).toBe('streaming');

      // A fresh session reads the same conversation and normalises it.
      const { result: second } = await renderStore();
      act(() => {
        second.current.selectThread('cv-1');
      });
      await settleFlush();
      expect(byId(second.current.messages, streamingId).status).toBe('error');
      expect(byId(second.current.messages, streamingId).error?.message).toContain(
        'Interrupted by a page reload',
      );
    });

    it('normalises a stored streaming message that had already produced output', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({
            id: 'a1',
            role: 'agent',
            text: 'partial answer',
            status: 'streaming',
            replyTo: 'u1',
          }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();

      const restored = byId(result.current.messages, 'a1');
      expect(restored.status).toBe('complete');
      expect(restored.text).toBe('partial answer');
      expect(restored.error).toBeUndefined();
    });

    it('normalises an empty stored streaming message as an error with an explanation', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: '', status: 'streaming', replyTo: 'u1' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();

      const restored = byId(result.current.messages, 'a1');
      expect(restored.status).toBe('error');
      expect(restored.error?.message).toContain('Interrupted by a page reload');
    });
  });

  describe('the one-time localStorage migration', () => {
    function seedLegacy(threads: Thread[]): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    }

    function legacyThread(id: string, messages: ChatMessage[]): Thread {
      return {
        id,
        title: `Legacy ${id}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        messages,
      };
    }

    it('uploads the existing history and clears the key only after it is confirmed', async () => {
      seedLegacy([
        legacyThread('th-1', [
          msg({ id: 'lu1', role: 'user', text: 'old q1' }),
          msg({ id: 'la1', role: 'agent', text: 'old a1', replyTo: 'lu1' }),
        ]),
        legacyThread('th-2', [msg({ id: 'lu2', role: 'user', text: 'old q2' })]),
      ]);

      const { result } = await renderStore();
      await settleFlush();

      expect(result.current.migration).toMatchObject({ state: 'done', uploaded: 3, total: 3 });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(MIGRATED_KEY)).not.toBeNull();

      const uploaded = [...server.values()];
      expect(uploaded).toHaveLength(2);
      expect(uploaded[0]?.messages.map((m) => m.content)).toEqual(['old q1', 'old a1']);
      expect(uploaded[1]?.messages.map((m) => m.content)).toEqual(['old q2']);
    });

    it('keeps the local message ids as client_ids, so a retry cannot duplicate', async () => {
      seedLegacy([legacyThread('th-1', [msg({ id: 'lu1', role: 'user', text: 'old q1' })])]);

      const { result } = await renderStore();
      await settleFlush();

      const bodies = convAppend.mock.calls.map((c) => c[2] as MessageCreate);
      expect(bodies.map((b) => b.client_id)).toEqual(['lu1']);
      // Re-post the same body: the fake enforces the same idempotency the backend does.
      const conversationId = [...server.keys()][0] as string;
      await convAppend(WORKSPACE, conversationId, bodies[0] as MessageCreate);
      expect(server.get(conversationId)?.messages).toHaveLength(1);
    });

    it('does not run twice, even on a later mount', async () => {
      seedLegacy([legacyThread('th-1', [msg({ id: 'lu1', role: 'user', text: 'old q1' })])]);

      const { result, unmount } = await renderStore();
      await settleFlush();
      const createsAfterFirst = convCreate.mock.calls.length;
      expect(createsAfterFirst).toBe(1);
      unmount();

      const second = await renderStore();
      await settleFlush();
      expect(convCreate.mock.calls.length).toBe(createsAfterFirst);
      expect(second.result.current.migration.state).not.toBe('running');
    });

    it('does nothing when there is no local history', async () => {
      const { result } = await renderStore();
      await settleFlush();

      expect(convCreate).not.toHaveBeenCalled();
      expect(result.current.migration).toEqual({ state: 'done', uploaded: 0, total: 0 });
    });

    it('does not migrate when the server already has conversations', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'real history' })], 'cv-1');
      seedLegacy([legacyThread('th-1', [msg({ id: 'lu1', role: 'user', text: 'old q1' })])]);

      const { result } = await renderStore();
      await settleFlush();

      expect(convCreate).not.toHaveBeenCalled();
      expect(result.current.migration.state).toBe('idle');
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('does not clear the key on a partial failure, and reports the failure', async () => {
      // The whole point: an upload that half-landed must leave the evidence behind so
      // the next load can retry. Clearing it would silently destroy the remainder.
      seedLegacy([
        legacyThread('th-1', [
          msg({ id: 'lu1', role: 'user', text: 'old q1' }),
          msg({ id: 'la1', role: 'agent', text: 'old a1', replyTo: 'lu1' }),
        ]),
      ]);
      let calls = 0;
      convAppend.mockImplementation(async () => {
        calls += 1;
        if (calls > 1) return { ok: false as const, error: '503 upload failed', status: 503 };
        return { ok: true as const, data: { clientId: 'lu1', content: 'old q1' } as MessageRecord };
      });

      const { result } = await renderStore();
      await settleFlush();

      expect(result.current.migration).toMatchObject({ state: 'failed', uploaded: 1, total: 2 });
      expect(result.current.migration.state === 'failed' && result.current.migration.error).toBe(
        '503 upload failed',
      );
      // Not cleared, and no marker: the next load retries.
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(localStorage.getItem(MIGRATED_KEY)).toBeNull();
      expect(result.current.persistenceError).toContain('still on this device');
      expect(result.current.persistenceError).toContain('1 of 2 messages');
    });

    it('retries a previously failed migration on the next load', async () => {
      seedLegacy([legacyThread('th-1', [msg({ id: 'lu1', role: 'user', text: 'old q1' })])]);
      convAppend.mockResolvedValueOnce({ ok: false as const, error: '503', status: 503 });

      const first = await renderStore();
      await settleFlush();
      expect(first.result.current.migration.state).toBe('failed');
      first.unmount();

      // The transport recovers; the next mount picks the leftover key back up.
      convAppend.mockImplementation(async (_ws: string, cid: string, body: MessageCreate) => ({
        ok: true as const,
        data: recordFor(cid, msg({ id: body.client_id, role: body.role, text: body.text })),
      }));

      const second = await renderStore();
      await settleFlush();
      expect(second.result.current.migration.state).toBe('done');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('stop', () => {
    it('cancels the durable workflow server-side, not just the client request', async () => {
      // The old handleStop only ever assigned its AbortController in the
      // non-durable branch, so in durable mode it was a complete no-op: the click
      // did nothing while the 60s poll loop kept running server-side.
      jest.useFakeTimers();
      const gate = stallDurableRun('wf-7');

      // Seeded so the send reuses the active thread. `send` creating a thread would
      // change `activeId` in the same commit the poll registers its workflow id, and
      // the store's `[activeId]` reset effect would then clear it. In a browser the
      // click handler flushes before the workflow id arrives, so this only ever
      // happens inside a single `act`.
      seedThread([msg({ id: 'seed-u', role: 'user', text: 'earlier question' })], 'cv-seed');

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('tailor my resume');
      });

      // Two separate `act`s: one to start the send, one to run the poll clock.
      let send!: Promise<void>;
      await act(async () => {
        send = result.current.send();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DURABLE_POLL_INTERVAL_MS + 50);
      });
      expect(result.current.workflowId).toBe('wf-7');
      expect(getStatus).toHaveBeenCalledWith('wf-7');

      act(() => {
        result.current.stop();
      });

      expect(cancelWorkflow).toHaveBeenCalledTimes(1);
      expect(cancelWorkflow).toHaveBeenCalledWith('wf-7');
      expect(result.current.busy).toBe(false);
      expect(result.current.workflowId).toBeNull();

      await act(async () => {
        gate.resolve(terminalPoll());
        await send;
      });
    });

    it('aborts the streamed request and marks the streaming message stopped', async () => {
      let captured: AbortSignal | undefined;
      chatStream.mockImplementation(
        (_body: unknown, _onEvent: unknown, signal: AbortSignal | undefined) =>
          new Promise<void>((_resolve, reject) => {
            captured = signal;
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      );

      const { result } = await renderStore();
      act(() => {
        result.current.setInput('stream this');
      });

      let send!: Promise<void>;
      await act(async () => {
        send = result.current.send();
      });

      expect(captured?.aborted).toBe(false);
      expect(lastAgent(result.current.messages).status).toBe('streaming');

      act(() => {
        result.current.stop();
      });

      expect(captured?.aborted).toBe(true);

      await act(async () => {
        await send;
      });

      const stopped = lastAgent(result.current.messages);
      expect(stopped.status).toBe('stopped');
      expect(stopped.text).toBe('Stopped before any output arrived.');
      expect(result.current.busy).toBe(false);
    });

    it('persists the stopped turn, because stopped is terminal', async () => {
      let captured: AbortSignal | undefined;
      chatStream.mockImplementation(
        (_body: unknown, _onEvent: unknown, signal: AbortSignal | undefined) =>
          new Promise<void>((_resolve, reject) => {
            captured = signal;
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      );
      seedThread([], 'cv-1');

      const { result } = await renderStore();
      act(() => {
        result.current.setInput('stream this');
      });
      await act(async () => {
        void result.current.send();
      });
      const agentId = lastAgent(result.current.messages).id;

      act(() => {
        result.current.stop();
      });
      await act(async () => {
        await Promise.resolve();
      });
      await settleFlush();

      const stored = server.get('cv-1')?.messages.find((m) => m.clientId === agentId);
      expect(stored?.status).toBe('stopped');
    });

    it('does not claim a server-side cancellation when there was no durable run', async () => {
      const { result } = await renderStore();

      act(() => {
        result.current.stop();
      });

      expect(cancelWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('resends the user message paired with that specific failed reply', async () => {
      // The old code resent the globally-last user message from every Retry
      // button, so with two failures both buttons resent the second question.
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'first question' }),
          msg({ id: 'a1', role: 'agent', text: 'boom', status: 'error', replyTo: 'u1' }),
          msg({ id: 'u2', role: 'user', text: 'second question' }),
          msg({ id: 'a2', role: 'agent', text: 'boom', status: 'error', replyTo: 'u2' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      await act(async () => {
        result.current.retry('a1');
      });

      expect(chatStream).toHaveBeenCalledTimes(1);
      expect(chatStream.mock.calls[0][0]).toMatchObject({
        workspaceId: WORKSPACE,
        message: 'first question',
      });

      // The failed turn is dropped and replaced by a fresh attempt.
      const ids = result.current.messages.map((m) => m.id);
      expect(ids).not.toContain('a1');
      expect(ids).toContain('u1');
      expect(result.current.messages.filter((m) => m.text === 'second question')).toHaveLength(1);
    });

    it('toasts an error instead of sending an empty message when the source is gone', async () => {
      seedThread(
        [msg({ id: 'a1', role: 'agent', text: 'boom', status: 'error', replyTo: 'deleted-user' })],
        'cv-1',
      );

      const { result } = await renderStore();
      act(() => {
        result.current.retry('a1');
      });

      expect(chatStream).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Nothing to retry' }),
      );
      // Nothing was removed either — the turn is left alone for inspection.
      expect(result.current.messages.map((m) => m.id)).toEqual(['a1']);
    });

    it('ignores a retry for a message id that is not in the thread', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-1');
      const { result } = await renderStore();

      act(() => {
        result.current.retry('nope');
      });

      expect(chatStream).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('deletes a user message together with the agent reply that answers it', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
          msg({ id: 'u2', role: 'user', text: 'q2' }),
          msg({ id: 'a2', role: 'agent', text: 'a2', replyTo: 'u2' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      act(() => {
        result.current.deleteMessage('u1');
      });

      expect(result.current.messages.map((m) => m.id)).toEqual(['u2', 'a2']);
    });

    it('leaves the question in place when only the answer is deleted', async () => {
      // Deleting a reply does not retract the question that caused it.
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      act(() => {
        result.current.deleteMessage('a1');
      });

      expect(result.current.messages.map((m) => m.id)).toEqual(['u1']);
    });

    it('does not delete the next message when it is not the paired reply', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'someone-else' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      act(() => {
        result.current.deleteMessage('u1');
      });

      expect(result.current.messages.map((m) => m.id)).toEqual(['a1']);
    });

    it('says the delete is local-only, because the contract has no per-message delete', async () => {
      // Claiming the message was deleted everywhere when it was not is exactly the
      // fabricated-confidence class of defect this refactor removed.
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      act(() => {
        result.current.deleteMessage('u1');
      });

      expect(result.current.persistenceError).toContain('this tab only');
      expect(result.current.persistenceError).toContain('no per-message delete endpoint');
    });
  });

  describe('editUserMessage', () => {
    it('truncates every message after the edit point, because the branch is invalid', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q1' }),
          msg({ id: 'a1', role: 'agent', text: 'a1', replyTo: 'u1' }),
          msg({ id: 'u2', role: 'user', text: 'q2' }),
          msg({ id: 'a2', role: 'agent', text: 'a2', replyTo: 'u2' }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      await act(async () => {
        result.current.editUserMessage('u1', '  revised question  ');
      });

      expect(result.current.messages[0]).toMatchObject({
        id: 'u1',
        text: 'revised question',
        edited: true,
      });
      expect(result.current.messages.map((m) => m.text)).not.toContain('q2');
      expect(result.current.messages.map((m) => m.text)).not.toContain('a2');
      expect(chatStream).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'revised question' }),
        expect.any(Function),
        expect.anything(),
      );
    });

    it('ignores an edit that would leave an empty message', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q1' })], 'cv-1');

      const { result } = await renderStore();
      act(() => {
        result.current.editUserMessage('u1', '   ');
      });

      expect(chatStream).not.toHaveBeenCalled();
      expect(result.current.messages[0]?.text).toBe('q1');
    });

    it('says the edit is local-only, because the contract has no message PATCH', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q1' })], 'cv-1');

      const { result } = await renderStore();
      await act(async () => {
        result.current.editUserMessage('u1', 'revised');
      });

      expect(result.current.persistenceError).toContain(
        'no endpoint for rewriting a stored message',
      );
    });
  });

  describe('decideProposal', () => {
    function seedProposal(): void {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'apply for me' }),
          msg({
            id: 'a1',
            role: 'agent',
            text: 'ready',
            replyTo: 'u1',
            proposals: [
              {
                title: 'Send the resume',
                detail: 'draft ready',
                requiresApproval: true,
                approvalId: 'ap-1',
                status: 'pending',
              },
            ],
          }),
        ],
        'cv-1',
      );
    }

    it('resolves an approve to approved when the backend answers with an unknown status', async () => {
      // The old code cast the raw string to ProposalStatus, so a backend status of
      // "pending" or "needs_review" left both buttons live on a card whose action
      // had already been recorded.
      seedProposal();
      approve.mockResolvedValue({ status: 'needs_review' });

      const { result } = await renderStore();
      await act(async () => {
        await result.current.decideProposal('a1', 0, 'approve');
      });

      expect(approve).toHaveBeenCalledWith('ap-1');
      expect(proposalAt(result.current.messages, 'a1', 0).status).toBe('approved');
    });

    it('resolves a reject to rejected when the backend echoes "pending"', async () => {
      seedProposal();
      rejectApproval.mockResolvedValue({ status: 'pending' });

      const { result } = await renderStore();
      await act(async () => {
        await result.current.decideProposal('a1', 0, 'reject');
      });

      expect(rejectApproval).toHaveBeenCalledWith('ap-1');
      expect(proposalAt(result.current.messages, 'a1', 0).status).toBe('rejected');
    });

    it('honours a recognised backend status including expired', async () => {
      seedProposal();
      approve.mockResolvedValue({ status: 'expired' });

      const { result } = await renderStore();
      await act(async () => {
        await result.current.decideProposal('a1', 0, 'approve');
      });

      expect(proposalAt(result.current.messages, 'a1', 0).status).toBe('expired');
    });

    it('marks the card as error and toasts when the approval call fails', async () => {
      seedProposal();
      approve.mockRejectedValue(new Error('approval service unavailable'));

      const { result } = await renderStore();
      await act(async () => {
        await result.current.decideProposal('a1', 0, 'approve');
      });

      expect(proposalAt(result.current.messages, 'a1', 0).status).toBe('error');
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'Approval failed' }),
      );
    });

    it('refuses to call the API for a proposal with no approval record', async () => {
      seedThread(
        [
          msg({ id: 'u1', role: 'user', text: 'q' }),
          msg({
            id: 'a1',
            role: 'agent',
            text: 'ready',
            proposals: [{ title: 'Delete everything', requiresApproval: false, status: 'expired' }],
          }),
        ],
        'cv-1',
      );

      const { result } = await renderStore();
      await act(async () => {
        await result.current.decideProposal('a1', 0, 'approve');
      });

      expect(approve).not.toHaveBeenCalled();
      expect(proposalAt(result.current.messages, 'a1', 0).status).toBe('error');
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: 'No approval record' }),
      );
    });
  });

  describe('durable mode', () => {
    it("keeps the user's Durable preference when Temporal answers 503", async () => {
      // The old code called setDurableMode(false) here, silently unticking a box the
      // user had explicitly ticked for the rest of the session, with no explanation.
      startDurableAgent.mockRejectedValue(
        new Error('503 Service Unavailable: temporal is disabled'),
      );
      chat.mockResolvedValue({ reply: 'Here is the answer.' });

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('hello');
      });

      await act(async () => {
        await result.current.send();
      });

      expect(chat).toHaveBeenCalledWith({ workspaceId: WORKSPACE, message: 'hello' });
      expect(result.current.durableMode).toBe(true);

      const answered = lastAgent(result.current.messages);
      expect(answered.status).toBe('complete');
      expect(answered.text).toBe('Here is the answer.');
    });

    it('carries proposals, questions, action chips, tool calls and citations through the 503 fallback', async () => {
      // The old durable 503-fallback had its own 60-line parser that silently
      // dropped all five of these.
      startDurableAgent.mockRejectedValue(new Error('503 temporal is disabled'));
      chat.mockResolvedValue({
        reply: 'Here is the tailored resume.',
        result: {
          proposals: [{ title: 'Send to recruiter', approval_id: 'ap-9', requires_approval: true }],
          questions: ['Which contact address?'],
          action_chips: ['Send now', 'Save draft'],
          details: {
            tool_calls: [{ name: 'search_jobs', latency_ms: 88 }],
            citations: [
              { document_title: 'Resume v3', uri: 's3://resume.pdf', page_or_section: 'p1' },
            ],
          },
        },
      });

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('hello');
      });

      await act(async () => {
        await result.current.send();
      });

      const answered = lastAgent(result.current.messages);
      expect(answered.text).toBe('Here is the tailored resume.');
      expect(answered.proposals).toEqual([
        {
          title: 'Send to recruiter',
          detail: undefined,
          requiresApproval: true,
          approvalId: 'ap-9',
          status: 'pending',
        },
      ]);
      expect(answered.questions).toEqual(['Which contact address?']);
      expect(answered.actionChips).toEqual(['Send now', 'Save draft']);
      expect(answered.toolCalls).toEqual([
        { name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 },
      ]);
      expect(answered.citations).toEqual([
        { title: 'Resume v3', uri: 's3://resume.pdf', pageOrSection: 'p1', excerpt: undefined },
      ]);
    });

    it('reports a failed run as an error message rather than retrying forever', async () => {
      startDurableAgent.mockRejectedValue(new Error('422 agent_id is not registered'));

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('hello');
      });

      await act(async () => {
        await result.current.send();
      });

      const failed = lastAgent(result.current.messages);
      expect(failed.status).toBe('error');
      expect(failed.error?.message).toBe('422 agent_id is not registered');
      // A non-503 failure is not a reason to silently take the other path.
      expect(chat).not.toHaveBeenCalled();
    });

    it('marks a run that exhausted its poll budget as background, never as in progress', async () => {
      // The old code wrote "Durable execution in progress — see timeline", which is
      // false: the client gave up. The workflow is still live, and that is a
      // different fact from "the run finished".
      jest.useFakeTimers();
      startDurableAgent.mockResolvedValue({ workflow_id: 'wf-bg', status: 'started' });
      getStatus.mockResolvedValue({ status: 'running', query: {} });

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('a very long job');
      });

      let send!: Promise<void>;
      await act(async () => {
        send = result.current.send();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DURABLE_POLL_INTERVAL_MS * (DURABLE_MAX_POLLS + 2));
      });
      await act(async () => {
        await send;
      });

      expect(getStatus).toHaveBeenCalledTimes(DURABLE_MAX_POLLS);

      const stillRunning = lastAgent(result.current.messages);
      expect(stillRunning.status).toBe('background');
      expect(stillRunning.text).toContain('still executing on the server');
      expect(stillRunning.text).not.toContain('in progress');
      expect(result.current.busy).toBe(false);
    });

    it('clears the durable workflow id when the user switches threads', async () => {
      // Otherwise thread A's ExecutionTimeline renders inside thread B.
      jest.useFakeTimers();
      const gate = stallDurableRun('wf-9');
      seedThread([msg({ id: 'seed-u', role: 'user', text: 'earlier question' })], 'cv-seed');

      const { result } = await renderStore();
      act(() => {
        result.current.setDurableMode(true);
        result.current.setInput('hello');
      });

      let send!: Promise<void>;
      await act(async () => {
        send = result.current.send();
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(DURABLE_POLL_INTERVAL_MS + 50);
      });
      expect(result.current.workflowId).toBe('wf-9');

      act(() => {
        result.current.newThread({ seedInput: 'another thread' });
      });

      expect(result.current.workflowId).toBeNull();
      expect(result.current.ragStatus).toBeNull();

      await act(async () => {
        result.current.stop();
        gate.resolve(terminalPoll());
        await send;
      });
    });
  });

  describe('the optimistic placeholder', () => {
    it('carries no confidence and no tool calls, because no model has run yet', async () => {
      // The old placeholder hardcoded `confidence: 0.98` and a
      // `{name:'routing', status:'running'}` tool, which rendered a green
      // "98% Verified Intent Confidence" badge and a live tool row instantly.
      chatStream.mockImplementation(() => new Promise<void>(() => undefined));

      const { result } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        void result.current.send();
      });

      const placeholder = lastAgent(result.current.messages);
      expect(placeholder.role).toBe('agent');
      expect(placeholder.status).toBe('streaming');
      expect(placeholder.text).toBe('');
      expect(placeholder.confidence).toBeUndefined();
      expect(placeholder.toolCalls).toBeUndefined();
      expect(placeholder.replyTo).toBe(result.current.messages.find((m) => m.role === 'user')?.id);
    });
  });

  describe('lifecycle', () => {
    it('aborts the in-flight stream on unmount', async () => {
      // No unmount cleanup meant navigating away mid-response leaked the fetch and
      // kept calling setState on a dead component.
      let captured: AbortSignal | undefined;
      chatStream.mockImplementation(
        (_body: unknown, _onEvent: unknown, signal: AbortSignal | undefined) =>
          new Promise<void>((_resolve, reject) => {
            captured = signal;
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      );

      const { result, unmount } = await renderStore();
      act(() => {
        result.current.setInput('hello');
      });
      await act(async () => {
        void result.current.send();
      });

      expect(captured?.aborted).toBe(false);

      unmount();

      expect(captured?.aborted).toBe(true);
    });
  });

  describe('catalog and commands', () => {
    it('reports an unavailable command catalog instead of a hardcoded list', async () => {
      const { fetchSlashCommands } = jest.requireMock('../chat-api') as {
        fetchSlashCommands: jest.Mock;
      };
      fetchSlashCommands.mockResolvedValueOnce({
        commands: [],
        state: 'error',
        error: '503 commands unavailable',
      });

      const { result } = await renderStore();

      expect(result.current.commandsState).toBe('error');
      expect(result.current.commandsError).toBe('503 commands unavailable');
      expect(result.current.commands).toEqual([]);
    });

    it('accepts a published command list, colour included', async () => {
      const { fetchSlashCommands } = jest.requireMock('../chat-api') as {
        fetchSlashCommands: jest.Mock;
      };
      fetchSlashCommands.mockResolvedValueOnce({
        commands: [{ trigger: '/resume', desc: 'x', agent: 'resume', color: 'text-sky-300' }],
        state: 'ready',
      });

      const { result } = await renderStore();

      expect(result.current.commandsState).toBe('ready');
      expect(result.current.commands[0]).toMatchObject({
        trigger: '/resume',
        color: 'text-sky-300',
      });
    });
  });
  describe('a conversation that has not reached the server yet', () => {
    it('deletes locally without issuing a doomed server request', async () => {
      // A freshly created conversation has a local id (`th_<n>_<rand>`), which is not
      // a UUID. Sending it to a route typed `conversation_id: uuid.UUID` 422s, which
      // the delete path treats as a failure and rolls back, so the user would watch
      // their new conversation refuse to delete.
      const { result } = await renderStore();

      act(() => {
        result.current.newThread({ agent: 'resume' });
      });
      const localId = result.current.activeId;
      expect(localId).toBeTruthy();
      expect(result.current.threads.map((t) => t.id)).toContain(localId);

      act(() => {
        result.current.deleteThread(localId as string);
      });

      expect(convRemove).not.toHaveBeenCalled();
      expect(result.current.threads.map((t) => t.id)).not.toContain(localId);
      expect(result.current.syncError).toBeNull();
    });

    it('clears locally without issuing a doomed server request', async () => {
      const { result } = await renderStore();

      act(() => {
        result.current.newThread();
      });
      const localId = result.current.activeId as string;
      act(() => {
        result.current.clearThread(localId);
      });

      expect(convClear).not.toHaveBeenCalled();
      expect(result.current.syncError).toBeNull();
    });

    it('still calls the server for a conversation that does have a UUID', async () => {
      seedThread([msg({ id: 'u1', role: 'user', text: 'q' })], 'cv-real');
      const { result } = await renderStore();

      act(() => {
        result.current.deleteThread('cv-real');
      });

      expect(convRemove).toHaveBeenCalledTimes(1);
      expect(convRemove.mock.calls[0]?.[1]).toBe('cv-real');
    });
  });
});
