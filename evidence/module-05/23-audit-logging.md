# Module 05: Audit Logging & Non-Repudiation Audit

**Requirement**: Comprehensive Security Audit Trail, Tamper-Evident Action
History, Actor Attribution, and Non-Repudiation  
**Auditor**: Enterprise Compliance Engineer / Security Architect  
**Status**: NOT RELEASE VERIFIED (SIGNIFICANT AUDIT LOGGING GAPS)

---

## 1. Requirement & Expected Behavior

Enterprise regulatory compliance (SOC 2, ISO 27001, HIPAA §164.312(b)) mandates
that every security-relevant event produces an immutable audit record:

- **Workspace Events**: `workspace.created`, `workspace.updated`,
  `workspace.deleted`, `workspace.member_invited`, `workspace.member_removed`.
- **Document Events**: `document.uploaded`, `document.viewed`,
  `document.downloaded`, `document.updated`, `document.archived`,
  `document.restored`, `document.undone`, `document.deleted`.
- **Mandatory Audit Fields**: `event_id`, `tenant_id`, `workspace_id`,
  `document_id`, `actor_id`, `action`, `timestamp`, `ip_address`, `trace_id`,
  `result`.
- Document contents and secrets must never be logged.

---

## 2. Implementation Findings

### 2.1 Complete Absence of Audit Events in Workspace Service

- **Location**: `apps/api/src/api/routers/workspaces.py` and
  `services/workspace_service.py`
- **Observed**: Grep search for `record_event` or `audit_service` in
  `routers/workspaces.py` and `services/workspace_service.py` yields **0
  matches**.
  - Creating a workspace emits 0 audit events.
  - Renaming or changing workspace settings emits 0 audit events.
  - Deleting a workspace emits 0 audit events.
  - Inviting a member emits 0 audit events.

### 2.2 Complete Absence of Audit Events in Document Service

- **Location**: `apps/api/src/api/routers/documents.py` and
  `services/document_service.py`
- **Observed**: Grep search for `record_event` or `audit_service` in
  `routers/documents.py` and `services/document_service.py` yields **0
  matches**. None of the standard document actions emit events to the
  centralized `audit_events` table.

### 2.3 Critical Attribute Omissions in `DocumentAction` Ledger

- **Location**: `apps/api/src/api/models/schema.py:312-327` (`DocumentAction`)
- **Observed Code**:
  ```python
  class DocumentAction(Base):
      __tablename__ = "document_actions"
      id: Mapped[uuid.UUID]
      document_id: Mapped[uuid.UUID]
      workspace_id: Mapped[uuid.UUID]
      action_type: Mapped[str]
      old_path: Mapped[str | None]
      new_path: Mapped[str | None]
      old_deleted_at: Mapped[datetime | None]
      new_deleted_at: Mapped[datetime | None]
      undone_at: Mapped[datetime | None]
      created_at: Mapped[datetime]
  ```
- **Auditing Defects**:
  1. **No Actor Identity**: `DocumentAction` **has NO `user_id` or `actor_id`
     column**! When a document is renamed or archived, there is no record of who
     performed the action.
  2. **No Tenant Identity**: `DocumentAction` **has NO `tenant_id` column**.
  3. **Uploads are Unrecorded**: Initial document uploads do NOT create a
     `DocumentAction` record.
  4. **Views & Downloads are Unrecorded**: Content retrieval emits zero action
     records.
  5. **Undo Actions are Invisible**: Undoing an action mutates the document, but
     does not record a new compensation entry in `DocumentAction`.

---

## 3. Evaluation Matrix

| Event Name                | Centralized Audit Event (`audit_events`) | Local Action Ledger (`document_actions`) |      Actor Attributed      | Status   |
| :------------------------ | :--------------------------------------: | :--------------------------------------: | :------------------------: | :------- |
| **`workspace.created`**   |                  ❌ No                   |                   N/A                    |           ❌ No            | **FAIL** |
| **`workspace.updated`**   |                  ❌ No                   |                   N/A                    |           ❌ No            | **FAIL** |
| **`workspace.deleted`**   |                  ❌ No                   |                   N/A                    |           ❌ No            | **FAIL** |
| **`workspace.invited`**   |                  ❌ No                   |                   N/A                    |           ❌ No            | **FAIL** |
| **`document.uploaded`**   |                  ❌ No                   |                  ❌ No                   |           ❌ No            | **FAIL** |
| **`document.viewed`**     |                  ❌ No                   |                  ❌ No                   |           ❌ No            | **FAIL** |
| **`document.downloaded`** |                  ❌ No                   |                  ❌ No                   |           ❌ No            | **FAIL** |
| **`document.renamed`**    |                  ❌ No                   |                  ✅ Yes                  | ❌ No (`actor_id` missing) | **FAIL** |
| **`document.archived`**   |                  ❌ No                   |                  ✅ Yes                  | ❌ No (`actor_id` missing) | **FAIL** |
| **`document.restored`**   |                  ❌ No                   |                  ✅ Yes                  | ❌ No (`actor_id` missing) | **FAIL** |
| **`document.undone`**     |                  ❌ No                   |                  ❌ No                   |           ❌ No            | **FAIL** |

---

## 4. Compliance Verdict

**NOT RELEASE VERIFIED (NON-COMPLIANT)**  
The module fails non-repudiation and audit logging standards. Critical mutations
generate zero audit logs, and internal action tables fail to record actor
identities.
