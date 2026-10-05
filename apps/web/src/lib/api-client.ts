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

// ─── Auth ────────────────────────────────────────────────────────────────────

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
  workspace_id?: string;
  type?: string;
  domain?: string;
  tags?: string[];
  top_k?: number;
  threshold?: number;
  strategy?: 'hybrid' | 'vector' | 'keyword';
  include_superseded?: boolean;
}

export interface MemorySupersedeRequest {
  reason: string;
  title?: string;
  summary?: string;
  content?: string;
  type?: string;
  domain?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  confidence?: number;
}

export interface MemoryExportResponse {
  export_version: string;
  workspace_id: string;
  exported_at: string;
  total_count: number;
  memories: Memory[];
}

export interface MemoryImportItem {
  type?: string;
  domain?: string;
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  source_type?: string;
  source_label?: string;
}

export interface MemoryImportBatchRequest {
  workspace_id?: string;
  deduplicate_by_hash?: boolean;
  memories: MemoryImportItem[];
}

export interface MemoryImportResponse {
  imported_count: number;
  skipped_count: number;
  error_count: number;
  imported_ids: string[];
}

export interface MemoryBulkResult {
  success_count: number;
  failed_count: number;
  affected_ids: string[];
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
    workspace_id?: string;
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
  supersede(id: string, body: MemorySupersedeRequest): Promise<Memory> {
    return apiClient.post<Memory>(`/memories/${id}/supersede`, body);
  },
  delete(id: string): Promise<void> {
    return apiClient.delete(`/memories/${id}`);
  },
  search(body: MemorySearchRequest): Promise<MemorySearchResultItem[]> {
    return apiClient.post<MemorySearchResultItem[]>('/memories/search', body);
  },
  export(workspaceId: string, includeSuperseded: boolean = false): Promise<MemoryExportResponse> {
    return apiClient.get<MemoryExportResponse>(
      `/memories/export?workspace_id=${workspaceId}&include_superseded=${includeSuperseded}`,
    );
  },
  import(body: MemoryImportBatchRequest): Promise<MemoryImportResponse> {
    return apiClient.post<MemoryImportResponse>('/memories/import', body);
  },
  bulkStatus(workspaceId: string, memoryIds: string[], status: string): Promise<MemoryBulkResult> {
    return apiClient.post<MemoryBulkResult>('/memories/bulk-status', {
      workspace_id: workspaceId,
      memory_ids: memoryIds,
      status,
    });
  },
  bulkTag(
    workspaceId: string,
    memoryIds: string[],
    addTags: string[] = [],
    removeTags: string[] = [],
  ): Promise<MemoryBulkResult> {
    return apiClient.post<MemoryBulkResult>('/memories/bulk-tag', {
      workspace_id: workspaceId,
      memory_ids: memoryIds,
      add_tags: addTags,
      remove_tags: removeTags,
    });
  },
};

// ─── Vault Sync (Memory Vault Git Plumbing) ──────────────────────────────────

export interface VaultSyncStatus {
  workspaceId: string;
  /** 'unknown' when no client has ever connected — not a reassuring value. */
  status:
    'unknown' | 'in_sync' | 'syncing' | 'behind' | 'ahead' | 'diverged' | 'conflict' | 'error';
  /** True only once a vaultsync client has checked in. */
  installed: boolean;
  /** Derived from client heartbeat freshness; 'not_connected' when there is none. */
  daemonStatus: 'not_connected' | 'running' | 'paused' | 'stale' | 'unknown';
  lastClientHeartbeat?: string | null;
  branch: string;
  remoteUrl?: string | null;
  /** null until configured; the server must not invent a path. */
  vaultPath?: string | null;
  totalNotes: number;
  vaultMemories: number;
  lastPullTime?: string | null;
  lastPushTime?: string | null;
  conflictsCount: number;
  autoIngest: boolean;
  debounceSeconds: number;
  rebaseIntervalMinutes: number;
  /** 'client' — git sync runs on the user's machine, not on the server. */
  engine: 'client';
  engineNote: string;
}

export interface VaultConfigUpdateRequest {
  workspace_id: string;
  remote_url?: string;
  branch?: string;
  vault_path?: string;
  auto_ingest?: boolean;
  daemon_status?: 'running' | 'paused';
  // Previously absent from the wire contract, so the UI's debounce/rebase
  // number inputs were write-only state that could never be saved.
  debounce_seconds?: number;
  rebase_interval_minutes?: number;
}

export interface VaultNoteItem {
  filename: string;
  content: string;
  relative_path?: string;
  tags?: string[];
  last_modified?: string;
}

export interface VaultIngestRequest {
  workspace_id: string;
  notes: VaultNoteItem[];
}

export interface VaultConflict {
  id: string;
  file: string;
  conflict_file: string;
  detected_at: string;
  local_head?: string;
  remote_head?: string;
}

export interface VaultSyncLog {
  timestamp: string;
  level: string;
  message: string;
  event?: string;
  executed?: boolean;
}

export interface VaultSyncTriggerResponse {
  success: boolean;
  /** False when no sync actually ran — the server has no git engine. */
  executed: boolean;
  workspace_id: string;
  daemon_status: string;
  last_pull_time: string | null;
  last_push_time: string | null;
  conflicts_count: number;
  message: string;
}

export const vaultSyncApi = {
  getStatus(workspaceId: string): Promise<VaultSyncStatus> {
    return apiClient.get<VaultSyncStatus>('/vault-sync/status', { workspace_id: workspaceId });
  },
  updateConfig(body: VaultConfigUpdateRequest): Promise<{ success: boolean; config: unknown }> {
    return apiClient.post<{ success: boolean; config: unknown }>('/vault-sync/config', body);
  },
  triggerSync(workspaceId: string): Promise<VaultSyncTriggerResponse> {
    return apiClient.post<VaultSyncTriggerResponse>('/vault-sync/sync', {
      workspace_id: workspaceId,
    });
  },
  getLogs(workspaceId: string): Promise<VaultSyncLog[]> {
    return apiClient.get<VaultSyncLog[]>('/vault-sync/logs', { workspace_id: workspaceId });
  },
  ingest(body: VaultIngestRequest): Promise<{
    success: boolean;
    ingested_documents: number;
    created_or_updated_memories: number;
  }> {
    return apiClient.post<{
      success: boolean;
      ingested_documents: number;
      created_or_updated_memories: number;
    }>('/vault-sync/ingest', body);
  },
  getConflicts(workspaceId: string): Promise<VaultConflict[]> {
    return apiClient.get<VaultConflict[]>('/vault-sync/conflicts', { workspace_id: workspaceId });
  },
  resolveConflict(
    conflictId: string,
    strategy: 'keep-local' | 'accept-incoming',
    workspaceId: string,
  ): Promise<{
    success: boolean;
    conflict_id: string;
    strategy: string;
    remaining_conflicts: number;
  }> {
    return apiClient.post<{
      success: boolean;
      conflict_id: string;
      strategy: string;
      remaining_conflicts: number;
    }>(
      `/vault-sync/conflicts/${encodeURIComponent(conflictId)}/resolve?workspace_id=${encodeURIComponent(workspaceId)}`,
      { strategy },
    );
  },
  downloadClientUrl(os: 'windows' | 'linux' | 'darwin' = 'windows'): string {
    return `${API_BASE}${API_PREFIX}/vault-sync/download-client?os=${os}`;
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

/** One decoded SSE block: the lines between two blank lines. */
export interface SseBlock {
  event: string;
  /** `data:` lines joined with `\n`, exactly as the spec defines the data buffer. */
  data: string;
  /** Last `id:` field seen in the block. Carried for spec fidelity; the chat
   *  transport never resumes, so nothing consumes it yet. */
  lastEventId?: string;
}

/**
 * Parse a single SSE block per the WHATWG event-stream rules.
 *
 * The inline parser this replaced concatenated every `data:` line with no separator
 * and `.trim()`ed each one, so a payload split across two `data:` lines — which a
 * server does whenever a JSON body contains a newline — became unparseable and the
 * whole event degraded to `{ raw: … }`. It also let the LAST `event:` line win and
 * read comment lines as fields.
 *
 * Returns null when the block carries no `data:` line, which the spec defines as
 * "dispatch nothing" — a keep-alive comment or a bare `retry:` must not surface as
 * an event.
 */
export function parseSseBlock(raw: string): SseBlock | null {
  if (!raw.trim()) return null;

  let event = '';
  let sawEvent = false;
  let data = '';
  let lastEventId: string | undefined;

  // CRLF, a lone CR and LF all terminate a line; a server on Windows, or behind a
  // proxy that rewrites line endings, emits the first two.
  for (const line of raw.split(/\r\n|\r|\n/)) {
    /* A comment is a keep-alive. It carries no field, and treating it as one
       corrupts the next field's name/value split. */
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    /* Exactly one optional leading space belongs to the framing. `.trim()` here
       would eat whitespace that is part of a token payload. */
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'event':
        /* The first `event:` wins. A conforming server sends one name per block, so
           a second one means the block is malformed and the later value is the
           suspect — which is what the previous last-wins parser adopted. */
        if (!sawEvent) {
          event = value;
          sawEvent = true;
        }
        break;
      case 'data':
        /* The newline separator is the whole point: it is what lets a JSON payload
           split across several `data:` lines be reassembled byte-for-byte. */
        data += `${value}\n`;
        break;
      case 'id':
        if (!value.includes('\u0000')) lastEventId = value;
        break;
      case 'retry':
        break;
      default:
        break;
    }
  }

  if (data === '') return null;
  return { event: event || 'message', data: data.slice(0, -1), lastEventId };
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
    /* Line terminators are normalised to `\n` as bytes arrive so block splitting has
       one shape to look for. A trailing CR is held back because the LF half of a
       CRLF pair can land in the next chunk. */
    let pendingCr = false;
    const feed = (chunk: string): void => {
      let text = chunk;
      if (pendingCr) {
        pendingCr = false;
        buf += '\n';
        if (text.startsWith('\n')) text = text.slice(1);
      }
      if (text.endsWith('\r')) {
        pendingCr = true;
        text = text.slice(0, -1);
      }
      buf += text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    };
    const emit = (raw: string) => {
      const block = parseSseBlock(raw);
      if (!block) return;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(block.data) as Record<string, unknown>;
      } catch {
        data = { raw: block.data };
      }
      onEvent(block.event, data);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      feed(decoder.decode(value, { stream: true }));
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        emit(chunk);
      }
    }
    if (pendingCr) buf += '\n';
    if (buf.trim()) emit(buf);
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

