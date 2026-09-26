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
export type { Event, EventSubscription } from '@vaeloom/shared-types';

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
    body?: unknown,
  ): Promise<T> {
    const qs = params ? '?' + encodeParams(params) : '';
    return this.request<T>(`${path}${qs}`, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
    });
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

// â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const authApi = {
  signup(body: SignupRequest): Promise<AuthResponse> {
    const payload = {
      email: body.email,
      password: body.password,
      display_name: body.displayName,
      terms_accepted: body.termsAccepted ?? true,
    };
    return apiClient.post<AuthResponse>('/auth/signup', payload);
  },
  login(body: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', body);
  },
  me(): Promise<MeResponse> {
    return apiClient.get<MeResponse>('/auth/me');
  },
  /**
   * Rotate the session.
   *
   * The `body` argument is retained in the signature so existing callers keep
   * compiling, but it is no longer sent: the refresh credential is an HttpOnly
   * cookie the browser attaches on its own and this bundle cannot read it.
   * Sending a body token would also defeat the migration, since a token handed
   * to JavaScript is readable by any script on the origin.
   *
   * An empty body is safe because the backend falls back to the cookie when the
   * body field is absent (`token = cookie or body`).
   */
  refresh(_body?: { refresh_token?: string }): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh', {});
  },
  logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('vaeloom.accessToken');
      window.localStorage.removeItem('vaeloom.refreshToken');
    }
    return Promise.resolve();
  },
};

// â”€â”€â”€ Workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Knowledge Graph â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DocumentResponse {
  id: string;
  workspace_id: string;
  folder_id?: string | null;
  path: string;
  type: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  detected_mime_type?: string | null;
  scan_status?: 'CLEAN' | 'PENDING' | 'MALICIOUS' | 'REJECTED';
  scan_result?: string | null;
  expires_at?: string | null;
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

export interface FolderResponse {
  id: string;
  workspace_id: string;
  parent_id?: string | null;
  name: string;
  created_by?: string | null;
  created_at: string;
}

export interface FolderTreeItem {
  id: string;
  workspace_id: string;
  parent_id?: string | null;
  name: string;
  created_at?: string | null;
  children: FolderTreeItem[];
}

export interface DocumentVersionResponse {
  id: string;
  document_id: string;
  version_number: number;
  storage_key: string;
  checksum?: string | null;
  size_bytes?: number | null;
  created_at: string;
}

