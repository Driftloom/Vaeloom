# Module 05: Current-State Discovery & Architecture

**Component**: Vaeloom Workspace & Document Management (Module 05)  
**Audit Standard**: Zero-Trust Architecture, Defense-in-Depth, Principle of
Least Privilege  
**Date**: 2026-09-21  
**Status**: AUDIT COMPLETE — NOT RELEASE VERIFIED

---

## 1. System Inventory

The forensic audit inspected the codebase across `apps/api` and `apps/web` to
map the actual implementation vs. the enterprise contract:

### 1.1 Backend Models (`apps/api/src/api/models/schema.py`)

- `Workspace` (lines 190–222): Primary tenant container, foreign key to
  `users.id` (`user_id`). **No direct `tenant_id` column.**
- `WorkspaceUser` (lines 224–237): Membership table with `workspace_id`,
  `user_id`, and `role` (default `"MEMBER"`). **No direct `tenant_id` column.**
- `Document` (lines 266–293): Document table with `workspace_id`,
  `source_connector_id`, `path`, `type`, `raw_storage_key`, `content`
  (`LargeBinary`), `summary`, `retention_policy` (default `"user_driven"`),
  `deleted_at`, `metadata_` (`JSON`).
- `DocumentVersion` (lines 295–310): Version tracking with `document_id`,
  `version_number`, `storage_key`, `superseded_by`, `checksum`, `size_bytes`.
  **Missing `workspace_id` column.**
- `DocumentAction` (lines 312–330): Audit action ledger with `document_id`,
  `workspace_id`, `action_type`, `old_path`, `new_path`, `old_deleted_at`,
  `new_deleted_at`, `undone_at`. **Missing `user_id` / `actor_id` column.**
- **Missing Tables**: No `folders` table, no `document_shares` table, no
  `document_quarantine` table.

### 1.2 Routers & Services (`apps/api/src/api`)

- `routers/workspaces.py` (lines 1–275): CRUD for workspaces, invite members,
  sub-resource listings (agents, memories, connectors, document-actions,
  agent-actions).
- `services/workspace_service.py` (lines 1–94): `create`, `list_for_user`,
  `find_by_id`, `update`, `delete`.
- `routers/documents.py` (lines 1–298): Upload, list, content retrieval, rename,
  archive, restore, actions listing, action undo.
- `services/document_service.py` (lines 1–255): Binary upload streaming,
  workspace listing, document retrieval, rename, archive, restore, action
  tracking, undo.
- `services/storage_service.py` (lines 1–53): S3/MinIO wrapper using synchronous
  `boto3` client with hardcoded `use_ssl=False`.
- `ingestion/pipeline.py` (lines 1–508): Document ingestion, text chunking,
  deduplication, and version creation. **Disconnected from standard
  `POST /documents`.**
- `ingestion/dedup.py` (lines 1–65): Content hash deduplication checking
  `DocumentVersion` globally without workspace scoping.
- `temporal/workflows.py` (`IngestDocumentWorkflow`, lines 196–325):
  Orchestrates parse, extract, write memory, and index graph.
- `temporal/activities.py` (`parse_document`, lines 138–180): Stub activity
  computing SHA-256 slice rather than parsing documents.
- `agents/document_agent/handler.py`: Unwired mock agent returning static
  citations (`doc_arch_01`, `doc_dr_01`).
- `agents/workspace_agent/handler.py`: Unwired mock agent returning static file
  analysis (`f1`..`f4`).

### 1.3 Frontend Web (`apps/web`)

- `apps/web/src/app/workspace/[workspaceId]/files/page.tsx` (1,018 lines): Flat
  document listing, single-file dropzone upload, rename modal, action history
  drawer, ingest trigger.
- `apps/web/src/app/workspace/[workspaceId]/files/[documentId]/page.tsx` (111
  lines): Single document preview and change history.

---

## 2. Actual Document Lifecycle

The declared enterprise lifecycle compared to the actual implemented lifecycle:

```text
DECLARED ENTERPRISE LIFECYCLE:
UPLOAD → VALIDATION → STORAGE → MALWARE SCAN → EXTRACTION → OCR → INDEXING → EMBEDDING → AVAILABLE → VERSION → ARCHIVE → RESTORE → EXPIRE → DELETE

ACTUAL CODE IMPLEMENTATION:
POST /documents
  ↓
Spool to SpooledTemporaryFile (25MB check)
  ↓
Load entire 25MB file into RAM (spooled.read())
  ↓
Compute SHA-256 (no deduplication check)
  ↓
INSERT INTO documents (content: LargeBinary inline in DB)
  ↓
[If storage_mirror_enabled]: S3 put_object (blocking boto3, use_ssl=False, no tenant_id)
  ↓
Auto-dispatch Temporal IngestDocumentWorkflow (background)
  ├─ check_kill_switch (activity)
  ├─ parse_document (STUB: returns SHA-256 string, no OCR, no text extraction)
  ├─ extract_entities (Receives raw binary byte string representation like b'%PDF...'!)
  ├─ write_memory (Writes extracted entities into memories table)
  └─ index_graph (No-op SQL check)
  ↓
Available immediately in GET /documents & GET /documents/{id}/content
```

---

## 3. Forensic Test Verification Baseline

Executed automated test runs:

- `tests/test_workspaces.py`: 1 failed, 20 passed.
  - **Failure**: `test_list_workspace_connectors_success` failed with
    `ImportError: cannot import name 'mask_sensitive_config' from 'api.services.connector_ext_service'`.
- `tests/test_documents.py`: 1 failed, 20 passed.
  - **Failure**: `test_content_requires_workspace_access` failed with
    `assert 403 == 404`.
- `tests/integration/test_workspace_isolation.py`: 6 passed (18.42s).

---

## 4. Key Gaps Discovered

1. **Zero Malware Scanning**: Uninspected binaries saved directly to database.
2. **Member Authorization Lockout**: `_verify_workspace_access` checks only
   `Workspace.user_id == uid`, blocking all `WorkspaceUser` members.
3. **Broken Connector Endpoint**: Fatal `ImportError` on `workspaces.py:125`.
4. **Stored XSS**: HTML files served with `Content-Disposition: inline` and
   `Content-Type: text/html`.
5. **No Folders / Directory Structure**: Virtual strings only; no folder
   entities or ACLs.
6. **No Versions in REST API**: `DocumentVersion` is never populated by
   `POST /documents`.
7. **Cross-Tenant Hash Collision**: `dedup.py` queries unscoped
   `DocumentVersion`.
8. **Orphaned S3 Files on GDPR Delete**: Deletion scripts remove DB rows but
   leave cloud storage intact.
9. **Archived Document Leakage**: Soft-deleted files remain in vector similarity
   search.
10. **Mocked Agents**: `DocumentAgent` and `WorkspaceAgent` execute zero
    database queries.
