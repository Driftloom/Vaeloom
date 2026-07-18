import type { BaseEntity, UUID } from './domain';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'disabled';

export type AgentCategory = 'ingestion' | 'memory' | 'analysis' | 'retrieval' | 'action' | 'scheduling' | 'communication';

export interface Agent extends BaseEntity {
  name: string;
  description: string;
  category: AgentCategory;
  status: AgentStatus;
  version: string;
  config: AgentConfig;
  capabilities: string[];
  permissions: AgentPermissions;
  schedule?: CronSchedule;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  memory: AgentMemoryConfig;
  promptTemplate?: string;
  rateLimit?: RateLimit;
}

export interface AgentMemoryConfig {
  enabled: boolean;
  shortTermSize: number;
  longTermEnabled: boolean;
  contextWindow: number;
}

export interface AgentPermissions {
  allowedTools: string[];
  allowedDataSources: string[];
  maxMemoryAccess: 'read' | 'write' | 'admin';
  restrictedTopics: string[];
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  concurrentLimit: number;
}

export interface CronSchedule {
  enabled: boolean;
  expression: string;
  timezone: string;
}

export interface AgentExecution {
  id: UUID;
  agentId: UUID;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  tokensUsed?: number;
  cost?: number;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}
