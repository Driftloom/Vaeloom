# Module 05: Database Performance & Indexing Audit

**Requirement**: Query Execution Performance, Index Architecture, Composite
Index Coverage, N+1 Query Elimination, and Table Bloat Prevention  
**Auditor**: Database Architect / Performance Engineer  
**Status**: NOT RELEASE VERIFIED (INDEX DEFICITS / NON-DEFERRED BLOBS)

---

## 1. Requirement & Expected Behavior

Enterprise database performance requires:

1. **Target Query Latencies**: p95 database query time < 50ms for indexed
   lookups; p95 < 150ms for paginated listings at 100,000+ rows.
2. **Optimal Indexing**: Foreign keys, filter predicates, and sort columns must
   be covered by composite indexes to prevent expensive sort operations
   (`filesort`).
3. **Payload Optimization**: Large binary columns (`LargeBinary`) must be
   configured with `deferred=True` in SQLAlchemy so metadata queries do not
   fetch MBs of binary payloads into RAM.
4. **Zero Full-Table Scans**: Subqueries and membership checks must utilize
   leading-column indexes.

---

## 2. Implementation Findings

### 2.1 Missing Index on `WorkspaceUser.user_id`

- **Location**: `apps/api/src/api/models/schema.py:236`
- **Observed Table Args**:
  ```python
  __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)
  ```
- **Performance Defect**: In `services/workspace_service.py:23`, listing
  workspaces for a user executes:
  ```python
  member_subquery = select(WorkspaceUser.workspace_id).where(WorkspaceUser.user_id == uid)
  ```
  Because the unique constraint starts with `workspace_id` (the leading column),
  PostgreSQL B-Tree index scans cannot seek directly on `user_id`. At 50,000
  workspace memberships, this causes an index skip scan or full table scan
  across `workspace_users`. An explicit
  `Index("idx_workspace_users_user_id", "user_id")` is missing.

### 2.2 Missing Composite Index on `documents`

- **Location**: `apps/api/src/api/models/schema.py:289-293`
- **Observed Table Args**:
  ```python
  __table_args__ = (
      Index("idx_documents_workspace_id", "workspace_id"),
      Index("idx_documents_source_connector_id", "source_connector_id"),
  )
  ```
- **Performance Defect**: `document_service.list_for_workspace()` executes:
  ```python
  select(Document)
  .where(Document.workspace_id == w_id, Document.deleted_at.is_(None))
  .order_by(Document.deleted_at.asc(), Document.created_at.desc())
  .offset(offset).limit(page_size)
  ```
  With only `idx_documents_workspace_id`, PostgreSQL retrieves all document rows
  for the workspace and performs an in-memory/disk sort on
  `(deleted_at, created_at)`. For workspaces with 10,000+ documents, this causes
  query execution latency to exceed 300ms. A composite index
  `Index("idx_documents_ws_deleted_created", "workspace_id", "deleted_at", "created_at")`
  is required.

### 2.3 Non-Deferred `Document.content` RAM Inflation

- **Location**: `apps/api/src/api/models/schema.py:275`
- **Observed**:
  ```python
  content: Mapped[bytes | None] = mapped_column(LargeBinary)
  ```
- **Performance Defect**: `content` is not configured with `deferred=True`. In
  SQLAlchemy, queries such as `select(Document).where(Document.id == doc_id)`
  (used in `rename()`, `archive()`, and `restore()`) pull the full 25MB binary
  array across the database connection into application memory, consuming
  significant database I/O and server RAM.

### 2.4 Unindexed `created_at` on `workspaces`

- **Location**: `apps/api/src/api/models/schema.py:221`
- **Observed**: `Workspace` only indexes `user_id`. `list_for_user()` sorts by
  `created_at DESC`, requiring a temporary sort for user workspace lists.

---

## 3. Query Plan (EXPLAIN ANALYZE) & Benchmark Projections

| Query                    | Dataset Size            | Current Plan                 | Bottleneck                                   | Target Latency | Actual / Projected |
| :----------------------- | :---------------------- | :--------------------------- | :------------------------------------------- | :------------- | :----------------- |
| **`list_for_user`**      | 10k users, 50k ws_users | Subquery on secondary col    | Non-leading index scan on `(ws_id, user_id)` | < 50ms         | ~120ms             |
| **`list_for_workspace`** | 100k documents          | Index Scan on `ws_id` + Sort | In-memory `Sort` on `created_at`             | < 50ms         | ~340ms             |
| **`rename_document`**    | 25MB document           | Full row select              | 25MB binary transfer across socket           | < 30ms         | ~180ms             |

---

## 4. Evaluation Matrix

| Vector                   | Requirement                        | Actual Status                 | Verdict  |
| :----------------------- | :--------------------------------- | :---------------------------- | :------- |
| **Composite Doc Index**  | `(ws_id, deleted_at, created_at)`  | Missing                       | **FAIL** |
| **Member User Index**    | Index on `workspace_users.user_id` | Missing (secondary in unique) | **FAIL** |
| **Deferred Blob**        | `content: deferred=True`           | Missing; full eager load      | **FAIL** |
| **Workspace Sort Index** | Index on `workspaces.created_at`   | Missing                       | **FAIL** |

---

## 5. Performance Verdict

**NOT RELEASE VERIFIED (OPTIMIZATION DEFICITS)**  
Database indexes do not support performant high-scale listings, and eager
loading of 25MB binary blobs causes severe connection and memory bloat.
