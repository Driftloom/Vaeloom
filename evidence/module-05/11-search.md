# Module 05: Document Search & Full-Text Retrieval Audit

**Requirement**: Full-Text Search, PostgreSQL TSVector/GIN Indexing, Algolia
Indexing, Workspace-Scoped Query Boundaries, and Keyword Ranking  
**Auditor**: Search Engineer / Security Architect  
**Status**: NOT RELEASE VERIFIED (CRITICAL GAPS / UNWIRED INDEXES)

---

## 1. Requirement & Expected Behavior

Enterprise document management requires performant, secure document search:

1. **Full-Text Indexing**: Document text and metadata must be tokenized and
   indexed using PostgreSQL `tsvector` with a `GIN` index, or an external search
   engine.
2. **Dedicated Search API**: A search endpoint (`GET /documents/search?q=...` or
   `q` parameter on `GET /documents`) supporting pagination, highlighting, and
   relevance ranking.
3. **Strict Zero-Trust Authorization**: Search results must be strictly bounded
   to the user's workspace. Cross-tenant or cross-workspace results must be
   impossible.
4. **Sub-500ms Latency**: p95 search latency < 500ms under indexed corpus loads.

---

## 2. Implementation Findings

### 2.1 The Dead `search_vector` Column (Migration 0026)

- **Location**: `apps/api/alembic/versions/0026_tsvector_documents.py:25-30`
- **Observed Code**:
  ```sql
  ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,''))) STORED;
  CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING gin(search_vector);
  ```
- **Critical Defects**:
  1. **Only Indexes Filename**: The generated column concatenates
     `coalesce(path,'')` and `coalesce(summary,'')`. Document contents are NOT
     included!
  2. **`summary` is Always NULL**: When documents are uploaded via
     `POST /documents`, `summary` is omitted and defaults to `NULL`. Background
     workflows never summarize the document or update `Document.summary`. Thus,
     `search_vector` contains only the filename tokens.
  3. **Column is Never Queried**: Grep analysis confirms that `search_vector`
     appears **nowhere** in application query code. It exists purely in
     migration 0026.

### 2.2 Complete Absence of Document Search Endpoints

- **Location**: `apps/api/src/api/routers/documents.py:147-173`
- **Observed**: The `GET /documents` endpoint accepts only: `workspace_id: str`,
  `page: int`, `page_size: int`, `include_archived: bool`. There is **no search
  query parameter `q`** and **no `/documents/search` endpoint**. Users and
  frontend clients have zero API mechanism to search documents.

### 2.3 RAG Fallback Query Misses Document Content

- **Location**: `apps/api/src/api/orchestrator/loop.py:642-653`
- **Observed Code**:
  ```python
  stmt = text("""
      SELECT id, path, summary,
             ts_rank(to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,'')),
                     plainto_tsquery('english', :q)) AS rank
      FROM documents
      WHERE workspace_id = :wid
        AND to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,'')) @@ plainto_tsquery('english', :q)
      ORDER BY rank DESC LIMIT 8
  """)
  ```
- **Defect**: The orchestrator loop bypasses `idx_documents_search_vector` and
  recalculates `to_tsvector` on the fly. Because `summary` is `NULL`, searching
  for terms present inside a document returns zero results. Only matches against
  the literal filename `path` succeed.

### 2.4 Cross-Tenant Data Exposure in Algolia Tooling

- **Location**: `apps/api/src/api/tools/executor.py:354-375`
  (`_execute_search_documents`)
- **Observed Code**:
  ```python
  search_idx = get_search_index()
  if isinstance(search_idx, AlgoliaIndex):
      hits = await search_idx.search(query, options={"limit": limit})
  ```
- **Vulnerability**: In `apps/api/src/api/infrastructure/search.py:61-80`,
  `AlgoliaIndex.search()` supports `"filters"`. However,
  `_execute_search_documents` **does not provide any `workspace_id` filter**!
  When Algolia is enabled, document search queries return documents across all
  tenants globally.

---

## 3. Test & Verification Evidence

- **Full-Text Search Probe**:
  1. Upload document `project_alpha.pdf` containing the text:
     `"Project Alpha budget is $500,000"`.
  2. Execute orchestrator search with query `"Alpha budget"`.
  3. **Result**: 0 results returned. The file is completely unindexed because
     full-text content is not stored in `summary` or `search_vector`.

---

## 4. Evaluation Matrix

| Capability                      | Requirement                       | Actual Status                | Verdict           |
| :------------------------------ | :-------------------------------- | :--------------------------- | :---------------- |
| **Document Search Endpoint**    | `GET /documents?q=...`            | Missing from router          | **FAIL**          |
| **Content Indexing**            | Full text indexed in TSVector     | Only `path` + `NULL` indexed | **FAIL**          |
| **`search_vector` Utilization** | GIN index queried by API          | Dead column; 0 queries       | **FAIL**          |
| **Algolia Tenant Scoping**      | `workspace_id` filter enforced    | Missing; global cross-tenant | **CRITICAL FAIL** |
| **Frontend Search UI**          | Accessible search bar in files UI | Missing in web UI            | **FAIL**          |

---

## 5. Security & Functional Verdict

**NOT RELEASE VERIFIED (CRITICAL DEFICIT)**  
Document search is non-functional for document contents. The generated tsvector
column is a dead artifact, and Algolia search integrations leak document
metadata across tenants.
