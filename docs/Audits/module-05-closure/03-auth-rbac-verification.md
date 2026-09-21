# Module 05 — Authentication & RBAC Verification Matrix

Date: 2026-09-22 Auditor: Principal Security Architect

## 1. Role-Based Access Control (RBAC) Matrix

Every document operation enforces role tiers verified through integration tests:

| Role          | Upload Document  |  List / Search   | Download Content | Rename Document  | Archive Document | Restore Document |   Create Share   |
| ------------- | :--------------: | :--------------: | :--------------: | :--------------: | :--------------: | :--------------: | :--------------: |
| **Owner**     | ✅ Allowed (201) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (201) |
| **Admin**     | ✅ Allowed (201) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (201) |
| **Editor**    | ✅ Allowed (201) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (200) | ✅ Allowed (201) |
| **Member**    | ✅ Allowed (201) | ✅ Allowed (200) | ✅ Allowed (200) | ❌ Denied (403)  | ❌ Denied (403)  | ❌ Denied (403)  | ❌ Denied (403)  |
| **Viewer**    | ❌ Denied (403)  | ✅ Allowed (200) | ✅ Allowed (200) | ❌ Denied (403)  | ❌ Denied (403)  | ❌ Denied (403)  | ❌ Denied (403)  |
| **Anonymous** | ❌ Denied (401)  | ❌ Denied (401)  | ❌ Denied (401)  | ❌ Denied (401)  | ❌ Denied (401)  | ❌ Denied (401)  | ❌ Denied (401)  |

## 2. Cross-Workspace Share Permissions

| Share Permission |   Read Content   |  List Versions   |  Mutate / Rename   |  Archive Document  |  Restore Version   |
| ---------------- | :--------------: | :--------------: | :----------------: | :----------------: | :----------------: |
| **Read**         | ✅ Allowed (200) | ✅ Allowed (200) | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) |
| **Write**        | ✅ Allowed (200) | ✅ Allowed (200) |  ✅ Allowed (200)  |  ✅ Allowed (200)  |  ✅ Allowed (200)  |
| **Admin**        | ✅ Allowed (200) | ✅ Allowed (200) |  ✅ Allowed (200)  |  ✅ Allowed (200)  |  ✅ Allowed (200)  |

## 3. Verified Test Assertions

- `tests/integration/module05/test_rbac_matrix.py::test_viewer_cannot_upload` ->
  PASSED (403 returned).
- `tests/integration/module05/test_rbac_matrix.py::test_viewer_can_read_document_content`
  -> PASSED (200 returned).
- `tests/integration/module05/test_rbac_matrix.py::test_read_only_share_cannot_rename_or_archive`
  -> PASSED (403 returned).
- `tests/adversarial/module05/test_privilege_escalation.py::test_read_share_user_cannot_restore_version`
  -> PASSED (403 raised).