export interface DocumentShareResponse {
  id: string;
  document_id: string;
  source_workspace_id: string;
  target_workspace_id: string;
  permission: string;
  granted_by?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface BulkUploadResponse {
  total_attempted: number;
  processed: number;
  failed: number;
  succeeded: Array<{ id: string; filename: string; path: string; scan_status: string }>;
  items: Array<{ id: string; filename: string; path: string; scan_status: string }>;
  errors: Array<{ filename: string; error: string }>;
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
  search(workspaceId: string, query: string, folderId?: string): Promise<DocumentResponse[]> {
    const params: Record<string, string> = { workspace_id: workspaceId, q: query };
    if (folderId) params['folder_id'] = folderId;
    return apiClient.get<DocumentResponse[]>('/documents/search', params);
  },
  listFolders(workspaceId: string, parentId?: string): Promise<FolderResponse[]> {
    const params: Record<string, string> = { workspace_id: workspaceId };
    if (parentId) params['parent_id'] = parentId;
    return apiClient.get<FolderResponse[]>('/documents/folders', params);
  },
  getFolderTree(workspaceId: string): Promise<FolderTreeItem[]> {
    return apiClient.get<FolderTreeItem[]>('/documents/folders/tree', {
      workspace_id: workspaceId,
    });
  },
  createFolder(
    workspaceId: string,
    name: string,
    parentId?: string | null,
  ): Promise<FolderResponse> {
    return apiClient.postQuery<FolderResponse>(
      '/documents/folders',
      { workspace_id: workspaceId },
      { name, parent_id: parentId },
    );
  },
  updateFolder(
    folderId: string,
    workspaceId: string,
    name?: string,
    parentId?: string | null,
  ): Promise<FolderResponse> {
    return apiClient.patch<FolderResponse>(
      `/documents/folders/${encodeURIComponent(folderId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
      { name, parent_id: parentId },
    );
  },
  deleteFolder(folderId: string, workspaceId: string): Promise<void> {
    return apiClient.delete(
      `/documents/folders/${encodeURIComponent(folderId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  listVersions(documentId: string, workspaceId: string): Promise<DocumentVersionResponse[]> {
    return apiClient.get<DocumentVersionResponse[]>(
      `/documents/${encodeURIComponent(documentId)}/versions`,
      { workspace_id: workspaceId },
    );
  },
  async createVersion(
    documentId: string,
    workspaceId: string,
    file: File,
  ): Promise<DocumentVersionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const csrf = await getCsrfToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (csrf) headers[CSRF_HEADER] = csrf;
    const res = await fetch(
      `${API_BASE}${API_PREFIX}/documents/${encodeURIComponent(documentId)}/versions?workspace_id=${encodeURIComponent(workspaceId)}`,
      {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      },
    );
    if (!res.ok) throw new ApiClientError(res.status, 'Failed to upload new version');
    return (res.json() as Promise<Record<string, unknown>>).then(
      (j) => transformKeys(j) as DocumentVersionResponse,
    );
  },
  restoreVersion(
    documentId: string,
    versionNumber: number,
    workspaceId: string,
  ): Promise<DocumentResponse> {
    return apiClient.postQuery<DocumentResponse>(
      `/documents/${encodeURIComponent(documentId)}/versions/${versionNumber}/restore`,
      { workspace_id: workspaceId },
    );
  },
  listShares(documentId: string, workspaceId: string): Promise<DocumentShareResponse[]> {
    return apiClient.get<DocumentShareResponse[]>(
      `/documents/${encodeURIComponent(documentId)}/shares`,
      { workspace_id: workspaceId },
    );
  },
  createShare(
    documentId: string,
    workspaceId: string,
    targetWorkspaceId: string,
    permission = 'READ',
    expiresAt?: string | null,
  ): Promise<DocumentShareResponse> {
    return apiClient.postQuery<DocumentShareResponse>(
      `/documents/${encodeURIComponent(documentId)}/shares`,
      { workspace_id: workspaceId },
      { target_workspace_id: targetWorkspaceId, permission, expires_at: expiresAt },
    );
  },
  revokeShare(shareId: string, workspaceId: string, documentId?: string): Promise<void> {
    const path = documentId
      ? `/documents/${encodeURIComponent(documentId)}/shares/${encodeURIComponent(shareId)}`
      : `/documents/shares/${encodeURIComponent(shareId)}`;
    return apiClient.delete(`${path}?workspace_id=${encodeURIComponent(workspaceId)}`);
  },
  async bulkUpload(
    workspaceId: string,
    files: File[],
    folderId?: string,
  ): Promise<BulkUploadResponse> {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    const token = getToken();
    const csrf = await getCsrfToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (csrf) headers[CSRF_HEADER] = csrf;
    let url = `${API_BASE}${API_PREFIX}/documents/bulk/upload?workspace_id=${encodeURIComponent(workspaceId)}`;
    if (folderId) url += `&folder_id=${encodeURIComponent(folderId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new ApiClientError(res.status, 'Bulk upload failed');
    return (res.json() as Promise<Record<string, unknown>>).then(
      (j) => transformKeys(j) as BulkUploadResponse,
    );
  },
  async bulkDownload(workspaceId: string, documentIds: string[]): Promise<Blob> {
    const token = getToken();
    const csrf = await getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
    };
    const res = await fetch(
      `${API_BASE}${API_PREFIX}/documents/bulk/download?workspace_id=${encodeURIComponent(workspaceId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ document_ids: documentIds }),
        credentials: 'include',
      },
    );
    if (!res.ok) throw new ApiClientError(res.status, 'Bulk download failed');
    return res.blob();
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

// â”€â”€â”€ Resume â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  // â”€â”€ Overleaf-style source (Typst/LaTeX) â€” hybrid WASM + Tectonic â”€â”€
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

// â”€â”€â”€ Application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ApplicationCreateRequest {
  job_external_id?: string;
  platform?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ApplicationUpdateOutcomeRequest {
  status: string;
  outcome?: string;
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

// â”€â”€â”€ Connector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Consent / Data rights (DPDP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Scheduler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Integration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ IAM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

export interface OrganizationInviteRequest {
  email: string;
  role?: string;
  organization_id?: string;
}

export interface OrganizationInviteResponse {
  id: string;
  email: string;
  role: string;
  status: string;
  message: string;
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
  inviteMember(body: OrganizationInviteRequest): Promise<OrganizationInviteResponse> {
    return apiClient.post<OrganizationInviteResponse>('/iam/organizations/invites', body);
  },
};

export const adminApi = {
  servicesHealth(): Promise<{
    services: Array<{
      name: string;
      status: string;
      uptime: string;
      latency_ms?: number;
      error?: string;
    }>;
    checked_at: number;
  }> {
    return apiClient.get('/admin/services/health');
  },
  runAction(
    action: string,
  ): Promise<{ action: string; status: string; message?: string; diagnostics?: unknown }> {
    return apiClient.post(`/admin/actions/${action}`, {});
  },
};

// â”€â”€â”€ Plugin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const chatApi = {
  send(
    workspaceId: string,
    body: { message: string; agent_name?: string },
  ): Promise<{ reply: string }> {
    return apiClient.post<{ reply: string }>(`/chat/workspaces/${workspaceId}/chat`, body);
  },
};

// â”€â”€â”€ Billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  invoices(): Promise<InvoiceResponse[]> {
    return apiClient.get<InvoiceResponse[]>('/billing/invoices');
  },
  downloadInvoice(invoiceId: string): Promise<{ invoice_id: string; download_url: string }> {
    return apiClient.get<{ invoice_id: string; download_url: string }>(
      `/billing/invoices/${invoiceId}/download`,
    );
  },
};

export interface InvoiceResponse {
  id: string;
  subscriptionId: string | null;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  downloadUrl: string | null;
}

// â”€â”€â”€ BYOK Provider Keys (Bring Your Own Key) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Agents Catalog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

export interface CapabilityTestRequest {
  workspaceId: string;
  capabilityName: string;
  category: string;
  inputPayload?: Record<string, unknown>;
}

export interface CapabilityTestResponse {
  status: 'success' | 'warning' | 'error';
  capability: string;
  category: string;
  timestamp: string;
  executionDurationMs: number;
  validationErrors: string[];
  result: unknown;
}

// â”€â”€â”€ Memory Feed / Lineage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Temporal durable workflows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  startDurableAgent(body: {
    workspace_id: string;
    agent_id?: string;
    request_id?: string;
    input?: Record<string, unknown> | string;
    correlation_id?: string;
  }): Promise<{ workflow_id: string; run_id?: string | null; status: string }> {
    return apiClient.post('/temporal/workflows/durable-agent', body);
  },
};

