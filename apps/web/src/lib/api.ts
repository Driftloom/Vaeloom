import { CSRF_HEADER, getCsrfToken, isMutatingMethod, resetCsrfToken } from './csrf';

import type {
  AuthResponse,
  CreateWorkspaceRequest,
  LoginRequest,
  MeResponse,
  SignupRequest,
  Workspace,
  Memory,
  Agent,
  AgentExecution,
  Event,
  EventSubscription,
  PaginatedResponse,
} from '@vaeloom/shared-types';

export interface SessionItem {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  status: string;
}

export interface SessionListResponse {
  sessions: SessionItem[];
}

export const API_BASE = (function () {
  if (typeof window !== 'undefined') {
    const envUrl = process.env['NEXT_PUBLIC_API_URL'];
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return '';
    }
    return envUrl;
  }
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://127.0.0.1:8000';
})();
export const API_PREFIX = '/api/v1';

/**
 * Session storage (GAP-AUTH-01).
 *
 * The access and refresh credentials are HttpOnly cookies. This module no longer
 * stores either of them: it cannot, because the browser does not expose them to
 * JavaScript, and that is the point. A credential held in `localStorage` is
 * readable by any script on the origin, so one XSS payload exfiltrates a session
 * that outlives the tab and cannot be revoked by clearing storage.
 *
 * What remains here is a *marker* recording that a session probably exists. It
 * contains no secret, and it is only ever used to decide whether it is worth
 * asking the server who the user is. Every route that actually authenticates
 * does so with the cookie the browser attaches automatically, and the server is
 * the only authority on whether that cookie is still valid.
 *
 * The exported names are kept because ~40 modules import them, and because the
 * SDK-style surface is part of this module's contract. `getToken()` deliberately
 * returns `null` now: returning a placeholder would build an `Authorization:
 * Bearer <placeholder>` header that fails closed but produces confusing 401s.
 */
const SESSION_MARKER_KEY = 'vaeloom.session';

/** Legacy keys from before the HttpOnly migration, removed on first load. */
const LEGACY_TOKEN_KEYS = ['vaeloom.accessToken', 'vaeloom.refreshToken'];

/**
 * Header that tells the API this caller wants credentials in cookies only, so
 * the response body carries no token. Without it the backend would keep
 * returning the tokens for the SDK's benefit and the web bundle would hold one
 * again.
 */
const AUTH_MODE_HEADER = 'X-Auth-Mode';

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function transformKeys<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map(transformKeys) as T;
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        toCamelCase(k),
        transformKeys(v),
      ]),
    ) as T;
  }
  return obj as T;
}

/**
 * Purge tokens written by an older build.
 *
 * A user who signed in before this change still has a usable access and refresh
 * token sitting in `localStorage`. Nothing would ever remove them, so the
 * migration would silently leave the vulnerability in place for exactly the
 * people who have been logged in longest. This runs once per page load.
 */
function purgeLegacyTokens(): void {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_TOKEN_KEYS) {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Private browsing or a disabled storage partition. Not fatal: the cookie
      // is what authenticates, and the stale value is unreachable by this build.
    }
  }
}

purgeLegacyTokens();

/**
 * Whether a session marker is present.
 *
 * A hint, never an authorisation. Callers that gate UI on this must still treat
 * a `true` as "ask the server", because the cookie can be expired or revoked
 * while the marker remains.
 */
export function hasSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SESSION_MARKER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Always `null`.
 *
 * Retained so the ~40 modules that imported it keep compiling, and so no caller
 * can accidentally build an `Authorization` header from a placeholder. Use
 * `hasSession()` to ask whether a session might exist.
 */
export function getToken(): string | null {
  return null;
}

export function getRefreshToken(): string | null {
  return null;
}

export function setToken(_token?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_MARKER_KEY, '1');
  } catch {
    // Storage unavailable; the cookie still authenticates.
  }
  window.dispatchEvent(new Event('vaeloom.auth_token_set'));
}

export function setRefreshToken(_token?: string): void {
  // The refresh credential is a cookie. Nothing to persist. `setToken` already
  // set the marker when the session was established.
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_MARKER_KEY);
    for (const key of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('vaeloom.auth_token_cleared'));
}

