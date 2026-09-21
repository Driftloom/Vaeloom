# Module 05: Workspace Security & Authorization Matrix

**Requirement**: Workspace CRUD, Membership Management, Tenant Isolation, and
RBAC Enforcement  
**Auditor**: Principal Security Architect / Zero-Trust Architect  
**Status**: NOT RELEASE VERIFIED (CRITICAL GAPS IDENTIFIED)

---

## 1. Requirement & Expected Behavior

Workspaces must provide strong multi-tenant isolation, role-based access control
(Owner, Admin, Member, Viewer), and complete member lifecycle management
(invite, list, update role, remove). All mutations must be audit-logged and
rate-limited. Tenant boundaries must be enforced at both the application and
database (RLS) layers.

---

## 2. Implementation Findings

### 2.1 Missing `tenant_id` on Workspaces & Workspace Users

- **Location**: `apps/api/src/api/models/schema.py:190-237`
- **Observed**: Neither the `workspaces` table nor the `workspace_users` table
  contains a `tenant_id` foreign key. Tenant binding is resolved solely through
  an indirect join: `workspaces.user_id` -> `users.id` -> `users.tenant_id`.
- **Database RLS**: In `alembic/versions/0036_least_privilege_rls.py:102-110`, a
  security definer function `app_tenant_for_workspace(ws uuid)` resolves tenant
  identity dynamically via SQL join.

### 2.2 Broken Connector Listing Endpoint (Fatal Runtime Bug)

- **Location**: `apps/api/src/api/routers/workspaces.py:125, 134`
- **Observed**:
  ```python
  from ..services.connector_ext_service import mask_sensitive_config
  ...
  for c in connectors:
      resp = ConnectorResponse.model_validate(c)
      if resp.config:
          resp.config = mask_sensitive_config(resp.config)
      res.append(resp)
  ```
- **Defect**: `connector_ext_service.py` exports an instance
  `connector_ext_service = ConnectorExtService()`. There is NO module-level
  function `mask_sensitive_config`. Furthermore, the instance method
  `mask_sensitive_config(config: dict, conn_type: str)` requires two arguments.
  Every call to `GET /api/v1/workspaces/{id}/connectors` throws an unhandled
  `ImportError` resulting in HTTP 500.

### 2.3 Member Invitation Vulnerabilities & Swallowed Exceptions

- **Location**: `apps/api/src/api/routers/workspaces.py:211-274`
  (`POST /workspaces/{id}/invites`)
- **Observed**:
  1. **Unscoped Cross-Tenant Lookup**:
     `select(User).where(User.email == dto.email)` does not filter by caller's
     `tenant_id`. Any user in Tenant A can invite an email belonging to Tenant
     B, attaching Tenant B users to Tenant A workspaces.
  2. **Unvalidated Role Input**: `dto.role` is an unconstrained string
     (`role: str = "member"`). Users can pass `"owner"`, `"superadmin"`, or
     arbitrary string payloads.
  3. **Silent Exception Swallowing**: Lines 248–266 wrap the user insertion and
     commit inside `try: ... except Exception: pass`. If database insertion
     fails (e.g. PostgreSQL RLS violation), the error is swallowed and the
     endpoint returns `201 Created` with `"Invitation successfully sent"`.
  4. **Ghost Success for Non-Existent Users**: If the target user does not
     exist, `target_user` is `None`, no invitation record or email is generated,
     yet HTTP 201 is returned.

### 2.4 RBAC Role Casing Lockout & RLS Conflict

- **Location**: `services/workspace_service.py:55` and
  `routers/workspaces.py:261`
- **Observed**:
  - `POST /invites` inserts `role=dto.role.lower()` (e.g. `"admin"`).
  - `workspace_service.update()` checks
    `WorkspaceUser.role.in_(["ADMIN", "OWNER"])`.
  - In standard SQL, `"admin" IN ('ADMIN', 'OWNER')` evaluates to `FALSE`. An
    invited Admin cannot edit workspace settings.
  - Furthermore, on PostgreSQL with RLS, `0036_least_privilege_rls.py:188-193`
    defines `p_workspaces_write` strictly as `user_id::text = app.user_id`.
    Non-owner admins are rejected at the database RLS layer.

