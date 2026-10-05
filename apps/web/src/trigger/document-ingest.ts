import { task } from '@trigger.dev/sdk';

export interface DocumentIngestPayload {
  workspace_id: string;
  document_id: string;
  filename?: string;
  requested_by?: string;
}

/** The subset of `Response` this task reads. Keeps the unit test free of globals. */
type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

/** What the backend answers with on success. Snake_case: this is the raw wire shape. */
interface ProcessWireResponse {
  document_id?: string;
  status?: string;
  chunks_indexed?: number;
  detail?: string | null;
}

/**
 * The service credential, resolved from the environment.
 *
 * WHY AN API KEY AND NOT A USER JWT
 *
 * `getToken()` (`lib/api.ts:197`) reads a browser session, which does not exist
 * in a Trigger worker. The repo's existing service-to-service mechanism is the
 * API key the auth middleware already accepts: `X-API-Key: vael_<...>`, or
 * `Authorization: Bearer vael_<...>` (`apps/api/src/api/middleware/auth.py:84`,
 * `:92-97` shape gate, `:100-142` lookup). The middleware resolves it to a user
 * id and tenant before the route runs, so `_verify_workspace_access` still
 * applies — the key is a credential, not a bypass.
 *
 * THE KEY NEEDS A WRITE-CAPABLE IDENTITY. `/documents/{id}/process` is gated on
 * `_ROLES_WRITE` plus `required_permission="write"`
 * (`routers/documents.py:1094-1100`), so a key belonging to a viewer-role member
 * gets a 403, not a 200 with zero chunks. Nothing in this task can detect that
 * ahead of the call; the 403's `detail` is what makes it diagnosable.
 *
 * `VAELOOM_SERVICE_API_KEY` is the canonical name; `BACKEND_API_KEY` is accepted
 * as an alias because the web app already namespaces backend-facing variables
 * that way (`BACKEND_URL`).
 */
function serviceApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env['VAELOOM_SERVICE_API_KEY'] ?? env['BACKEND_API_KEY'];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // The middleware rejects anything that is not `vael_`-prefixed and at least 20
  // characters (`auth.py:92-97`), so failing here is a better error than a 401.
  if (!trimmed.startsWith('vael_') || trimmed.length < 20) return null;
  return trimmed;
}

/**
 * Pull the human-readable reason out of a FastAPI error body.
 *
 * FastAPI's `HTTPException` bodies are `{"detail": "..."}` or, for validation
 * errors, `{"detail": [{...}]}`. Both are handled; anything else falls back to
 * the status line so the thrown message is never empty.
 */
export function describeFailure(body: unknown, status: number, statusText: string): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (Array.isArray(detail) && detail.length > 0) return JSON.stringify(detail);
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return statusText || `HTTP ${status}`;
}

export interface DocumentIngestResult {
  /** The server's own verdict. Never invented here. */
  status: string;
  document_id: string;
  workspace_id: string;
  /** The server's count. `0` when the response omitted it. */
  chunks_indexed: number;
  /** The server's explanation, or `null`. */
  detail: string | null;
  timestamp: string;
}

/**
 * The ingest call, extracted from the `task` wrapper so it can be unit-tested
 * without booting Trigger.dev.
 *
 * THE THREE DEFECTS THIS REPLACES
 *
 * 1. It POSTed to `/api/v1/workspaces/{workspace_id}/documents/{document_id}/process`.
 *    No such route exists — the real one is `/api/v1/documents/{document_id}/process`
 *    with `workspace_id` as a QUERY parameter. Every run was a 404.
 * 2. It sent no `Authorization`/`X-API-Key` header. Every documents route sits
 *    behind `AuthMiddleware` (`auth.py:64-68`), so even the corrected path would
 *    have been a 401.
 * 3. `if (!response.ok && response.status !== 404)` treated a 404 as success and
 *    returned a hardcoded `status: 'completed'` for every outcome. A run that
 *    indexed nothing looked identical to a run that indexed a document, which is
 *    why the breakage was invisible.
 *
 * Now: any non-2xx throws, 404 included, with the server's `detail` in the
 * message; and the returned `status`/`chunks_indexed` come from the response
 * body rather than from a literal.
 *
 * `status: 'skipped'` resolves, deliberately. The endpoint answers 200 for a file
 * whose format has no registered parser, and treats that as a normal outcome
 * (`routers/documents.py:1170-1175`) — the desired end state already holds and
 * there is nothing to retry. A 500 there means a registered parser failed, and
 * that throws.
 */
export async function runDocumentIngest(
  payload: DocumentIngestPayload,
  fetchImpl: FetchLike,
  env: NodeJS.ProcessEnv = process.env,
  backendUrl: string = env['BACKEND_URL'] || 'http://localhost:8000',
): Promise<DocumentIngestResult> {
  const apiKey = serviceApiKey(env);
  if (!apiKey) {
    throw new Error(
      'vaeloom.ingest-document: no usable service credential. Set VAELOOM_SERVICE_API_KEY ' +
        '(or BACKEND_API_KEY) to an enabled API key of the form vael_<32+ chars>. Refusing to ' +
        'call the API unauthenticated — the request would 401, and the previous version of this ' +
        'task reported success anyway.',
    );
  }

  const url =
    `${backendUrl.replace(/\/+$/, '')}/api/v1/documents/` +
    `${encodeURIComponent(payload.document_id)}/process` +
    `?workspace_id=${encodeURIComponent(payload.workspace_id)}`;

  // No request body: the route takes `workspace_id` as a query parameter and
  // declares no body model, so a JSON body would be ignored.
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A 204, an empty body or an HTML error page from a proxy. Leave `body`
    // null and let the branch below describe the failure from the status.
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to process document ${payload.document_id} (HTTP ${response.status} ${response.statusText}): ` +
        describeFailure(body, response.status, response.statusText),
    );
  }

  const wire = (body ?? {}) as ProcessWireResponse;
  return {
    status: typeof wire.status === 'string' ? wire.status : 'processed',
    document_id: wire.document_id ?? payload.document_id,
    workspace_id: payload.workspace_id,
    chunks_indexed:
      typeof wire.chunks_indexed === 'number' && Number.isFinite(wire.chunks_indexed)
        ? wire.chunks_indexed
        : 0,
    detail: typeof wire.detail === 'string' ? wire.detail : null,
    timestamp: new Date().toISOString(),
  };
}

export const documentIngestTask = task({
  id: 'vaeloom.ingest-document',
  run: async (payload: DocumentIngestPayload) => {
    console.log(
      `[vaeloom.ingest-document] Ingesting document ${payload.document_id} in workspace ${payload.workspace_id}`,
    );
    return runDocumentIngest(payload, fetch as unknown as FetchLike);
  },
});