/**
 * WHY EVERY RESPONSE INTERFACE BELOW IS CAMELCASE WHILE EVERY QUERY PARAM AND
 * REQUEST BODY IS SNAKECASE.
 *
 * `api.request` (`api.ts:440`) runs `transformKeys()` over every JSON response
 * body, and `transformKeys` (`api.ts:130`) rewrites every key through
 * `toCamelCase` (`api.ts:77`), recursing into nested objects and array elements.
 * Every `documentApi` method reaches the network through `ApiClient` ->
 * `api.request`, so `folder_id` on the wire is `folderId` in this layer.
 * Unconditionally, for every call.
 *
 * The opposite holds for anything travelling *out*: request bodies are
 * `JSON.stringify`-ed verbatim (`api-client.ts:61`) and the Pydantic schemas in
 * `apps/api/src/api/schemas/document.py` declare snake_case field names with no
 * serialisation aliases, so a body must stay snake_case. Query strings go
 * through `encodeParams` (`api-client.ts:34`), which never transforms, so query
 * parameter *names* stay snake_case too.
 *
 * These interfaces used to declare snake_case. TypeScript believes a declared
 * interface, so the build stayed green while every one of those reads evaluated
 * to `undefined` at runtime. The types below are now the shape the runtime
 * actually produces.
 */

/**
 * `Document.metadata`, keyed by what the backend actually writes.
 *
 * `metadata` is a JSON column (`models/schema.py:360`) passed through verbatim by
 * the API (`schemas/document.py:20`), and `metadata` is NOT a member of
 * `OPAQUE_DATA_KEYS` (`api.ts:121`) — so `transformKeys` recurses INTO it and
 * rewrites its inner keys as well. `metadata.original_name` therefore arrives as
 * `metadata.originalName`, while `metadata.size` and `metadata.sha256` arrive
 * spelled exactly as the backend wrote them because they contain no underscore.
 *
 * There is no `version_number` and no `size_bytes`. The byte count is written as
 * `size` (`document_service.py:443`), not `size_bytes`, and a document's version
 * number lives on `DocumentVersion.versionNumber`
 * (`schemas/document.py:107`) — not in metadata at all.
 *
 * Every key is optional because different code paths add different keys, so no
 * single document carries all of them. Keys the ingestion pipeline writes
 * (`ingestion/pipeline.py:104`) are parser-specific and are deliberately not
 * modelled here; read them off an index access with a cast rather than widening
 * this interface to `Record<string, unknown>`, which would let a misspelled
 * metadata key type-check again.
 */
export interface DocumentMetadata {
  /** `original_name` — the filename the client uploaded under (`:442`). */
  originalName?: string;
  /** `size` — `len(content)` in bytes (`:443`). NOT `size_bytes`. */
  size?: number;
  /** `sha256` — content checksum (`:444`). No underscore, so untransformed. */
  sha256?: string | null;
  /** `detected_mime` — MIME reported by the security scanner (`:445`). NOT `detected_mime_type`. */
  detectedMime?: string | null;
  /** Normalised tags; written by `set_tags` (`document_service.py:742`). */
  tags?: string[];
  /** `'synced'` once the document is mirrored into memory (`:1622`). */
  syncStatus?: string;
  /** Memory row created by `sync_to_memory`; `null` when none was created (`:1623`). */
  memoryId?: string | null;
  /** ISO-8601 string from `datetime.now(UTC).isoformat()` (`:1624`). */
  syncedAt?: string;
  /** Category assigned by the `categorize_document` tool (`tools/executor.py:919`). */
  category?: string;
  /** Set by `categorize_document` (`executor.py:921`) and `move_file` (`executor.py:2277`). */
  folder?: string;
  /** Path before a `move_file` tool call moved it (`executor.py:2278`). */
  previousPath?: string;
}

/**
 * Free-form metadata written by the ingestion pipeline, whose keys depend on the
 * per-parser extras (`ingestion/pipeline.py:104`) and so cannot be enumerated.
 *
 * Deliberately NOT an index signature on `DocumentMetadata`. An open bag there
 * silently re-admitted the whole class of bug this contract fix closed:
 * `metadata['size_bytes']`, `metadata['version_number']` and `metadata['title']`
 * all type-checked while resolving to `undefined`, which is how the documents UI
 * shipped "Invalid Date" dates and dead badges. Pipeline-specific keys are read
 * through this type at the call site, where the cast is visible and reviewable.
 */
export type DocumentDynamicMetadata = Record<string, unknown>;

/**
 * `Document.scan_status`.
 *
 * The backend only ever writes `CLEAN`, `REJECTED` or `MALICIOUS`
 * (`file_security_service.py:97,107,118-239`) and the column default is `CLEAN`
 * (`models/schema.py:357`). `PENDING` is a client-side in-flight state and is
 * never served. Rows predating that migration can still carry the lowercase
 * `quarantined` value the backend's own queries compare against
 * (`tools/executor.py:437,489`), which is why `scanStateOf` in
 * `@/lib/document-format` matches case-insensitively.
 */
export type DocumentScanStatus = 'CLEAN' | 'PENDING' | 'MALICIOUS' | 'REJECTED';

/**
 * One document as served by `GET /documents`, `GET /documents/{id}`,
 * `POST /documents`, `GET /documents/search`, and every mutating route that
 * echoes the row back. Wire shape: `schemas/document.py:8`.
 *
 * `folder_id` -> `folderId`, `detected_mime_type` -> `detectedMimeType`,
 * `scan_status` -> `scanStatus`, `scan_result` -> `scanResult`,
 * `raw_storage_key` -> `rawStorageKey`, `expires_at` -> `expiresAt`,
 * `deleted_at` -> `deletedAt`, `created_at` -> `createdAt`,
 * `updated_at` -> `updatedAt`.
 */
