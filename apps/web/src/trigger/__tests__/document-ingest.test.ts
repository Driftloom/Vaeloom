/**
 * `@trigger.dev/sdk` ships ESM-only and the app's Jest config does not transform
 * it, so importing the real module fails at parse time on `nanoid` before a single
 * assertion runs. `task()` is only a registry call — the behaviour under test is
 * `runDocumentIngest`, which the task delegates to verbatim — so stubbing the
 * factory is enough to get the module graph loaded.
 */
jest.mock('@trigger.dev/sdk', () => ({
  task: (definition: { id: string; run: unknown }) => definition,
}));

import { describeFailure, runDocumentIngest, type DocumentIngestPayload } from '../document-ingest';

/**
 * These tests exist because the task they cover was silently broken: it POSTed to
 * a route that never existed, sent no credential, and then treated the resulting
 * 404 as success — so every run reported `status: 'completed'` while indexing
 * nothing. Each of the three defects gets its own assertion below, because a
 * single "it works now" test would pass with any one of them still present.
 */

/** The task's own `FetchLike`, structurally typed so no global mocking is needed. */
type FetchStub = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

const PAYLOAD: DocumentIngestPayload = {
  workspace_id: 'ws-abc',
  document_id: 'doc-123',
  filename: 'report.pdf',
};

/** A key the middleware's shape gate accepts: `vael_` + 40 chars. */
const GOOD_KEY = `vael_${'a'.repeat(40)}`;
const ENV = { BACKEND_URL: 'https://api.example.test', VAELOOM_SERVICE_API_KEY: GOOD_KEY };

function respondWith(
  body: unknown,
  response: { ok?: boolean; status?: number; statusText?: string },
) {
  const status = response.status ?? 200;
  const calls: { url: string; init: Parameters<FetchStub>[1] }[] = [];
  const fetchImpl: FetchStub = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok ?? (status >= 200 && status < 300),
      status,
      statusText: response.statusText ?? 'OK',
      json: async () => body,
    };
  };
  return { fetchImpl, calls };
}

describe('runDocumentIngest — the URL it calls', () => {
  it('POSTs to /api/v1/documents/{id}/process with workspace_id as a QUERY parameter', async () => {
    const { fetchImpl, calls } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 12, detail: null },
      { status: 200 },
    );

    await runDocumentIngest(PAYLOAD, fetchImpl, ENV);

    expect(calls).toHaveLength(1);
    // The old path nested the document under /workspaces/{ws}/documents/, which no
    // route ever matched. Asserted on the whole URL, so a reintroduced prefix
    // fails here rather than as a silent 404 in production.
    expect(calls[0].url).toBe(
      'https://api.example.test/api/v1/documents/doc-123/process?workspace_id=ws-abc',
    );
    expect(calls[0].init?.method).toBe('POST');
    // The route declares no body model; sending one would be silently discarded.
    expect(calls[0].init?.body).toBeUndefined();
  });

  it('encodes both ids, so a hostile id cannot escape the path or the query', async () => {
    const { fetchImpl, calls } = respondWith(
      { document_id: 'x', status: 'skipped', chunks_indexed: 0, detail: 'no parser' },
      { status: 200 },
    );

    await runDocumentIngest(
      { workspace_id: 'ws/../admin', document_id: 'a b?c=1' },
      fetchImpl,
      ENV,
    );

    expect(calls[0].url).toBe(
      'https://api.example.test/api/v1/documents/a%20b%3Fc%3D1/process?workspace_id=ws%2F..%2Fadmin',
    );
  });

  it('tolerates a trailing slash on BACKEND_URL', async () => {
    const { fetchImpl, calls } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 1 },
      { status: 200 },
    );
    await runDocumentIngest(PAYLOAD, fetchImpl, {
      ...ENV,
      BACKEND_URL: 'https://api.example.test/',
    });
    expect(calls[0].url).toBe(
      'https://api.example.test/api/v1/documents/doc-123/process?workspace_id=ws-abc',
    );
  });
});

describe('runDocumentIngest — the credential it sends', () => {
  it('sends the service key as X-API-Key, the header the auth middleware reads', async () => {
    const { fetchImpl, calls } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 3 },
      { status: 200 },
    );

    await runDocumentIngest(PAYLOAD, fetchImpl, ENV);

    // Without this the call is a 401: every documents route sits behind
    // AuthMiddleware and none of them is in PUBLIC_PATHS.
    expect(calls[0].init?.headers?.['X-API-Key']).toBe(GOOD_KEY);
  });

  it('accepts BACKEND_API_KEY as an alias for VAELOOM_SERVICE_API_KEY', async () => {
    const { fetchImpl, calls } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 3 },
      { status: 200 },
    );

    await runDocumentIngest(PAYLOAD, fetchImpl, {
      BACKEND_URL: 'https://api.example.test',
      BACKEND_API_KEY: GOOD_KEY,
    });

    expect(calls[0].init?.headers?.['X-API-Key']).toBe(GOOD_KEY);
  });

  it('refuses to call the API at all when no usable key is configured', async () => {
    const { fetchImpl, calls } = respondWith({}, { status: 200 });

    // Failing loudly here is the whole point: the previous version made the call,
    // got a 401, and reported success.
    await expect(
      runDocumentIngest(PAYLOAD, fetchImpl, { BACKEND_URL: 'https://api.example.test' }),
    ).rejects.toThrow(/VAELOOM_SERVICE_API_KEY/);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['wrong prefix', `secret_${'a'.repeat(40)}`],
    ['too short to be a real key', 'vael_short'],
    ['blank', '   '],
  ])('rejects a key that is %s before spending a request', async (_label, value) => {
    const { fetchImpl, calls } = respondWith({}, { status: 200 });

    await expect(
      runDocumentIngest(PAYLOAD, fetchImpl, {
        BACKEND_URL: 'https://api.example.test',
        VAELOOM_SERVICE_API_KEY: value,
      }),
    ).rejects.toThrow(/no usable service credential/);
    expect(calls).toHaveLength(0);
  });
});

