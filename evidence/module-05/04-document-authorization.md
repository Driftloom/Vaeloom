# Module 05: Document Authorization & IDOR/BOLA Audit

**Requirement**: Granular Document Authorization, RBAC Enforcement, IDOR/BOLA
Protection, Member Collaboration, and Content Serving Security  
**Auditor**: Principal Security Architect / Zero-Trust Architect  
**Status**: NOT RELEASE VERIFIED (CRITICAL AUTHORIZATION FAILURE)

---

## 1. Requirement & Expected Behavior

Document access must adhere strictly to zero-trust principles:

1. Every access boundary must independently verify tenant context, workspace
   membership, and role permissions.
2. Workspace owners, admins, and members must have authorized access according
   to an explicit RBAC matrix. Viewers must have read-only access and be barred
   from upload, rename, archive, restore, and undo.
3. Cross-tenant and cross-workspace access must be rejected with zero data
   leakage.
4. Content serving must enforce safe download dispositions (`attachment`),
   sanitize filenames against header injection, and prevent Stored Cross-Site
   Scripting (XSS).

---

## 2. Implementation Findings

### 2.1 Critical Member Authorization Lockout (`_verify_workspace_access`)

- **Location**: `apps/api/src/api/routers/documents.py:44-55`
- **Observed Code**:
  ```python
  async def _verify_workspace_access(workspace_id: str, user_id: str, db: AsyncSession) -> None:
      """Verify user has access to this workspace. Raises 404 if not found/owned."""
      try:
          from uuid import UUID
          wid = UUID(workspace_id)
          uid = UUID(user_id)
      except (ValueError, TypeError):
          raise HTTPException(status_code=400, detail="Invalid ID format")
      result = await db.execute(select(Workspace).where(Workspace.id == wid, Workspace.user_id == uid))
      if not result.scalar_one_or_none():
          raise HTTPException(status_code=404, detail="Workspace not found")
  ```
- **Vulnerability**: Line 52 queries
  `select(Workspace).where(Workspace.id == wid, Workspace.user_id == uid)`. It
  **strictly validates that `user_id` is the creator/owner of the workspace**.
  It completely ignores the `WorkspaceUser` membership table! **Impact**: Every
  endpoint in `documents.py` invokes `_verify_workspace_access`. Consequently,
  **invited workspace admins, members, and viewers are locked out of all
  document operations** with HTTP 404. Workspace document collaboration is
  completely broken.

### 2.2 Complete Absence of Role-Based Access Control (RBAC)

- **Location**: `apps/api/src/api/routers/documents.py:61-298`
- **Observed**: The document router does not query user roles or enforce role
  constraints on any operation.
  - If a user passes `_verify_workspace_access`, they are granted full write
    permissions (upload, rename, archive, restore, undo).
  - Even if member access were fixed, a user with `role="viewer"` would be able
    to archive, rename, and undo document actions because no role check exists.

### 2.3 Stored Cross-Site Scripting (XSS) via Inline HTML Serving

- **Location**: `apps/api/src/api/routers/documents.py:191-196`
- **Observed Code**:
  ```python
  filename = path.rsplit("/", 1)[-1] or path
  return Response(
      content=content,
      media_type=CONTENT_TYPES.get(doc_type, "application/octet-stream"),
      headers={"Content-Disposition": f'inline; filename="{filename}"'},
  )
  ```
- **Vulnerability**:
  1. `CONTENT_TYPES["html"]` maps to `text/html; charset=utf-8`.
  2. The response header explicitly specifies `Content-Disposition: inline`.
  3. When an attacker uploads an `.html` or `.svg` file containing malicious
     `<script>` tags, navigating to the content URL renders the page directly in
     the victim's browser under the application origin. The script runs with
     full access to session cookies, localStorage, and API endpoints.

### 2.4 Header Parameter Injection & CRLF Risks

- **Location**: `apps/api/src/api/routers/documents.py:195`
- **Observed**: `filename` is interpolated directly into
  `f'inline; filename="{filename}"'` without escaping internal double quotes. A
  filename containing quotes (e.g. `report"; filename="evil.exe`) breaks out of
  the parameter enclosure.

---

## 3. Test & Verification Evidence

- **Command**:
  `uv run python -m pytest tests/test_documents.py -v -o addopts=""`
- **Test ID**:
  `tests/test_documents.py::TestDocumentContentAndOperations::test_content_requires_workspace_access`
- **Observed Result**: FAILED
  ```text
  assert 403 == 404
  where 403 = <Response [403 Forbidden]>.status_code
  ```
- **Analysis**: `TenantMiddleware` returned 403 Forbidden when a user attempted
  to access another workspace's document, but the test asserted 404. Within a
  valid workspace, non-owner members are rejected with 404 by
  `_verify_workspace_access`.

---

## 4. Document Authorization Matrix

| Action               | Owner |       Admin       |      Member       |      Viewer       | Cross-Tenant User | Code Enforcement                  |
| :------------------- | :---: | :---------------: | :---------------: | :---------------: | :---------------: | :-------------------------------- |
| **Upload Document**  | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **List Documents**   | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **Get Content**      | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **Rename Document**  | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **Archive Document** | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **Restore Document** | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |
| **Undo Action**      | ALLOW | **LOCKOUT (404)** | **LOCKOUT (404)** | **LOCKOUT (404)** |  DENY (403/404)   | Broken `_verify_workspace_access` |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (CRITICAL AUTHORIZATION & COLLABORATION DEFECT)**  
Workspace member access is completely non-functional; Viewer role restrictions
do not exist; and file content retrieval is exposed to Stored XSS attacks.
