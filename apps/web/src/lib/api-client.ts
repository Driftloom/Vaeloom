import type {
  ApiResponse,
  PaginatedResponse,
  AuthResponse,
  MeResponse,
  SignupRequest,
  LoginRequest,
  Workspace,
  Memory,
  Agent,
  AgentExecution,
  Event,
  EventSubscription,
  Connector,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '@vaeloom/shared-types';

export { ApiError } from './api';
export {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from './api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';
const API_PREFIX = '/api/v1';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = `${API_BASE}${API_PREFIX}`) {
    this.baseUrl = baseUrl;
  }

  protected transformKeys<T>(obj: unknown): T {
    if (obj === null || obj === undefined) return obj as T;
    if (Array.isArray(obj)) return obj.map((v) => this.transformKeys(v)) as T;
    if (typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
          k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
          this.transformKeys(v),
        ]),
      ) as T;
    }
    return obj as T;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('vaeloom.accessToken');
  }

  get baseURL(): string {
    return this.baseUrl;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const qs = params ? '?' + this.encodeParams(params) : '';
    return this.request<T>(`${path}${qs}`, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async postQuery<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const qs = params ? '?' + this.encodeParams(params) : '';
    return this.request<T>(`${path}${qs}`, { method: 'POST' });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body != null ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private encodeParams(
    params: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v != null) {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    }
    return parts.join('&');
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (res.status === 401 && token) {
      const newToken = await this.tryRefresh();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
      }
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      let code: string | undefined;
      try {
        const body = (await res.json()) as {
          error?: { message?: string; code?: string };
          detail?: string;
        };
        if (body.error) {
          message = body.error.message ?? message;
          code = body.error.code;
        } else if ((body as { detail?: string }).detail) {
          message = (body as { detail: string }).detail;
        }
      } catch {}
      throw new ApiClientError(res.status, message, code);
    }

    return res.status === 204 ? (undefined as unknown as T) : this.transformKeys(await res.json());
  }

  private async tryRefresh(): Promise<string | null> {
    const refresh =
      typeof window !== 'undefined' ? window.localStorage.getItem('vaeloom.refreshToken') : null;
    if (!refresh) return null;
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        this.clearTokens();
        return null;
      }
      const data = this.transformKeys<AuthResponse>(await res.json());
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('vaeloom.accessToken', data.accessToken);
        if (data.refreshToken)
          window.localStorage.setItem('vaeloom.refreshToken', data.refreshToken);
      }
      return data.accessToken;
    } catch {
      this.clearTokens();
      return null;
    }
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('vaeloom.accessToken');
      window.localStorage.removeItem('vaeloom.refreshToken');
    }
  }
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const apiClient = new ApiClient();

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  signup(body: SignupRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/signup', body);
  },
  login(body: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', body);
  },
  me(): Promise<MeResponse> {
    return apiClient.get<MeResponse>('/auth/me');
  },
  refresh(body: { refresh_token: string }): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh', body);
  },
  logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('vaeloom.accessToken');
      window.localStorage.removeItem('vaeloom.refreshToken');
    }
    return Promise.resolve();
  },
};

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface CreateWorkspaceRequest {
  name?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
}

export const workspaceApi = {
  create(body: CreateWorkspaceRequest = {}): Promise<Workspace> {
    return apiClient.post<Workspace>('/workspaces', body);
  },
  list(): Promise<Workspace[]> {
    return apiClient.get<Workspace[]>('/workspaces');
  },
  get(id: string): Promise<Workspace> {
    return apiClient.get<Workspace>(`/workspaces/${id}`);
  },
  update(id: string, body: UpdateWorkspaceRequest): Promise<Workspace> {
    return apiClient.patch<Workspace>(`/workspaces/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/workspaces/${id}`);
  },
  agents(workspaceId: string): Promise<Agent[]> {
    return apiClient.get<Agent[]>(`/workspaces/${workspaceId}/agents`);
  },
  memories(workspaceId: string): Promise<Memory[]> {
    return apiClient.get<Memory[]>(`/workspaces/${workspaceId}/memories`);
  },
  connectors(workspaceId: string): Promise<Connector[]> {
    return apiClient.get<Connector[]>(`/workspaces/${workspaceId}/connectors`);
  },
};

