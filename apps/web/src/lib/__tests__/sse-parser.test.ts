import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

import { agentApi, parseSseBlock } from '../api-client';
import type { SseBlock } from '../api-client';

/**
 * The SSE parser is the only place the wire format of `/agents/chat/stream` is
 * interpreted, and a mistake here is invisible in the UI: an event that fails to
 * parse is delivered as `{ raw: … }`, which the reducer folds as an unknown event
 * type, so the turn silently loses its tokens and falls back to a buffered retry.
 *
 * The cases below are the ones the previous hand-rolled parser got wrong, plus the
 * framing rules it happened to satisfy by accident.
 */

jest.mock('../csrf', () => ({
  CSRF_HEADER: 'X-CSRF-Token',
  API_BASE: '',
  getCsrfToken: () => Promise.resolve('csrf-test-token'),
  resetCsrfToken: () => undefined,
  isMutatingMethod: (method: string | undefined) => method !== 'GET',
}));

function parsed(raw: string): SseBlock {
  const block = parseSseBlock(raw);
  if (!block) throw new Error(`expected a block, got null for ${JSON.stringify(raw)}`);
  return block;
}

describe('parseSseBlock — data lines', () => {
  it('joins multiple data lines with a newline so a split JSON payload parses', () => {
    // The regression: every `data:` line was concatenated with no separator, so a
    // server that chunks a long JSON body at a fixed width produced
    // `{"agent":"resume","confidence":0.9}`, JSON.parse threw, and the whole event
    // degraded to `{ raw: … }`.
    const block = parsed('event: intent\ndata: {"agent":"resume",\ndata: "confidence":0.9}');

    expect(block.event).toBe('intent');
    expect(JSON.parse(block.data)).toEqual({ agent: 'resume', confidence: 0.9 });
  });

  it('leaves no trailing newline after the final data line', () => {
    expect(parsed('data: a\ndata: b').data).toBe('a\nb');
  });

  it('preserves whitespace inside a value, stripping only the one framing space', () => {
    // `.trim()` on each line ate leading indentation and trailing spaces that belong
    // to the payload — visible as collapsed indentation in a streamed code block.
    expect(parsed('data:   indented\ndata:  two spaces  ').data).toBe('  indented\n two spaces  ');
  });

  it('accepts a value written with no space after the field name', () => {
    expect(parsed('data:{"token":"x"}').data).toBe('{"token":"x"}');
  });

  it('treats a field with no colon as that field with an empty value', () => {
    expect(parsed('data\ndata: after').data).toBe('\nafter');
  });
});

describe('parseSseBlock — event names', () => {
  it('defaults to "message" when the block carries no event field', () => {
    expect(parsed('data: {"a":1}').event).toBe('message');
  });

  it('takes the first event name in a block', () => {
    // A conforming server sends one name per block. The previous parser kept the
    // last, so a duplicated or stray trailing `event:` line silently relabelled the
    // event and the reducer dropped it as an unknown type.
    const block = parsed('event: token\ndata: {"token":"x"}\nevent: done\ndata: {"token":"y"}');

    expect(block.event).toBe('token');
    // Both data lines still belong to the one block, so both are joined — an
    // `event:` line does not start a new event, only a blank line does.
    expect(block.data).toBe('{"token":"x"}\n{"token":"y"}');
  });

  it('reports an empty event field as "message", which is what the spec says', () => {
    expect(parsed('event:\ndata: x').event).toBe('message');
  });

  it('does not let a leading space inside a value become part of the event name', () => {
    expect(parsed('event:  token\ndata: x').event).toBe(' token');
  });
});

describe('parseSseBlock — other fields', () => {
  it('ignores comment lines, which are keep-alives carrying no field', () => {
    const block = parsed(': keep-alive\nevent: token\ndata: {"token":"x"}');

    expect(block.event).toBe('token');
    expect(block.data).toBe('{"token":"x"}');
  });

  it('ignores a comment that contains a colon so it cannot be read as a field', () => {
    expect(parsed(':data: not a field\ndata: real').data).toBe('real');
  });

  it('captures the id field as lastEventId', () => {
    expect(parsed('id: 42\ndata: x').lastEventId).toBe('42');
  });

  it('keeps the last id in a block and rejects one containing NUL', () => {
    expect(parsed('id: 1\ndata: x\nid: 2').lastEventId).toBe('2');
    expect(parsed('id: 1\ndata: x\nid: ba\u0000d').lastEventId).toBe('1');
  });

  it('ignores retry and unknown fields rather than folding them into the payload', () => {
    // The old parser's `startsWith('data:')` chain silently dropped these, which was
    // right by luck: the field name was not stripped before reaching the reducer.
    const block = parsed('retry: 3000\nx-vendor: tail\ndata: {"token":"x"}');

    expect(block.data).toBe('{"token":"x"}');
  });
});

describe('parseSseBlock — line endings', () => {
  it('parses a block written with CRLF terminators', () => {
    const block = parsed('event: token\r\ndata: {"token":"x"}\r\ndata: {"token":"y"}');

    expect(block.event).toBe('token');
    expect(block.data).toBe('{"token":"x"}\n{"token":"y"}');
  });

  it('parses a block written with bare CR terminators', () => {
    expect(parsed('event: token\rdata: x').data).toBe('x');
  });

  it('leaves no carriage return inside a CRLF payload value', () => {
    expect(parsed('data: x\r\ndata: y').data).toBe('x\ny');
  });
});

