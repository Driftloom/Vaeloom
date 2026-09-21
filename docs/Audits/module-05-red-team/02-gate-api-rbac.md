# Gate 02 — Real API E2E (all roles)

## Verdict: FAIL

## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| G02-1 | P0 | `apps/api/src/api/routers/documents.py:129` | The `_verify_workspace_access` function supports a `required_roles` argument, but it is never passed when called by the endpoints. All workspace members (even Viewers) can perform all actions (e.g., upload, delete). |
| G02-2 | P1 | `apps/api/tests/test_module05_auth.py:15` | Tests use `ASGITransport(app=app)` to directly call endpoints instead of testing a running HTTP API server. |
| G02-3 | P0 | `apps/api/tests/test_module05_auth.py:18-21` | Role-based permission boundaries (Viewer vs Owner/Admin) are not actually tested. The test `test_workspace_rbac_permissions` only verifies that a request without auth returns a 401. |

## Evidence
`apps/api/src/api/routers/documents.py` line 129:
`await _verify_workspace_access(workspace_id, _user_id(current_user), db)`

`apps/api/tests/test_module05_auth.py` line 19-21:
```python
        # Request without auth must be 401
        res = await ac.get(f"/api/v1/workspaces/{ws_id}")
        assert res.status_code == 401
```

## Conclusion
API RBAC is fundamentally broken as role checks are bypassed on document endpoints. The tests are shallow, using an ASGI transport and failing to verify actual role enforcement.
