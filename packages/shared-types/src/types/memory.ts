import type { BaseEntity, UUID, ISO8601 } from './domain';
import type { GeneratedMemoryType } from './memory.generated';

/**
 * Memory taxonomy. GENERATED from the backend domain-pack registry
 * (`CAREER_TYPES` in `apps/api/src/api/services/memory_type_packs.py`) -- the
 * same constant the API validates every memory write against. Do not hand-edit
 * the list; regenerate `memory.generated.ts` instead.
 *
 * This previously declared `document | email | code | note | conversation |
 * webpage | structured` by hand, which is a *source format* list, not the
 * taxonomy the API actually accepts. Only `document` and `note` existed in both,
 * so every other type the UI could send or filter by silently matched nothing —
 * the backend rejects unknown types and the type filter returned zero rows.
 * Nothing caught it, because nothing compared the two lists.
 *
 * `test_generated_union_matches_career_pack` in
 * `apps/api/tests/test_memory_type_packs.py` is the guard that closes that gap;
 * `scripts/gen_memory_type_union.py --check` is the CI-side freshness gate.
 *
 * Backend: 6 canonical + 16 enterprise additive + `note`/`fact` legacy aliases,
 * per CONT-P12 expand-contract migration 0027.
 */
export type MemoryType = GeneratedMemoryType;

export type MemoryStatus =
  | 'processing'
  | 'indexed'
  | 'failed'
  | 'archived'
  | 'deleted'
  // backend writes this on active memories
  | 'active'
  | 'superseded';

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
  description?: string;
  importance: number;
}

export type NodeType =
  'concept' | 'entity' | 'document' | 'topic' | 'person' | 'organization' | 'event' | 'project';

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