export interface DocumentResponse {
  id: string;
  workspaceId: string;
  /** `null` (or absent) means the document sits at the workspace root. */
  folderId?: string | null;
  path: string;
  /**
   * `Document.type`, taken from `EXTENSION_MAP` (`document_service.py:22-45`):
   * `pdf`, `markdown`, `text`, `docx`, `csv`, `xlsx`, `pptx`, `json`, `html`,
   * `xml`, `yaml`, `image`, or `unknown` for anything unmapped.
   */
  type: string;
  /** `'ACTIVE'` on create (`schemas/document.py:14`); `'ARCHIVED'` / `'STORAGE_DEGRADED'` also occur. */
  status?: string;
  detectedMimeType?: string | null;
  scanStatus?: DocumentScanStatus;
  /** Rejection reason when the scanner refused the file; `null` otherwise. */
  scanResult?: string | null;
  summary?: string | null;
  /** Object-storage key once the body has been offloaded (`>= 1MB` or mirroring on). */
  rawStorageKey?: string | null;
  metadata?: DocumentMetadata | null;
  expiresAt?: string | null;
  /** Non-null marks the row archived (soft delete); this is the archived-badge signal. */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /documents`. Wire shape: `schemas/document.py:29`. `page_size` -> `pageSize`. */
export interface DocumentListResponse {
  documents: DocumentResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `GET /documents/search`. New envelope.
 *
 * BREAKING SHAPE CHANGE (see `documentApi.search`): this used to be
 * `DocumentResponse[]` with no total, and it is now an object. A caller written
 * against the old signature still COMPILES if it only iterates — `documents` is
 * not iterable, so the failure is a runtime `TypeError` rather than a type error.
 * That is why `useDocumentList` re-reads `total` from here instead of deriving
 * it from the row count.
 *
 * Wire shape: `schemas/document.py:36` (`DocumentSearchResponse`), served by
 * `routers/documents.py:280`. `total` is a `COUNT(*)` over the same filters
 * rather than `len(documents)`, and `limit`/`offset` are echoed back, so
 * `Math.ceil(total / limit)` is a real page count and the window size is the
 * server's, not an assumption.
 */
export interface DocumentSearchResponse {
  documents: DocumentResponse[];
  /** Every match for `q` under the same filters, not just this window. */
  total: number;
  /** Echo of the `limit` the server applied; use it, do not assume PAGE_SIZE. */
  limit: number;
  /** Echo of the `offset` the server applied; equals `(page - 1) * limit`. */
  offset: number;
}

/**
 * `GET /documents/stats?workspace_id=`. New workspace-wide aggregate.
 *
 * Wire shape: `schemas/document.py:50` (`DocumentStatsResponse`), served by
 * `routers/documents.py:310` over SQL in
 * `services/document_stats_service.py:20`.
 *
 * WHY THIS EXISTS RATHER THAN BEING DERIVED IN THE UI
 *
 * The documents list is ONE PAGE of at most `page_size` rows. Summing
 * `metadata.size` over that page and captioning the result "Storage Used" claims
 * a workspace total it cannot have, and the total was previously taken from the
 * server while the storage/clean/quarantined counts came from the page — four
 * cards with two different denominators side by side. Every field here is
 * computed server-side over the whole workspace, so they share a denominator.
 *
 * `total_bytes` sums the recorded `metadata.size` (`json_int_key(metadata, 'size')`
 * — `document_stats_service.py:33`), which is absent on rows whose upload path
 * never wrote it, so it is a lower bound. `totalDocuments` counts only rows with
 * a null `deleted_at`; `archivedDocuments` holds the rest.
 *
 * Every member is declared optional even though the schema requires all eight.
 * That is deliberate: a partial or older payload must degrade to "that card is
 * omitted", never to a fabricated `0`. `DocumentStatsBar` renders a metric card
 * only for a field it actually received, so `undefined` is the correct way for a
 * gap to arrive.
 *
 * KNOWN BACKEND MISMATCHES — see the report; the client is coded to the contract
 * above and degrades honestly, but two of these will produce wrong numbers:
 *
 *  - `quarantinedCount` and `scanningCount` are `lower(scan_status) =
 *    'quarantined'` / `'scanning'` (`document_stats_service.py:35-36`), but the
 *    scanner only ever writes `CLEAN`, `REJECTED` and `MALICIOUS`
 *    (`file_security_service.py:97,107`) with `CLEAN` as the column default
 *    (`models/schema.py:357`). Neither word is ever written, so both counts are
 *    structurally 0 for any row the scanner has seen. `cleanCount` is correct.
 *  - `category` filtering compares against `metadata->>'category'`
 *    (`document_service.py:69-83`), a free-form string. See
 *    `DocumentListParams.category`.
 */
export interface DocumentStatsResponse {
  /** Non-archived documents in the workspace (`deleted_at IS NULL`). */
  totalDocuments?: number;
  /** Rows carrying a non-null `deleted_at`. */
  archivedDocuments?: number;
  /** Sum of `metadata.size` across the workspace, in bytes. A lower bound. */
  totalBytes?: number;
  /** Rows whose `scan_status` is `CLEAN`. This one is computed correctly. */
  cleanCount?: number;
  /** Rows the scanner refused or flagged. See the mismatch note above. */
  quarantinedCount?: number;
  /** Rows whose scan has not reached a verdict. See the mismatch note above. */
  scanningCount?: number;
  /** Folders in the workspace tree. */
  folderCount?: number;
  /**
   * Shares this workspace GRANTED that have not lapsed. Shares pointing INTO the
   * workspace are deliberately excluded.
   *
   * This is the one number `DocumentResponse` cannot express at all — nothing on
   * a row or in `metadata` describes a share — which is why the "Active Shares"
   * card had to be omitted rather than estimated before this endpoint existed.
   */
  activeShareCount?: number;
}

/**
 * `POST /documents/{document_id}/process?workspace_id=`. New ingest trigger.
 *
 * Wire shape: `schemas/document.py:67` (`DocumentProcessResponse`), served by
 * `routers/documents.py:1094`. `document_id` -> `documentId`,
 * `chunks_indexed` -> `chunksIndexed`.
 *
 * `status` is `'processed'` when the body was chunked and indexed, and
 * `'skipped'` when the format has no registered parser — an unsupported file is
 * a normal outcome, not an error. A `500` is reserved for a parser that exists
 * and still failed. `detail` carries the reason on a skip.
 *
 * The route requires a WRITE-capable caller (`required_roles=_ROLES_WRITE` plus
 * `required_permission="write"`) and is rate-limited to 10 calls / 5 minutes, so
 * an API-key-only service identity needs a member-with-write role in the
 * workspace or it gets a 403.
 *
 * This is the endpoint the `vaeloom.ingest-document` Trigger task calls; see
 * `apps/web/src/trigger/document-ingest.ts`, which was silently 404ing against a
 * route that never existed.
 */
export interface DocumentProcessResponse {
  documentId: string;
  status: 'processed' | 'skipped';
  chunksIndexed: number;
  /** Free text, or `null`. The only field that says WHY something was skipped. */
  detail?: string | null;
}

/**
 * One audit-trail entry from `GET /documents/{id}/actions`.
 * Wire shape: `schemas/document.py:49`.
 *
 * `action_type` is typed `string` rather than a union because the backend's own
 * action constants number six (`document_service.py:47-52`: rename, archive,
 * restore, version_create, version_restore, share) and the column is a plain
 * `String`, so a narrowing union would reject legitimate historical values at
 * the call site without making the runtime any safer. Compare against the
 * constants, not against a type.
 *
 * `actor_id` -> `actorId` and `tenant_id` -> `tenantId` are declared here; they
 * were previously missing from this interface despite being served.
 */
export interface DocumentAction {
  id: string;
  documentId: string;
  workspaceId: string;
  actorId?: string | null;
  tenantId?: string | null;
  /** `document_rename` | `document_archive` | `document_restore` | `document_version_create` | `document_version_restore` | `document_share` */
  actionType: string;
  oldPath?: string | null;
  newPath?: string | null;
  oldDeletedAt?: string | null;
  newDeletedAt?: string | null;
  /** Non-null once the action has been undone. */
  undoneAt?: string | null;
  createdAt: string;
}

/** `GET /documents/{id}/actions`. Wire shape: `schemas/document.py:66`. */
export interface DocumentActionListResponse {
  actions: DocumentAction[];
  total: number;
}

/**
 * `GET/POST/PATCH/DELETE /documents/folders`. Wire shape:
 * `schemas/document.py:82`.
 *
 * `workspace_id` -> `workspaceId`, `parent_id` -> `parentId`, `created_by` ->
 * `createdBy`, `created_at` -> `createdAt`, `updated_at` -> `updatedAt`.
 * `updatedAt` was missing from this interface before and is served on every row.
 */
export interface FolderResponse {
  id: string;
  workspaceId: string;
  /** `null` means the folder is at the workspace root. */
  parentId?: string | null;
  name: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `GET /documents/folders/tree`. Wire shape: `schemas/document.py:94`.
 *
 * The tree endpoint declares every id as `str` rather than `uuid.UUID`, so no
 * UUID validation happens server-side; `id`, `workspaceId`, `parentId` and
 * `createdAt` all arrive as plain strings. `children` is always present but may
 * be empty, and a leaf node's `children` is `[]`, not absent.
 */
export interface FolderTreeItem {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  name: string;
  createdAt?: string | null;
  children: FolderTreeItem[];
}

/**
 * One row of `GET/POST /documents/{id}/versions`. Wire shape:
 * `schemas/document.py:104`.
 *
 * `document_id` -> `documentId`, `version_number` -> `versionNumber`,
 * `storage_key` -> `storageKey`, `size_bytes` -> `sizeBytes`, `created_at` ->
 * `createdAt`. The snake_case duplicates this interface used to declare
 * alongside each field could never be populated — `transformKeys` renames the
 * key, it does not keep both — so they are removed rather than left as a lie.
 */
export interface DocumentVersionResponse {
  id: string;
  documentId: string;
  versionNumber: number;
  storageKey: string;
  checksum?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

/**
 * `GET/POST/DELETE /documents/{id}/shares`. Wire shape:
 * `schemas/document.py:123`.
 *
 * `document_id` -> `documentId`, `source_workspace_id` -> `sourceWorkspaceId`,
 * `target_workspace_id` -> `targetWorkspaceId`, `granted_by` -> `grantedBy`,
 * `expires_at` -> `expiresAt`, `created_at` -> `createdAt`. The snake_case
 * duplicates are removed for the same reason as on `DocumentVersionResponse`.
 */
/**
 * Access level granted to the target workspace.
 *
 * The request side is a `Literal["read", "write"]` on the backend
 * (`schemas/document.py:119`), so any other value is a 422. Rows written before
 * that contract may still hold an uppercase or legacy value; the response side is
 * therefore widened by `legacySharePermission` rather than trusting the column.
 */
export type DocumentSharePermission = 'read' | 'write';

/**
 * Narrows a persisted `permission` to the current vocabulary.
 *
 * `read_write` was persisted by earlier callers and never actually granted write:
 * the backend's escalation check only ever matched `write`/`admin`, so those
 * shares silently behaved as read-only. The backend now also treats `read_write`
 * as write for backwards compatibility (`SHARE_WRITE_PERMISSIONS` in
 * `document_service.py`), so folding it to `write` here matches enforcement.
 */
export function legacySharePermission(value: string | null | undefined): DocumentSharePermission {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'write' || normalized === 'admin' || normalized === 'read_write') {
    return 'write';
  }
  return 'read';
}

export interface DocumentShareResponse {
  id: string;
  documentId: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  permission: string;
  grantedBy?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

/** One accepted file inside a `BulkUploadResponse`. `document_service.py:1223-1228`. */
export interface BulkUploadItem {
  id: string;
  /** The multipart filename as sent, which is NOT necessarily `path`. */
  filename: string;
  path: string;
  /** `scan_status` on the wire, so `scanStatus` here. */
  scanStatus: string;
}

/** One rejected file inside a `BulkUploadResponse`. `document_service.py:1231-1234`. */
export interface BulkUploadError {
  filename: string;
  /** `str()` of the raised exception, or its `detail` when it was an `HTTPException`. */
  error: string;
}

/**
 * `POST /documents/bulk/upload`. Wire shape: `schemas/document.py:137`.
 *
 * `total_attempted` -> `totalAttempted`; the other five keys have no underscore
 * and are unchanged. `processed` counts successes (it is `len(succeeded)`, not
 * successes plus failures — `document_service.py:1238`), so
 * `processed + failed === totalAttempted` is the invariant to check.
 * `items` is the same list as `succeeded` (`document_service.py:1241`), kept for
 * the older alias route `POST /documents/bulk`.
 */
export interface BulkUploadResponse {
  totalAttempted: number;
  processed: number;
  failed: number;
  succeeded: BulkUploadItem[];
  items: BulkUploadItem[];
  errors: BulkUploadError[];
}

/**
 * One of the 50 checks inside a `DocumentAuditResponse`.
 * Wire shape: `schemas/document.py:151`. Already snake_case-free.
 */
export interface DocumentAuditCheckItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  score: number;
  detail: string;
  recommendation?: string | null;
}

/** Per-category roll-up inside `DocumentAuditResponse`. `schemas/document.py:161`. */
export interface DocumentAuditCategoryScore {
  total: number;
  passed: number;
  score: number;
}

/**
 * `POST /documents/{id}/audit`. Wire shape: `schemas/document.py:167`.
 *
 * `document_id` -> `documentId`, `total_checks` -> `totalChecks`, `passed_checks`
 * -> `passedChecks`, `failed_checks` -> `failedChecks`, `quality_score` ->
 * `qualityScore`. The snake_case duplicates are removed: `transformKeys` renames
 * a key, it does not keep both, so they were unreachable.
 *
 * `categories` is a JSON object keyed by category name, not an array, so
 * `Object.values(categories)` is the way to iterate it. Its keys are category
 * names chosen by the audit implementation, not by `transformKeys`, and they
 * carry no underscores, so they survive unrenamed.
 *
 * `verdict` is typed `string`: the four named verdicts are what the service
 * emits today, but the wire field is a plain `str` and a narrowing union would
 * only push the failure to the call site.
 */
export interface DocumentAuditResponse {
  documentId: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  /** 0-100 (`schemas/document.py:172`). */
  qualityScore: number;
  /** `EXCELLENT` | `GOOD` | `NEEDS_IMPROVEMENT` | `CRITICAL_ISSUES` in practice. */
  verdict: string;
  categories: Record<string, DocumentAuditCategoryScore>;
  checks: DocumentAuditCheckItem[];
  recommendations: string[];
}

/**
 * `POST /documents/{id}/compare`. Wire shape: `schemas/document.py:184`.
 *
 * Every snake_case field is renamed on the way in: `version_a` -> `versionA`,
 * `version_b` -> `versionB`, `similarity_ratio` -> `similarityRatio`,
 * `word_count_a` -> `wordCountA`, `word_count_b` -> `wordCountB`,
 * `word_count_delta` -> `wordCountDelta`, `additions_count` -> `additionsCount`,
 * `deletions_count` -> `deletionsCount`, `diff_snippet` -> `diffSnippet`. The
 * snake_case duplicates are removed.
 *
 * `additions` and `deletions` are whole changed lines including their trailing
 * newline, and `similarityRatio` is 0-1 (multiply by 100 before rendering a
 * percentage). `diffSnippet` is a single string, not a list of hunks.
 */
export interface DocumentCompareResponse {
  documentId: string;
  versionA: number;
  versionB: number;
  /** 0-1 ratio. */
  similarityRatio: number;
  wordCountA: number;
  wordCountB: number;
  wordCountDelta: number;
  additionsCount: number;
  deletionsCount: number;
  additions: string[];
  deletions: string[];
  diffSnippet: string;
  summary: string;
}

/**
 * `POST /documents/{id}/sync-memory`. Wire shape: `schemas/document.py:200`,
 * and the dict the service returns at `document_service.py:1629-1636`.
 *
 * `document_id` -> `documentId`, `workspace_id` -> `workspaceId`, `memory_id` ->
 * `memoryId`. The separate `sync_status` / `memory_id` / `synced_at` the service
 * also writes land on `Document.metadata` (see `DocumentMetadata`), not here.
 */
export interface DocumentSyncMemoryResponse {
  success: boolean;
  documentId: string;
  workspaceId: string;
  memoryId?: string | null;
  title?: string | null;
  summary?: string | null;
  status: string;
}

/**
 * `POST /documents/bulk/sync-memory`. Wire shape: `schemas/document.py:214`.
 * `synced_count` -> `syncedCount`, `failed_count` -> `failedCount`.
 */
export interface BulkSyncMemoryResponse {
  syncedCount: number;
  failedCount: number;
  items: DocumentSyncMemoryResponse[];
}

/** One document relocated by `autoOrganize`. `document_service.py:1486-1491`. */
export interface AutoOrganizeMovedDocument {
  id: string;
  /** The document's path at the time of the move, not its filename. */
  name: string;
  /** Destination folder NAME, not its id — the id is on `folderId`. */
  folder: string;
  /** `folder_id` on the wire, so `folderId` here. */
  folderId: string;
}

/** `POST /documents/auto-organize`. `document_service.py:1495-1500`. */
export interface AutoOrganizeResponse {
  message: string;
  /** `organized_count` on the wire. */
  organizedCount: number;
  /** `folders_created` on the wire: names of the folders created this run. */
  foldersCreated: string[];
  /** `moved_documents` on the wire. */
  movedDocuments: AutoOrganizeMovedDocument[];
}

/** `POST /documents/bulk/delete`. `document_service.py:1367-1376`. */
export interface BulkDeleteResponse {
  /** `deleted_count` on the wire. */
  deletedCount: number;
  /** `document_ids` on the wire. */
  documentIds: string[];
}

/**
 * `POST /documents/bulk/download` takes ids in the body, so those stay
 * snake_case; only the response shape above is camelCase.
 */
export interface BulkDownloadRequest {
  document_ids: string[];
}

/**
 * Body of `PATCH /documents/folders/{folder_id}`. `schemas/document.py:77`
 * (`FolderUpdate`) declares `name` and `parent_id` with no aliases, and bodies
 * are sent verbatim, so this stays snake_case.
 */
export interface FolderUpdateRequest {
  /** 1-255 chars once trimmed; an empty or whitespace-only name is a 400. */
  name?: string | null;
  /** Target parent folder id. `null`/absent leaves the parent UNCHANGED. */
  parent_id?: string | null;
}

/**
 * Query parameters for `GET /documents`. Query strings are never transformed,
 * so these names stay snake_case. Server side: `routers/documents.py:237-250`.
 */
export interface DocumentListParams {
  workspace_id?: string;
  /** Server-side folder filter. `null`/absent means every folder plus root. */
  folder_id?: string | null;
  /** `'ACTIVE'`, `'ARCHIVED'`, `'STORAGE_DEGRADED'` — whatever `Document.status` holds. */
  status?: string | null;
  /**
   * Server-side category filter. Absent/`null` means "no category filter".
   *
   * Accepts a {@link DocumentCategoryId} verbatim except `'all'`, which is sent
   * as absent because it means "do not filter" rather than "the bucket named
   * all".
   *
   * ⚠ VOCABULARY MISMATCH, CONFIRMED AGAINST THE LANDED ROUTER. The parameter
   * exists (`routers/documents.py:247-250`) but the predicate behind it is
   * `lower(metadata->>'category') == category` (`document_service.py:69-83`) —
   * an equality test against the free-form string the `categorize_document` tool
   * wrote (`tools/executor.py:919`). The six ids the tab strip sends are
   * `vault_notes`, `documents`, `spreadsheets`, `images`, `code`; none of those
   * is a value the stored data ever holds (`vault_note`, singular, is the only
   * one that comes close), and the four MIME-derived buckets cannot exist there
   * at all. As landed, every non-`all` tab returns an empty set.
   *
   * The client sends the taxonomy id because that is the documented contract, and
   * an empty result renders as "No documents found" — a visible failure rather
   * than the silent one a client-side filter produced. The server fix is to
   * bucket by `detected_mime_type` / extension for the four MIME buckets and by
   * `metadata.category = 'vault_note'` (or the folder name) for `vault_notes`,
   * and to reject an unrecognised vocabulary with a 422 rather than matching
   * nothing. See `parts/documentCategories.ts`.
   */
  category?: string | null;
  page?: number;
  /** 1-100. */
  page_size?: number;
  include_archived?: boolean;
}

/**
 * Pagination for `GET /documents/search`.
 *
 * `limit`/`offset` were already accepted; what changed is that the RESPONSE now
 * carries `total` (see `DocumentSearchResponse`), so this is finally a real page
 * window rather than a best-effort truncation.
 */
export interface DocumentSearchParams {
  /** 1-100, server default 50. */
  limit?: number;
  /** >= 0, server default 0. */
  offset?: number;
  /**
   * Sent as `category`, same vocabulary as {@link DocumentListParams.category}.
   *
   * NOT in the published search contract: `/documents/search` was only given a
   * paginated envelope. FastAPI ignores undeclared query parameters, so sending
   * it is harmless today and becomes honoured the moment the parameter is
   * declared — whereas omitting it would leave a category tab silently ignored
   * for the whole time a search box is focused.
   */
  category?: string | null;
}

function contentUrl(documentId: string, workspaceId: string): string {
  return `${API_BASE}${API_PREFIX}/documents/${encodeURIComponent(documentId)}/content?workspace_id=${encodeURIComponent(workspaceId)}`;
}

export const documentApi = {
  upload(file: File, workspaceId: string, folderId?: string | null): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    return getCsrfToken().then(async (csrf) => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      if (csrf) headers[CSRF_HEADER] = csrf;
      const folderParam = folderId ? `&folder_id=${encodeURIComponent(folderId)}` : '';
      const url = `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}${folderParam}`;
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
      if (!res.ok) {
        let msg = 'Upload failed';
        try {
          const errJson = await res.json();
          if (errJson?.detail) {
            msg =
              typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch {
          if (res.status === 413) msg = 'File too large — max 100MB';
        }
        throw new ApiClientError(res.status, msg);
      }
      return (res.json() as Promise<Record<string, unknown>>).then(
        (j) => transformKeys(j) as DocumentResponse,
      );
    });
  },
  uploadWithProgress(
    file: File,
    workspaceId: string,
    onProgress: (percent: number) => void,
    folderId?: string | null,
  ): Promise<DocumentResponse> {
    const extractErrorMsg = (xhr: XMLHttpRequest): string => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (data?.detail) {
          return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
      } catch {
        // Fallback
      }
      if (xhr.status === 413) return 'File too large — max 100MB';
      if (xhr.status === 400) return 'Invalid upload request or file rejected by security scan';
      return `Upload failed (HTTP ${xhr.status || 'Error'})`;
    };

    return new Promise((resolve, reject) => {
      getCsrfToken().then((csrf) => {
        const xhr = new XMLHttpRequest();
        const folderParam = folderId ? `&folder_id=${encodeURIComponent(folderId)}` : '';
        xhr.open(
          'POST',
          `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}${folderParam}`,
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
              reject(new ApiClientError(xhr.status, 'Upload failed to parse response'));
            }
          } else if (xhr.status === 403 && csrf) {
            resetCsrfToken();
            getCsrfToken().then((fresh) => {
              if (fresh) {
                const retry = new XMLHttpRequest();
                retry.open(
                  'POST',
                  `${API_BASE}${API_PREFIX}/documents?workspace_id=${encodeURIComponent(workspaceId)}${folderParam}`,
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
                      reject(new ApiClientError(retry.status, 'Upload failed to parse response'));
                    }
                  } else {
                    reject(new ApiClientError(retry.status, extractErrorMsg(retry)));
                  }
                };
                retry.onerror = () => reject(new ApiClientError(0, 'Network error during upload'));
                retry.send(form);
              } else {
                reject(new ApiClientError(xhr.status, extractErrorMsg(xhr)));
              }
            });
          } else {
            reject(new ApiClientError(xhr.status, extractErrorMsg(xhr)));
          }
        };
        xhr.onerror = () => reject(new ApiClientError(0, 'Network error during upload'));
        const form = new FormData();
        form.append('file', file);
        xhr.send(form);
      });
    });
  },
  autoOrganize(workspaceId: string): Promise<AutoOrganizeResponse> {
    return apiClient.postQuery<AutoOrganizeResponse>('/documents/auto-organize', {
      workspace_id: workspaceId,
    });
  },
  /**
   * `GET /documents`.
   *
   * `folder_id`, `status` and `category` are all forwarded to the server, which is
   * the point: filtering client-side after a single page has been fetched can only
   * ever match documents that happen to be in that page, so a non-empty folder
   * rendered as empty. Pass `folder_id` and let `routers/documents.py:256-276`
   * scope the query; `total` then reflects the filter too. Same argument for
   * `category` — subject to the vocabulary caveat on
   * {@link DocumentListParams.category}.
   *
   * A `null`/`undefined` `folder_id` or `category` is omitted from the query
   * string by `encodeParams`, which is the same as the server's `None` default.
   */
  list(params?: DocumentListParams): Promise<DocumentListResponse> {
    return apiClient.get<DocumentListResponse>(
      '/documents',
      params as Record<string, string | number | boolean | undefined | null>,
    );
  },
  /**
   * `GET /documents/stats?workspace_id=`. Workspace-wide aggregates.
   *
   * Route: `routers/documents.py:310`. Read-only, so plain workspace membership
   * is the bar — no mutation role.
   *
   * Loaded on its own schedule, independent of the paged list: the numbers
   * describe the whole workspace, so they must not be derived from (or blocked
   * by) whichever page happens to be loaded. A failure here is reported by the
   * stats bar alone and leaves the document table untouched.
   *
   * @see DocumentStatsResponse for why each field is server-computed, and for two
   * confirmed mismatches in the scan-state counts.
   */
  stats(workspaceId: string): Promise<DocumentStatsResponse> {
    return apiClient.get<DocumentStatsResponse>('/documents/stats', { workspace_id: workspaceId });
  },
  getById(documentId: string, workspaceId: string): Promise<DocumentResponse> {
    return apiClient.get<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`, {
      workspace_id: workspaceId,
    });
  },
  rename(id: string, workspaceId: string, path: string): Promise<DocumentResponse> {
    return apiClient.patch<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(workspaceId)}`,
      { path },
    );
  },
  move(id: string, workspaceId: string, folderId: string | null): Promise<DocumentResponse> {
    return apiClient.postQuery<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}/move`,
      { workspace_id: workspaceId },
      { folder_id: folderId },
    );
  },
  updateTags(id: string, workspaceId: string, tags: string[]): Promise<DocumentResponse> {
    return apiClient.patch<DocumentResponse>(
      `/documents/${encodeURIComponent(id)}/tags?workspace_id=${encodeURIComponent(workspaceId)}`,
      { tags },
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
  delete(id: string, workspaceId: string): Promise<void> {
    return apiClient.delete<void>(
      `/documents/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
  },
  bulkDelete(workspaceId: string, documentIds: string[]): Promise<BulkDeleteResponse> {
    return apiClient.postQuery<BulkDeleteResponse>(
      '/documents/bulk/delete',
      { workspace_id: workspaceId },
      { document_ids: documentIds },
    );
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
  async getContent(id: string, workspaceId: string, inline: boolean = false): Promise<Blob> {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const base = contentUrl(id, workspaceId);
    const url = inline ? `${base}&inline=true` : base;
    const res = await fetch(url, {
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
  /**
   * `GET /documents/search`. Route: `routers/documents.py:280`.
   *
   * BREAKING RETURN-TYPE CHANGE: this returned `Promise<DocumentResponse[]>`. It
   * now returns {@link DocumentSearchResponse}. Callers must read `.documents`
   * and may read `.total` for a real page count. Every caller in this repo
   * (`hooks/useDocumentList.ts`) has been updated; there is no compatibility
   * shim, because a shim would have to invent a `total` and the whole point of
   * the change is to stop inventing one.
   *
   * `limit`/`offset` are forwarded to the server, and the response echoes both
   * plus a `total` for the whole match set — so paging during a search is a real
   * page window rather than a guess.
   */
  search(
    workspaceId: string,
    query: string,
    folderId?: string | null,
    pagination?: DocumentSearchParams,
  ): Promise<DocumentSearchResponse> {
    const params: Record<string, string | number | null> = {
      workspace_id: workspaceId,
      q: query,
    };
    if (folderId) params['folder_id'] = folderId;
    if (pagination?.limit != null) params['limit'] = pagination.limit;
    if (pagination?.offset != null) params['offset'] = pagination.offset;
    // `'all'` is the client taxonomy's "do not filter" sentinel and is not a
    // bucket name, so it is never sent. See `DocumentListParams.category`.
    if (pagination?.category && pagination.category !== 'all') {
      params['category'] = pagination.category;
    }
    return apiClient.get<DocumentSearchResponse>('/documents/search', params);
  },
  /**
   * `POST /documents/{document_id}/process?workspace_id=`.
   * Route: `routers/documents.py:1094`.
   *
   * Runs the ingestion/chunking pipeline for one document. `workspace_id` is a
   * QUERY parameter and the route declares no request body, so `postQuery` is
   * called with `undefined` — a JSON body would be silently discarded.
   *
   * `'skipped'` resolves rather than rejects: an unregistered file format is a
   * normal outcome and the endpoint returns 200 for it. A 500 means a registered
   * parser failed.
   *
   * Rate limited to 10 calls / 5 minutes and gated on a WRITE-capable caller, so
   * this is not a loop-per-row API. The document list does not call it.
   */
  process(documentId: string, workspaceId: string): Promise<DocumentProcessResponse> {
    return apiClient.postQuery<DocumentProcessResponse>(
      `/documents/${encodeURIComponent(documentId)}/process`,
      { workspace_id: workspaceId },
    );
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
  /**
   * `PATCH /documents/folders/{folder_id}`.
   *
   * Body is `FolderUpdate` (`schemas/document.py:77`): only `name` and
   * `parent_id` exist, both optional, no aliases — so `undefined` keys are
   * dropped by `JSON.stringify` and the backend treats an absent field as
   * "leave unchanged" (`folder_service.py:158,166`).
   *
   * THE `parentId: null` TRAP: sending `parent_id: null` does NOT move the
   * folder to the workspace root. `if parent_id is not None` skips a JSON
   * `null` outright (`folder_service.py:166`). Root is reached only by sending
   * the literal sentinel STRING `"null"` (or `"none"` or `""`) — see
   * `folder_service.py:167`. So `parentId: undefined` means "don't touch the
   * parent" and `parentId: 'null'` means "move to root"; `null` is accepted in
   * the signature only so the distinction is explicit at the call site.
   *
   * The backend rejects a name that is empty after trimming or that contains
   * `/` or `\` with a 400, and a parent that is the folder itself or one of its
   * own descendants with a 400 (`folder_service.py:160-178`).
   *
   * This method has no call sites yet; `FolderResponse` is the return type, so
   * the response is camelCase as declared.
   */
  updateFolder(
    folderId: string,
    workspaceId: string,
    name?: string,
    parentId?: string | null,
  ): Promise<FolderResponse> {
    const body: FolderUpdateRequest = {};
    if (name !== undefined) body.name = name;
    if (parentId !== undefined) body.parent_id = parentId;
    return apiClient.patch<FolderResponse>(
      `/documents/folders/${encodeURIComponent(folderId)}?workspace_id=${encodeURIComponent(workspaceId)}`,
      body,
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
    permission: DocumentSharePermission = 'read',
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
  /**
   * `POST /documents/bulk/upload`.
   *
   * Multipart field name is `files`, repeated once per file, which matches the
   * backend's `files: list[UploadFile] = File(...)`
   * (`routers/documents.py:292`). `workspace_id` and `folder_id` are QUERY
   * parameters on that route, not form fields, so they go in the URL.
   *
   * The response is `BulkUploadResponse` and is camelCase-transformed like every
   * other response. Read `succeeded`/`items` for accepted files and `errors` for
   * rejected ones: this endpoint returns 200 even when individual files fail
   * (`document_service.py:1229-1242`), so a resolved promise does NOT mean the
   * upload succeeded. Check `failed === 0`, or `failed + processed ===
   * totalAttempted`. Per-file errors arrive only in `errors`, never as a thrown
   * exception.
   *
   * `fetch` is used directly rather than `apiClient` because the body is
   * multipart and must not carry a JSON `Content-Type`; the transform is applied
   * by hand here, mirroring what `api.request` does.
   */
  async bulkUpload(
    workspaceId: string,
    files: File[],
    folderId?: string | null,
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
    try {
      return transformKeys(await res.json()) as BulkUploadResponse;
    } catch {
      // A 200 with a body that is not JSON is a contract violation, and letting
      // the raw SyntaxError escape would read as a network bug at the call site.
      throw new ApiClientError(res.status, 'Bulk upload returned a malformed response');
    }
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
  audit(documentId: string, workspaceId: string): Promise<DocumentAuditResponse> {
    return apiClient.postQuery<DocumentAuditResponse>(
      `/documents/${encodeURIComponent(documentId)}/audit`,
      { workspace_id: workspaceId },
    );
  },
  compare(
    documentId: string,
    versionA: number,
    versionB: number,
    workspaceId: string,
  ): Promise<DocumentCompareResponse> {
    return apiClient.post<DocumentCompareResponse>(
      `/documents/${encodeURIComponent(documentId)}/compare?workspace_id=${encodeURIComponent(workspaceId)}`,
      { version_a: versionA, version_b: versionB },
    );
  },
  syncMemory(documentId: string, workspaceId: string): Promise<DocumentSyncMemoryResponse> {
    return apiClient.postQuery<DocumentSyncMemoryResponse>(
      `/documents/${encodeURIComponent(documentId)}/sync-memory`,
      { workspace_id: workspaceId },
    );
  },
  bulkSyncMemory(workspaceId: string, documentIds: string[]): Promise<BulkSyncMemoryResponse> {
    return apiClient.postQuery<BulkSyncMemoryResponse>(
      '/documents/bulk/sync-memory',
      { workspace_id: workspaceId },
      { document_ids: documentIds },
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

// ─── Resume ──────────────────────────────────────────────────────────────────

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
  // ── Overleaf-style source (Typst/LaTeX) — hybrid WASM + Tectonic ──
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

// ─── Application ─────────────────────────────────────────────────────────────

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

// ─── Approval ───────────────────────────────────────────────────────────────

export interface ApprovalItem {
  id: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  agent_name?: string;
  agentName?: string;
  action_type?: string;
  actionType?: string;
  payload: Record<string, unknown>;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requested_by?: string | null;
  requestedBy?: string | null;
  decided_by?: string | null;
  decidedBy?: string | null;
  decision_note?: string | null;
  decisionNote?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  decided_at?: string | null;
  decidedAt?: string | null;
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
  jobId: string;
  job_id?: string;
  status: string;
  startedAt?: string;
  started_at?: string;
  finishedAt?: string;
  finished_at?: string;
  statusCode?: number;
  status_code?: number;
  error?: string;
  createdAt: string;
  created_at?: string;
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
  filters?: Record<string, unknown>;
}

export interface SearchResultItem {
  id: string;
  text: string;
  score: number;
  source: string;
  metadata: Record<string, unknown>;
}

export type SearchResult = SearchResultItem;

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

// ─── BYOK Provider Keys (Bring Your Own Key) ─────────────────────────────

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

// ─── Agents Catalog ───────────────────────────────────────────────────────

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

/**
 * `POST /capabilities/{id}/test`
 *
 * Distinct from `CapabilityTestResponse` on purpose. This one DOES dispatch the
 * capability (`executed: true`) and reports wall-clock `latency_ms`, which is not
 * the same quantity as `execution_duration_ms` above and is measured with a
 * different clock. They are separate types so a page cannot read one field name
 * off a response that carries the other.
 *
 * `status` is the union of every branch of the handler, not one branch's
 * vocabulary. The `tool` branch emits `success`, `error` and `not_registered`
 * (the last when the process-local dynamic registration is gone after a restart);
 * the `mcp` branch forwards `probe_mcp_endpoint`'s `connected` / `skipped` /
 * `timeout` / `error`. `warning` was never emitted here -- it belongs to
 * `POST /agents/capabilities/test` below -- so it is gone rather than left as a
 * value no caller can ever observe.
 */
export type TestCapabilityStatus =
  'success' | 'not_registered' | 'connected' | 'skipped' | 'timeout' | 'error';

export interface TestCapabilityByIdResponse {
  status: TestCapabilityStatus;
  latencyMs: number;
  output: unknown;
  error: string | null;
  executed: boolean;
}

export interface CapabilityTestRequest {
  workspaceId: string;
  capabilityName: string;
  category: string;
  inputPayload?: Record<string, unknown>;
}

/**
 * `POST /agents/capabilities/test`
 *
 * This endpoint does NOT execute the capability. It validates the input against
 * the registered schema and returns `executed: false`; the handler's own
 * docstring says "The tool was NOT executed". A `status: 'success'` here means
 * "the parameters validated", not "the capability works".
 *
 * There is no `simulated_output` field any more. The hardcoded fake payload it
 * used to return was removed in favour of the `executed` flag, so a caller can no
 * longer mistake a canned response for a real one.
 */
export interface CapabilityTestResponse {
  status: 'success' | 'warning' | 'error';
  capability: string;
  category: string;
  timestamp: string;
  executionDurationMs: number;
  validationErrors: string[];
  result: unknown;
  executed: boolean;
}

// ─── Memory Feed / Lineage ────────────────────────────────────────────────

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
  webhookId: string;
  webhook_id?: string;
  eventType: string;
  event_type?: string;
  status: string;
  statusCode: number | null;
  status_code?: number | null;
  responseBody: string | null;
  response_body?: string | null;
  attempt: number;
  maxAttempts: number;
  max_attempts?: number;
  completedAt: string | null;
  completed_at?: string | null;
  createdAt: string;
  created_at?: string;
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

// ── Profile ──────────────────────────────────────────────────────────
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

// ── Opportunities (PIOS Opportunity Engine) ─────────────────────────
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

// ── Agent Council (PIOS Adjudication Quality Gate) ───────────────────
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

// ─── Organizations ──────────────────────────────────────────────────────────

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
 * arrays, so callers received an object where they expected an array —
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

// ─── Marketplace ────────────────────────────────────────────────────────────

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

// ─── Capabilities API ───────────────────────────────────────────────────────

/**
 * The free-form `config` bag on a capability row.
 *
 * The backend stores `parameters` / `returns` as JSON Schema (see
 * `routers/capabilities.py`, which reads them straight back when building a
 * synthetic ToolDefinition), so those two stay `Record<string, unknown>` on
 * purpose: their keys are schema property names, not field names, and
 * `transformKeys` preserves them verbatim via `OPAQUE_DATA_KEYS`.
 *
 * The rest of the bag is still camelCased, so `markdown_doc` arrives as
 * `markdownDoc` and `required_scope` as `requiredScope` -- which is why the typed
 * readers below are declared in camelCase. The index signature is an escape
 * hatch for genuinely open data, not an invitation to index blindly. Use the
 * getters below instead.
 */
export interface CapabilityConfig {
  doc?: string;
  tags?: string[];
  parameters?: Record<string, unknown>;
  returns?: Record<string, unknown>;
  autonomy?: CapabilityAutonomy;
  requiredScope?: string;
  url?: string;
  importedAt?: string;
  [k: string]: unknown;
}

export type CapabilityAutonomy = 'suggest' | 'autonomous' | 'approval_required';

/**
 * Trust classes the server actually emits.
 *
 * The bundled catalog uses only `core_trusted` and `community`; bridged MCP
 * servers use the `mcp.*` pair from `mcp_client_service.py`. The `string & {}`
 * arm keeps an unrecognised server value readable without pretending it is one
 * of the values above.
 */
export type CapabilityTrustClass =
  'core_trusted' | 'community' | 'mcp.read' | 'mcp.workspace.write' | 'untrusted' | (string & {});

const CAPABILITY_AUTONOMY: ReadonlySet<string> = new Set<CapabilityAutonomy>([
  'suggest',
  'autonomous',
  'approval_required',
]);

/**
 * Typed readers for the `config` bag.
 *
 * Every one of these was an `as` cast at the call site, which is how a server
 * that changed a field's type kept typechecking. They coerce and fall back
 * instead, because the bag is user-writable through `PATCH /capabilities/{id}`
 * and is not trustworthy at compile time.
 */

/**
 * Markdown documentation stored on the capability.
 *
 * Reads `markdownDoc` as well as `doc`: the server field is `markdown_doc`, and
 * `transformKeys()` recurses over the whole response body, so it arrives already
 * camelCased. `doc` is kept for rows written before the field was renamed.
 *
 * `config.parameters` and `config.returns` are on `OPAQUE_DATA_KEYS`, so JSON
 * Schema property names inside them are NOT camelCased and round-trip verbatim --
 * which is what `routers/capabilities.py` needs, because it reads them straight
 * back into a `ToolDefinition`.
 */
export function capabilityConfigMarkdownDoc(config?: CapabilityConfig | null): string | undefined {
  if (!config) return undefined;
  const camel = config['markdownDoc'];
  if (typeof camel === 'string') return camel;
  if (typeof config.doc === 'string') return config.doc;
  return undefined;
}

export function capabilityConfigTags(config?: CapabilityConfig | null): string[] {
  const tags = config?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === 'string');
}

export function capabilityConfigAutonomy(
  config?: CapabilityConfig | null,
): CapabilityAutonomy | undefined {
  const value = config?.autonomy;
  if (typeof value !== 'string' || !CAPABILITY_AUTONOMY.has(value)) return undefined;
  return value as CapabilityAutonomy;
}

export function capabilityConfigRequiredScope(
  config?: CapabilityConfig | null,
): string | undefined {
  const value = config?.requiredScope;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Prefer the real 0062 telemetry columns on the row; fall back to the config bag
 * for rows written before those columns existed.
 */
export function capabilityConfigUsageCount(config?: CapabilityConfig | null): number {
  const value = config?.['usageCount'];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function capabilityConfigLastUsedAt(config?: CapabilityConfig | null): string | null {
  const value = config?.['lastUsedAt'];
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * The `config` key the ReAct budget lives under, in both spellings.
 *
 * `max_react_rounds` goes out in a request body; `transformKeys` camelCases it to
 * `maxReactRounds` on the way back — `toCamelCase` uppercases the single letter
 * after each underscore, so this is `maxReactRounds` and not `maxReActRounds`.
 * `services/capability_runtime_config.py` reads the snake_case name off the stored
 * row and nothing else, so a client that writes `maxReactRounds` stores a key no
 * runtime will ever look at.
 */
export const CAPABILITY_MAX_REACT_ROUNDS_KEY = 'max_react_rounds';

const CAPABILITY_MAX_REACT_ROUNDS_CAMEL = 'maxReactRounds';

/**
 * `MIN_MAX_REACT_ROUNDS` / `MAX_MAX_REACT_ROUNDS` in
 * `services/capability_runtime_config.py`.
 *
 * A stored value outside the range is not rejected — it is clamped with a
 * server-side WARNING. A control that accepts 30 therefore hands the operator a
 * number that silently becomes 12 at run time, which is why the bound lives in
 * the client too.
 */
export const MIN_REACT_ROUNDS = 1;
export const MAX_REACT_ROUNDS = 12;

/**
 * Whether the runtime would use `value` exactly as written.
 *
 * Mirrors `_coerce` in the resolver, including the cases it treats as absent:
 * a boolean is not a round count (`bool` is an `int` subclass in Python, so
 * `true` would become a one-round agent), a non-integral number is never
 * truncated into a value nobody typed, and text that is not a whole number is
 * rejected rather than parsed hopefully.
 *
 * The reason is returned rather than a bare boolean so the input can say which
 * rule it broke instead of "invalid".
 */
export function reactRoundsAcceptance(
  value: unknown,
): { ok: true; rounds: number } | { ok: false; reason: string } {
  if (typeof value === 'boolean') {
    return { ok: false, reason: 'true/false is not a round count; the server rejects a boolean.' };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, reason: `${String(value)} is not a finite number.` };
    }
    if (!Number.isInteger(value)) {
      return {
        ok: false,
        reason: `${value} is not a whole number; it would not be rounded for you.`,
      };
    }
    if (value < MIN_REACT_ROUNDS) {
      return {
        ok: false,
        reason: `The server clamps anything below ${MIN_REACT_ROUNDS} up to ${MIN_REACT_ROUNDS} and logs it, so this would not be the value the run used.`,
      };
    }
    if (value > MAX_REACT_ROUNDS) {
      return {
        ok: false,
        reason: `The server clamps anything above ${MAX_REACT_ROUNDS} down to ${MAX_REACT_ROUNDS} and logs it, so this would not be the value the run used.`,
      };
    }
    return { ok: true, rounds: value };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return { ok: false, reason: 'Empty; the server treats this as unset.' };
    // `_coerce` parses text with `int(s, 10)` first and only then as a float, so
    // the two shapes get two different verdicts: an integer is honoured, and a
    // non-integral one is rejected rather than truncated.
    if (/^[+-]?\d+$/.test(trimmed)) return reactRoundsAcceptance(Number.parseInt(trimmed, 10));
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return {
        ok: false,
        reason: `${trimmed} is not a whole number of rounds, and the server does not round it for you.`,
      };
    }
    return {
      ok: false,
      reason: `"${trimmed}" is not a number; the server rejects it rather than guessing.`,
    };
  }
  return {
    ok: false,
    reason: `${value === null ? 'null' : typeof value} is not a round count; the server rejects it.`,
  };
}

/**
 * What this capability row actually contributes to the ReAct round budget.
 *
 * `rejected` is distinct from `absent` on purpose: an absent key means nobody
 * configured a budget, while a rejected one means someone saved a value the
 * runtime ignored — which is exactly the case an operator needs told, because
 * from the form it looks configured.
 */
export function capabilityConfigReactRounds(
  config?: CapabilityConfig | null,
):
  | { state: 'absent' }
  | { state: 'honoured'; rounds: number }
  | { state: 'rejected'; stored: unknown; reason: string } {
  if (!config) return { state: 'absent' };
  // The camelCase arm is what a server response carries. The snake_case arm is a
  // row copied straight out of a request body, which happens whenever a caller
  // round-trips a config it built itself instead of one the API sent back.
  const key =
    CAPABILITY_MAX_REACT_ROUNDS_CAMEL in config
      ? CAPABILITY_MAX_REACT_ROUNDS_CAMEL
      : CAPABILITY_MAX_REACT_ROUNDS_KEY in config
        ? CAPABILITY_MAX_REACT_ROUNDS_KEY
        : null;
  if (key === null) return { state: 'absent' };
  const stored = config[key];
  const verdict = reactRoundsAcceptance(stored);
  return verdict.ok
    ? { state: 'honoured', rounds: verdict.rounds }
    : { state: 'rejected', stored, reason: verdict.reason };
}

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
  config: CapabilityConfig;
  createdAt?: string;
  updatedAt?: string;
  /** Real executions, from the 0062 telemetry columns. 0 has never run. */
  usageCount: number;
  /** ISO 8601 of the last execution; null when it has never run. */
  lastUsedAt: string | null;
  installedAt?: string | null;
}

export interface CreateCapabilityRequest {
  name: string;
  category: string;
  description?: string;
  version?: string;
  author?: string;
  type?: string;
  runtime?: string;
  config?: CapabilityConfig;
}

export interface UpdateCapabilityRequest {
  enabled?: boolean;
  status?: string;
  description?: string;
  config?: CapabilityConfig;
  autonomy?: CapabilityAutonomy;
  requiredScope?: string;
}

/**
 * One row of the server skill catalog: `GET /capabilities/catalog`.
 *
 * The catalog is global, so it carries no install state and no workspace id.
 * `bundled` is the only install signal available here; resolving "is this already
 * installed for my workspace" needs `listSkills` below.
 *
 * Note the server field `self_check`, which `transformKeys()` delivers as
 * `selfCheck`.
 */
export interface SkillCatalogEntry {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
  author: string;
  requiredScope: string;
  autonomy: CapabilityAutonomy;
  trustClass: CapabilityTrustClass;
  triggers: string[];
  markdownDoc: string;
  bundled: boolean;
  selfCheck?: unknown;
}

/**
 * A workspace capability row unioned with the not-yet-installed catalog entries.
 *
 * `GET /capabilities?category=skill&include_catalog=true`. A catalog-only row has
 * `installed: false`, a null `id` and null `workspaceId`, so anything that needs
 * a row to exist server-side must branch on `installed` before touching `id`.
 * `usageCount` is 0 and `lastUsedAt` is null on such rows by construction.
 */
export interface SkillListItem extends Omit<CapabilityItemRecord, 'id' | 'workspaceId'> {
  installed: boolean;
  /** Null on a catalog-only row: it has no workspace row to point at. */
  id: string | null;
  workspaceId: string | null;
  tags: string[];
  markdownDoc: string | null;
  requiredScope: string | null;
  trustClass: CapabilityTrustClass | null;
  autonomy: CapabilityAutonomy | null;
  triggers: string[];
  bundled: boolean;
  slug: string | null;
}

/**
 * The four statuses `POST /capabilities/validate` can answer with.
 *
 * `not_validated` is the one a UI is most likely to get wrong: it means the
 * category is real but no validator covers it, so only the shared draft rules
 * ran. It is not a pass and it is not a failure, and the server returns it
 * instead of inventing a `success`.
 */
export type CapabilityDraftStatus = 'success' | 'warning' | 'error' | 'not_validated';

/** `hard` means the create path would reject the draft; `soft` means advisory. */
export type CapabilityDraftSeverity = 'hard' | 'soft';

/**
 * Where the rules that ran came from.
 *
 * `draft` is the author's own document, `catalog` the bundled skill of the same
 * name (so a `catalog` verdict is about the shipped text, not about the edits),
 * `delegated` a validator this endpoint does not own, and `none` that nothing
 * checked the capability's substance — which is what `not_validated` reports.
 */
export type CapabilityDraftSource = 'draft' | 'catalog' | 'delegated' | 'none';

export interface CapabilityDraftViolation {
  rule: string;
  message: string;
  /** 1-based line in the authored document, when the rule could locate one. */
  line?: number | null;
  severity: CapabilityDraftSeverity;
}

/**
 * `CapabilityDraftValidationResponse` in `api/schemas/capability_draft.py`.
 *
 * `executed` is typed `false` rather than `boolean` because the server types it
 * `Literal[False]`: no response from this endpoint may be read as a live run, and
 * the compiler is what keeps a caller from writing `executed && <a run>`.
 *
 * Every field is renamed from the wire by `transformKeys`: `rules_checked` is
 * `rulesChecked`, `validated_source` is `validatedSource`, `catalog_slug` is
 * `catalogSlug`. `rule`, `message`, `line` and `severity` are single words and
 * survive unrenamed.
 */
export interface CapabilityDraftValidationResponse {
  status: CapabilityDraftStatus;
  /** How many rules actually ran. Not a score, and not the violation count. */
  rulesChecked: number;
  violations: CapabilityDraftViolation[];
  executed: false;
  /** The lower-cased category the server measured; may not be a valid one. */
  category: string;
  validatedSource: CapabilityDraftSource;
  /** Only set when `validatedSource` is `catalog`. */
  catalogSlug: string | null;
  /** The server's own sentence, including why a `not_validated` happened. */
  detail: string;
}

/**
 * `CapabilityDraftRequest`.
 *
 * `config` is `CapabilityConfig` rather than an open record so a caller builds it
 * through the typed readers above instead of restating which keys the server
 * reads. Keys travel snake_case in a request body -- `transformKeys` runs on
 * responses only -- so `markdown_doc` / `required_scope` are the names
 * `routers/capabilities.py` looks up, and the camelCase arms of
 * `CapabilityConfig` describe rows that have already made the round trip.
 *
 * `autonomy` and `trustClass` are plain strings on purpose, mirroring the server:
 * a validator endpoint has to be able to *report* a value outside the enum as a
 * violation, so typing them as `CapabilityAutonomy` / `CapabilityTrustClass`
 * here would push the rejection into the client and hide the rule.
 */
export interface ValidateCapabilityDraftRequest {
  name: string;
  category: string;
  description?: string;
  config?: CapabilityConfig;
  autonomy?: string;
  trustClass?: string;
}

export const capabilitiesApi = {
  list(category?: string, workspaceId?: string): Promise<CapabilityItemRecord[]> {
    const params: Record<string, string | undefined> = {};
    if (category) params['category'] = category;
    if (workspaceId) params['workspace_id'] = workspaceId;
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
  /**
   * The server-owned catalog. Authoritative for the Skills tab; the TS seed in
   * `capabilities-data.ts` is only the offline/SSR fallback.
   *
   * `category` is a plain `string` rather than a union because the server treats
   * it as free text (`list_catalog(category)` filters on equality); narrowing it
   * client-side would only be a guess about which values are populated today.
   *
   * No workspace parameter: `list_catalog_capabilities` reads no workspace row,
   * so a workspace id here would be silently ignored. Use `listSkills` when the
   * answer depends on what this workspace has installed.
   */
  catalog(category = 'skill'): Promise<SkillCatalogEntry[]> {
    return apiClient.get<SkillCatalogEntry[]>('/capabilities/catalog', { category });
  },
  /**
   * Installed skills merged with the catalog in one request.
   *
   * Saves the page a fetch-then-join: it would otherwise have to reconcile the
   * two lists itself and could show a catalog skill the workspace had already
   * installed. Lands with the 0062 migration.
   */
  listSkills(workspaceId: string): Promise<SkillListItem[]> {
    return apiClient.get<SkillListItem[]>('/capabilities', {
      category: 'skill',
      include_catalog: 'true',
      workspace_id: workspaceId,
    });
  },
  /**
   * Flip a capability on or off.
   *
   * `workspace_id` is omitted deliberately. `UpdateCapabilityRequest` accepts the
   * field so the client can stop having it silently dropped, but the backend only
   * uses it to prove the client agrees with the verified workspace — authorization
   * comes from the request-scoped workspace id (`Depends(get_workspace_id)`), never
   * from a body field. Sending it invites a caller to believe it is load-bearing.
   */
  toggleCapability(
    capabilityId: string,
    enabled: boolean,
    _workspaceId?: string,
  ): Promise<CapabilityItemRecord> {
    return apiClient.patch<CapabilityItemRecord>(`/capabilities/${capabilityId}`, { enabled });
  },
  /**
   * Dispatch a registered capability for real and report what happened.
   *
   * Not interchangeable with `test()`, which never executes anything.
   */
  testCapability(
    capabilityId: string,
    inputPayload?: Record<string, unknown>,
  ): Promise<TestCapabilityByIdResponse> {
    return apiClient.post<TestCapabilityByIdResponse>(`/capabilities/${capabilityId}/test`, {
      input: inputPayload ?? {},
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
  /**
   * Validate an unsaved draft. Nothing is persisted and nothing is executed.
   *
   * The counterpart to `test()`, which needs a minted capability id the author
   * does not have until they save. This one takes the field set a create takes,
   * so an author can check their work against the server's real validators
   * before the row exists.
   *
   * No workspace argument: the endpoint reads the request-scoped workspace
   * (`X-Workspace-ID`, which `api.request` derives from the current route), and
   * `POST /capabilities` uses the same dependency. Sending one in the body would
   * be a second, unverifiable copy of an identity the server already resolved.
   */
  validateDraft(body: ValidateCapabilityDraftRequest): Promise<CapabilityDraftValidationResponse> {
    return apiClient.post<CapabilityDraftValidationResponse>('/capabilities/validate', {
      name: body.name,
      category: body.category,
      description: body.description ?? '',
      config: body.config ?? {},
      ...(body.autonomy !== undefined ? { autonomy: body.autonomy } : {}),
      ...(body.trustClass !== undefined ? { trust_class: body.trustClass } : {}),
    });
  },
};

// ─── Connectors API ─────────────────────────────────────────────────────────

/**
 * `ConnectorResponse` in `api/schemas/connector_ext.py`.
 *
 * `syncInterval`, `errorMessage` and `tenantId` were declared here and are NOT on
 * the wire; `configVersion` and `scopes` were on the wire and were NOT declared.
 * Every read of a missing field is `undefined`, which renders as a permanent
 * "Never synced" rather than an error, so the mismatch was invisible.
 */
export interface ConnectorItem {
  id: string;
  workspaceId: string;
  name: string;
  type: 'rest' | 'graphql' | 'database' | 'file' | 'mcp';
  status: 'active' | 'syncing' | 'error' | 'paused' | 'disconnected' | 'synced';
  config: Record<string, any>;
  configVersion: number;
  scopes?: string[] | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

/**
 * `McpToolInfoResponse` in `api/schemas/connector_ext.py`.
 *
 * The read-only hint arrives as `readOnlyHint` (the response transform
 * camelCases `read_only_hint`). It was previously typed and read as `readOnly`,
 * which does not exist on the wire -- so the value was always `undefined` and
 * every MCP tool rendered as "Approval gated", including read-only ones. That is
 * a false security signal: it told the operator a tool needed approval it did
 * not need, and told nothing at all about the tools that genuinely do.
 *
 * The server always sends the field, defaulting to `false`, so `undefined` here
 * means the response did not come from this endpoint and the UI must say
 * "unknown" rather than guess.
 */
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  readOnlyHint: boolean;
}

/**
 * `POST /connectors/{id}/mcp/sync` returns `{connector_id, registered, bridged_total}`.
 *
 * `bridgedTotal` is the size of the process-wide bridge registry
 * (`len(get_bridge_definitions())` in routers/connectors.py), NOT this
 * connector's contribution. Reading `bridged_total` off the camelCased response
 * was always `undefined`, and the `?? registered.length` fallback then silently
 * substituted a different quantity for the same label. Use `registered.length`
 * when reporting what a single connector bridged.
 */
export interface McpSyncResult {
  connectorId: string;
  connector_id?: string;
  /** Tool names bridged from this connector into the executor. */
  registered: string[];
  /** Size of the process-wide bridge registry, across every connector. */
  bridgedTotal: number;
  bridged_total?: number;
}

/**
 * The operator-invoked MCP tool result.
 *
 * `isError` and `structuredTruncated` are the camelCase spellings the response
 * transform produces for the service's `is_error` / `structured_truncated`.
 * `isError` means the MCP server reported a tool-level failure, which is a 200
 * with an error in it -- not a transport failure, which arrives as a 502.
 */
export interface McpToolCallResult {
  tool: string;
  text: string;
  isError: boolean;
  structured?: unknown;
  structuredTruncated?: boolean;
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
  totalApps?: number;
  total_apps?: number;
  popularApps?: ComposioAppInfo[];
  popular_apps?: ComposioAppInfo[];
}

export interface ComposioAuthUrlResponse {
  status: string;
  app: string;
  authUrl?: string;
  auth_url?: string;
  url?: string;
  workspaceId?: string;
  workspace_id?: string;
  connectionStatus?: string;
  connection_status?: string;
  errorCode?: string;
  error_code?: string;
  message?: string;
}

/**
 * `GET /connectors/{id}/health`, from `connector_ext_service.get_health`.
 *
 * The service returns exactly `connector_id`, `name`, `type`, `status`,
 * `last_synced_at`, `auth_state`, `connectivity` and `details`. `last_sync`,
 * `error_message` and `config_keys` were declared here and are NOT produced --
 * so the health panel showed "None reported" for an error that could not exist,
 * and a config-keys row that was always empty.
 */
export interface ConnectorHealthResponse {
  connectorId?: string;
  connector_id?: string;
  name: string;
  type: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  lastSyncedAt?: string | null;
  last_sync?: string | null;
  authState?: 'configured' | 'unconfigured';
  connectivity?: 'ok' | 'failed' | 'unknown';
  details?: string;
  error_message?: string;
  config_keys?: string[];
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
  /**
   * `SyncStatusResponse` in `api/schemas/connector_ext.py`, which carries
   * `connector_id`, `status`, `error` and `synced_at`. `records_synced` was
   * declared by the caller and is not produced by any of these endpoints, so the
   * success toast could only ever have read "Records synced: 0".
   */
  sync(connectorId: string): Promise<SyncStatusResponse> {
    return apiClient.post<SyncStatusResponse>(`/connectors/${connectorId}/sync`);
  },
  getSyncStatus(connectorId: string): Promise<SyncStatusResponse> {
    return apiClient.get<SyncStatusResponse>(`/connectors/${connectorId}/sync/status`);
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
    sync(connectorId: string, workspaceId?: string): Promise<McpSyncResult> {
      return apiClient.post<McpSyncResult>(
        `/connectors/${connectorId}/mcp/sync`,
        workspaceId ? { workspace_id: workspaceId } : undefined,
      );
    },
    /**
     * `POST /connectors/{id}/mcp/call`, from `mcp_client_service.call_tool`.
     *
     * `structured` is the MCP server's own `structuredContent`, so it is `unknown`
     * rather than a record with named fields -- and it is served under the
     * name the server chose, which is why `structuredContent` is not reachable
     * through `transformKeys` either (it is not on `OPAQUE_DATA_KEYS`: the
     * service truncates it into a string when it is oversized, and a value whose
     * type depends on its length is not something a typed field can promise).
     * `structuredTruncated` is the flag that says the string is a prefix, so a
     * renderer can refuse to parse it instead of reporting a half-document as a
     * complete one.
     */
    call(
      connectorId: string,
      toolName: string,
      args: Record<string, unknown> = {},
    ): Promise<McpToolCallResult> {
      return apiClient.post<McpToolCallResult>(`/connectors/${connectorId}/mcp/call`, {
        tool_name: toolName,
        arguments: args,
      });
    },
    builtin(): Promise<{
      builtinServers: BuiltinMcpServer[];
      builtin_servers?: BuiltinMcpServer[];
    }> {
      return apiClient.get<{
        builtinServers: BuiltinMcpServer[];
        builtin_servers?: BuiltinMcpServer[];
      }>('/connectors/mcp/builtin');
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

export interface ExtractedEmailEntity {
  type: string;
  label: string;
  value: string;
  confidence: number;
  addedToMemory: boolean;
}

export interface LiveEmailMessage {
  id: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  company: string;
  preview: string;
  body: string;
  receivedAt: string;
  isRead: boolean;
  category: 'RECRUITER' | 'INTERVIEW_INVITE' | 'STATUS_UPDATE' | 'GENERAL';
  extractedEntities: ExtractedEmailEntity[];
}

export interface GmailStatusResponse {
  connected: boolean;
  provider: string;
  accountEmail: string;
  syncHealth: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
  configured: boolean;
}

export const gmailApi = {
  listMessages(params?: {
    workspaceId?: string;
    maxResults?: number;
    query?: string;
  }): Promise<{ messages: LiveEmailMessage[]; count: number; connected: boolean }> {
    return apiClient.get('/gmail/messages', {
      workspace_id: params?.workspaceId,
      max_results: params?.maxResults,
      query: params?.query,
    });
  },
  getStatus(workspaceId?: string): Promise<GmailStatusResponse> {
    return apiClient.get('/gmail/status', {
      workspace_id: workspaceId,
    });
  },
  createDraft(data: { to: string; subject: string; body: string }): Promise<{ id: string }> {
    return apiClient.post('/gmail/drafts', data);
  },
};

export interface CareerStrategyResponse {
  primaryTargetRole: {
    title: string;
    level: string;
    overallMatchPercentage: number;
    readinessScore: number;
    benchmarkCompensation: string;
    marketDemand: string;
  };
  skillGaps: Array<{
    skill: string;
    category: string;
    currentLevel: string;
    requiredLevel: string;
    gapSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
    actionRequired: string;
    recommendedResources: string[];
  }>;
  milestones: Array<{
    id: string;
    quarter: string;
    title: string;
    description: string;
    progressPercentage: number;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
    agentAssigned: string;
  }>;
  targetCompanies: Array<{
    name: string;
    tier: string;
    matchPercentage: number;
    openPositions: number;
    activeContact: string;
    stage: string;
  }>;
}

export const careerApi = {
  getStrategy(workspaceId: string): Promise<CareerStrategyResponse> {
    return apiClient.get<CareerStrategyResponse>('/career/strategy', {
      workspace_id: workspaceId,
    });
  },
};