export interface FeatureFlagItem {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export const featureFlagsApi = {
  list(workspaceId: string): Promise<FeatureFlagItem[]> {
    return apiClient.get<FeatureFlagItem[]>(
      `/feature-flags?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  create(
    workspaceId: string,
    body: {
      name: string;
      description?: string;
      enabled?: boolean;
      rollout_percentage?: number;
      category?: string;
    },
  ): Promise<FeatureFlagItem> {
    return apiClient.post<FeatureFlagItem>(
      `/feature-flags?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
    );
  },
  update(
    flagId: string,
    body: {
      name?: string;
      description?: string;
      enabled?: boolean;
      rollout_percentage?: number;
      category?: string;
    },
  ): Promise<FeatureFlagItem> {
    return apiClient.put<FeatureFlagItem>(`/feature-flags/${flagId}`, body);
  },
  toggle(flagId: string): Promise<FeatureFlagItem> {
    return apiClient.post<FeatureFlagItem>(`/feature-flags/${flagId}/toggle`);
  },
  delete(flagId: string): Promise<void> {
    return apiClient.delete(`/feature-flags/${flagId}`);
  },
};

export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryItem {
  id: string;
  webhook_id: string;
  event_type: string;
  status: string;
  status_code: number | null;
  response_body: string | null;
  attempt: number;
  max_attempts: number;
  completed_at: string | null;
  created_at: string;
}

export const webhookApi = {
  list(): Promise<{ webhooks: WebhookItem[]; total: number }> {
    return apiClient.get<{ webhooks: WebhookItem[]; total: number }>('/webhooks');
  },
  create(body: {
    name: string;
    url: string;
    secret: string;
    events?: string[];
    active?: boolean;
    retry_count?: number;
    timeout_ms?: number;
  }): Promise<WebhookItem> {
    return apiClient.post<WebhookItem>('/webhooks', body);
  },
  get(id: string): Promise<WebhookItem> {
    return apiClient.get<WebhookItem>(`/webhooks/${encodeURIComponent(id)}`);
  },
  update(
    id: string,
    body: Partial<{ name: string; url: string; active: boolean; events: string[] }>,
  ): Promise<WebhookItem> {
    return apiClient.put<WebhookItem>(`/webhooks/${encodeURIComponent(id)}`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/webhooks/${encodeURIComponent(id)}`);
  },
  test(id: string): Promise<{ status: string; delivery_count: number }> {
    return apiClient.post<{ status: string; delivery_count: number }>(
      `/webhooks/test/${encodeURIComponent(id)}`,
    );
  },
  deliveries(id: string): Promise<{ deliveries: WebhookDeliveryItem[]; total: number }> {
    return apiClient.get<{ deliveries: WebhookDeliveryItem[]; total: number }>(
      `/webhooks/${encodeURIComponent(id)}/deliveries`,
    );
  },
};

// â”€â”€ Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface SkillItem {
  name: string;
  confidence: number;
  source: string;
  verified: boolean;
  tag?: string;
  validationTier?: 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | string;
  decayStatus?: 'fresh' | 'active' | 'stale' | string;
  decayFactor?: number;
  effectiveConfidence?: number;
  isMatchable?: boolean;
  category?: string;
  proficiency?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | string;
  yearsExperience?: number;
}

export interface CareerEntry {
  company: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  achievements: string[];
  confidence: number;
  location?: string | null;
  employmentType?: string;
  isCurrent?: boolean;
}

export interface JobPreferencesData {
  jobTypes: string[];
  salaryRange: Record<string, unknown>;
  preferredIndustries: string[];
  dealbreakers: string[];
  remotePreference: string | null;
}

export interface EducationEntry {
  id?: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number | null;
  graduationYear?: number | null;
  gpa?: string | null;
  showGpaOnResume?: boolean;
  honors?: string[];
}

export interface ProjectEntry {
  id?: string;
  title: string;
  tagline?: string | null;
  description: string;
  technologies: string[];
  metricsSummary?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  featured: boolean;
}

export interface ApplicationVaultData {
  demographicsPolicy: 'autofill' | 'decline' | 'blank' | string;
  gender?: string | null;
  ethnicity?: string | null;
  veteranStatus?: string | null;
  disabilityStatus?: string | null;
  authorizedCountries: string[];
  visaStatus: string;
  requiresSponsorship: boolean;
  securityClearance: string;
}

export interface AgentDirectivesData {
  autonomyMode: 'copilot' | 'semi_autonomous' | 'full_autopilot' | string;
  minMatchThreshold: number;
  dailyApplicationQuota: number;
  minBaseSalary?: number | null;
  targetBaseSalary?: number | null;
  targetTotalComp?: number | null;
  currency: string;
  noticePeriod: string;
  relocationPreference: string;
  travelPercentage: string;
  coverLetterPolicy: string;
}

export interface BlacklistItem {
  id: string;
  companyName: string;
  domain?: string | null;
  reason: string;
  autoInferred?: boolean;
}

export interface ScreeningQuestionItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface MemorySummaryItem {
  type: string;
  count: number;
  lastUpdated: string | null;
}

export interface ProfileData {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  phone: string | null;
  socialLinks: Record<string, string>;
  jobTitle: string | null;
  authProvider: string;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  skills: SkillItem[];
  careerHistory: CareerEntry[];
  jobPreferences: JobPreferencesData | null;
  memorySummary: MemorySummaryItem[];
  yearsExperience: number | null;
  education: EducationEntry[];
  projects: ProjectEntry[];
  applicationVault?: ApplicationVaultData | null;
  agentDirectives?: AgentDirectivesData | null;
  companyBlacklist: BlacklistItem[];
  screeningQuestions: ScreeningQuestionItem[];
}

export interface UpdateProfileData {
  display_name?: string;
  bio?: string;
  headline?: string;
  location?: string;
  phone?: string;
  social_links?: Record<string, string>;
  job_title?: string;
  avatar_url?: string;
  preferences?: Record<string, unknown>;
}

export interface ProfileCompletenessData {
  score: number;
  totalFields: number;
  filledFields: number;
  suggestions: Array<{ field: string; action: string; boost: string }>;
}

export interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  jobTitle: string | null;
  socialLinks: Record<string, string>;
  skills: SkillItem[];
  careerHistory: CareerEntry[];
  yearsExperience: number | null;
  createdAt: string;
}

export interface ATSReadinessData {
  score: number;
  statusLabel: string;
  targetRole: string | null;
  totalSkillsCount: number;
  matchingSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  keywordMatchPct: number;
}

export interface ProfileRecommendationItem {
  id: string;
  agentName: string;
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string | null;
  impact: string;
  createdAt: string;
}

export interface ProfileActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  agentName?: string;
}

export interface ProfileImportSummaryData {
  skillsImported: number;
  careerImported: number;
  educationImported: number;
  message: string;
  profile: ProfileData;
}

export const profileApi = {
  get(workspaceId?: string): Promise<ProfileData> {
    const params = workspaceId ? { workspace_id: workspaceId } : undefined;
    return apiClient.get<ProfileData>('/profile', params);
  },
  update(data: UpdateProfileData, workspaceId?: string): Promise<ProfileData> {
    const qs = workspaceId ? `?workspace_id=${workspaceId}` : '';
    return apiClient.put<ProfileData>(`/profile${qs}`, data);
  },
  uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.request<{ avatarUrl: string }>('/profile/avatar', {
      method: 'POST',
      body: formData,
      headers: {},
    });
  },
  completeness(workspaceId?: string): Promise<ProfileCompletenessData> {
    const params = workspaceId ? { workspace_id: workspaceId } : undefined;
    return apiClient.get<ProfileCompletenessData>('/profile/completeness', params);
  },
  confirmSkill(skillName: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/skills/confirm', {
      skill_name: skillName,
      workspace_id: workspaceId,
    });
  },
  addSkill(skillName: string, workspaceId: string, confidence = 1.0): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/skills', {
      skill_name: skillName,
      workspace_id: workspaceId,
      confidence,
    });
  },
  removeSkill(skillName: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.delete<ProfileData>(
      `/profile/skills/${encodeURIComponent(skillName)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  updatePreferences(data: Partial<JobPreferencesData>, workspaceId: string): Promise<ProfileData> {
    return apiClient.put<ProfileData>('/profile/preferences', {
      workspace_id: workspaceId,
      job_types: data.jobTypes ?? [],
      salary_range: data.salaryRange ?? {},
      preferred_industries: data.preferredIndustries ?? [],
      dealbreakers: data.dealbreakers ?? [],
      remote_preference: data.remotePreference ?? null,
    });
  },
  autoPopulate(workspaceId: string): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/auto-populate', {
      workspace_id: workspaceId,
    });
  },
  importResume(file: File, workspaceId: string): Promise<ProfileImportSummaryData> {
    const formData = new FormData();
    formData.append('file', file);
    return api.request<ProfileImportSummaryData>(
      `/profile/import/resume?workspace_id=${encodeURIComponent(workspaceId)}`,
      { method: 'POST', body: formData, headers: {} },
    );
  },
  importLinkedIn(linkedinUrl: string, workspaceId: string): Promise<ProfileImportSummaryData> {
    return apiClient.post<ProfileImportSummaryData>('/profile/import/linkedin', {
      workspace_id: workspaceId,
      linkedin_url: linkedinUrl,
    });
  },
  getPublic(userId: string): Promise<PublicProfileData> {
    return apiClient.get<PublicProfileData>(`/profile/public/${encodeURIComponent(userId)}`);
  },
  atsReadiness(workspaceId: string): Promise<ATSReadinessData> {
    return apiClient.get<ATSReadinessData>('/profile/ats-readiness', {
      workspace_id: workspaceId,
    });
  },
  recommendations(workspaceId: string): Promise<ProfileRecommendationItem[]> {
    return apiClient.get<ProfileRecommendationItem[]>('/profile/recommendations', {
      workspace_id: workspaceId,
    });
  },
  addCareer(
    data: {
      company: string;
      role: string;
      startDate?: string;
      endDate?: string;
      achievements?: string[];
      location?: string;
      employmentType?: string;
      isCurrent?: boolean;
    },
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/career', {
      workspace_id: workspaceId,
      company: data.company,
      role: data.role,
      start_date: data.startDate,
      end_date: data.endDate,
      achievements: data.achievements ?? [],
      location: data.location,
      employment_type: data.employmentType,
      is_current: data.isCurrent,
    });
  },
  updateCareer(
    company: string,
    data: {
      role?: string;
      startDate?: string;
      endDate?: string;
      achievements?: string[];
      location?: string;
      employmentType?: string;
      isCurrent?: boolean;
    },
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.put<ProfileData>(`/profile/career/${encodeURIComponent(company)}`, {
      workspace_id: workspaceId,
      role: data.role,
      start_date: data.startDate,
      end_date: data.endDate,
      achievements: data.achievements,
      location: data.location,
      employment_type: data.employmentType,
      is_current: data.isCurrent,
    });
  },
  deleteCareer(company: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.delete<ProfileData>(
      `/profile/career/${encodeURIComponent(company)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  activity(workspaceId: string): Promise<ProfileActivityItem[]> {
    return apiClient.get<ProfileActivityItem[]>('/profile/activity', {
      workspace_id: workspaceId,
    });
  },
  addEducation(
    data: {
      institution: string;
      degree: string;
      fieldOfStudy: string;
      startYear?: number | null;
      graduationYear?: number | null;
      gpa?: string | null;
      showGpaOnResume?: boolean;
      honors?: string[];
    },
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/education', {
      workspace_id: workspaceId,
      institution: data.institution,
      degree: data.degree,
      field_of_study: data.fieldOfStudy,
      start_year: data.startYear,
      graduation_year: data.graduationYear,
      gpa: data.gpa,
      show_gpa_on_resume: data.showGpaOnResume ?? false,
      honors: data.honors ?? [],
    });
  },
  updateEducation(
    educationId: string,
    data: Partial<EducationEntry>,
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.put<ProfileData>(`/profile/education/${encodeURIComponent(educationId)}`, {
      workspace_id: workspaceId,
      institution: data.institution,
      degree: data.degree,
      field_of_study: data.fieldOfStudy,
      start_year: data.startYear,
      graduation_year: data.graduationYear,
      gpa: data.gpa,
      show_gpa_on_resume: data.showGpaOnResume,
      honors: data.honors,
    });
  },
  deleteEducation(educationId: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.delete<ProfileData>(
      `/profile/education/${encodeURIComponent(educationId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  addProject(
    data: {
      title: string;
      tagline?: string | null;
      description: string;
      technologies?: string[];
      metricsSummary?: string | null;
      liveUrl?: string | null;
      githubUrl?: string | null;
      featured?: boolean;
    },
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/projects', {
      workspace_id: workspaceId,
      title: data.title,
      tagline: data.tagline,
      description: data.description,
      technologies: data.technologies ?? [],
      metrics_summary: data.metricsSummary,
      live_url: data.liveUrl,
      github_url: data.githubUrl,
      featured: data.featured ?? true,
    });
  },
  updateProject(
    projectId: string,
    data: Partial<ProjectEntry>,
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.put<ProfileData>(`/profile/projects/${encodeURIComponent(projectId)}`, {
      workspace_id: workspaceId,
      title: data.title,
      tagline: data.tagline,
      description: data.description,
      technologies: data.technologies,
      metrics_summary: data.metricsSummary,
      live_url: data.liveUrl,
      github_url: data.githubUrl,
      featured: data.featured,
    });
  },
  deleteProject(projectId: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.delete<ProfileData>(
      `/profile/projects/${encodeURIComponent(projectId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  updateVault(data: Partial<ApplicationVaultData>, workspaceId: string): Promise<ProfileData> {
    return apiClient.put<ProfileData>('/profile/vault', {
      workspace_id: workspaceId,
      demographics_policy: data.demographicsPolicy ?? 'decline',
      gender: data.gender,
      ethnicity: data.ethnicity,
      veteran_status: data.veteranStatus,
      disability_status: data.disabilityStatus,
      authorized_countries: data.authorizedCountries ?? ['US'],
      visa_status: data.visaStatus ?? 'Citizen',
      requires_sponsorship: data.requiresSponsorship ?? false,
      security_clearance: data.securityClearance ?? 'None',
    });
  },
  updateDirectives(data: Partial<AgentDirectivesData>, workspaceId: string): Promise<ProfileData> {
    return apiClient.put<ProfileData>('/profile/directives', {
      workspace_id: workspaceId,
      autonomy_mode: data.autonomyMode ?? 'copilot',
      min_match_threshold: data.minMatchThreshold ?? 80,
      daily_application_quota: data.dailyApplicationQuota ?? 10,
      min_base_salary: data.minBaseSalary,
      target_base_salary: data.targetBaseSalary,
      target_total_comp: data.targetTotalComp,
      currency: data.currency ?? 'USD',
      notice_period: data.noticePeriod ?? '2 weeks',
      relocation_preference: data.relocationPreference ?? 'Remote only',
      travel_percentage: data.travelPercentage ?? '0%',
      cover_letter_policy: data.coverLetterPolicy ?? 'when_required',
    });
  },
  addBlacklist(
    data: { companyName: string; domain?: string; reason?: string },
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.post<ProfileData>('/profile/blacklist', {
      workspace_id: workspaceId,
      company_name: data.companyName,
      domain: data.domain,
      reason: data.reason ?? 'Company Blacklist',
    });
  },
  removeBlacklist(companyName: string, workspaceId: string): Promise<ProfileData> {
    return apiClient.delete<ProfileData>(
      `/profile/blacklist/${encodeURIComponent(companyName)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  updateScreeningQuestions(
    questions: ScreeningQuestionItem[],
    workspaceId: string,
  ): Promise<ProfileData> {
    return apiClient.put<ProfileData>('/profile/screening-questions', {
      workspace_id: workspaceId,
      questions,
    });
  },
};

// â”€â”€ Opportunities (PIOS Opportunity Engine) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface OpportunityDTO {
  id?: string;
  title: string;
  company: string;
  type?: 'job' | 'hackathon' | 'research' | 'oss' | 'cofounder' | string;
  requiredSkills?: string[];
  location?: string | null;
  url?: string | null;
  description?: string | null;
}

export interface OpportunityMetrics {
  cosineSimilarity: number;
  networkProximity: number;
  decayWeightedConfidence: number;
  skillGapPenalty: number;
}

export interface MatchedSkillDetail {
  name: string;
  tag?: string;
  validationTier?: string;
  decayStatus?: string;
  decayFactor?: number;
  effectiveConfidence?: number;
}

export interface OpportunityMatchResult {
  opportunityId: string;
  title: string;
  company: string;
  type: string;
  matchScore: number;
  whyYou: string;
  metrics: OpportunityMetrics;
  matchedSkills: MatchedSkillDetail[];
  missingSkills: string[];
}

export const opportunityApi = {
  match(opportunity: OpportunityDTO, connectedEntitiesCount = 0): Promise<OpportunityMatchResult> {
    return apiClient.post<OpportunityMatchResult>('/opportunities/match', {
      opportunity: {
        id: opportunity.id,
        title: opportunity.title,
        company: opportunity.company,
        type: opportunity.type ?? 'job',
        required_skills: opportunity.requiredSkills ?? [],
        location: opportunity.location,
        url: opportunity.url,
        description: opportunity.description,
      },
      connected_entities_count: connectedEntitiesCount,
    });
  },
  rank(opportunities: OpportunityDTO[], topK = 10): Promise<OpportunityMatchResult[]> {
    return apiClient.post<OpportunityMatchResult[]>('/opportunities/rank', {
      opportunities: opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        company: o.company,
        type: o.type ?? 'job',
        required_skills: o.requiredSkills ?? [],
        location: o.location,
        url: o.url,
        description: o.description,
      })),
      top_k: topK,
    });
  },
};

