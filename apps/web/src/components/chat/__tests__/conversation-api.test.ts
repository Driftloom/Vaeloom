import {
  ConversationApi,
  conversationsKey,
  messageToCreate,
  normaliseOnRead,
  recordToMessage,
  type MessageCreate,
} from '../conversation-api';
import { api } from '@/lib/api';
import type { ChatMessage } from '../types';

/**
 * The conversation API is the transcript's only path to storage. Two properties are
 * load-bearing and are asserted throughout:
 *
 *   - every request goes through `api.*`, so the workspace prefix, `transformKeys`,
 *     CSRF and `ApiError` normalisation all apply. A hand-built `fetch` would skip
 *     all four, which is how the chat previously ended up with a fabricated
 *     command list.
 *   - no call throws. Every failure comes back as `{ ok: false, error }`, so a
 *     caller cannot mistake "failed" for "empty" the way a `.catch(() => [])`
 *     makes it indistinguishable.
 */

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

const apiGet = api.get as unknown as jest.Mock;
const apiPost = api.post as unknown as jest.Mock;
const apiDelete = api.delete as unknown as jest.Mock;
const apiRequest = api.request as unknown as jest.Mock;

const WS = 'ws-1';

function serverConversation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cv-1',
    workspaceId: WS,
    title: 'Tailoring',
    messageCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Mirrors `MessageResponse` after `transformKeys`: `id`/`conversationId` are UUIDs,
 * the body field is `text`, and the timestamp is `createdAt`.
 */
function serverMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '2f1c9d5e-0000-4000-8000-000000000001',
    conversationId: '2f1c9d5e-0000-4000-8000-0000000000aa',
    clientId: 'm_local_1',
    role: 'agent',
    text: 'Here is the tailored resume.',
    createdAt: '2026-01-02T00:00:01.000Z',
    status: 'complete',
    ...overrides,
  };
}

