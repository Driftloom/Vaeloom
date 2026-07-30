# ADR-003: Use pgvector for Vector Embeddings

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

The Vaeloom memory system requires semantic search over document embeddings, memory vectors, and knowledge graph node embeddings. The solution must support cosine similarity search, hybrid search (vector + keyword), and efficient indexing for millions of vectors without introducing a separate infrastructure dependency.

Options considered: pgvector, Pinecone, Weaviate, Qdrant, Milvus.

## Decision

Use **pgvector** as the vector storage and similarity search engine.

Rationale:
- **No additional infrastructure** — runs inside PostgreSQL, which we already use for all application data
- **Transactional consistency** — vector data stays in sync with relational data (memories, documents, knowledge graph nodes) within the same transaction
- **ACID compliance** — critical for the memory system where data integrity is paramount
- **Hybrid search** — SQL-level integration allows combining `ORDER BY embedding <=> :query` with `WHERE` filters (tenant_id, type, date ranges) in a single query
- **Performance** — IVFFlat and HNSW indexes support sub-50ms queries at million-scale
- **Python integration** — `pgvector` Python package integrates directly with SQLAlchemy vector columns

## Consequences

**Positive:**
- Zero additional infrastructure to deploy, monitor, or back up — vector data is in PostgreSQL
- Single database transaction for writes to memory + embeddings + knowledge graph
- HNSW index enables fast approximate nearest-neighbor search without external services
- Tenant isolation works naturally — `WHERE tenant_id = :tid` filters vectors alongside relational data
- Cost-effective — no per-vector pricing or separate vector database licenses

**Negative:**
- Vector dimension is limited to 2000 (pgvector constraint); we use 1536-dim embeddings from `text-embedding-3-small`, which is well within limits
- Filtering after vector search (pre-filtering) can be slower than dedicated vector DBs with pre-filter support
- PostgreSQL index size grows with vector data — monitored via existing RDS storage metrics
- No built-in hybrid search ranking fusion — must implement `Reciprocal Rank Fusion` in application layer