// â”€â”€ Agent Council (PIOS Adjudication Quality Gate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface CouncilReviewRequest {
  artifact: string;
  artifactType?: string;
  context?: Record<string, unknown>;
  mode?: 'collaborative' | 'adversarial';
}

export interface CouncilCritique {
  role: string;
  stance: 'PASS' | 'CONCERN' | 'BLOCK' | string;
  analysis: string;
  irreducibleFlaws: string[];
  reducibleFlaws: string[];
  confidence: number;
}

export interface CouncilRebuttal {
  reviewerRole: string;
  targetRole: string;
  agreement: boolean;
  rebuttalComment: string;
}

export interface CouncilVerdict {
  verdict: 'SHIP' | 'REVISE' | 'HOLD';
  overallScore: number;
  confidence: number;
  summary: string;
  revisionBrief: string[];
  irreducibleFlaws: string[];
  reducibleFlaws: string[];
  round1Critiques: Record<string, CouncilCritique>;
  round2Rebuttals: CouncilRebuttal[];
  bypassedTriage: boolean;
  timestamp: string;
}

export const councilApi = {
  review(body: CouncilReviewRequest): Promise<CouncilVerdict> {
    return apiClient.post<CouncilVerdict>('/council/review', {
      artifact: body.artifact,
      artifact_type: body.artifactType ?? 'text',
      context: body.context ?? {},
      mode: body.mode ?? 'collaborative',
    });
  },
  triage(artifact: string): Promise<{ requiresCouncil: boolean; length: number; reason: string }> {
    return apiClient.post<{ requiresCouncil: boolean; length: number; reason: string }>(
      '/council/triage',
      {
        artifact,
      },
    );
  },
  certify(data: {
    workspaceId: string;
    agentName: string;
    executionId: string;
    artifact: string;
    artifactType?: string;
    toolsInvoked?: string[];
    mode?: string;
  }): Promise<Record<string, unknown>> {
    return apiClient.post('/council/evaluate-and-certify', {
      workspace_id: data.workspaceId,
      agent_name: data.agentName,
      execution_id: data.executionId,
      artifact: data.artifact,
      artifact_type: data.artifactType ?? 'text',
      tools_invoked: data.toolsInvoked ?? [],
      mode: data.mode ?? 'collaborative',
    });
  },
};

