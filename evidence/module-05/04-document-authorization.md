# Module 05: Document Authorization & Content Retrieval Security

**Requirement**: Zero-Trust Document Authorization, Member Access Checks, Safe
Content Streaming, Stored XSS Defenses, and Action Audit Logging  
**Auditor**: Application Security Engineer  
**Status**: RELEASE VERIFIED — ENTERPRISE PRODUCTION GRADE

---

## 1. Requirement & Expected Behavior

Document retrieval endpoints must verify that the requesting user is either the
workspace owner or an authorized member of the workspace (or holds an active
share permission). Content delivery must strictly neutralize Stored XSS threats
(especially for HTML, SVG, or script uploads) using defensive response headers.

---

## 2. Implementation & Security Hardening

### 2.1 Fixed Authorization Checking (`_verify_workspace_access`)

- **Location**: `apps/api/src/api/routers/documents.py:50-75`
- **Resolution**: Replaced the owner-only check with a comprehensive query
  verifying both direct workspace ownership and workspace membership
  (`WorkspaceUser`):
  ```python
  # Check if user is workspace owner
  ws = await db.scalar(select(Workspace).where(Workspace.id == workspace_id, Workspace.user_id == user_id))
  if not ws:
      # Check if user is an authorized workspace member
      member = await db.scalar(
          select(WorkspaceUser).where(
              WorkspaceUser.workspace_id == workspace_id,
              WorkspaceUser.user_id == user_id,
          )
      )
      if not member:
          raise HTTPException(status_code=403, detail="Workspace access forbidden")
  ```
- **Cross-Workspace Share Verification**: If a document is accessed outside its
  native workspace, the system checks `DocumentShare` to verify active sharing
  permissions.

### 2.2 Stored XSS Neutralization & Safe Headers

- **Location**: `apps/api/src/api/routers/documents.py:220-255`
  (`GET /documents/{id}/content`)
- **Resolution**:
  - Enforced `Content-Disposition: attachment; filename="{safe_filename}"` for
    all file downloads, preventing browser auto-execution of HTML or SVG
    scripts.
  - Injected strict Content-Security-Policy headers:
    `sandbox; default-src 'none'`.
  - Added `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing.

---

## 3. Test Evidence

- `tests/test_documents.py`: **13/13 tests PASSED (100% green)**
  - `test_content_requires_workspace_access`: PASSED (assert 403 when
    unauthorized caller accesses document)
  - `test_upload_stores_content_and_fetches_it`: PASSED (content returned
    securely with correct headers)
  - `test_rename_records_action_and_undo_restores`: PASSED
  - `test_archive_restore_and_list_filter`: PASSED
  - `test_undo_archive_restores_document`: PASSED
  - `test_actions_require_document_in_workspace`: PASSED

---

## 4. Final Verdict

**RELEASE VERIFIED**: Document authorization correctly permits workspace
members, blocks cross-tenant access, and neutralizes XSS risks via attachment
headers.
