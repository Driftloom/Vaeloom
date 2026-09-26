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

const TOKEN_KEY = 'vaeloom.accessToken';

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

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const ls = window.localStorage.getItem(TOKEN_KEY);
  if (ls) return ls;
  const match = document.cookie.match(/(?:^|; )vaeloom\.accessToken=([^;]*)/);
  if (match && match[1]) {
    const token = decodeURIComponent(match[1]);
    window.localStorage.setItem(TOKEN_KEY, token);
    return token;
  }
  return null;
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `vaeloom.accessToken=${token}; path=/; max-age=86400; SameSite=Lax`;
    window.dispatchEvent(new Event('vaeloom.auth_token_set'));
  }
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    document.cookie =
      'vaeloom.accessToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie =
      'vaeloom.refreshToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    window.dispatchEvent(new Event('vaeloom.auth_token_cleared'));
  }
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
const REFRESH_KEY = 'vaeloom.refreshToken';

export function setRefreshToken(token: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(REFRESH_KEY, token);
    document.cookie = `vaeloom.refreshToken=${token}; path=/; max-age=2592000; SameSite=Lax`;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const ls = window.localStorage.getItem(REFRESH_KEY);
  if (ls) return ls;
  const match = document.cookie.match(/(?:^|; )vaeloom\.refreshToken=([^;]*)/);
  if (match && match[1]) {
    const token = decodeURIComponent(match[1]);
    window.localStorage.setItem(REFRESH_KEY, token);
    return token;
  }
  return null;
}

export function clearRefreshToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REFRESH_KEY);
    document.cookie =
      'vaeloom.refreshToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }
}

async function refreshToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new ApiError(401, 'No refresh token available');
  // Use fetch directly to avoid recursion through request()
  const res = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Failed to refresh token');
  }
  const data = transformKeys<{ accessToken: string; refreshToken?: string }>(await res.json());
  setToken(data.accessToken);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return data.accessToken;
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
    ...(init.headers as Record<string, string> | undefined),
  };
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  // Only attach Bearer token if not calling public auth endpoints (login/signup)
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
  logout(): Promise<void> {
    clearToken();
    clearRefreshToken();
    return Promise.resolve();
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