// â”€â”€â”€ Organizations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface OrganizationNode {
  id: string;
  name: string;
  type: 'organization' | 'department' | 'team';
  tenantId: string;
  workspaceId?: string | null;
  parentId?: string | null;
  membersCount: number;
  createdAt: string;
  updatedAt: string;
  children: OrganizationNode[];
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  createdAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  type?: 'organization' | 'department' | 'team';
  workspace_id?: string | null;
  parent_id?: string | null;
  allowed_domains?: string[];
  default_role?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  type?: 'organization' | 'department' | 'team';
  parent_id?: string | null;
  allowed_domains?: string[];
  default_role?: string;
}

export interface AddOrganizationMemberRequest {
  user_id: string;
  role?: 'admin' | 'lead' | 'member' | 'viewer';
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token?: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role?: 'admin' | 'lead' | 'member' | 'viewer';
}

/**
 * The organizations list endpoints return a `{ items, total }` envelope
 * (organizations.py get_organization_tree / list_organization_members /
 * list_organization_invitations). The previous client typed them as bare
 * arrays, so callers received an object where they expected an array â€”
 * `organizations/page.tsx` then did `roots.map(...)` on `{items,total}` and
 * threw at runtime. Unwrap here so the caller's array contract holds, and keep
 * the envelope accessible for callers that need the count.
 */
