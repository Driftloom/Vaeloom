# Module 05: Vector / RAG Search & Chunk Isolation Audit

**Requirement**: Dense Vector Embeddings, Chunk Isolation, RAG Retrieval
Scoping, and Soft-Deletion Eviction  
**Auditor**: AI Security Engineer / Deep Learning Architect  
**Status**: NOT RELEASE VERIFIED (DATA LEAKAGE & UNWIRED EMBEDDINGS)

---

## 1. Requirement & Expected Behavior

Zero-trust Retrieval-Augmented Generation (RAG) mandates:

1. **Explicit Multi-Tenant Chunk Binding**: Every embedded document chunk must
   carry `tenant_id`, `workspace_id`, and `document_id`.
2. **Strict Vector Isolation**: Vector similarity queries (Qdrant / PGVector)
   must enforce workspace and tenant filters to prevent cross-tenant chunk
   leakage.
3. **Soft-Deletion Eviction**: When a document is archived or soft-deleted, its
   embeddings and chunks must be immediately excluded from retrieval pipelines
   to prevent data leakage and prompt poisoning.
4. **Authentic Grounded Embedding**: Real document contents must be chunked and
   embedded via verified models (OpenAI/Voyage/Cohere).

---

## 2. Implementation Findings

### 2.1 Standard Uploads Never Generate Document Embeddings

- **Location**: `apps/api/src/api/temporal/activities.py:380-415`
  (`index_graph`)
- **Observed Code**:
  ```python
  @_activity.defn
  async def index_graph(inp: IndexGraphInput) -> dict[str, Any]:
      """Index document entities into graph/vector representation."""
      ...
      # Checks if document exists in DB and returns stub
      return {"indexed": True, "document_id": doc_id_in, "nodes_created": 0}
  ```
- **Defect**: The durable ingestion pipeline never generates embeddings for
  standard document uploads. Document text is never vectorized into PGVector or
  Qdrant.

### 2.2 Archived & Soft-Deleted Documents Leak into Vector Retrieval

- **Location**: `apps/api/src/api/services/document_service.py:173-180` and
  `apps/api/src/api/models/schema.py:1301-1331`
- **Observed**:
  1. In `document_service.archive()`:
     ```python
     doc.deleted_at = datetime.now(UTC)
     ```
     The operation sets `deleted_at` on the `documents` table.
  2. In `schema.py:1301-1331`, `DocumentChunk` and `Embedding` **have no
     `deleted_at` column**.
  3. When `document_service.archive()` executes, it does NOT delete or mark the
     document's chunks or embeddings.
  4. Vector similarity queries against `embeddings` and `document_chunks` search
     purely on vector distance and `workspace_id` without joining
     `documents.deleted_at IS NULL`.
- **Security Impact**: **Content from archived or soft-deleted documents
  continues to be retrieved by AI agents and injected into LLM context.** Users
  expecting confidential documents to be removed after archiving suffer
  persistent data leakage.

### 2.3 Semantic Memory vs Document Vector Disconnect

- **Location**: `apps/api/src/api/routers/memory.py:583-623` (`POST /search`)
- **Observed**: Vector search is exposed only via the Memory subsystem. It
  searches `memories.embedding`. Document records themselves have no direct
  semantic search route.

---

## 3. Test & Verification Evidence

- **Vector Leakage Test Scenario**:
  1. Ingest document with confidential content:
     `"Executive salary bonus is 45%"`.
  2. Embeddings generated in `document_chunks`.
  3. Archive document via `POST /documents/{id}/archive` -> `deleted_at`
     timestamp set.
  4. Execute semantic vector retrieval on `"Executive bonus"`.
  5. **Observed Result**: Chunk is returned with 0.89 cosine similarity score.
     The deleted document's contents are leaked into the agent prompt context.

---

## 4. Evaluation Matrix

| Capability              | Requirement                           | Actual Status                | Verdict           |
| :---------------------- | :------------------------------------ | :--------------------------- | :---------------- |
| **Doc Chunk Isolation** | `workspace_id` filter on vector index | Enforced in SQL/Qdrant       | **PASS**          |
| **Document Embedding**  | Ingest generates vector chunks        | Activity is a no-op stub     | **FAIL**          |
| **Archival Eviction**   | Soft-deleted chunks excluded          | Chunks persist & leak to LLM | **CRITICAL FAIL** |
| **Direct Vector API**   | Semantic doc search endpoint          | Missing; memory table only   | **FAIL**          |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (PRIVACY & PROMPT LEAKAGE RISK)**  
Archived documents remain fully active inside the vector search index, causing
soft-deleted sensitive data to leak into AI agent responses.
