# Module 05: Regression & Prior Vulnerability Audit

**Requirement**: Verification of Known Regressions, Prior Security Fixes, and
API Stability  
**Auditor**: QA / Regression Specialist  
**Status**: NOT RELEASE VERIFIED (ACTIVE REGRESSIONS IDENTIFIED)

---

## 1. Requirement & Expected Behavior

No previously remediated vulnerabilities or stable routes may experience
regression. All unit, integration, and security test suites covering workspaces
and documents must execute with 100% pass rates.

---

## 2. Implementation Findings & Active Regressions

### 2.1 Active Regression in `routers/workspaces.py`

- **Location**: `apps/api/src/api/routers/workspaces.py:125`
- **Defect**: An unvalidated code change introduced an import statement for a
  non-existent function:
  ```python
  from ..services.connector_ext_service import mask_sensitive_config
  ```
- **Observed Failure**: Running `pytest tests/test_workspaces.py` fails with:
  ```text
  ImportError: cannot import name 'mask_sensitive_config' from 'api.services.connector_ext_service'
  ```
  This is a critical regression crashing production instances when calling
  `GET /workspaces/{id}/connectors`.

### 2.2 Status Code Assertion Regression in `test_documents.py`

- **Location**: `apps/api/tests/test_documents.py:111`
- **Defect**: The test asserts `assert res.status_code == 404` when accessing
  another user's workspace document. However, `TenantMiddleware` in
  `middleware/tenant.py` returns `HTTP 403 Forbidden` for cross-workspace query
  parameters.
- **Observed Failure**:
  ```text
  FAILED tests/test_documents.py::TestDocumentContentAndOperations::test_content_requires_workspace_access
  assert 403 == 404
  ```

### 2.3 Member Access Regression

- **Location**: `apps/api/src/api/routers/documents.py:44-55`
- **Defect**: `_verify_workspace_access` was implemented using only
  `select(Workspace).where(Workspace.user_id == uid)`. While
  `apps/api/src/api/routers/agents.py:182-188` correctly queries both
  `Workspace` and `WorkspaceUser`, `documents.py` omitted the `WorkspaceUser`
  lookup, creating an active regression where invited workspace members cannot
  access documents.

---

## 3. Test Suite Summary

- **Total Tests Run**: 42
- **Passing Tests**: 40
- **Failing Tests**: 2
  1. `tests/test_workspaces.py::TestWorkspaces::test_list_workspace_connectors_success`
     (ImportError)
  2. `tests/test_documents.py::TestDocumentContentAndOperations::test_content_requires_workspace_access`
     (403 vs 404)

---

## 4. Verdict

**NOT RELEASE VERIFIED (ACTIVE REGRESSIONS PRESENT)**  
Two active test failures exist in the workspace and document test suites,
including a fatal import error on the connectors route.
