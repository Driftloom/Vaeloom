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

export const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';
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
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `vaeloom.accessToken=${token}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
    document.cookie = 'vaeloom.accessToken=; path=/; max-age=0';
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
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function clearRefreshToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REFRESH_KEY);
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
  if (token) headers['Authorization'] = `Bearer ${token}`;
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

  // CSRF token may have expired server-side (1h TTL) — refresh and retry once.
  if (res.status === 403 && mutating && headers[CSRF_HEADER]) {
    resetCsrfToken();
    const fresh = await getCsrfToken();
    if (fresh) {
      headers[CSRF_HEADER] = fresh;
      res = await fetchWith();
    }
  }

  if (res.status === 401 && token) {
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
          // W-13: route to the purpose-built expired-session page instead of
          // dropping the user on /login with no explanation.
          window.location.href = '/session-expired';
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
      };
      if (body.error) {
        message = body.error.message ?? message;
        code = body.error.code;
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

  // Auth
  signup(body: SignupRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(body) });
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
};
