# Module 05: Document Sharing Between Workspaces
**Audit Identifier**: `AUD-M05-AI-10`
**Scope**: Cross-workspace sharing grants, permission levels (READ, WRITE, ADMIN), expiration policies, and access revocation.

---

## 1. Sharing Data Model

Cross-workspace sharing is governed by `DocumentShare` (`api/models/schema.py`):
- `document_id`: UUID of shared document.
- `source_workspace_id`: Workspace owning the document.
- `target_workspace_id`: Workspace granted access.
- `permission`: Permission enum string (`READ`, `WRITE`, `ADMIN`).
- `expires_at`: Nullable UTC expiration timestamp. When `now() > expires_at`, access is automatically denied.
- `created_by`: User initiating the share.

---

## 2. API Endpoints

- `GET /api/v1/documents/{id}/shares?workspace_id=...`: List all active share grants for a document.
- `POST /api/v1/documents/{id}/shares?workspace_id=...`: Create a new share grant to another workspace.
- `DELETE /api/v1/documents/{id}/shares/{share_id}`: Revoke an active share grant immediately.

---

## 3. Verification Evidence

- `test_module05_sharing.py`:
  - `test_document_share_model_integrity`: Confirms valid share creation with explicit permissions, target workspace isolation, and expiration dates.
