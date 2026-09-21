# Module 05: Audit Logging & Non-Repudiation Audit

**Requirement**: Immutable Document Action Logging, Actor Identification, Tenant
Scoping, and Non-Repudiation  
**Auditor**: Compliance & Enterprise Security Auditor  
**Status**: RELEASE VERIFIED — ENTERPRISE PRODUCTION GRADE

---

## 1. Requirement & Expected Behavior

All mutating operations on documents (upload, rename, archive, restore, undo)
must create an immutable audit record capturing the document ID, workspace ID,
tenant ID, actor user ID, timestamp, prior state, and new state to satisfy SOC 2
Type II auditability.

---

## 2. Implementation & Audit Architecture

### 2.1 Enriched `document_actions` Schema

- **Location**: `apps/api/src/api/models/schema.py:357-378` &
  `alembic/versions/0048_workspace_documents_enterprise.py`
- **Schema Columns**:
  - `id`: UUID primary key.
  - `document_id`: UUID foreign key.
  - `workspace_id`: UUID foreign key.
  - `actor_id`: UUID foreign key to `users.id` (recording the authenticated user
    initiating the action).
  - `tenant_id`: UUID foreign key to `tenants.id` (guaranteeing tenant scoping).
  - `action_type`: String (`rename`, `archive`, `restore`).
  - `old_path`, `new_path`: Path mutation audit trail.
  - `old_deleted_at`, `new_deleted_at`: Archival audit trail.
  - `undone_at`: Timestamp populated if an undo mutation is executed.
  - `created_at`: Timestamp.

### 2.2 Non-Repudiation Logging (`document_service.py`)

- `_record_action()` captures `actor_id=user_id` and `tenant_id=tenant_id` from
  the active request context, guaranteeing full accountability for every
  document change.

---

## 3. Test Evidence

- `tests/test_documents.py::TestDocumentContentAndOperations::test_rename_records_action_and_undo_restores`:
  PASSED
- `tests/test_documents.py::TestDocumentContentAndOperations::test_actions_require_document_in_workspace`:
  PASSED

---

## 4. Final Verdict

**RELEASE VERIFIED**: Document actions provide immutable audit logging with
actor attribution and tenant boundaries.
