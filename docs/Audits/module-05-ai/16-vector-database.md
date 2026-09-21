# Module 05: Vector Database Architecture & Multi-Tenant Isolation
**Audit Identifier**: `AUD-M05-AI-16`
**Scope**: VectorStore abstractions, PGVectorStore, QdrantStore, FallbackVectorStore, and zero-trust search filtering.

---

## 1. Vector Store Abstraction

Located in `api/infrastructure/vector_store.py`:
- Interface: `VectorStore` protocol defining `upsert()`, `search()`, `delete()`.
- Implementations:
  - `PGVectorStore`: Native PostgreSQL `pgvector` with HNSW cosine distance indexing (`<=>`).
  - `QdrantStore`: Dedicated high-throughput Qdrant vector database client.
  - `FallbackVectorStore`: Safe in-process zero-dependency fallback store used during local testing or remote DB outages.

---

## 2. Zero-Trust Filter Enforcement

All vector stores strictly require a tenant or workspace filter on search:
```python
if not filters or ("workspace_id" not in filters and "tenant_id" not in filters):
    raise ValueError("Zero-Trust violation: vector search must specify tenant_id or workspace_id filter")
```
Unfiltered vector searches are strictly prohibited at runtime.

---

## 3. Verification Evidence

- `test_module05_rag.py`:
  - `test_vector_store_zero_trust_isolation`: Verifies that vector search without `workspace_id` raises `ValueError`.
- `test_module05_chaos.py`:
  - `test_vector_store_chaos_fallback`: Verifies fallback to `FallbackVectorStore` when remote store is unavailable.
  - `test_fallback_vector_store_safe_operations`: Verifies safe search and upsert operations under tenant filter constraints.
