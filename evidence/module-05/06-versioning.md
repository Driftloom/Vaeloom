# Module 05: Document Versioning & Concurrency Audit

**Requirement**: Immutable Document Versioning, Version Revision History,
Deterministic Current Version, Atomic Version Increments, and Rollback
Capabilities  
**Auditor**: Database Architect / Backend Engineer  
**Status**: NOT RELEASE VERIFIED (CRITICAL GAPS / FRAGMENTED IMPLEMENTATION)

---

## 1. Requirement & Expected Behavior

Enterprise documents require a robust, immutable versioning engine:

- Every document mutation or revision must produce a new, immutable
  `DocumentVersion` record.
- Current active version must be deterministic (`current_version_id` or latest
  `version_number`).
- Version creation must be concurrency-safe (optimistic locking or
  `SELECT FOR UPDATE`) to prevent lost updates or collision crashes.
- Version history and rollback endpoints must be exposed via REST APIs.
- Version metadata must track author identity, timestamp, size, and
  cryptographic checksum.

---

## 2. Implementation Findings

### 2.1 Model Exists But Lacks Multi-Tenant Scoping

- **Location**: `apps/api/src/api/models/schema.py:295-310`
- **Observed Code**:
  ```python
  class DocumentVersion(Base):
      __tablename__ = "document_versions"
      id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
      document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
      version_number: Mapped[int] = mapped_column(Integer, nullable=False)
      storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
      superseded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
      checksum: Mapped[str | None] = mapped_column(String(256))
      size_bytes: Mapped[int | None] = mapped_column(Integer)
      created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
      document: Mapped["Document"] = relationship("Document", back_populates="versions")
      __table_args__ = (UniqueConstraint("document_id", "version_number"),)
  ```
- **Defect**: `DocumentVersion` **does NOT contain a `workspace_id` or
  `tenant_id` column**. Multi-tenant scoping relies entirely on joins to
  `documents`.

### 2.2 Standard Document Upload Completely Bypasses Versioning

- **Location**: `apps/api/src/api/services/document_service.py:92-102`
- **Observed**: When a user uploads a document through `POST /api/v1/documents`,
  the service inserts a row into `documents` and returns. It **NEVER creates a
  `DocumentVersion` row**. Standard documents in Vaeloom possess zero version
  records.

### 2.3 Zero Version Endpoints in the REST Router

- **Location**: `apps/api/src/api/routers/documents.py:1-298`
- **Observed**: The router exposes no versioning endpoints:
  - No `GET /documents/{id}/versions`
  - No `POST /documents/{id}/versions`
  - No `GET /documents/{id}/versions/{version_id}`
  - No `POST /documents/{id}/revert` The versioning subsystem is completely
    unreachable from the public API.

### 2.4 Versioning Confined to Drive Ingestion (`pipeline.py`)

- **Location**: `apps/api/src/api/ingestion/pipeline.py:61-118`
- **Observed**: `DocumentVersion` rows are only created inside `run_pipeline()`.
  Code search across the repository confirms that `run_pipeline()` is invoked
  **only by `DriveAgent` (`drive_agent/handler.py:166`) and unit tests
  (`test_ingestion.py`)**. Neither the manual upload route nor the background
  Temporal workflow (`IngestDocumentWorkflow`) calls `run_pipeline()`.

### 2.5 Non-Atomic Version Increment (Race Condition)

- **Location**: `apps/api/src/api/ingestion/pipeline.py:61-77`
- **Observed Code**:
  ```python
  version_result = await session.execute(
      select(func.max(DocumentVersion.version_number))
      .where(DocumentVersion.document_id == document_id)
  )
  max_version = version_result.scalar() or 0
  next_version = max_version + 1

  new_version = DocumentVersion(
      document_id=document_id,
      version_number=next_version,
      ...
  )
  session.add(new_version)
  ```
- **Defect**: This sequence lacks `with_for_update()` on the parent `Document`
  row. When concurrent uploads or sync webhooks process updates for the same
  document in parallel, both workers read the same `max_version` and collide on
  `UniqueConstraint("document_id", "version_number")`, crashing the worker with
  an unhandled database `IntegrityError`.

---

## 3. Test & Verification Evidence

- **Database Query Inspection**: Checking
  `SELECT COUNT(*) FROM document_versions` after running standard document tests
  yields **0 rows created by `test_documents.py`**.
- **Concurrency Test Analysis**: Attempting 10 parallel uploads to
  `run_pipeline` with the same document ID triggers
  `IntegrityError: duplicate key value violates unique constraint "document_versions_document_id_version_number_key"`.
- **Frontend Inspection**:
  `apps/web/src/app/workspace/[workspaceId]/files/[documentId]/page.tsx` renders
  an action history tab (`documentApi.actions`), which displays path renames and
  archive events, but has no version history, version diffing, or version
  restore controls.

---

## 4. Evaluation Matrix

| Capability                 | Requirement                      | Actual Status                | Verdict  |
| :------------------------- | :------------------------------- | :--------------------------- | :------- |
| **Initial Upload Version** | Create v1 record                 | Bypassed; 0 versions created | **FAIL** |
| **API Version Listing**    | `GET /documents/{id}/versions`   | Route does not exist         | **FAIL** |
| **API Version Upload**     | `POST /documents/{id}/versions`  | Route does not exist         | **FAIL** |
| **Version Revert**         | Restore previous version         | Route does not exist         | **FAIL** |
| **Version Concurrency**    | Optimistic lock / Atomic counter | Non-atomic `MAX + 1`         | **FAIL** |
| **Direct Tenant Column**   | `workspace_id` on version        | Missing (requires join)      | **FAIL** |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (CRITICAL DEFICIT)**  
Document versioning is an isolated orphan subsystem confined to Google Drive
ingestion. Core document uploads do not create versions, no API routes expose
version operations, and version numbering is vulnerable to race conditions.
