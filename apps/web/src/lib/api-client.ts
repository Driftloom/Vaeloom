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

import { api, ApiError, getToken, transformKeys, API_BASE, API_PREFIX } from './api';
export {
  ApiError,
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
} from './api';
import { CSRF_HEADER, getCsrfToken, resetCsrfToken } from './csrf';

export const ApiClientError = ApiError;

function encodeParams(
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

class ApiClient {
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    return api.request<T>(path, init);
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const qs = params ? '?' + encodeParams(params) : '';
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
    const qs = params ? '?' + encodeParams(params) : '';
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
}

const apiClient = new ApiClient();

// ΓöÇΓöÇΓöÇ Auth ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Workspace ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Memory ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Agent ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
  async chatStream(
    body: ChatMessage,
    onEvent: (event: string, data: Record<string, unknown>) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = getToken();
    const csrf = await getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrf) headers[CSRF_HEADER] = csrf;
    const res = await fetch(`${API_BASE}${API_PREFIX}/agents/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
      signal,
    });
    if (!res.ok) {
      let msg = `Stream failed (${res.status})`;
      try {
        const j = (await res.json()) as { message?: string; error?: { message?: string } };
        msg =
          (j as { error?: { message?: string } }).error?.message ||
          (j as { message?: string }).message ||
          msg;
      } catch {}
      throw new ApiError(res.status, msg);
    }
    if (!res.body) throw new ApiError(500, 'No stream body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const emit = (raw: string) => {
      if (!raw.trim()) return;
      const lines = raw.split('\n');
      let ev = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) return;
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        onEvent(ev, data);
      } catch {
        onEvent(ev, { raw: dataStr });
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        emit(chunk);
      }
    }
    if (buf.trim()) emit(buf);
  },
};

// ΓöÇΓöÇΓöÇ Knowledge Graph ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Document ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface DocumentResponse {
  id: string;
  workspace_id: string;
  path: string;
  type: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: DocumentResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface DocumentAction {
  id: string;
  document_id: string;
  workspace_id: string;
  action_type: 'document_rename' | 'document_archive' | 'document_restore';
  old_path?: string | null;
  new_path?: string | null;
  old_deleted_at?: string | null;
  new_deleted_at?: string | null;
  undone_at?: string | null;
  created_at: string;
}

export interface DocumentActionListResponse {
  actions: DocumentAction[];
  total: number;
}

function contentUrl(documentId: string, workspaceId: string): string {
  return `${API_BASE}${API_PREFIX}/documents/${encodeURIComponent(documentId)}/content?workspace_id=${encodeURIComponent(workspaceId)}`;
}

export const documentApi = {
  upload(file: File, workspaceId: string): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    return getCsrfToken().then(async (csrf) => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      if (csrf) headers[CSRF_HEADER] = csrf;
      const url = `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}`;
      const doFetch = () =>
        fetch(url, {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include',
        });
      let res = await doFetch();
      if (res.status === 403 && csrf) {
        resetCsrfToken();
        const fresh = await getCsrfToken();
        if (fresh) {
          headers[CSRF_HEADER] = fresh;
          res = await doFetch();
        }
      }
      if (!res.ok) throw new ApiClientError(res.status, 'Upload failed');
      return (res.json() as Promise<Record<string, unknown>>).then(
        (j) => transformKeys(j) as DocumentResponse,
      );
    });
  },
  uploadWithProgress(
    file: File,
    workspaceId: string,
    onProgress: (percent: number) => void,
  ): Promise<DocumentResponse> {
    return new Promise((resolve, reject) => {
      getCsrfToken().then((csrf) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          'POST',
          `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}`,
        );
        xhr.withCredentials = true;
        const token = getToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (csrf) xhr.setRequestHeader(CSRF_HEADER, csrf);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        const parseDoc = (text: string): DocumentResponse =>
          transformKeys(JSON.parse(text) as Record<string, unknown>) as DocumentResponse;
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(parseDoc(xhr.responseText));
            } catch {
              reject(new ApiClientError(xhr.status, 'Upload failed'));
            }
          } else if (xhr.status === 403 && csrf) {
            resetCsrfToken();
            getCsrfToken().then((fresh) => {
              if (fresh) {
                const retry = new XMLHttpRequest();
                retry.open(
                  'POST',
                  `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}`,
                );
                retry.withCredentials = true;
                if (token) retry.setRequestHeader('Authorization', `Bearer ${token}`);
                retry.setRequestHeader(CSRF_HEADER, fresh);
                const form = new FormData();
                form.append('file', file);
                retry.upload.onprogress = xhr.upload.onprogress;
                retry.onload = () => {
                  if (retry.status >= 200 && retry.status < 300) {
                    try {
                      resolve(parseDoc(retry.responseText));
                    } catch {
                      reject(new ApiClientError(retry.status, 'Upload failed'));
                    }
                  } else {
                    reject(new ApiClientError(retry.status, 'Upload failed'));
                  }
                };
                retry.onerror = () => reject(new ApiClientError(0, 'Network error during upload'));
                retry.send(form);
              } else {
                reject(new ApiClientError(xhr.status, 'Upload failed'));
              }
            });
          } else {
            reject(new ApiClientError(xhr.status, 'Upload failed'));
          }
        };
        xhr.onerror = () => reject(new ApiClientError(0, 'Network error during upload'));
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
      });
    });
  },
  list(params?: {
    workspace_id?: string;
    page?: number;
    page_size?: number;
    include_archived?: boolean;
  }): Promise<DocumentListResponse> {
    return apiClient.get<DocumentListResponse>(
      '/documents',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  rename(id: string, workspaceId: string, path: string): Promise<DocumentResponse> {
    return apiClient.patch<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(workspaceId)}`,
      { path },
    );
  },
  archive(id: string, workspaceId: string): Promise<DocumentResponse> {
    return apiClient.postQuery<DocumentResponse>(`/documents/${encodeURIComponent(id)}/archive`, {
      workspace_id: workspaceId,
    });
  },
  restore(id: string, workspaceId: string): Promise<DocumentResponse> {
    return apiClient.postQuery<DocumentResponse>(`/documents/${encodeURIComponent(id)}/restore`, {
      workspace_id: workspaceId,
    });
  },
  actions(id: string, workspaceId: string): Promise<DocumentActionListResponse> {
    return apiClient.get<DocumentActionListResponse>(
      `/documents/${encodeURIComponent(id)}/actions`,
      { workspace_id: workspaceId },
    );
  },
  undo(actionId: string, workspaceId: string): Promise<DocumentResponse> {
    return apiClient.postQuery<DocumentResponse>(
      `/documents/actions/${encodeURIComponent(actionId)}/undo`,
      { workspace_id: workspaceId },
    );
  },
  async getContent(id: string, workspaceId: string): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(contentUrl(id, workspaceId), {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new ApiClientError(res.status, 'Failed to load document content');
    return res.blob();
  },
  workspaceActions(workspaceId: string): Promise<DocumentActionListResponse> {
    return apiClient.get<DocumentActionListResponse>(
      `/workspaces/${encodeURIComponent(workspaceId)}/document-actions`,
    );
  },
  workspaceAgentActions(workspaceId: string): Promise<AgentActionHistory[]> {
    return apiClient.get<AgentActionHistory[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/agent-actions`,
    );
  },
};

export interface AgentActionHistory {
  id: string;
  workspaceId: string;
  agentName: string;
  actionType: string;
  inputRef?: string | null;
  outputRef?: string | null;
  status: string;
  error?: string | null;
  durationMs?: number | null;
  approvalRequestId?: string | null;
  createdAt: string | null;
}

// ΓöÇΓöÇΓöÇ Resume ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface ResumeResponse {
  id: string;
  workspaceId: string;
  variantType: string;
  content: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateResumeRequest {
  variant_type?: string;
  job_description?: string;
  target_role?: string;
  company?: string;
}

export interface ResumeTemplate {
  slug: string;
  name: string;
  category: string;
  description: string;
  bestFor: string[];
  atsCompatibility: number;
  accentColor: string;
  fontStack: string;
  layout: string;
}

export interface ResumeArtifact {
  id: string;
  workspaceId: string;
  resumeId: string;
  artifactKind: string;
  templateSlug: string | null;
  format: string;
  filename: string;
  mediaType: string;
  fileSize: number;
  createdAt: string;
}

export interface TailorResumeRequest {
  job_description: string;
  target_role?: string;
  company?: string;
}

export interface CompileResumeRequest {
  template_slug: string;
  format?: 'pdf' | 'docx' | 'html';
  max_pages?: number;
}

export interface CoverLetterRequest {
  body: string;
  template_slug: string;
  format?: 'pdf' | 'docx' | 'html';
  recipient?: string;
  company?: string;
  role?: string;
}

export interface ResumeSource {
  id: string;
  resumeId: string;
  workspaceId: string;
  path: string;
  content: string;
  lang: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSourceRequest {
  content: string;
  path?: string;
  lang?: 'typst' | 'latex' | 'html';
}

export interface CompileTypstRequest {
  template_slug?: string;
  typst_source?: string;
  format?: 'pdf' | 'html';
  max_pages?: number;
}

export interface InlineAiRequest {
  start_line: number;
  end_line: number;
  intent: 'tailor' | 'xyz' | 'condense' | 'ats_fix';
  target_jd?: string;
  selected_text?: string;
}

export interface InlineAiResponse {
  diff: Array<{
    op: string;
    oldText: string;
    newText: string;
    rationale: string;
    confidence: number;
    provenance?: string[];
  }>;
  suggestions: Array<{ type: string; severity: string; detail: string; fix: string }>;
  ats_score?: Record<string, unknown> | null;
}

/** Fetch a compiled artifact as a Blob (bearer auth; GET needs no CSRF token). */
export async function fetchArtifactBlob(workspaceId: string, artifactId: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}${API_PREFIX}/resumes/artifacts/${artifactId}/download?workspace_id=${encodeURIComponent(workspaceId)}`,
    {
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
  );
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to download artifact (${res.status})`);
  }
  return res.blob();
}

/** Trigger a browser download of a compiled artifact. */
export async function downloadArtifact(
  workspaceId: string,
  artifact: Pick<ResumeArtifact, 'id' | 'filename'>,
): Promise<void> {
  const blob = await fetchArtifactBlob(workspaceId, artifact.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.filename || 'resume';
  a.click();
  URL.revokeObjectURL(url);
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
  listTemplates(): Promise<ResumeTemplate[]> {
    return apiClient.get<ResumeTemplate[]>('/resumes/templates');
  },
  tailor(
    resumeId: string,
    workspaceId: string,
    body: TailorResumeRequest,
  ): Promise<ResumeResponse> {
    return apiClient.post<ResumeResponse>(
      `/resumes/${resumeId}/tailor?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  compile(
    resumeId: string,
    workspaceId: string,
    body: CompileResumeRequest,
  ): Promise<ResumeArtifact> {
    return apiClient.post<ResumeArtifact>(
      `/resumes/${resumeId}/compile?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  coverLetter(
    resumeId: string,
    workspaceId: string,
    body: CoverLetterRequest,
  ): Promise<ResumeArtifact> {
    return apiClient.post<ResumeArtifact>(
      `/resumes/${resumeId}/cover-letter?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  listArtifacts(resumeId: string, workspaceId: string): Promise<ResumeArtifact[]> {
    return apiClient.get<ResumeArtifact[]>(`/resumes/${resumeId}/artifacts`, {
      workspace_id: workspaceId,
    });
  },
  // ΓöÇΓöÇ Overleaf-style source (Typst/LaTeX) ΓÇö hybrid WASM + Tectonic ΓöÇΓöÇ
  getSource(resumeId: string, workspaceId: string): Promise<ResumeSource> {
    return apiClient.get<ResumeSource>(`/resumes/${resumeId}/source`, {
      workspace_id: workspaceId,
    });
  },
  updateSource(
    resumeId: string,
    workspaceId: string,
    body: UpdateSourceRequest,
  ): Promise<ResumeSource> {
    return apiClient.put<ResumeSource>(
      `/resumes/${resumeId}/source?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  compileTypst(
    resumeId: string,
    workspaceId: string,
    body: CompileTypstRequest,
  ): Promise<ResumeArtifact> {
    return apiClient.post<ResumeArtifact>(
      `/resumes/${resumeId}/compile-typst?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  inlineAi(
    resumeId: string,
    workspaceId: string,
    body: InlineAiRequest,
  ): Promise<InlineAiResponse> {
    return apiClient.post<InlineAiResponse>(
      `/resumes/${resumeId}/ai/inline?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
};

// ΓöÇΓöÇΓöÇ Application ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Connector ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Consent / Data rights (DPDP) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface ConsentScope {
  scope: string;
  granted: boolean;
  granted_at?: string;
  description?: string;
}

export interface ConsentGrantRequest {
  scope: string;
}

export interface ConsentState {
  items: ConsentRecord[];
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  tenant_id: string | null;
  scope: string;
  granted_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
}

export interface GdprExportResponse {
  user_id: string;
  exported_at: string;
  data: Record<string, unknown[]>;
  total_records: number;
}

export interface GdprDeleteResponse {
  user_id: string;
  action: string;
  tables: Record<string, number>;
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
    return apiClient.get<GdprExportResponse>('/gdpr/export');
  },
  delete(): Promise<GdprDeleteResponse> {
    return apiClient.post<GdprDeleteResponse>('/gdpr/delete');
  },
};

// ΓöÇΓöÇΓöÇ Approval ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface ApprovalItem {
  id: string;
  workspace_id: string | null;
  agent_name: string;
  action_type: string;
  payload: Record<string, unknown>;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requested_by: string | null;
  decided_by: string | null;
  decision_note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface ApprovalListResponse {
  items: ApprovalItem[];
  total: number;
  page: number;
  page_size: number;
}

export const approvalApi = {
  list(params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApprovalListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    const qs = query.toString();
    return apiClient.get<ApprovalListResponse>(`/approvals${qs ? `?${qs}` : ''}`);
  },
  approve(id: string, note?: string): Promise<ApprovalItem> {
    return apiClient.post<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/approve`, { note });
  },
  reject(id: string, note?: string): Promise<ApprovalItem> {
    return apiClient.post<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/reject`, { note });
  },
};

// ΓöÇΓöÇΓöÇ Notification ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Scheduler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Search ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Event ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
  publish(body: PublishEventRequest & { workspace_id?: string }): Promise<Event> {
    return apiClient.post<Event>('/events', body);
  },
  list(params?: { workspace_id?: string }): Promise<Event[]> {
    return apiClient.get<Event[]>('/events', params as Record<string, string | undefined>);
  },
  createSubscription(body: CreateSubscriptionRequest): Promise<EventSubscription> {
    return apiClient.post<EventSubscription>('/events/subscriptions', body);
  },
  listSubscriptions(): Promise<EventSubscription[]> {
    return apiClient.get<EventSubscription[]>('/events/subscriptions');
  },
};

// ΓöÇΓöÇΓöÇ Integration ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Analytics ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Audit ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ IAM ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Plugin ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ Chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export const chatApi = {
  send(
    workspaceId: string,
    body: { message: string; agent_name?: string },
  ): Promise<{ reply: string }> {
    return apiClient.post<{ reply: string }>(`/chat/workspaces/${workspaceId}/chat`, body);
  },
};

// ΓöÇΓöÇΓöÇ Billing ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

// ΓöÇΓöÇΓöÇ BYOK Provider Keys (Bring Your Own Key) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface ProviderKeyResponse {
  id: string;
  provider: string;
  keyHint: string;
  keyPrefix: string;
  isActive: boolean;
  isValid: boolean | null;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  validationError: string | null;
  workspaceId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderKeyListResponse {
  keys: ProviderKeyResponse[];
  total: number;
}

export interface EffectiveKeyResponse {
  provider: string;
  hasCustomKey: boolean;
  source: 'workspace' | 'user' | 'system' | 'none';
  keyHint: string | null;
  isValid: boolean | null;
  lastValidatedAt: string | null;
}

export const providerKeysApi = {
  list(params?: { workspace_id?: string }): Promise<ProviderKeyListResponse> {
    return apiClient.get<ProviderKeyListResponse>(
      '/provider-keys',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  effective(params: { provider: string; workspace_id?: string }): Promise<EffectiveKeyResponse> {
    return apiClient.get<EffectiveKeyResponse>(
      '/provider-keys/effective',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  create(body: {
    provider: string;
    api_key: string;
    workspace_id?: string | null;
  }): Promise<ProviderKeyResponse> {
    return apiClient.post<ProviderKeyResponse>('/provider-keys', body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/provider-keys/${id}`);
  },
  validate(
    id: string,
  ): Promise<{ isValid: boolean; provider: string; message: string; latencyMs: number }> {
    return apiClient.post<{
      isValid: boolean;
      provider: string;
      message: string;
      latencyMs: number;
    }>(`/provider-keys/${id}/validate`);
  },
  update(
    id: string,
    body: { api_key?: string; is_active?: boolean },
  ): Promise<ProviderKeyResponse> {
    return apiClient.patch<ProviderKeyResponse>(`/provider-keys/${id}`, body);
  },
};

// ΓöÇΓöÇΓöÇ Agents Catalog ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface CatalogToolDef {
  name: string;
  description: string;
  requiredScope: string;
  category: string;
}

export interface CatalogAgent {
  name: string;
  mission: string;
  tools: CatalogToolDef[];
  toolNames: string[];
  memoryScopes: { readTypes: string[]; writeTypes: string[] };
  defaultAutonomy: string;
  isCanonical: boolean;
  skills: string[];
  category: string;
}

export interface AgentCatalogResponse {
  agents: CatalogAgent[];
  total: number;
  canonicalCount: number;
  toolDefinitions: Record<string, { description: string; category: string; requiredScope: string }>;
}

export const agentCatalogApi = {
  get(): Promise<AgentCatalogResponse> {
    return apiClient.get<AgentCatalogResponse>('/agents/catalog');
  },
};

// ΓöÇΓöÇΓöÇ Memory Feed / Lineage ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export interface MemoryFeedItem {
  kind: string;
  memory: Memory | null;
  agentName: string | null;
  action: {
    id: string;
    actionType: string;
    status: string;
    createdAt: string | null;
    inputRef?: string | null;
    outputRef?: string | null;
  } | null;
  timestamp: string | null;
}

export interface MemoryFeedResponse {
  feed: MemoryFeedItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: { totalMemories: number; superseded: number; agentCreated: number; recentActions: number };
}

export interface MemoryLineageResponse {
  memory: Memory;
  chainBackwards: Memory[];
  chainForwards: Memory[];
  provenance: Array<{ table: string; id: string; type: string; detail: string }>;
  agentActions: Array<{
    id: string;
    agentName: string;
    actionType: string;
    status: string;
    createdAt: string | null;
  }>;
}

export const memoryFeedApi = {
  feed(params?: {
    workspace_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<MemoryFeedResponse> {
    return apiClient.get<MemoryFeedResponse>(
      '/memories/feed',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  lineage(memoryId: string): Promise<MemoryLineageResponse> {
    return apiClient.get<MemoryLineageResponse>(`/memories/${memoryId}/lineage`);
  },
};

// ─── Temporal durable workflows ───────────────────────────────────────

export interface TemporalWorkflowStatus {
  workflow_id: string;
  run_id?: string | null;
  status: string;
  query?:
    | ({
        status?: string;
        step?: string;
        progress?: number;
        handled?: string;
        error?: string | null;
      } & Record<string, unknown>)
    | null;
}

export const temporalApi = {
  getStatus(workflowId: string): Promise<TemporalWorkflowStatus> {
    return apiClient.get<TemporalWorkflowStatus>(
      `/temporal/workflows/${encodeURIComponent(workflowId)}`,
    );
  },
  cancel(workflowId: string): Promise<{ workflow_id: string; status: string }> {
    return apiClient.post<{ workflow_id: string; status: string }>(
      `/temporal/workflows/${encodeURIComponent(workflowId)}/cancel`,
    );
  },
  signal(
    workflowId: string,
    signalName: string,
    payload?: Record<string, unknown>,
  ): Promise<{ workflow_id: string; signal: string; status: string }> {
    return apiClient.post(
      `/temporal/workflows/${encodeURIComponent(workflowId)}/signal/${encodeURIComponent(signalName)}`,
      payload,
    );
  },
  startIngest(body: {
    workspace_id: string;
    document_id: string;
    content_hash?: string;
    correlation_id?: string;
  }): Promise<{ workflow_id: string; run_id?: string | null; status: string }> {
    return apiClient.post('/temporal/workflows/ingest', body);
  },
  startConnectorSync(body: {
    workspace_id: string;
    connector_id: string;
    sync_token?: string;
  }): Promise<{ workflow_id: string; run_id?: string | null; status: string }> {
    return apiClient.post('/temporal/workflows/connector-sync', body);
  },
};
