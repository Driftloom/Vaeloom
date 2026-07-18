export type MemoryType = 'document' | 'email' | 'code' | 'note' | 'conversation' | 'webpage' | 'structured';

export enum MemoryStatus { Processing = 'processing', Indexed = 'indexed', Failed = 'failed', Archived = 'archived', Deleted = 'deleted' }

export enum AgentStatus { Idle = 'idle', Running = 'running', Paused = 'paused', Error = 'error', Disabled = 'disabled' }

export interface Memory {
  id: string; type: MemoryType; status: MemoryStatus; title: string; summary?: string; tags: string[];
  createdAt: string; updatedAt: string; tenantId: string; userId?: string; workspaceId?: string;
}

export interface MemoryQuery { query: string; filters?: MemoryQueryFilter; limit?: number; offset?: number; minScore?: number; }

export interface MemoryQueryFilter { types?: MemoryType[]; tags?: string[]; dateFrom?: string; dateTo?: string; }

export interface Agent { id: string; name: string; description?: string; category: string; status: AgentStatus; version: string; createdAt: string; }

export interface AgentConfig { model: string; temperature: number; maxTokens: number; tools: string[]; }

export interface AgentExecution { id: string; agentId: string; status: string; input: Record<string, unknown>; output?: Record<string, unknown>; error?: string; startedAt: string; completedAt?: string; tokensUsed?: number; }

export interface User { id: string; email: string; displayName: string; status: string; createdAt: string; }

export interface Tenant { id: string; name: string; slug: string; plan: string; status: string; }

export interface Workspace { id: string; name: string; slug: string; tenantId: string; }

export interface PaginatedResponse<T> { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean; } }

export interface ApiError { code: string; message: string; details?: Record<string, unknown>; }