### 2.5 Ineffective Middleware Path Parameter Parsing

- **Location**: `apps/api/src/api/middleware/tenant.py:154-158`
- **Observed**: `path_workspace_id = request.path_params.get("workspace_id")`.
  In Starlette, `BaseHTTPMiddleware` executes before router matching, meaning
  `request.path_params` is always empty `{}`. Unless a client sends
  `X-Workspace-ID` or a query parameter, `TenantMiddleware` never captures the
  workspace from the path.

---

## 3. Test & Verification Evidence

- **Command**:
  `uv run python -m pytest tests/test_workspaces.py -v -o addopts=""`
- **Test ID**:
  `tests/test_workspaces.py::TestWorkspaces::test_list_workspace_connectors_success`
- **Observed Result**: FAILED
  ```text
  ImportError: cannot import name 'mask_sensitive_config' from 'api.services.connector_ext_service'
  (apps/api/src/api/services/connector_ext_service.py)
  ```
- **Command**:
  `uv run python -m pytest tests/integration/test_workspace_isolation.py -v -o addopts=""`
- **Observed Result**: 6 passed in 18.42s. Service queries isolate workspaces by
  `Workspace.user_id == uid`, but cross-tenant invites and admin updates fail.

---

## 4. Workspace Authorization Matrix (Observed vs Enforced)

| Action               |  Owner   |  Admin   |  Member  |  Viewer  | Suspended | Code Enforcement                                      | RLS Enforcement                            |
| :------------------- | :------: | :------: | :------: | :------: | :-------: | :---------------------------------------------------- | :----------------------------------------- |
| **Create Workspace** |   Yes    |   Yes    |   Yes    |   Yes    |   Yes*    | Unrestricted                                          | Permissive (`0036:224`)                    |
| **List Workspaces**  |   Yes    |   Yes    |   Yes    |   Yes    |   Yes*    | Owner OR Member                                       | Matches `p_workspaces_select`              |
| **Get Workspace**    |   Yes    |   Yes    |   Yes    |   Yes    |   Yes*    | Owner OR Member                                       | Matches `p_workspaces_select`              |
| **Update Workspace** |   Yes    | **FAIL** |    No    |    No    |    No     | Owner or `role IN ('ADMIN', 'OWNER')` (fails: casing) | **Owner only** (`p_workspaces_write`)      |
| **Delete Workspace** |   Yes    |    No    |    No    |    No    |    No     | `workspaces.user_id == uid`                           | Matches `p_workspaces_write`               |
| **Invite Member**    |   Yes    | **FAIL** |    No    |    No    |    No     | Owner or `role IN ('ADMIN', 'OWNER')`                 | **Owner only** (`p_workspace_users_write`) |
| **List Connectors**  | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL**  | Crashes with HTTP 500 (`ImportError`)                 | N/A                                        |
| **Remove Member**    |    —     |    —     |    —     |    —     |     —     | **No endpoint**                                       | Not exposed in API                         |
| **Change Role**      |    —     |    —     |    —     |    —     |     —     | **No endpoint**                                       | Not exposed in API                         |
| **List Members**     |    —     |    —     |    —     |    —     |     —     | **No endpoint**                                       | Not exposed in API                         |

_\* Suspended accounts are never checked in workspace endpoints._

---

## 5. Security Metric & Implication

- **Unauthorized Workspace Modifications**: Blocked for non-members (PASS).
- **Admin Collaboration**: Blocked due to casing and RLS conflicts (FAIL).
- **Connector Listing Availability**: 0% availability (HTTP 500 on all calls)
  (FAIL).
- **Cross-Tenant Invitation Hijack**: High risk of unintended cross-tenant user
  linkage (FAIL).
- **Audit Logging**: 0 audit events emitted for workspace creation, update,
  deletion, or invites (FAIL).

**Status**: **NOT RELEASE VERIFIED**