interface ListEnvelope<T> {
  items?: T[];
  total?: number;
}

function unwrapItems<T>(payload: T[] | ListEnvelope<T> | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.items ?? [];
}

export const organizationsApi = {
  getTree(workspaceId?: string | null): Promise<OrganizationNode[]> {
    return apiClient
      .get<OrganizationNode[] | ListEnvelope<OrganizationNode>>(
        '/organizations/tree',
        workspaceId ? { workspace_id: workspaceId } : undefined,
      )
      .then(unwrapItems<OrganizationNode>);
  },
  create(body: CreateOrganizationRequest): Promise<OrganizationNode> {
    return apiClient.post<OrganizationNode>('/organizations', body);
  },
  update(id: string, body: UpdateOrganizationRequest): Promise<OrganizationNode> {
    return apiClient.patch<OrganizationNode>(`/organizations/${id}`, body);
  },
  delete(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(`/organizations/${id}`);
  },
  getMembers(id: string): Promise<OrganizationMember[]> {
    return apiClient
      .get<OrganizationMember[] | ListEnvelope<OrganizationMember>>(`/organizations/${id}/members`)
      .then(unwrapItems<OrganizationMember>);
  },
  addMember(id: string, body: AddOrganizationMemberRequest): Promise<OrganizationMember> {
    return apiClient.post<OrganizationMember>(`/organizations/${id}/members`, body);
  },
  removeMember(id: string, userId: string): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(`/organizations/${id}/members/${userId}`);
  },
  createInvitation(orgId: string, body: CreateInvitationRequest): Promise<OrganizationInvitation> {
    return apiClient.post<OrganizationInvitation>(`/organizations/${orgId}/invitations`, body);
  },
  getInvitations(orgId: string): Promise<OrganizationInvitation[]> {
    return apiClient
      .get<OrganizationInvitation[] | ListEnvelope<OrganizationInvitation>>(
        `/organizations/${orgId}/invitations`,
      )
      .then(unwrapItems<OrganizationInvitation>);
  },
  revokeInvitation(invitationId: string): Promise<{ ok: boolean }> {
    return apiClient.delete<{ ok: boolean }>(`/organizations/invitations/${invitationId}`);
  },
  acceptInvitation(
    token: string,
  ): Promise<{ status: string; organizationId: string; role: string }> {
    return apiClient.post<{ status: string; organizationId: string; role: string }>(
      `/organizations/invitations/${token}/accept`,
      {},
    );
  },
};

// â”€â”€â”€ Marketplace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface MarketplaceListingItem {
  id: string;
  pluginId: string;
  name: string;
  slug: string;
  category: string;
  author: string;
  description: string;
  version: string;
  rating: number;
  installCount: number;
  tags: string[];
  configSchema?: Record<string, unknown>;
  createdAt: string;
}