describe('parseSseBlock — blocks that dispatch nothing', () => {
  it.each([
    ['an empty string', ''],
    ['whitespace only', '   \n  '],
    ['a comment-only keep-alive', ': ping'],
    ['an event name with no data', 'event: token'],
    ['retry only', 'retry: 3000'],
  ])('returns null for %s', (_label, raw) => {
    // The spec dispatches nothing when the data buffer is empty. Returning a block
    // with empty data would push `{ raw: '' }` into the reducer on every keep-alive.
    expect(parseSseBlock(raw)).toBeNull();
  });
});

/* ------------------------------------------------------------ chatStream ---- */

/**
 * jsdom 26 exposes none of `fetch`, `TextDecoder` or `TextEncoder`. A real browser
 * always has all three, so they are restored from Node here rather than in
 * `jest.setup.js`, which stays limited to the gaps every suite hits.
 */
interface StreamReader {
  read: () => Promise<{ done: boolean; value: Uint8Array | undefined }>;
}

function readerOver(chunks: readonly string[]): StreamReader {
  const encoder = new NodeTextEncoder();
  let index = 0;
  return {
    read: () => {
      if (index >= chunks.length) return Promise.resolve({ done: true, value: undefined });
      const next = chunks[index];
      index += 1;
      return Promise.resolve({ done: false, value: encoder.encode(next ?? '') });
    },
  };
}

/** Serves the chunks in order, then closes. Deliberately not a `Response`: jsdom has none. */
function stubStreamFetch(chunks: readonly string[]): jest.Mock {
  const fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      body: { getReader: () => readerOver(chunks) },
    }),
  );
  Object.defineProperty(globalThis, 'fetch', {
    writable: true,
    configurable: true,
    value: fetchMock,
  });
  Object.defineProperty(globalThis, 'TextDecoder', {
    writable: true,
    configurable: true,
    value: NodeTextDecoder,
  });
  return fetchMock as unknown as jest.Mock;
}

interface Seen {
  event: string;
  data: Record<string, unknown>;
}

function collector(): {
  seen: Seen[];
  onEvent: (event: string, data: Record<string, unknown>) => void;
} {
  const seen: Seen[] = [];
  return { seen, onEvent: (event, data) => seen.push({ event, data }) };
}

const BODY = { workspaceId: 'ws-1', message: 'hello' };

describe('agentApi.chatStream', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis as unknown as Record<string, unknown>, 'fetch');
  });

  it('emits one callback per event with the event name and parsed payload', async () => {
    stubStreamFetch([
      'event: intent\ndata: {"agent":"resume"}\n\n',
      'event: token\ndata: {"token":"Hi"}\n\n',
      'event: done\ndata: {"status":"ok"}\n\n',
    ]);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([
      { event: 'intent', data: { agent: 'resume' } },
      { event: 'token', data: { token: 'Hi' } },
      { event: 'done', data: { status: 'ok' } },
    ]);
  });

  it('reassembles an event whose JSON payload was split across two data lines', async () => {
    stubStreamFetch(['event: token\ndata: {"token":\ndata: "one"}\n\n']);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.data).toEqual({ token: 'one' });
  });

  it('splits CRLF-separated events', async () => {
    stubStreamFetch([
      'event: intent\r\ndata: {"agent":"resume"}\r\n\r\nevent: token\r\ndata: {"token":"x"}\r\n\r\n',
    ]);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([
      { event: 'intent', data: { agent: 'resume' } },
      { event: 'token', data: { token: 'x' } },
    ]);
  });

  it('splits a blank line whose CR and LF arrive in different chunks', async () => {
    // The chunk boundary lands between the CR and the LF of the blank line, so the
    // held-CR path has to emit exactly one terminator. Dropping the pair merged two
    // events into one; emitting two inserted a phantom empty line and lost an event.
    stubStreamFetch([
      'event: token\r\ndata: {"token":"a"}\r',
      '\n\r\n',
      'event: done\r\ndata: {"status":"ok"}\r\n\r\n',
    ]);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([
      { event: 'token', data: { token: 'a' } },
      { event: 'done', data: { status: 'ok' } },
    ]);
  });

  it('splits on a bare CR blank line, which a rewriting proxy emits', async () => {
    stubStreamFetch([
      'event: intent\rdata: {"agent":"resume"}\r\r',
      'event: token\rdata: {"token":"x"}\r\r',
    ]);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([
      { event: 'intent', data: { agent: 'resume' } },
      { event: 'token', data: { token: 'x' } },
    ]);
  });

  it('handles an event whose terminator and payload arrive in different chunks', async () => {
    stubStreamFetch([
      'event: token\ndata: {"token":"a"}\n',
      '\n',
      'event: done\ndata: {"status":"ok"}\n\n',
    ]);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen.map((s) => s.event)).toEqual(['token', 'done']);
  });

  it('flushes a final event that the server never terminated with a blank line', async () => {
    stubStreamFetch(['event: token\ndata: {"token":"x"}']);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([{ event: 'token', data: { token: 'x' } }]);
  });

  it('emits nothing for a stream that is only keep-alive comments', async () => {
    stubStreamFetch([': ping\n\n: ping\n\n']);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([]);
  });

  it('delivers an unparseable payload as raw text rather than dropping the event', async () => {
    stubStreamFetch(['event: token\ndata: not json\n\n']);
    const { seen, onEvent } = collector();

    await agentApi.chatStream(BODY, onEvent);

    expect(seen).toEqual([{ event: 'token', data: { raw: 'not json' } }]);
  });
});
