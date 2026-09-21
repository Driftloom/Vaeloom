# Module 05: Document Expiration & Retention Policy Audit

**Requirement**: Automated Document Expiration, Access-Time TTL Enforcement,
Scheduled Retention Jobs, and Compliance Purging  
**Auditor**: Enterprise Compliance Engineer / Backend Systems Engineer  
**Status**: NOT RELEASE VERIFIED (COMPLIANCE GAP / UNENFORCED SCHEMA)

---

## 1. Requirement & Expected Behavior

Enterprise documents must adhere to statutory and corporate data retention
rules:

- Documents must support an explicit `expires_at` timestamp.
- Expiration must be enforced **at access time** (denying retrieval and download
  if `now() > expires_at`) as well as via scheduled background retention
  workers.
- Expired documents must be cleanly transitioned to archived/deleted state,
  purging associated search vectors, embeddings, and object storage blobs.
- Audit events must be emitted when documents reach expiration.

---

## 2. Implementation Findings

### 2.1 Complete Absence of `expires_at` Column

- **Location**: `apps/api/src/api/models/schema.py:266-282`
- **Observed**: The `Document` model possesses columns: `id`, `workspace_id`,
  `path`, `type`, `raw_storage_key`, `content`, `summary`, `retention_policy`,
  `deleted_at`, `metadata_`, `created_at`, `updated_at`. **There is NO
  `expires_at` column** on `Document` or `DocumentVersion`.

### 2.2 `Document.retention_policy` is a Dead Column

- **Location**: `apps/api/src/api/models/schema.py:277`
- **Observed**:
  `retention_policy: Mapped[str] = mapped_column(String(50), default="user_driven")`
- **Defect**: Grep analysis across the entire codebase confirms that
  `retention_policy` is **never queried, checked, or evaluated** anywhere in the
  application. It is an unindexed dead string column.

### 2.3 `retention.py` Explicitly Rejects Document Tables

- **Location**: `apps/api/src/api/services/retention.py:16-18, 56-58`
- **Observed Code**:
  ```python
  ALLOWED_RETENTION_TABLES = frozenset({
      "events", "audit_events", "usage_records", "agent_executions", "auth_sessions",
  })
  ...
  if table not in ALLOWED_RETENTION_TABLES:
      raise ValueError(f"Table not allowed for retention: {table}")
  ```
- **Defect**: `retention.py` provides automated retention cleanup for ephemeral
  system logs, but explicitly excludes document tables. Attempting to apply a
  retention policy to `documents`, `document_versions`, or `document_chunks`
  immediately raises an unhandled `ValueError`.

### 2.4 Zero Access-Time or Background Expiration Checks

- **Location**: `apps/api/src/api/routers/documents.py:175-197`
- **Observed**: `get_document_content()` only evaluates `DocumentNotFound` and
  whether `content is None`. There is no expiration evaluation. An old document
  persists and remains downloadable forever.

---

## 3. Test & Verification Evidence

- **Code Search**:
  - `Document.expires_at`: 0 references.
  - `ALLOWED_RETENTION_TABLES`: contains only logs and sessions.
- **API Access Test**: Creating a document with old timestamp:
  `Document.created_at = 2020-01-01`. Accessing `GET /documents/{id}/content`
  returns `200 OK` with full binary payload. No expiration barrier exists.

---

## 4. Evaluation Matrix

| Capability              | Requirement                           | Actual Status                      | Verdict  |
| :---------------------- | :------------------------------------ | :--------------------------------- | :------- |
| **`expires_at` Field**  | Database timestamp column             | Missing from schema                | **FAIL** |
| **Access-Time Barrier** | Reject download if expired            | No check implemented               | **FAIL** |
| **Retention Engine**    | Background worker purges expired docs | `retention.py` throws `ValueError` | **FAIL** |
| **Audit on Expiration** | `document.expired` event emitted      | Zero audit events                  | **FAIL** |
| **Search/Vector Purge** | Evict expired doc from RAG            | Unimplemented                      | **FAIL** |

---

## 5. Security & Compliance Verdict

**NOT RELEASE VERIFIED (COMPLIANCE DEFICIT)**  
Document lifecycle retention is completely absent. Vaeloom cannot satisfy
enterprise legal hold requirements, automated data lifecycle policies, or
statutory expiration constraints.