export function clearRefreshToken(): void {
  // Nothing persisted to clear; `clearToken` removes the marker.
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Correlation ID echoed by the backend (or the client-generated one). */
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

/**
 * Rotate the session.
 *
 * Sends no credential in the body: the refresh token is an HttpOnly cookie the
 * browser attaches on its own, and this function cannot read it. The response
 * therefore carries no new token either — the rotated cookies arrive in
 * `Set-Cookie` — so the return value is a presence signal, not a credential.
 *
 * A CSRF token is required because, unlike a body field, a cookie *is* attached
 * to cross-site requests. Without it an attacker page could force rotations,
 * and since rotation invalidates the previous token, repeating that locks the
 * user out.
 */
async function refreshToken(): Promise<string> {
  const csrf = await getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [AUTH_MODE_HEADER]: 'cookie',
  };
  if (csrf) headers['X-CSRF-Token'] = csrf;

  // Use fetch directly to avoid recursion through request()
  const res = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 403) {
      // The CSRF token expired or was never fetched. Drop it and let the caller
      // retry once, matching the recovery path in request().
      resetCsrfToken();
    }
    throw new ApiError(res.status, 'Failed to refresh token');
  }
  // Re-establish the marker: the session rotated, so it still exists.
  setToken();
  return 'cookie-session';
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const mutating = isMutatingMethod(init.method);
  const isAuthEndpoint =
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/auth/refresh');

  // W-13: every request carries a correlation ID; the backend echoes it back
  // (CorrelationIDMiddleware) and we expose it for support/debug context.
  const requestId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Request-ID': requestId,
    // Ask for cookie-only credentials so the response body carries no token.
    [AUTH_MODE_HEADER]: 'cookie',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  // No Authorization header: the session is the HttpOnly cookie the browser
  // attaches on its own. The branch is retained only so a caller that somehow
  // supplies a token cannot have it silently dropped.
  if (token && !isAuthEndpoint) headers['Authorization'] = `Bearer ${token}`;
  if (!headers['X-Workspace-ID']) {
    const urlParamsMatch = path.match(/[?&]workspace_?id=([a-f0-9-]+)/i);
    if (urlParamsMatch && urlParamsMatch[1]) {
      headers['X-Workspace-ID'] = urlParamsMatch[1];
    } else if (typeof window !== 'undefined') {
      const locMatch = window.location.pathname.match(/\/workspace\/([a-f0-9-]+)/i);
      if (locMatch && locMatch[1]) {
        headers['X-Workspace-ID'] = locMatch[1];
      }
    }
    if (!headers['X-Workspace-ID'] && typeof init.body === 'string') {
      try {
        const parsed = JSON.parse(init.body);
        if (parsed.workspace_id) {
          headers['X-Workspace-ID'] = parsed.workspace_id;
        } else if (parsed.workspaceId) {
          headers['X-Workspace-ID'] = parsed.workspaceId;
        }
      } catch {
        /* non-JSON body */
      }
    }
  }
  if (mutating) {
    const csrf = await getCsrfToken();
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const fetchWith = () =>
    fetch(`${API_BASE}${API_PREFIX}${path}`, { ...init, credentials: 'include', headers });

  let res = await fetchWith();

  // Capture the backend's correlation ID for error surfacing.
  const serverCorrelationId =
    res.headers.get('x-correlation-id') ?? res.headers.get('x-request-id') ?? requestId;

  // CSRF token may have expired server-side (1h TTL) or was missing — refresh and retry once.
  if (res.status === 403 && mutating) {
    resetCsrfToken();
    const fresh = await getCsrfToken();
    if (fresh && headers[CSRF_HEADER] !== fresh) {
      headers[CSRF_HEADER] = fresh;
      res = await fetchWith();
    }
  }

  // Token refresh logic: ONLY for non-auth endpoints when token is present
  if (res.status === 401 && token && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshToken();
        setToken(newToken);
        isRefreshing = false;
        refreshQueue.forEach((q) => q.resolve(newToken));
        refreshQueue = [];
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetchWith();
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach((q) => q.reject(err));
        refreshQueue = [];
        clearToken();
        clearRefreshToken();
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const isAuthPage =
            currentPath === '/login' ||
            currentPath === '/signup' ||
            currentPath === '/session-expired' ||
            currentPath === '/' ||
            currentPath.startsWith('/terms') ||
            currentPath.startsWith('/privacy');

          // ONLY redirect to /session-expired if the user was inside an active protected workspace route
          if (!isAuthPage && currentPath.startsWith('/workspace')) {
            window.location.href = '/session-expired';
          }
        }
        throw err;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetchWith();
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; code?: string };
        message?: string | string[];
        detail?: string | Array<{ msg?: string; loc?: string[] }>;
      };
      if (body.error) {
        message = body.error.message ?? message;
        code = body.error.code;
      } else if (body?.detail) {
        if (typeof body.detail === 'string') {
          message = body.detail;
        } else if (Array.isArray(body.detail)) {
          message = body.detail
            .map((d) => (typeof d === 'string' ? d : (d?.msg ?? JSON.stringify(d))))
            .join(', ');
        }
      } else if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, code, serverCorrelationId);
  }

  return (res.status === 204 ? undefined : transformKeys(await res.json())) as T;
}

