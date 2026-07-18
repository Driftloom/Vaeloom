import type { BaseEntity, UUID, ISO8601 } from './domain';

export type MemoryType = 'document' | 'email' | 'code' | 'note' | 'conversation' | 'webpage' | 'structured';

export type MemoryStatus = 'processing' | 'indexed' | 'failed' | 'archived' | 'deleted';

export interface Memory extends BaseEntity {
  type: MemoryType;
  status: MemoryStatus;
  title: string;
  summary: string;
  source: MemorySource;
  contentHash: string;
  size: number;
  embedding: number[];
  metadata: Record<string, unknown>;
  tags: string[];
  vectorId: string;
  graphNodeId?: UUID;
}

export interface MemorySource {
  type: 'upload' | 'import' | 'sync' | 'api' | 'email' | 'webhook';
  uri: string;
  label: string;
  connectorId?: UUID;
}

export interface KnowledgeGraphNode extends BaseEntity {
  label: string;
  type: NodeType;
  properties: Record<string, unknown>;
  embedding: number[];
  description: string;
  importance: number;
}

export type NodeType = 'concept' | 'entity' | 'document' | 'topic' | 'person' | 'organization' | 'event' | 'project';

export interface KnowledgeGraphEdge {
  id: UUID;
  sourceId: UUID;
  targetId: UUID;
  relationship: string;
  weight: number;
  properties: Record<string, unknown>;
  createdAt: ISO8601;
}

export interface VectorSearchResult {
  id: UUID;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface MemoryQuery {
  query: string;
  filters?: MemoryQueryFilter;
  limit?: number;
  offset?: number;
  minScore?: number;
}

export interface MemoryQueryFilter {
  types?: MemoryType[];
  tags?: string[];
  dateFrom?: ISO8601;
  dateTo?: ISO8601;
  tenantId?: UUID;
  userId?: UUID;
}
