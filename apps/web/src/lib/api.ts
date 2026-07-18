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

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

const TOKEN_KEY = 'vaeloom.accessToken';

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
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Failed to refresh token');
  }
  const data = (await res.json()) as { accessToken: string; refreshToken?: string };
  setToken(data.accessToken);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return data.accessToken;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${API_PREFIX}${path}`, { ...init, headers });

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
        res = await fetch(`${API_BASE}${API_PREFIX}${path}`, { ...init, headers });
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach((q) => q.reject(err));
        refreshQueue = [];
        clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw err;
      }
    } else {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${API_PREFIX}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string }; message?: string | string[] };
      if (body.error) {
        message = body.error.message ?? message;
        code = body.error.code;
      } else if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, code);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
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
    create(body: { title: string; type: string; summary?: string; content?: string; tags?: string[]; metadata?: Record<string, unknown> }): Promise<Memory> {
      return request<Memory>('/memories', { method: 'POST', body: JSON.stringify(body) });
    },
    list(params?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<PaginatedResponse<Memory>>(`/memories${qs}`);
    },
    get(id: string): Promise<Memory> {
      return request<Memory>(`/memories/${id}`);
    },
    update(id: string, body: Partial<{ title: string; summary: string; content: string; tags: string[] }>): Promise<Memory> {
      return request<Memory>(`/memories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    delete(id: string): Promise<void> {
      return request<void>(`/memories/${id}`, { method: 'DELETE' });
    },
    search(query: string, filters?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
      return request<PaginatedResponse<Memory>>('/memories/search', { method: 'POST', body: JSON.stringify({ query, ...filters }) });
    },
  },

  // Agents
  agents: {
    create(body: { name: string; category: string; description?: string; config?: Record<string, unknown> }): Promise<Agent> {
      return request<Agent>('/agents', { method: 'POST', body: JSON.stringify(body) });
    },
    list(params?: Record<string, unknown>): Promise<PaginatedResponse<Agent>> {
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<PaginatedResponse<Agent>>(`/agents${qs}`);
    },
    get(id: string): Promise<Agent> {
      return request<Agent>(`/agents/${id}`);
    },
    execute(id: string, input: Record<string, unknown>): Promise<AgentExecution> {
      return request<AgentExecution>(`/agents/${id}/execute`, { method: 'POST', body: JSON.stringify({ input }) });
    },
    executions(agentId: string): Promise<PaginatedResponse<AgentExecution>> {
      return request<PaginatedResponse<AgentExecution>>(`/agents/${agentId}/executions`);
    },
  },

  // Events
  events: {
    publish(body: { type: string; source: string; category: string; payload: Record<string, unknown>; priority?: string }): Promise<Event> {
      return request<Event>('/events', { method: 'POST', body: JSON.stringify(body) });
    },
    list(): Promise<PaginatedResponse<Event>> {
      return request<PaginatedResponse<Event>>('/events');
    },
    createSubscription(body: { eventType: string; handlerId: string; handlerType: string; config?: Record<string, unknown> }): Promise<EventSubscription> {
      return request<EventSubscription>('/events/subscriptions', { method: 'POST', body: JSON.stringify(body) });
    },
    listSubscriptions(): Promise<PaginatedResponse<EventSubscription>> {
      return request<PaginatedResponse<EventSubscription>>('/events/subscriptions');
    },
  },

  // Search
  search(body: { query: string; sources?: string[]; limit?: number; offset?: number }): Promise<{ results: Array<{ id: string; text: string; score: number; source: string; metadata: Record<string, unknown> }>; total: number }> {
    return request('/search', { method: 'POST', body: JSON.stringify(body) });
  },

  // Integrations
  integrations: {
    create(body: { name: string; provider: string; config?: Record<string, unknown> }): Promise<unknown> {
      return request('/integrations', { method: 'POST', body: JSON.stringify(body) });
    },
    list(): Promise<PaginatedResponse<unknown>> {
      return request<PaginatedResponse<unknown>>('/integrations');
    },
    update(id: string, body: { name?: string; config?: Record<string, unknown> }): Promise<unknown> {
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
      const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
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