describe('runDocumentIngest — a 404 is a failure, not a success', () => {
  it('throws on 404 instead of returning completed', async () => {
    const { fetchImpl } = respondWith(
      { detail: 'Document not found' },
      { ok: false, status: 404, statusText: 'Not Found' },
    );

    // This is the exact defect: `if (!response.ok && response.status !== 404)`
    // fell through to `return { status: 'completed' }`.
    await expect(runDocumentIngest(PAYLOAD, fetchImpl, ENV)).rejects.toThrow(
      /Failed to process document doc-123 \(HTTP 404/,
    );
  });

  it('surfaces the server detail in the thrown message', async () => {
    const { fetchImpl } = respondWith(
      { detail: 'Document has no stored content' },
      { ok: false, status: 404, statusText: 'Not Found' },
    );

    // A bare "Failed: Not Found" is not diagnosable. This is what turns a
    // production 404 into something an operator can act on.
    await expect(runDocumentIngest(PAYLOAD, fetchImpl, ENV)).rejects.toThrow(
      /Document has no stored content/,
    );
  });

  it.each([
    [401, 'Unauthorized', 'Invalid or expired API key'],
    [403, 'Forbidden', 'Insufficient workspace role'],
    [429, 'Too Many Requests', 'Rate limit exceeded'],
  ])('throws on %i and quotes the detail', async (status, statusText, detail) => {
    const { fetchImpl } = respondWith({ detail }, { ok: false, status, statusText });

    await expect(runDocumentIngest(PAYLOAD, fetchImpl, ENV)).rejects.toThrow(
      new RegExp(`HTTP ${status}.*${detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
  });

  it('still throws when the error body is not JSON', async () => {
    // A proxy 502 or an HTML error page: `json()` rejects. The task must not turn
    // an unreadable body into a swallowed failure.
    const fetchImpl: FetchStub = async () => ({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    await expect(runDocumentIngest(PAYLOAD, fetchImpl, ENV)).rejects.toThrow(
      /HTTP 502 Bad Gateway\): Bad Gateway/,
    );
  });

  it('renders a FastAPI validation detail array rather than dropping it', async () => {
    const { fetchImpl } = respondWith(
      { detail: [{ loc: ['query', 'workspace_id'], msg: 'field required' }] },
      { ok: false, status: 422, statusText: 'Unprocessable Entity' },
    );

    await expect(runDocumentIngest(PAYLOAD, fetchImpl, ENV)).rejects.toThrow(
      /workspace_id.*field required/,
    );
  });
});

describe('runDocumentIngest — what it returns comes from the response', () => {
  it('returns the server status and chunk count instead of a hardcoded completed', async () => {
    const { fetchImpl } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 37, detail: null },
      { status: 200 },
    );

    const result = await runDocumentIngest(PAYLOAD, fetchImpl, ENV);

    expect(result.status).toBe('processed');
    expect(result.chunks_indexed).toBe(37);
    expect(result.document_id).toBe('doc-123');
    expect(result.workspace_id).toBe('ws-abc');
    expect(result.detail).toBeNull();
  });

  it('reports a skip as a skip, with its reason', async () => {
    const { fetchImpl } = respondWith(
      {
        document_id: 'doc-123',
        status: 'skipped',
        chunks_indexed: 0,
        detail: 'no parser for .xyz',
      },
      { status: 200 },
    );

    // 200 + skipped is the endpoint's normal answer for an unregistered format, so
    // it resolves. Asserting `status` is what proves the value came from the body.
    const result = await runDocumentIngest(PAYLOAD, fetchImpl, ENV);
    expect(result.status).toBe('skipped');
    expect(result.chunks_indexed).toBe(0);
    expect(result.detail).toBe('no parser for .xyz');
  });

  it('falls back to a zero chunk count rather than reporting NaN', async () => {
    const { fetchImpl } = respondWith(
      { document_id: 'doc-123', status: 'processed' },
      { status: 200 },
    );

    const result = await runDocumentIngest(PAYLOAD, fetchImpl, ENV);
    expect(result.chunks_indexed).toBe(0);
    expect(Number.isNaN(result.chunks_indexed)).toBe(false);
  });

  it('carries an ISO timestamp so a run is traceable in the Trigger log', async () => {
    const { fetchImpl } = respondWith(
      { document_id: 'doc-123', status: 'processed', chunks_indexed: 1 },
      { status: 200 },
    );
    const result = await runDocumentIngest(PAYLOAD, fetchImpl, ENV);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

describe('describeFailure', () => {
  it.each([
    [{ detail: 'boom' }, 'boom'],
    [{ detail: [{ msg: 'x' }] }, '[{"msg":"x"}]'],
    [{ message: 'from a gateway' }, 'from a gateway'],
    [{}, 'Service Unavailable'],
    [null, 'Service Unavailable'],
  ])('reads %#: %j -> %j', (body, expected) => {
    expect(describeFailure(body, 503, 'Service Unavailable')).toBe(expected);
  });

  it('falls back to the status code when there is no status text', () => {
    expect(describeFailure({}, 500, '')).toBe('HTTP 500');
  });
});