describe('conversation-api', () => {
  let bareFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    bareFetch = jest.fn(() => Promise.reject(new Error('the raw fetch path must stay unused')));
    (globalThis as unknown as { fetch?: unknown }).fetch = bareFetch;
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  describe('workspace scoping', () => {
    // Cross-workspace isolation is enforced server-side by RLS, but the client owns
    // one half of it: the workspace must appear in the path of every request. If a
    // future refactor drops it, the server has nothing to compare against.
    it('puts the workspace in the path of every endpoint', async () => {
      apiGet.mockResolvedValue({ conversations: [], total: 0 });
      apiGet.mockResolvedValueOnce({ conversations: [], total: 0 });
      apiPost.mockResolvedValue(serverConversation());
      apiDelete.mockResolvedValue(undefined);

      await ConversationApi.list(WS);
      expect(apiGet.mock.calls[0]?.[0]).toBe(`/workspaces/${WS}/conversations`);

      await ConversationApi.get(WS, 'cv-1');
      expect(apiGet.mock.calls[1]?.[0]).toBe(`/workspaces/${WS}/conversations/cv-1`);

      await ConversationApi.create(WS, { title: 'x' });
      expect(apiPost.mock.calls[0]?.[0]).toBe(`/workspaces/${WS}/conversations`);

      await ConversationApi.appendMessage(WS, 'cv-1', {
        client_id: 'm1',
        role: 'user',
        text: 'hi',
        status: 'complete',
      });
      expect(apiPost.mock.calls[1]?.[0]).toBe(`/workspaces/${WS}/conversations/cv-1/messages`);

      await ConversationApi.clearMessages(WS, 'cv-1');
      expect(apiDelete.mock.calls[0]?.[0]).toBe(`/workspaces/${WS}/conversations/cv-1/messages`);

      await ConversationApi.remove(WS, 'cv-1');
      expect(apiDelete.mock.calls[1]?.[0]).toBe(`/workspaces/${WS}/conversations/cv-1`);
    });

    it('percent-encodes the workspace and conversation ids', async () => {
      apiGet.mockResolvedValue({ conversations: [], total: 0 });
      await ConversationApi.get('ws/../other', 'cv 1');
      expect(apiGet.mock.calls[0]?.[0]).toBe('/workspaces/ws%2F..%2Fother/conversations/cv%201');
    });

    it('scopes the SWR key to the workspace', () => {
      expect(conversationsKey('ws-a')).not.toBe(conversationsKey('ws-b'));
    });

    it('never reaches for a bare fetch', async () => {
      apiGet.mockResolvedValue({ conversations: [], total: 0 });
      await ConversationApi.list(WS);
      expect(bareFetch).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns the rows and the server-reported total', async () => {
      apiGet.mockResolvedValue({
        conversations: [serverConversation(), serverConversation({ id: 'cv-2', title: 'Second' })],
        total: 214,
        page: 1,
        pageSize: 2,
      });

      const res = await ConversationApi.list(WS, { page: 1, pageSize: 2 });

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      // The total must come from the envelope. Inferring it from the array would make
      // a non-empty workspace look empty and fire the migration over real history.
      expect(res.data.total).toBe(214);
      expect(res.data.conversations.map((c) => c.id)).toEqual(['cv-1', 'cv-2']);
      expect(res.data.conversations[0]?.workspaceId).toBe(WS);
      expect(res.data.conversations[0]?.messageCount).toBe(2);
    });

    it('serialises the pagination and search parameters snake_case', async () => {
      apiGet.mockResolvedValue({ conversations: [], total: 0 });
      await ConversationApi.list(WS, { page: 2, pageSize: 25, offset: 25, search: 'resume two' });
      const path = apiGet.mock.calls[0]?.[0] as string;
      expect(path).toContain('page=2');
      expect(path).toContain('page_size=25');
      expect(path).toContain('offset=25');
      expect(path).toContain('search=resume+two');
    });

    it('omits the query string entirely when there are no parameters', async () => {
      apiGet.mockResolvedValue({ conversations: [], total: 0 });
      await ConversationApi.list(WS);
      expect(apiGet.mock.calls[0]?.[0]).toBe(`/workspaces/${WS}/conversations`);
    });

    it('reports an error instead of an empty list when the request fails', async () => {
      apiGet.mockRejectedValue(new Error('502 Bad Gateway'));
      const res = await ConversationApi.list(WS);
      expect(res).toEqual({ ok: false, error: '502 Bad Gateway' });
    });

    it('carries the HTTP status from an ApiError so callers can distinguish 401 from 500', async () => {
      const { ApiError } = jest.requireMock('@/lib/api') as {
        ApiError: new (status: number, message: string) => Error;
      };
      apiGet.mockRejectedValue(new ApiError(401, 'Not authenticated'));
      const res = await ConversationApi.list(WS);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.status).toBe(401);
      expect(res.error).toBe('Not authenticated');
    });

    it('flags an abort as aborted rather than as a failure', async () => {
      apiGet.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));
      const res = await ConversationApi.list(WS);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.aborted).toBe(true);
    });

    it('falls back to the row count when the envelope omits total, rather than reporting zero', async () => {
      apiGet.mockResolvedValue({ conversations: [serverConversation()] });
      const res = await ConversationApi.list(WS);
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.total).toBe(1);
    });

    it('drops malformed rows instead of crashing on them', async () => {
      apiGet.mockResolvedValue({
        conversations: [serverConversation(), { title: 'no id' }, null, 'nonsense'],
        total: 1,
      });
      const res = await ConversationApi.list(WS);
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.conversations).toHaveLength(1);
    });

    it('defaults a missing title rather than rendering a blank rail entry', async () => {
      apiGet.mockResolvedValue({
        conversations: [serverConversation({ title: undefined })],
        total: 1,
      });
      const res = await ConversationApi.list(WS);
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.conversations[0]?.title).toBe('New conversation');
    });
  });

  describe('get', () => {
    it('accepts the conversation nested under `conversation`', async () => {
      apiGet.mockResolvedValue({
        conversation: serverConversation(),
        messages: [serverMessage()],
      });
      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.conversation.id).toBe('cv-1');
      expect(res.data.messages).toHaveLength(1);
    });

    it('accepts the conversation flattened beside `messages`', async () => {
      apiGet.mockResolvedValue({ ...serverConversation(), messages: [serverMessage()] });
      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.conversation.title).toBe('Tailoring');
      expect(res.data.messages[0]?.clientId).toBe('m_local_1');
    });

    it('reads the telemetry the store relies on', async () => {
      apiGet.mockResolvedValue({
        conversation: serverConversation(),
        messages: [
          serverMessage({
            confidence: 0.72,
            replyTo: 'm_local_0',
            agentName: 'resume',
            toolCalls: [{ name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 }],
            actionChips: ['Send now'],
            latencyMs: 1234,
            s1LatencyMs: 14,
            s2LatencyMs: 2200,
            workflowId: 'wf-1',
            error: { message: 'nope', code: '502' },
          }),
        ],
      });

      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      const record = res.data.messages[0];
      if (!record) throw new Error('expected a message');
      expect(record.confidence).toBe(0.72);
      expect(record.replyTo).toBe('m_local_0');
      expect(record.agentName).toBe('resume');
      expect(record.toolCalls).toEqual([
        { name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 },
      ]);
      expect(record.actionChips).toEqual(['Send now']);
      expect(record.latencyMs).toBe(1234);
      expect(record.s1LatencyMs).toBe(14);
      expect(record.s2LatencyMs).toBe(2200);
      expect(record.workflowId).toBe('wf-1');
      expect(record.error).toEqual({ message: 'nope', code: '502' });
    });

    it('leaves an unreported tool duration absent rather than zero-filling it', async () => {
      apiGet.mockResolvedValue({
        conversation: serverConversation(),
        messages: [
          serverMessage({ toolCalls: [{ name: 'search_jobs', status: 'done', kind: 'tool' }] }),
        ],
      });
      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.messages[0]?.toolCalls?.[0]).not.toHaveProperty('latencyMs');
    });

    it('accepts `content` as well as `text` for the body', async () => {
      // `text` is the backend's field name. `content` is accepted too so a server-side
      // rename cannot silently blank the transcript.
      apiGet.mockResolvedValue({
        conversation: serverConversation(),
        messages: [serverMessage({ text: undefined, content: 'legacy body' })],
      });
      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      expect(res.data.messages[0]?.content).toBe('legacy body');
    });

    it('reads a real MessageResponse row, including the UUID ids and createdAt', async () => {
      apiGet.mockResolvedValue({
        conversation: serverConversation(),
        messages: [
          {
            id: '2f1c9d5e-0000-4000-8000-000000000001',
            conversationId: '2f1c9d5e-0000-4000-8000-0000000000aa',
            clientId: 'm_local_1',
            role: 'agent',
            text: 'Here is the tailored resume.',
            status: 'complete',
            agentName: 'resume',
            toolCalls: [{ name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 }],
            citations: [],
            proposals: [],
            questions: [],
            actionChips: [],
            attachments: [],
            phases: [],
            plan: null,
            error: null,
            latencyMs: 1234,
            highway: 'green',
            s1LatencyMs: 14,
            s2LatencyMs: 2200,
            workflowId: null,
            replyTo: 'm_local_0',
            createdAt: '2026-01-02T00:00:01.000Z',
          },
        ],
      });

      const res = await ConversationApi.get(WS, 'cv-1');
      if (!res.ok) throw new Error('expected ok');
      const record = res.data.messages[0];
      if (!record) throw new Error('expected a message');
      expect(record.id).toBe('2f1c9d5e-0000-4000-8000-000000000001');
      expect(record.conversationId).toBe('2f1c9d5e-0000-4000-8000-0000000000aa');
      expect(record.timestamp).toBe('2026-01-02T00:00:01.000Z');
      expect(record.content).toBe('Here is the tailored resume.');
      // Empty arrays must not become `[]` on the store model: absent is absent.
      expect(record.citations).toBeUndefined();
      expect(record.questions).toBeUndefined();
      expect(record.toolCalls).toEqual([
        { name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 },
      ]);
      expect(record.error).toBeUndefined();
      expect(record.highway).toBe('green');
    });

    it('accepts a 200 duplicate-client_id replay as a success', async () => {
      // The backend answers a repeated `client_id` with 200 and the stored row. Both
      // 200 and 201 are `res.ok`, so the queue can retry without special-casing.
      apiPost.mockResolvedValue(serverMessage());
      const res = await ConversationApi.appendMessage(WS, 'cv-1', {
        client_id: 'm_local_1',
        role: 'agent',
        text: 'already stored',
        status: 'complete',
      });
      expect(res.ok).toBe(true);
    });

    it('fails loudly when the envelope carries no id, instead of reporting an empty transcript', async () => {
      apiGet.mockResolvedValue({ messages: [serverMessage()] });
      const res = await ConversationApi.get(WS, 'cv-1');
      expect(res.ok).toBe(false);
    });
  });

  describe('create / rename / remove / clearMessages', () => {
    it('creates with a snake_case agent_name and returns the server row', async () => {
      apiPost.mockResolvedValue(serverConversation({ id: 'cv-new' }));
      const res = await ConversationApi.create(WS, { title: 'New chat', agentName: 'resume' });
      if (!res.ok) throw new Error('expected ok');
      expect(apiPost.mock.calls[0]?.[1]).toEqual({ title: 'New chat', agent_name: 'resume' });
      expect(res.data.id).toBe('cv-new');
    });

    it('omits absent create fields rather than sending empty strings', async () => {
      apiPost.mockResolvedValue(serverConversation());
      await ConversationApi.create(WS);
      expect(apiPost.mock.calls[0]?.[1]).toEqual({});
    });

    it('reports a create response with no id as a failure', async () => {
      apiPost.mockResolvedValue({ title: 'orphan' });
      const res = await ConversationApi.create(WS);
      expect(res.ok).toBe(false);
    });

    it('renames with PATCH and only a title', async () => {
      apiRequest.mockResolvedValue(serverConversation({ title: 'Renamed' }));
      const res = await ConversationApi.rename(WS, 'cv-1', 'Renamed');
      if (!res.ok) throw new Error('expected ok');
      const [path, init] = apiRequest.mock.calls[0] as [string, RequestInit];
      expect(path).toBe(`/workspaces/${WS}/conversations/cv-1`);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(String(init.body))).toEqual({ title: 'Renamed' });
      expect(res.data.title).toBe('Renamed');
    });

    it('treats a 204 delete as a success rather than a JSON parse failure', async () => {
      apiDelete.mockResolvedValue(undefined);
      expect(await ConversationApi.remove(WS, 'cv-1')).toEqual({ ok: true, data: null });
      expect(await ConversationApi.clearMessages(WS, 'cv-1')).toEqual({ ok: true, data: null });
    });

    it('reports a failed delete instead of assuming the row is gone', async () => {
      apiDelete.mockRejectedValue(new Error('403 not permitted'));
      const res = await ConversationApi.remove(WS, 'cv-1');
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBe('403 not permitted');
    });
  });

  describe('appendMessage', () => {
    const body: MessageCreate = { client_id: 'm1', role: 'user', text: 'hi', status: 'complete' };

    it('sends client_id as the idempotency key and returns the stored row', async () => {
      apiPost.mockResolvedValue(serverMessage({ clientId: 'm1' }));
      const res = await ConversationApi.appendMessage(WS, 'cv-1', body);
      if (!res.ok) throw new Error('expected ok');
      expect(apiPost.mock.calls[0]?.[1]).toMatchObject({
        client_id: 'm1',
        role: 'user',
        text: 'hi',
      });
      expect(res.data.clientId).toBe('m1');
    });

    it('forwards keepalive so an unload flush can outlive the document', async () => {
      apiPost.mockResolvedValue(serverMessage());
      await ConversationApi.appendMessage(WS, 'cv-1', body, { keepalive: true });
      expect((apiPost.mock.calls[0]?.[2] as RequestInit).keepalive).toBe(true);
    });

    it('fails when the server echoes no client_id, rather than treating it as stored', async () => {
      apiPost.mockResolvedValue({ id: 'row-9' });
      const res = await ConversationApi.appendMessage(WS, 'cv-1', body);
      expect(res.ok).toBe(false);
    });
  });

  describe('messageToCreate', () => {
    const base: ChatMessage = {
      id: 'm1',
      role: 'agent',
      text: 'answer',
      timestamp: '2026-01-01T00:00:00.000Z',
      status: 'complete',
    };

    it('carries the local id as client_id', () => {
      expect(messageToCreate(base).client_id).toBe('m1');
    });

    it('converts nested telemetry to snake_case, since requests are not key-transformed', () => {
      const body = messageToCreate({
        ...base,
        toolCalls: [{ name: 'search_jobs', status: 'done', kind: 'tool', latencyMs: 88 }],
        citations: [{ title: 'Resume v3', uri: 's3://r.pdf', pageOrSection: 'p1' }],
        proposals: [
          { title: 'Send it', requiresApproval: true, approvalId: 'ap-1', status: 'pending' },
        ],
        workflowId: 'wf-1',
        latencyMs: 1234,
        s1LatencyMs: 14,
        s2LatencyMs: 2200,
        error: { message: 'boom', code: '502' },
      });
      expect(body.tool_calls?.[0]?.latency_ms).toBe(88);
      expect(body.citations?.[0]?.page_or_section).toBe('p1');
      expect(body.proposals?.[0]?.approval_id).toBe('ap-1');
      expect(body.workflow_id).toBe('wf-1');
      expect(body.latency_ms).toBe(1234);
      expect(body.s1_latency_ms).toBe(14);
      expect(body.s2_latency_ms).toBe(2200);
      expect(body.error).toEqual({ message: 'boom', code: '502' });
    });

    it('omits absent telemetry instead of sending nulls or zeroes', () => {
      const body = messageToCreate(base);
      expect(body.tool_calls).toBeUndefined();
      expect(body.confidence).toBeUndefined();
      expect(body.latency_ms).toBeUndefined();
      expect(body).not.toHaveProperty('confidence', null);
    });

    it('round-trips through recordToMessage without inventing telemetry', () => {
      const original: ChatMessage = {
        ...base,
        confidence: 0.5,
        toolCalls: [{ name: 'x', status: 'done', kind: 'sub_agent' }],
        questions: ['Which one?'],
        actionChips: ['A'],
        edited: true,
      };
      const record = recordToMessage({
        id: 'row',
        conversationId: 'cv-1',
        clientId: original.id,
        role: original.role,
        content: original.text,
        timestamp: original.timestamp,
        status: original.status,
        confidence: original.confidence,
        toolCalls: original.toolCalls,
        questions: original.questions,
        actionChips: original.actionChips,
        edited: original.edited,
      });
      expect(record).toEqual(original);
    });

    it('preserves a streaming status verbatim, so an interrupted run is stored as streaming', () => {
      expect(messageToCreate({ ...base, status: 'streaming' }).status).toBe('streaming');
    });
  });

  describe('normaliseOnRead', () => {
    it('turns a streaming message with output into a complete one', () => {
      // A reload must not resurrect a placeholder as a live stream: the old code left
      // `streaming` in storage and the UI spun forever.
      expect(normaliseOnRead({ status: 'streaming', text: 'partial answer' })).toEqual({
        status: 'complete',
        text: 'partial answer',
      });
    });

    it('turns a streaming message with no output into an error with an explanation', () => {
      const result = normaliseOnRead({ status: 'streaming', text: '' });
      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('Interrupted by a page reload');
    });

    it('leaves every non-streaming status untouched', () => {
      for (const status of ['complete', 'error', 'stopped', 'background'] as const) {
        expect(normaliseOnRead({ status, text: 'x' }).status).toBe(status);
      }
    });
  });
});