export const api = {
  /** Low-level request helper for endpoints not yet wrapped above. */
  request<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, init);
  },
  get<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>(path, { ...init, method: 'DELETE' });
  },

  // Auth
  signup(body: SignupRequest): Promise<AuthResponse> {
    const payload = {
      email: body.email,
      password: body.password,
      display_name: body.displayName,
      terms_accepted: body.termsAccepted ?? true,
    };
    return request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
  },
  login(body: LoginRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  me(): Promise<MeResponse> {
    return request<MeResponse>('/auth/me');
  },
  refresh(body: { refreshToken: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify(body) });
  },
  async logout(): Promise<void> {
    try {
      await request<void>('/auth/logout', { method: 'POST' });
    } catch {
      // non-fatal if backend unreachable
    } finally {
      clearToken();
      clearRefreshToken();
    }
  },
  listSessions(): Promise<SessionListResponse> {
    return request<SessionListResponse>('/auth/sessions');
  },
  revokeSession(sessionId: string): Promise<void> {
    return request<void>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  },
  revokeOtherSessions(): Promise<{ status: string; revokedCount: number }> {
    return request<{ status: string; revokedCount: number }>('/auth/sessions/revoke-others', {
      method: 'POST',
    });
  },

  // MFA
  mfa: {
    setup(): Promise<{ secret: string; otpauthUrl: string; recoveryCodes?: string[] }> {
      return request<{ secret: string; otpauthUrl: string; recoveryCodes?: string[] }>(
        '/auth/mfa/setup',
        { method: 'POST' },
      );
    },
    enable(code: string): Promise<{ status: string; recoveryCodes: string[] }> {
      return request<{ status: string; recoveryCodes: string[] }>('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
    verify(mfaToken: string, code: string): Promise<AuthResponse> {
      return request<AuthResponse>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ mfa_token: mfaToken, code }),
      });
    },
  },

  // Workspaces
  createWorkspace(body: CreateWorkspaceRequest = {}): Promise<Workspace> {
    return request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(body) });
  },
  listWorkspaces(): Promise<Workspace[]> {
    return request<Workspace[]>('/workspaces');
  },

  // Memories
  memories: {
    create(body: {
      title: string;
      type: string;
      summary?: string;
      content?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }): Promise<Memory> {
      return request<Memory>('/memories', { method: 'POST', body: JSON.stringify(body) });
    },
    list(params?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
      const qs = params
        ? '?' + new URLSearchParams(params as Record<string, string>).toString()
        : '';
      return request<PaginatedResponse<Memory>>(`/memories${qs}`);
    },
    get(id: string): Promise<Memory> {
      return request<Memory>(`/memories/${id}`);
    },
    update(
      id: string,
      body: Partial<{ title: string; summary: string; content: string; tags: string[] }>,
    ): Promise<Memory> {
      return request<Memory>(`/memories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    delete(id: string): Promise<void> {
      return request<void>(`/memories/${id}`, { method: 'DELETE' });
    },
    search(query: string, filters?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
      return request<PaginatedResponse<Memory>>('/memories/search', {
        method: 'POST',
        body: JSON.stringify({ query, ...filters }),
      });
    },
  },

  // Agents
  agents: {
    create(body: {
      name: string;
      category: string;
      description?: string;
      config?: Record<string, unknown>;
    }): Promise<Agent> {
      return request<Agent>('/agents', { method: 'POST', body: JSON.stringify(body) });
    },
    list(params?: Record<string, unknown>): Promise<PaginatedResponse<Agent>> {
      const qs = params
        ? '?' + new URLSearchParams(params as Record<string, string>).toString()
        : '';
      return request<PaginatedResponse<Agent>>(`/agents${qs}`);
    },
    get(id: string): Promise<Agent> {
      return request<Agent>(`/agents/${id}`);
    },
    execute(id: string, input: Record<string, unknown>): Promise<AgentExecution> {
      return request<AgentExecution>(`/agents/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
    },
    executions(agentId: string): Promise<PaginatedResponse<AgentExecution>> {
      return request<PaginatedResponse<AgentExecution>>(`/agents/${agentId}/executions`);
    },
  },

  // Events
  events: {
    publish(body: {
      type: string;
      source: string;
      category: string;
      payload: Record<string, unknown>;
      priority?: string;
    }): Promise<Event> {
      return request<Event>('/events', { method: 'POST', body: JSON.stringify(body) });
    },
    list(): Promise<PaginatedResponse<Event>> {
      return request<PaginatedResponse<Event>>('/events');
    },
    createSubscription(body: {
      eventType: string;
      handlerId: string;
      handlerType: string;
      config?: Record<string, unknown>;
    }): Promise<EventSubscription> {
      return request<EventSubscription>('/events/subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    listSubscriptions(): Promise<PaginatedResponse<EventSubscription>> {
      return request<PaginatedResponse<EventSubscription>>('/events/subscriptions');
    },
  },

  // Search
  search(body: { query: string; sources?: string[]; limit?: number; offset?: number }): Promise<{
    results: Array<{
      id: string;
      text: string;
      score: number;
      source: string;
      metadata: Record<string, unknown>;
    }>;
    total: number;
  }> {
    return request('/search', { method: 'POST', body: JSON.stringify(body) });
  },

  // Integrations
  integrations: {
    create(body: {
      name: string;
      provider: string;
      config?: Record<string, unknown>;
    }): Promise<unknown> {
      return request('/integrations', { method: 'POST', body: JSON.stringify(body) });
    },
    list(): Promise<PaginatedResponse<unknown>> {
      return request<PaginatedResponse<unknown>>('/integrations');
    },
    update(
      id: string,
      body: { name?: string; config?: Record<string, unknown> },
    ): Promise<unknown> {
      return request(`/integrations/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    delete(id: string): Promise<void> {
      return request<void>(`/integrations/${id}`, { method: 'DELETE' });
    },
    sync(id: string): Promise<{ synced: boolean; message: string }> {
      return request(`/integrations/${id}/sync`, { method: 'POST' });
    },
  },

  // Connectors
  connectors: {
    list(workspaceId?: string, type?: string): Promise<any[]> {
      const qs = new URLSearchParams();
      if (workspaceId) qs.set('workspace_id', workspaceId);
      if (type) qs.set('type', type);
      const qStr = qs.toString() ? `?${qs.toString()}` : '';
      return request<any[]>(`/connectors${qStr}`);
    },
    get(id: string): Promise<any> {
      return request(`/connectors/${id}`);
    },
    create(body: Record<string, any>): Promise<any> {
      return request('/connectors', { method: 'POST', body: JSON.stringify(body) });
    },
    update(id: string, body: Record<string, any>): Promise<any> {
      return request(`/connectors/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    delete(id: string): Promise<void> {
      return request<void>(`/connectors/${id}`, { method: 'DELETE' });
    },
    sync(id: string): Promise<{ status: string; records_synced?: number; error?: string }> {
      return request(`/connectors/${id}/sync`, { method: 'POST' });
    },
    getSyncStatus(id: string): Promise<any> {
      return request(`/connectors/${id}/sync/status`);
    },
    test(id: string): Promise<any> {
      return request(`/connectors/${id}/test`, { method: 'POST' });
    },
    health(id: string): Promise<any> {
      return request(`/connectors/${id}/health`);
    },
    listMcpTools(id: string, refresh = false): Promise<any[]> {
      return request(`/connectors/${id}/mcp/tools?refresh=${refresh}`);
    },
    refreshMcpTools(id: string): Promise<any[]> {
      return request(`/connectors/${id}/mcp/tools/refresh`, { method: 'POST' });
    },
    syncMcp(id: string, workspaceId?: string): Promise<any> {
      return request(`/connectors/${id}/mcp/sync`, {
        method: 'POST',
        body: JSON.stringify(workspaceId ? { workspace_id: workspaceId } : {}),
      });
    },
    callMcp(id: string, toolName: string, args: Record<string, any> = {}): Promise<any> {
      return request(`/connectors/${id}/mcp/call`, {
        method: 'POST',
        body: JSON.stringify({ tool_name: toolName, arguments: args }),
      });
    },
    builtinMcp(): Promise<{ builtin_servers: any[] }> {
      return request('/connectors/mcp/builtin');
    },
    composioStatus(): Promise<{ enabled: boolean; popular_apps: any[] }> {
      return request('/connectors/composio/status');
    },
    composioAuthUrl(app: string, workspaceId: string, redirectUrl?: string): Promise<any> {
      return request('/connectors/composio/auth-url', {
        method: 'POST',
        body: JSON.stringify({ app, workspace_id: workspaceId, redirect_url: redirectUrl }),
      });
    },
    composioSync(workspaceId: string): Promise<any> {
      return request('/connectors/composio/sync', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    },
  },

  // Billing
  billing: {
    usage(params?: { metric?: string; from?: string; to?: string }): Promise<any[]> {
      const qs = params
        ? '?' + new URLSearchParams(params as Record<string, string>).toString()
        : '';
      return request<any[]>(`/billing/usage${qs}`);
    },
    subscription(): Promise<unknown> {
      return request('/billing/subscription');
    },
    createSubscription(plan: string): Promise<unknown> {
      return request('/billing/subscription', { method: 'POST', body: JSON.stringify({ plan }) });
    },
  },

  // Sovereignty & Verifiable Credentials
  sovereignty: {
    getIdentity(): Promise<{
      did: string;
      publicKeyBase64: string;
      didDocument: Record<string, unknown>;
      createdAt: string;
    }> {
      return request('/sovereignty/identity');
    },
    listCredentials(
      workspaceId: string,
      credentialType?: string,
    ): Promise<{
      credentials: Array<{
        id: string;
        credentialType: string;
        subjectDid: string;
        issuerDid: string;
        claims: Record<string, any>;
        status: string;
        createdAt: string;
      }>;
      total: number;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      if (credentialType) qs.set('credential_type', credentialType);
      return request(`/sovereignty/credentials?${qs.toString()}`);
    },
    getCredential(workspaceId: string, credentialId: string): Promise<Record<string, unknown>> {
      return request(`/sovereignty/credentials/${credentialId}?workspace_id=${workspaceId}`);
    },
    verifyCredential(credential: Record<string, unknown>): Promise<{
      isValid: boolean;
      issuer: string;
      subject: string;
      credentialType: string;
      claimsVerified: boolean;
      signatureVerified: boolean;
      reason?: string | null;
      checkedAt: string;
    }> {
      return request('/sovereignty/credentials/verify', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
    },
    issueCapability(body: {
      workspace_id: string;
      capability_tag: string;
      validation_tier: string;
      evidence: string[];
    }): Promise<Record<string, unknown>> {
      return request('/sovereignty/credentials/issue/capability', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    pullSyncDeltas(
      workspaceId: string,
      sinceHlc?: string,
    ): Promise<{
      deltas: Array<any>;
      total: number;
      latestHlc: string | null;
      hasMore: boolean;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      if (sinceHlc) qs.set('since_hlc', sinceHlc);
      return request(`/sovereignty/sync/pull?${qs.toString()}`);
    },
  },
  anticipation: {
    listProposals(
      workspaceId: string,
      status?: string,
    ): Promise<{
      proposals: Array<{
        id: string;
        triggerType: string;
        title: string;
        summary: string;
        proposedAction: string;
        actionPayload: Record<string, any>;
        urgency: string;
        status: string;
        relevanceScore: number;
        scheduledFor?: string | null;
        dismissedReason?: string | null;
        createdAt: string;
      }>;
      total: number;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      if (status) qs.set('status', status);
      return request(`/anticipation/proposals?${qs.toString()}`);
    },
    scan(workspaceId: string): Promise<{
      proposals: Array<{
        id: string;
        triggerType: string;
        title: string;
        summary: string;
        proposedAction: string;
        actionPayload: Record<string, any>;
        urgency: string;
        status: string;
        relevanceScore: number;
        scheduledFor?: string | null;
        dismissedReason?: string | null;
        createdAt: string;
      }>;
      total: number;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      return request(`/anticipation/scan?${qs.toString()}`, {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    },
    acceptProposal(
      workspaceId: string,
      proposalId: string,
    ): Promise<{
      id: string;
      triggerType: string;
      title: string;
      summary: string;
      proposedAction: string;
      actionPayload: Record<string, any>;
      urgency: string;
      status: string;
      relevanceScore: number;
      scheduledFor?: string | null;
      dismissedReason?: string | null;
      createdAt: string;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      return request(`/anticipation/proposals/${proposalId}/accept?${qs.toString()}`, {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    },
    dismissProposal(
      workspaceId: string,
      proposalId: string,
      reason?: string,
    ): Promise<{
      id: string;
      triggerType: string;
      title: string;
      summary: string;
      proposedAction: string;
      actionPayload: Record<string, any>;
      urgency: string;
      status: string;
      relevanceScore: number;
      scheduledFor?: string | null;
      dismissedReason?: string | null;
      createdAt: string;
    }> {
      const qs = new URLSearchParams({ workspace_id: workspaceId });
      return request(`/anticipation/proposals/${proposalId}/dismiss?${qs.toString()}`, {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId, reason }),
      });
    },
  },
};