export interface MarketplaceListingsResponse {
  items: MarketplaceListingItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface WorkspacePluginInstallItem {
  id: string;
  workspaceId: string;
  listingId: string;
  installedBy: string;
  isActive: boolean;
  config: Record<string, unknown>;
  installedAt: string;
  listing?: MarketplaceListingItem;
}

export const marketplaceApi = {
  getListings(params?: {
    category?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<MarketplaceListingsResponse> {
    return apiClient.get<MarketplaceListingsResponse>(
      '/marketplace/listings',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  getListing(id: string): Promise<MarketplaceListingItem> {
    return apiClient.get<MarketplaceListingItem>(`/marketplace/listings/${id}`);
  },
  install(
    listingId: string,
    body: { workspace_id: string; config?: Record<string, unknown> },
  ): Promise<WorkspacePluginInstallItem> {
    return apiClient.post<WorkspacePluginInstallItem>(
      `/marketplace/listings/${listingId}/install`,
      body,
    );
  },
  uninstall(
    listingId: string,
    workspaceId: string,
  ): Promise<{ ok: boolean; uninstalled: boolean }> {
    return apiClient.delete<{ ok: boolean; uninstalled: boolean }>(
      `/marketplace/listings/${listingId}/uninstall?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  getInstalled(workspaceId: string): Promise<WorkspacePluginInstallItem[]> {
    return apiClient.get<WorkspacePluginInstallItem[]>('/marketplace/installed', {
      workspace_id: workspaceId,
    });
  },
  seed(): Promise<{ message: string; count: number }> {
    return apiClient.post<{ message: string; count: number }>('/marketplace/seed');
  },
  rate(
    listingId: string,
    body: { rating: number; review?: string },
  ): Promise<{
    listing_id: string;
    user_id: string;
    rating: number;
    review?: string;
    average_rating: number;
  }> {
    return apiClient.post(`/marketplace/listings/${listingId}/rate`, body);
  },
  execute(
    installId: string,
    body: { workspace_id: string; action: string; params?: Record<string, unknown> },
  ): Promise<{ status: string; plugin: string; action: string; result: Record<string, unknown> }> {
    return apiClient.post(`/marketplace/installed/${installId}/execute`, body);
  },
};

// â”€â”€â”€ Capabilities API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CapabilityItemRecord {
  id: string;
  workspaceId: string;
  name: string;
  category: 'skill' | 'connector' | 'mcp' | 'plugin' | 'tool' | 'agent';
  description: string;
  version: string;
  status: string;
  enabled: boolean;
  author: string;
  type: string;
  runtime: string;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCapabilityRequest {
  name: string;
  category: string;
  description?: string;
  version?: string;
  author?: string;
  type?: string;
  runtime?: string;
  config?: Record<string, unknown>;
}

export interface UpdateCapabilityRequest {
  enabled?: boolean;
  status?: string;
  description?: string;
  config?: Record<string, unknown>;
}

export const capabilitiesApi = {
  list(category?: string, workspaceId?: string): Promise<CapabilityItemRecord[]> {
    const params: Record<string, string | undefined> = {};
    if (category) params['category'] = category;
    if (workspaceId) params['workspace_id'] = workspaceId;
    return apiClient.get<CapabilityItemRecord[]>('/capabilities', params);
  },
  getCapabilities(params?: {
    workspaceId?: string;
    category?: string;
  }): Promise<CapabilityItemRecord[]> {
    return apiClient.get<CapabilityItemRecord[]>('/capabilities', params);
  },
  get(capabilityId: string): Promise<CapabilityItemRecord> {
    return apiClient.get<CapabilityItemRecord>(`/capabilities/${capabilityId}`);
  },
  create(body: CreateCapabilityRequest): Promise<CapabilityItemRecord> {
    return apiClient.post<CapabilityItemRecord>('/capabilities', body);
  },
  update(capabilityId: string, body: UpdateCapabilityRequest): Promise<CapabilityItemRecord> {
    return apiClient.patch<CapabilityItemRecord>(`/capabilities/${capabilityId}`, body);
  },
  delete(capabilityId: string): Promise<void> {
    return apiClient.delete<void>(`/capabilities/${capabilityId}`);
  },
  toggleCapability(capabilityId: string, enabled: boolean, workspaceId?: string) {
    return apiClient.patch<CapabilityItemRecord>(`/capabilities/${capabilityId}`, {
      enabled,
      workspace_id: workspaceId,
    });
  },
  testCapability(
    capabilityId: string,
    inputPayload?: Record<string, unknown>,
    workspaceId?: string,
  ) {
    return apiClient.post(`/capabilities/${capabilityId}/test`, {
      input: inputPayload,
      workspace_id: workspaceId,
    });
  },
  test(body: CapabilityTestRequest): Promise<CapabilityTestResponse> {
    return apiClient.post<CapabilityTestResponse>('/agents/capabilities/test', {
      workspace_id: body.workspaceId,
      capability_name: body.capabilityName,
      category: body.category,
      input_payload: body.inputPayload ?? {},
    });
  },
};

// â”€â”€â”€ Connectors API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ConnectorItem {
  id: string;
  name: string;
  type: 'rest' | 'graphql' | 'mcp';
  config: Record<string, any>;
  syncInterval?: number;
  lastSync?: string;
  status: 'active' | 'syncing' | 'error' | 'paused';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
  tenantId?: string;
}

export interface CreateConnectorRequest {
  name: string;
  type: 'rest' | 'graphql' | 'mcp';
  config: Record<string, any>;
  workspace_id?: string;
  sync_interval?: number;
}

export interface UpdateConnectorRequest {
  name?: string;
  config?: Record<string, any>;
  sync_interval?: number;
  status?: string;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  readOnly?: boolean;
}

export interface BuiltinMcpServer {
  id: string;
  name: string;
  description: string;
  transport: string;
  tools: string[];
  config: Record<string, any>;
}

export interface ComposioAppInfo {
  id: string;
  name: string;
  description: string;
  category?: string;
  action_count?: number;
}

export interface ComposioAppsResponse {
  total: number;
  limit: number;
  offset: number;
  apps: ComposioAppInfo[];
  categories: string[];
}

export interface ComposioStatusResponse {
  enabled: boolean;
  total_apps?: number;
  popular_apps: ComposioAppInfo[];
}

export interface ComposioAuthUrlResponse {
  status: string;
  app: string;
  auth_url?: string;
  url?: string;
  workspace_id?: string;
  connection_status?: string;
  error_code?: string;
  message?: string;
}

export interface ConnectorHealthResponse {
  status: string;
  connector_id: string;
  type: string;
  name: string;
  last_sync?: string;
  error_message?: string;
  config_keys: string[];
}

export const connectorsApi = {
  list(workspaceId?: string, type?: string): Promise<ConnectorItem[]> {
    const params: Record<string, string | undefined> = {};
    if (workspaceId) params['workspace_id'] = workspaceId;
    if (type) params['type'] = type;
    return apiClient.get<ConnectorItem[]>('/connectors', params);
  },
  get(connectorId: string): Promise<ConnectorItem> {
    return apiClient.get<ConnectorItem>(`/connectors/${connectorId}`);
  },
  create(body: CreateConnectorRequest): Promise<ConnectorItem> {
    return apiClient.post<ConnectorItem>('/connectors', body);
  },
  update(connectorId: string, body: UpdateConnectorRequest): Promise<ConnectorItem> {
    return apiClient.put<ConnectorItem>(`/connectors/${connectorId}`, body);
  },
  delete(connectorId: string): Promise<void> {
    return apiClient.delete<void>(`/connectors/${connectorId}`);
  },
  sync(connectorId: string): Promise<{ status: string; records_synced?: number; error?: string }> {
    return apiClient.post(`/connectors/${connectorId}/sync`);
  },
  getSyncStatus(
    connectorId: string,
  ): Promise<{ status: string; records_synced?: number; error?: string }> {
    return apiClient.get(`/connectors/${connectorId}/sync/status`);
  },
  test(
    connectorId: string,
  ): Promise<{ status: string; code?: number; error?: string; message?: string }> {
    return apiClient.post(`/connectors/${connectorId}/test`);
  },
  health(connectorId: string): Promise<ConnectorHealthResponse> {
    return apiClient.get<ConnectorHealthResponse>(`/connectors/${connectorId}/health`);
  },
  mcp: {
    listTools(connectorId: string, refresh = false): Promise<McpToolInfo[]> {
      return apiClient.get<McpToolInfo[]>(`/connectors/${connectorId}/mcp/tools`, { refresh });
    },
    refreshTools(connectorId: string): Promise<McpToolInfo[]> {
      return apiClient.post<McpToolInfo[]>(`/connectors/${connectorId}/mcp/tools/refresh`);
    },
    sync(
      connectorId: string,
      workspaceId?: string,
    ): Promise<{ connector_id: string; registered: string[]; bridged_total: number }> {
      return apiClient.post(
        `/connectors/${connectorId}/mcp/sync`,
        workspaceId ? { workspace_id: workspaceId } : undefined,
      );
    },
    call(connectorId: string, toolName: string, args: Record<string, unknown> = {}): Promise<any> {
      return apiClient.post(`/connectors/${connectorId}/mcp/call`, {
        tool_name: toolName,
        arguments: args,
      });
    },
    builtin(): Promise<{ builtin_servers: BuiltinMcpServer[] }> {
      return apiClient.get<{ builtin_servers: BuiltinMcpServer[] }>('/connectors/mcp/builtin');
    },
  },
  composio: {
    status(): Promise<ComposioStatusResponse> {
      return apiClient.get<ComposioStatusResponse>('/connectors/composio/status');
    },
    apps(params?: {
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<ComposioAppsResponse> {
      return apiClient.get<ComposioAppsResponse>(
        '/connectors/composio/apps',
        params as Record<string, string | number | boolean | undefined | null>,
      );
    },
    authUrl(
      app: string,
      workspaceId: string,
      redirectUrl?: string,
    ): Promise<ComposioAuthUrlResponse> {
      return apiClient.post<ComposioAuthUrlResponse>('/connectors/composio/auth-url', {
        app,
        workspace_id: workspaceId,
        redirect_url: redirectUrl,
      });
    },
    sync(
      workspaceId: string,
    ): Promise<{ workspace_id: string; registered: string[]; count: number }> {
      return apiClient.post(`/connectors/composio/sync`, { workspace_id: workspaceId });
    },
  },
};

export interface ScaleMemoryNode {
  id: string;
  workspaceId: string;
  userId: string;
  tier: string;
  title: string;
  summary: string;
  content: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

export interface MorningBriefing {
  id?: string;
  workspaceId: string;
  date: string;
  headlines: string[];
  keyAccomplishments: string[];
  blockersAndRisks: string[];
  recommendedPriorities: string[];
  rawSummary?: string;
}

export interface RealityGapItem {
  commitment: string;
  evidence: string;
  gapSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  observation: string;
}

export interface RealityGapAnalysis {
  workspaceId: string;
  overallScore: number;
  gaps: RealityGapItem[];
  recommendations: string[];
  analyzedAt: string;
}

export const cognitionApi = {
  listScaleNodes(
    workspaceId: string,
    params?: { tier?: string; limit?: number; offset?: number },
  ): Promise<{ nodes: ScaleMemoryNode[]; total: number }> {
    return apiClient.get('/cognition/scale/nodes', { workspace_id: workspaceId, ...params });
  },
  createScaleNode(
    workspaceId: string,
    data: { tier: string; title: string; summary: string; content?: string },
  ): Promise<ScaleMemoryNode> {
    return apiClient.post(
      `/cognition/scale/nodes?workspace_id=${encodeURIComponent(workspaceId)}`,
      data,
    );
  },
  deleteScaleNode(workspaceId: string, nodeId: string): Promise<{ deleted: boolean }> {
    return apiClient.delete(
      `/cognition/scale/nodes/${nodeId}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  rollup(data: {
    target_tier: string;
    period_start: string;
    period_end: string;
    workspace_id: string;
  }): Promise<ScaleMemoryNode> {
    return apiClient.post('/cognition/scale/rollup', data);
  },
  triggerOvernight(workspaceId: string, targetDate?: string): Promise<MorningBriefing> {
    return apiClient.post('/cognition/overnight/run', {
      workspace_id: workspaceId,
      target_date: targetDate,
    });
  },
  getTodayBriefing(workspaceId: string): Promise<MorningBriefing> {
    return apiClient.get('/cognition/briefing/today', { workspace_id: workspaceId });
  },
  getRealityGap(
    workspaceId: string,
    periodStart?: string,
    periodEnd?: string,
  ): Promise<RealityGapAnalysis> {
    return apiClient.get('/cognition/reality-gap', {
      workspace_id: workspaceId,
      period_start: periodStart,
      period_end: periodEnd,
    });
  },
};

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  tenantId?: string;
  userId: string;
  expiresAt?: string;
  lastUsed?: string;
  enabled: boolean;
  version: number;
  rotatedAt?: string;
  createdAt: string;
}

export interface CreatedApiKeyItem extends ApiKeyItem {
  key: string;
}

export interface RotatedApiKeyItem {
  id: string;
  key: string;
  keyPrefix: string;
  version: number;
  rotatedAt?: string;
}

export const apiKeysApi = {
  list(): Promise<ApiKeyItem[]> {
    return apiClient.get('/api-keys');
  },
  create(data: {
    name: string;
    permissions?: string[];
    expires_days?: number;
  }): Promise<CreatedApiKeyItem> {
    return apiClient.post('/api-keys', data);
  },
  rotate(keyId: string): Promise<RotatedApiKeyItem> {
    return apiClient.post(`/api-keys/${keyId}/rotate`);
  },
  revoke(keyId: string): Promise<{ status: string }> {
    return apiClient.delete(`/api-keys/${keyId}`);
  },
};