// ─── Memory ─────────────────────────────────────────────────────────────────

export interface MemoryCreateRequest {
  type: string;
  domain?: string;
  title?: string;
  summary?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  workspace_id?: string;
  source_type?: string;
  source_uri?: string;
  source_label?: string;
  connector_id?: string;
  supersedes_id?: string;
}

export interface MemoryUpdateRequest {
  type?: string;
  domain?: string;
  title?: string;
  summary?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  status?: string;
  supersedes_id?: string;
}

export interface MemorySearchRequest {
  query: string;
  type?: string;
  tags?: string[];
  top_k?: number;
  threshold?: number;
}

export interface MemorySearchResultItem {
  memory: Memory;
  score: number;
}

export interface MemoryListResponse {
  memories: Memory[];
  total: number;
  page: number;
  page_size: number;
}

export const memoryApi = {
  create(body: MemoryCreateRequest): Promise<Memory> {
    return apiClient.post<Memory>('/memories', body);
  },
  list(params?: {
    type?: string;
    status?: string;
    tags?: string;
    page?: number;
    page_size?: number;
  }): Promise<MemoryListResponse> {
    return apiClient.get<MemoryListResponse>(
      '/memories',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  get(id: string): Promise<Memory> {
    return apiClient.get<Memory>(`/memories/${id}`);
  },
  update(id: string, body: MemoryUpdateRequest): Promise<Memory> {
    return apiClient.put<Memory>(`/memories/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/memories/${id}`);
  },
  search(body: MemorySearchRequest): Promise<MemorySearchResultItem[]> {
    return apiClient.post<MemorySearchResultItem[]>('/memories/search', body);
  },
};

// ─── Agent ───────────────────────────────────────────────────────────────────

export interface AgentCreateRequest {
  name: string;
  category: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface AgentUpdateRequest {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: string;
}

export interface AgentExecuteRequest {
  input?: Record<string, unknown>;
  stream?: boolean;
}

export interface ScheduleRequest {
  cron: string;
  input?: Record<string, unknown>;
  enabled?: boolean;
}

export interface ScheduleResponse {
  id: string;
  agent_id: string;
  cron: string;
  input?: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  page_size: number;
}

export interface ExecutionListResponse {
  executions: AgentExecution[];
  total: number;
  page: number;
  page_size: number;
}

export interface ChatMessage {
  workspaceId: string;
  message: string;
  agentName?: string;
}

export const agentApi = {
  register(body: AgentCreateRequest): Promise<Agent> {
    return apiClient.post<Agent>('/agents', body);
  },
  list(params?: {
    page?: number;
    page_size?: number;
    category?: string;
    search?: string;
  }): Promise<AgentListResponse> {
    return apiClient.get<AgentListResponse>(
      '/agents',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  get(id: string): Promise<Agent> {
    return apiClient.get<Agent>(`/agents/${id}`);
  },
  update(id: string, body: AgentUpdateRequest): Promise<Agent> {
    return apiClient.put<Agent>(`/agents/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/agents/${id}`);
  },
  execute(id: string, body: AgentExecuteRequest): Promise<AgentExecution> {
    return apiClient.post<AgentExecution>(`/agents/${id}/execute`, body);
  },
  run(id: string, body: AgentExecuteRequest): Promise<AgentExecution> {
    return apiClient.post<AgentExecution>(`/agents/${id}/run`, body);
  },
  executions(
    agentId: string,
    params?: { page?: number; page_size?: number; status?: string },
  ): Promise<ExecutionListResponse> {
    return apiClient.get<ExecutionListResponse>(
      `/agents/${agentId}/executions`,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  schedule(agentId: string, body: ScheduleRequest): Promise<ScheduleResponse> {
    return apiClient.post<ScheduleResponse>(`/agents/${agentId}/schedule`, body);
  },
  chat(body: ChatMessage): Promise<{ reply?: string } & Record<string, unknown>> {
    return apiClient.post('/agents/chat', body);
  },
};

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export interface KGCreateNodeRequest {
  label: string;
  type?: string;
  description?: string;
  importance?: number;
  properties?: Record<string, unknown>;
}

export interface KGUpdateNodeRequest {
  label?: string;
  type?: string;
  description?: string;
  importance?: number;
  properties?: Record<string, unknown>;
}

export interface KGCreateEdgeRequest {
  target_id: string;
  relationship: string;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface KGTraverseRequest {
  start_id: string;
  depth?: number;
  mode?: string;
}

export interface KGShortestPathRequest {
  from_id: string;
  to_id: string;
  max_depth?: number;
}

export interface KGNodeListResponse {
  items: KnowledgeGraphNode[];
  total: number;
  page: number;
  page_size: number;
}

export interface KGEdgeListResponse {
  items: KnowledgeGraphEdge[];
  total: number;
  page: number;
  page_size: number;
}

export interface KGPathResponse {
  path: KnowledgeGraphNode[];
  depth: number;
  from_id: string;
  to_id: string;
}

export const knowledgeGraphApi = {
  // Nodes
  createNode(body: KGCreateNodeRequest): Promise<KnowledgeGraphNode> {
    return apiClient.post<KnowledgeGraphNode>('/knowledge-graph/nodes', body);
  },
  listNodes(params?: {
    page?: number;
    page_size?: number;
    type?: string;
    search?: string;
    min_importance?: number;
    max_importance?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<KGNodeListResponse> {
    return apiClient.get<KGNodeListResponse>(
      '/knowledge-graph/nodes',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  getNode(id: string): Promise<KnowledgeGraphNode> {
    return apiClient.get<KnowledgeGraphNode>(`/knowledge-graph/nodes/${id}`);
  },
  updateNode(id: string, body: KGUpdateNodeRequest): Promise<KnowledgeGraphNode> {
    return apiClient.put<KnowledgeGraphNode>(`/knowledge-graph/nodes/${id}`, body);
  },
  deleteNode(id: string): Promise<void> {
    return apiClient.delete(`/knowledge-graph/nodes/${id}`);
  },
  // Edges
  createEdge(nodeId: string, body: KGCreateEdgeRequest): Promise<KnowledgeGraphEdge> {
    return apiClient.post<KnowledgeGraphEdge>(`/knowledge-graph/nodes/${nodeId}/edges`, body);
  },
  listNodeEdges(
    nodeId: string,
    params?: { page?: number; page_size?: number },
  ): Promise<KGEdgeListResponse> {
    return apiClient.get<KGEdgeListResponse>(
      `/knowledge-graph/nodes/${nodeId}/edges`,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  listAllEdges(params?: {
    page?: number;
    page_size?: number;
    relationship?: string;
  }): Promise<KGEdgeListResponse> {
    return apiClient.get<KGEdgeListResponse>(
      '/knowledge-graph/edges',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  deleteEdge(id: string): Promise<void> {
    return apiClient.delete(`/knowledge-graph/edges/${id}`);
  },
  // Traversal
  traverse(body: KGTraverseRequest): Promise<KnowledgeGraphNode[]> {
    return apiClient.post<KnowledgeGraphNode[]>('/knowledge-graph/traverse', body);
  },
  findPath(params: {
    from_id: string;
    to_id: string;
    max_depth?: number;
  }): Promise<KGPathResponse> {
    return apiClient.get<KGPathResponse>(
      '/knowledge-graph/path',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
};

// ─── Document ────────────────────────────────────────────────────────────────

export interface DocumentResponse {
  id: string;
  workspace_id: string;
  path: string;
  type: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: DocumentResponse[];
  total: number;
  page: number;
  page_size: number;
}

export const documentApi = {
  upload(file: File, workspaceId: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const token =
      typeof window !== 'undefined' ? window.localStorage.getItem('vaeloom.accessToken') : null;
    return fetch(
      `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      },
    ).then(async (res) => {
      if (!res.ok) throw new ApiClientError(res.status, 'Upload failed');
      return res.json() as Promise<DocumentResponse>;
    });
  },
  list(params?: {
    workspace_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<DocumentListResponse> {
    return apiClient.get<DocumentListResponse>(
      '/documents',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
};

// ─── Resume ──────────────────────────────────────────────────────────────────

export interface ResumeResponse {
  id: string;
  workspace_id: string;
  variant_type: string;
  content: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateResumeRequest {
  variant_type?: string;
  job_description?: string;
  target_role?: string;
  company?: string;
}

export const resumeApi = {
  list(workspaceId: string): Promise<ResumeResponse[]> {
    return apiClient.get<ResumeResponse[]>('/resumes', { workspace_id: workspaceId });
  },
  master(workspaceId: string): Promise<ResumeResponse> {
    return apiClient.get<ResumeResponse>('/resumes/master', { workspace_id: workspaceId });
  },
  generate(resumeId: string, body: GenerateResumeRequest): Promise<ResumeResponse> {
    return apiClient.post<ResumeResponse>(`/resumes/${resumeId}/generate`, body);
  },
};

// ─── Application ─────────────────────────────────────────────────────────────

export interface ApplicationCreateRequest {
  job_external_id?: string;
  platform?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplicationUpdateOutcomeRequest {
  status: string;
}

export interface ApplicationResponse {
  id: string;
  workspace_id: string;
  job_external_id?: string;
  platform?: string;
  status: string;
  resume_version_id?: string;
  cover_letter?: string;
  submitted_at?: string;
  outcome?: string;
  outcome_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const applicationApi = {
  list(
    workspaceId: string,
    params?: { page?: number; page_size?: number },
  ): Promise<ApplicationResponse[]> {
    return apiClient.get<ApplicationResponse[]>(
      `/workspaces/${workspaceId}/applications`,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  create(workspaceId: string, body: ApplicationCreateRequest): Promise<ApplicationResponse> {
    return apiClient.post<ApplicationResponse>(`/workspaces/${workspaceId}/applications`, body);
  },
  get(workspaceId: string, applicationId: string): Promise<ApplicationResponse> {
    return apiClient.get<ApplicationResponse>(
      `/workspaces/${workspaceId}/applications/${applicationId}`,
    );
  },
  updateOutcome(
    workspaceId: string,
    applicationId: string,
    body: ApplicationUpdateOutcomeRequest,
  ): Promise<ApplicationResponse> {
    return apiClient.patch<ApplicationResponse>(
      `/workspaces/${workspaceId}/applications/${applicationId}/outcome`,
      body,
    );
  },
};

// ─── Connector ───────────────────────────────────────────────────────────────

export interface ConnectorCreateRequest {
  name: string;
  type: string;
  config: Record<string, unknown>;
  tenant_id?: string;
}

export interface ConnectorUpdateRequest {
  name?: string;
  config?: Record<string, unknown>;
}

export interface ConnectorResponseExt {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  scopes?: string[];
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncStatusResponse {
  connector_id: string;
  status: string;
  error?: string;
  synced_at?: string;
}

export const connectorApi = {
  create(body: ConnectorCreateRequest): Promise<ConnectorResponseExt> {
    return apiClient.post<ConnectorResponseExt>('/connectors', body);
  },
  list(params?: {
    page?: number;
    page_size?: number;
    type?: string;
  }): Promise<ConnectorResponseExt[]> {
    return apiClient.get<ConnectorResponseExt[]>(
      '/connectors',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  get(id: string): Promise<ConnectorResponseExt> {
    return apiClient.get<ConnectorResponseExt>(`/connectors/${id}`);
  },
  update(id: string, body: ConnectorUpdateRequest): Promise<ConnectorResponseExt> {
    return apiClient.put<ConnectorResponseExt>(`/connectors/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/connectors/${id}`);
  },
  sync(id: string): Promise<SyncStatusResponse> {
    return apiClient.post<SyncStatusResponse>(`/connectors/${id}/sync`);
  },
  syncStatus(id: string): Promise<SyncStatusResponse> {
    return apiClient.get<SyncStatusResponse>(`/connectors/${id}/sync/status`);
  },
  testConnection(id: string): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(`/connectors/${id}/test`);
  },
};

// ─── Consent / Data rights (DPDP) ───────────────────────────────────────────

export interface ConsentScope {
  scope: string;
  granted: boolean;
  granted_at?: string;
  description?: string;
}

export interface ConsentGrantRequest {
  scope: string;
  consent_version: string;
}

export interface ConsentState {
  scopes: ConsentScope[];
  consent_version: string;
}

export interface GdprExportResponse {
  job_id?: string;
  status?: string;
  download_url?: string;
  expires_at?: string;
}

export interface GdprDeleteResponse {
  request_id: string;
  status: string;
  primary_deletion: string;
  backup_expiry: string;
}

export const consentApi = {
  grant(body: ConsentGrantRequest): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>('/consent/grant', body);
  },
  revoke(scope: string): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(`/consent/revoke/${encodeURIComponent(scope)}`);
  },
  me(): Promise<ConsentState> {
    return apiClient.get<ConsentState>('/consent/me');
  },
  scopes(): Promise<ConsentScope[]> {
    return apiClient.get<ConsentScope[]>('/consent/scopes');
  },
};

export const gdprApi = {
  export(): Promise<GdprExportResponse> {
    return apiClient.post<GdprExportResponse>('/gdpr/export');
  },
  delete(): Promise<GdprDeleteResponse> {
    return apiClient.post<GdprDeleteResponse>('/gdpr/delete');
  },
};

// ─── Notification ────────────────────────────────────────────────────────────

export interface SendNotificationRequest {
  channel: string;
  recipient: string;
  template?: string;
  data?: Record<string, unknown>;
  subject?: string;
  body?: string;
}

export interface CreateTemplateRequest {
  name: string;
  subject?: string;
  body: string;
  channel: string;
}

export interface NotificationResponse {
  id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateResponse {
  id: string;
  name: string;
  subject?: string;
  body: string;
  channel: string;
  created_at: string;
}

export const notificationApi = {
  list(params?: {
    page?: number;
    page_size?: number;
    channel?: string;
  }): Promise<NotificationResponse[]> {
    return apiClient.get<NotificationResponse[]>(
      '/notifications',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  send(body: SendNotificationRequest): Promise<NotificationResponse> {
    return apiClient.post<NotificationResponse>('/notifications/send', body);
  },
  get(id: string): Promise<NotificationResponse> {
    return apiClient.get<NotificationResponse>(`/notifications/${id}`);
  },
  createTemplate(body: CreateTemplateRequest): Promise<TemplateResponse> {
    return apiClient.post<TemplateResponse>('/notifications/templates', body);
  },
  listTemplates(): Promise<TemplateResponse[]> {
    return apiClient.get<TemplateResponse[]>('/notifications/templates');
  },
  subscribe(body: { url: string; tenant_id?: string }): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>('/notifications/subscribe', body);
  },
  webhookReceipt(
    notificationId: string,
    body: { status?: string; details?: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(
      `/notifications/webhooks/${notificationId}`,
      body,
    );
  },
};

// ─── Scheduler ───────────────────────────────────────────────────────────────

export interface CreateJobRequest {
  name: string;
  type: string;
  cron: string;
  method?: string;
  url?: string;
  event?: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  tenant_id?: string;
}

export interface UpdateJobRequest {
  name?: string;
  cron?: string;
  method?: string;
  url?: string;
  event?: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface JobResponse {
  id: string;
  name: string;
  type: string;
  cron: string;
  method?: string;
  url?: string;
  event?: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  status: string;
  last_run_at?: string;
  next_run_at?: string;
  tenant_id?: string;
  created_at: string;
  updated_at: string;
}

export interface JobExecutionResponse {
  id: string;
  job_id: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  status_code?: number;
  error?: string;
  created_at: string;
}

export const schedulerApi = {
  createJob(body: CreateJobRequest): Promise<JobResponse> {
    return apiClient.post<JobResponse>('/scheduler/jobs', body);
  },
  listJobs(params?: {
    page?: number;
    page_size?: number;
    type?: string;
    status?: string;
    name?: string;
  }): Promise<JobResponse[]> {
    return apiClient.get<JobResponse[]>(
      '/scheduler/jobs',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  getJob(id: string): Promise<JobResponse> {
    return apiClient.get<JobResponse>(`/scheduler/jobs/${id}`);
  },
  updateJob(id: string, body: UpdateJobRequest): Promise<JobResponse> {
    return apiClient.patch<JobResponse>(`/scheduler/jobs/${id}`, body);
  },
  deleteJob(id: string): Promise<void> {
    return apiClient.delete(`/scheduler/jobs/${id}`);
  },
  pauseJob(id: string): Promise<JobResponse> {
    return apiClient.post<JobResponse>(`/scheduler/jobs/${id}/pause`);
  },
  resumeJob(id: string): Promise<JobResponse> {
    return apiClient.post<JobResponse>(`/scheduler/jobs/${id}/resume`);
  },
  triggerJob(id: string): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(`/scheduler/jobs/${id}/trigger`);
  },
  jobExecutions(jobId: string): Promise<JobExecutionResponse[]> {
    return apiClient.get<JobExecutionResponse[]>(`/scheduler/jobs/${jobId}/executions`);
  },
};

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  sources?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResultItem {
  id: string;
  text: string;
  score: number;
  source: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
}

export const searchApi = {
  all(body: SearchRequest): Promise<SearchResponse> {
    return apiClient.post<SearchResponse>('/search', body);
  },
};

// ─── Event ───────────────────────────────────────────────────────────────────

export interface PublishEventRequest {
  type: string;
  source: string;
  category: string;
  payload?: Record<string, unknown>;
  priority?: string;
  correlation_id?: string;
}

export interface CreateSubscriptionRequest {
  event_type: string;
  handler_id: string;
  handler_type?: string;
  config?: Record<string, unknown>;
  filters?: Record<string, unknown>;
}

export const eventApi = {
  publish(body: PublishEventRequest): Promise<Event> {
    return apiClient.post<Event>('/events', body);
  },
  list(): Promise<Event[]> {
    return apiClient.get<Event[]>('/events');
  },
  createSubscription(body: CreateSubscriptionRequest): Promise<EventSubscription> {
    return apiClient.post<EventSubscription>('/events/subscriptions', body);
  },
  listSubscriptions(): Promise<EventSubscription[]> {
    return apiClient.get<EventSubscription[]>('/events/subscriptions');
  },
};

// ─── Integration ─────────────────────────────────────────────────────────────

export interface IntegrationCreateRequest {
  name: string;
  provider: string;
  config?: Record<string, unknown>;
}

export interface IntegrationUpdateRequest {
  name?: string;
  config?: Record<string, unknown>;
}

export interface IntegrationResponse {
  id: string;
  name: string;
  provider: string;
  config: Record<string, unknown>;
  status: string;
  user_id: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

export const integrationApi = {
  create(body: IntegrationCreateRequest): Promise<IntegrationResponse> {
    return apiClient.post<IntegrationResponse>('/integrations', body);
  },
  list(): Promise<IntegrationResponse[]> {
    return apiClient.get<IntegrationResponse[]>('/integrations');
  },
  update(id: string, body: IntegrationUpdateRequest): Promise<IntegrationResponse> {
    return apiClient.put<IntegrationResponse>(`/integrations/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/integrations/${id}`);
  },
  sync(id: string): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(`/integrations/${id}/sync`);
  },
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface UsageTimePoint {
  date: string;
  memories_created: number;
  agents_run: number;
  tokens_used: number;
}

export interface KpiSummary {
  total_memories: number;
  total_agents: number;
  active_users: number;
  avg_response_time_ms: number;
}

export interface DashboardPayload {
  kpis: KpiSummary;
  usage: UsageTimePoint[];
  generated_at: string;
}

export interface TrackEventRequest {
  name: string;
  properties?: Record<string, unknown>;
}

export const analyticsApi = {
  dashboard(params?: {
    date_from?: string;
    date_to?: string;
    interval?: string;
  }): Promise<DashboardPayload> {
    return apiClient.get<DashboardPayload>(
      '/analytics',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  usage(params?: {
    date_from?: string;
    date_to?: string;
    interval?: string;
  }): Promise<UsageTimePoint[]> {
    return apiClient.get<UsageTimePoint[]>(
      '/analytics/usage',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  metrics(): Promise<KpiSummary> {
    return apiClient.get<KpiSummary>('/analytics/metrics');
  },
  track(body: TrackEventRequest): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>('/analytics/events', body);
  },
  aggregate(body?: { date?: string }): Promise<{ status: string }> {
    return apiClient.post<{ status: string }>('/analytics/aggregate', body);
  },
};

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface RecordAuditEventRequest {
  actor_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventResponse {
  id: string;
  actor_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  tenant_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ComplianceReport {
  by_action: Record<string, unknown>[];
  by_resource: Record<string, unknown>[];
  total: number;
  generated_at: string;
}

export const auditApi = {
  recordEvent(body: RecordAuditEventRequest): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>('/audit/events', body);
  },
  queryEvents(params?: {
    page?: number;
    page_size?: number;
    actor_id?: string;
    action?: string;
    resource?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{ items: AuditEventResponse[]; total: number; page: number; page_size: number }> {
    return apiClient.get(
      '/audit/events',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  getEvent(eventId: string): Promise<AuditEventResponse> {
    return apiClient.get<AuditEventResponse>(`/audit/events/${eventId}`);
  },
  export(params?: { date_from?: string; date_to?: string; format?: string }): Promise<string> {
    return apiClient.postQuery<string>(
      '/audit/export',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  complianceReport(params?: { date_from?: string; date_to?: string }): Promise<ComplianceReport> {
    return apiClient.get<ComplianceReport>(
      '/audit/compliance/report',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
};

// ─── IAM ─────────────────────────────────────────────────────────────────────

export interface IAMCreateUserRequest {
  email: string;
  display_name: string;
  tenant_id: string;
  role_ids?: string[];
}

export interface IAMUpdateUserRequest {
  display_name?: string;
  email?: string;
  active?: boolean;
}

export interface IAMUserResponse {
  id: string;
  email: string;
  display_name: string;
  tenant_id: string;
  active: boolean;
  roles: Array<{ id: string; name: string }>;
  created_at: string;
  updated_at: string;
}

export interface AssignRolesRequest {
  role_ids: string[];
}

export const iamApi = {
  createUser(body: IAMCreateUserRequest): Promise<IAMUserResponse> {
    return apiClient.post<IAMUserResponse>('/iam/users', body);
  },
  listUsers(params?: {
    page?: number;
    page_size?: number;
  }): Promise<{ items: IAMUserResponse[]; total: number; page: number; page_size: number }> {
    return apiClient.get(
      '/iam/users',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  getUser(userId: string): Promise<IAMUserResponse> {
    return apiClient.get<IAMUserResponse>(`/iam/users/${userId}`);
  },
  updateUser(userId: string, body: IAMUpdateUserRequest): Promise<IAMUserResponse> {
    return apiClient.put<IAMUserResponse>(`/iam/users/${userId}`, body);
  },
  deactivateUser(userId: string): Promise<void> {
    return apiClient.delete(`/iam/users/${userId}`);
  },
  assignRoles(userId: string, body: AssignRolesRequest): Promise<{ status: string }> {
    return apiClient.post<{ status: string }>(`/iam/users/${userId}/roles`, body);
  },
  removeRole(userId: string, roleId: string): Promise<void> {
    return apiClient.delete(`/iam/users/${userId}/roles/${roleId}`);
  },
  getPermissions(userId: string): Promise<string[]> {
    return apiClient.get<string[]>(`/iam/users/${userId}/permissions`);
  },
};

// ─── Plugin ──────────────────────────────────────────────────────────────────

export interface RegisterPluginRequest {
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  min_app_version: string;
  tags: string[];
  permissions: {
    memory?: string[];
    agents?: string[];
    events?: string[];
    storage?: string[];
    network?: string[];
    files?: string[];
  };
  capabilities?: string[];
  hooks?: string[];
  entry_point: string;
  tenant_id?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  config_schema?: Record<string, unknown>;
  code?: string;
}

export interface PluginResponse {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  status: string;
  permissions: Record<string, unknown>;
  capabilities: string[];
  hooks: string[];
  tags: string[];
  entry_point: string;
  tenant_id?: string;
  homepage?: string;
  repository?: string;
  icon?: string;
  config_schema?: Record<string, unknown>;
  code?: string;
  created_at: string;
  updated_at: string;
}

export interface PluginExecutionResponse {
  id: string;
  plugin_id: string;
  status: string;
  duration_ms?: number;
  output?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

export const pluginApi = {
  register(body: RegisterPluginRequest): Promise<PluginResponse> {
    return apiClient.post<PluginResponse>('/plugins', body);
  },
  list(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    tags?: string;
    search?: string;
  }): Promise<{ plugins: PluginResponse[]; total: number; page: number; page_size: number }> {
    return apiClient.get(
      '/plugins',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  get(id: string): Promise<PluginResponse> {
    return apiClient.get<PluginResponse>(`/plugins/${id}`);
  },
  update(
    id: string,
    body: Partial<RegisterPluginRequest> & { status?: string },
  ): Promise<PluginResponse> {
    return apiClient.put<PluginResponse>(`/plugins/${id}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/plugins/${id}`);
  },
  execute(
    id: string,
    body: { input?: Record<string, unknown>; code?: string; timeout_ms?: number },
  ): Promise<PluginExecutionResponse> {
    return apiClient.post<PluginExecutionResponse>(`/plugins/${id}/execute`, body);
  },
  getPermissions(id: string): Promise<{ permissions: Record<string, unknown> }> {
    return apiClient.get<{ permissions: Record<string, unknown> }>(`/plugins/${id}/permissions`);
  },
  executions(
    pluginId: string,
    params?: { page?: number; page_size?: number },
  ): Promise<{
    executions: PluginExecutionResponse[];
    total: number;
    page: number;
    page_size: number;
  }> {
    return apiClient.get(
      `/plugins/${pluginId}/executions`,
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
};

// ─── Chat ────────────────────────────────────────────────────────────────────

export const chatApi = {
  send(
    workspaceId: string,
    body: { message: string; agent_name?: string },
  ): Promise<{ reply: string }> {
    return apiClient.post<{ reply: string }>(`/chat/workspaces/${workspaceId}/chat`, body);
  },
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface UsageRecordResponse {
  id: string;
  metric: string;
  value: number;
  timestamp: string;
  tenant_id?: string;
  user_id?: string;
}

export interface SubscriptionResponse {
  id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

export const billingApi = {
  usage(params?: {
    metric?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<UsageRecordResponse[]> {
    return apiClient.get<UsageRecordResponse[]>(
      '/billing/usage',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  subscription(): Promise<SubscriptionResponse> {
    return apiClient.get<SubscriptionResponse>('/billing/subscription');
  },
  createSubscription(plan: string): Promise<SubscriptionResponse> {
    return apiClient.post<SubscriptionResponse>('/billing/subscription', { plan });
  },
};
