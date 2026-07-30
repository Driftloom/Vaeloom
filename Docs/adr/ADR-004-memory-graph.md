# ADR-004: Knowledge Graph for Memory System

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

The Vaeloom core differentiator is a persistent memory system that crosses sessions. Every agent needs to read from and write to a shared store of entities (skills, projects, people, companies), their typed relationships, and associated vector embeddings. The system must support graph traversal (BFS/DFS), shortest-path queries, node importance weighting, and tenant-scoped isolation — all within the existing PostgreSQL database.

Options considered: Custom relational schema (adjacency list), pgvector-only, Neo4j, Amazon Neptune, RedisGraph.

## Decision

Build an **entity-relationship knowledge graph** using a dual-table adjacency list in PostgreSQL with pgvector embeddings on each node.

Schema:
- `knowledge_nodes` table — entities with UUID id, type (skill, organization, role, etc.), name, summary, importance (float 0-1), embedding (vector(1536)), metadata (JSONB), tenant_id
- `knowledge_edges` table — typed relationships (source_id, target_id, relationship_type, weight, metadata), with bidirectional index
- BFS/DFS traversal via recursive CTEs
- Shortest path via bidirectional BFS in application layer with max-depth guard

## Consequences

**Positive:**
- Graph data lives in PostgreSQL with all other application data — single backup, single HA strategy
- Recursive CTEs for traversal avoid application-level recursion limits and perform well at sub-100K node scale
- Node embeddings stored inline enable hybrid graph+vector queries: "find nodes of type X similar to this vector, within 2 hops of node Y"
- Tenant isolation via `tenant_id` column on both tables — no separate graph instances
- HNSW index on embedding column enables fast vector similarity within graph context

**Negative:**
- Recursive CTE performance degrades beyond 100K nodes per tenant for deep traversals (depth > 5)
- No built-in graph algorithms (PageRank, community detection) — must implement in Python or migrate to specialized graph DB at scale
- Path-finding requires application-level bidirectional BFS rather than a declarative query language like Cypher
- Edge weight updates on frequently accessed nodes require write amplification management
