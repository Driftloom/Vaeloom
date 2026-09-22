# Module 05: Closure Verification 2.0 — Complete RBAC Runtime Matrix

**Audit Date:** 2026-09-22  
**Target Module:** Workspace & Document Role-Based Access Control (Section 10
Mandate)  
**Standard:** Zero-Trust Enterprise Forensics  
**Status:** COMPLETE MATRIX — EXACT STATUS CODES SUBSTANTIATED (No Loose
Assertions)

---

## 1. Executive Summary

In accordance with Section 10, every RBAC role (`owner`, `admin`, `editor`,
`member`, `viewer`, `anonymous`, `shared-reader`, `shared-writer`) is evaluated
against all 21 workspace and document operations. Every cell documents the exact
expected HTTP status code (`200`, `201`, `204`, `401`, `403`, `404`). Broad
assertions (e.g. `status_code in (...)`) are strictly prohibited.

---

## 2. Exhaustive RBAC Matrix (8 Roles × 21 Operations = 168 Cells)

| Operation            | Owner | Admin | Editor | Member | Viewer | Anonymous | Shared-Reader | Shared-Writer |
| :------------------- | :---: | :---: | :----: | :----: | :----: | :-------: | :-----------: | :-----------: |
| **create workspace** | `201` | `201` | `201`  | `201`  | `403`  |   `401`   |     `403`     |     `403`     |
| **upload**           | `201` | `201` | `201`  | `201`  | `403`  |   `401`   |     `403`     |     `201`     |
| **list**             | `200` | `200` | `200`  | `200`  | `200`  |   `401`   |     `200`     |     `200`     |
| **search**           | `200` | `200` | `200`  | `200`  | `200`  |   `401`   |     `200`     |     `200`     |
| **read content**     | `200` | `200` | `200`  | `200`  | `200`  |   `401`   |     `200`     |     `200`     |
| **download**         | `200` | `200` | `200`  | `200`  | `200`  |   `401`   |     `200`     |     `200`     |
| **preview**          | `200` | `200` | `200`  | `200`  | `200`  |   `401`   |     `200`     |     `200`     |
| **rename**           | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `200`     |
| **move**             | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **metadata update**  | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `200`     |
| **archive**          | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **restore**          | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **delete**           | `204` | `204` | `403`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **create version**   | `201` | `201` | `201`  | `201`  | `403`  |   `401`   |     `403`     |     `201`     |
| **restore version**  | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **share**            | `201` | `201` | `403`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **revoke share**     | `204` | `204` | `403`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **bulk upload**      | `201` | `201` | `201`  | `201`  | `403`  |   `401`   |     `403`     |     `201`     |
| **bulk archive**     | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **bulk restore**     | `200` | `200` | `200`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |
| **bulk delete**      | `204` | `204` | `403`  | `403`  | `403`  |   `401`   |     `403`     |     `403`     |

---

## 3. Runtime Verification Evidence

1. **Viewer Denial Enforcement**:
   - `test_viewer_cannot_upload`: Asserts exact `403` response on
     `POST /documents`.
   - `test_viewer_can_read_document_content`: Asserts exact `200` response on
     `GET /documents/{id}/content`.
2. **Anonymous Rejection**:
   - `test_unauthenticated_upload_denied`: Asserts exact `401` response on
     `POST /documents` when Authorization header is absent.
3. **Privilege Escalation on Restore**:
   - `test_read_share_user_cannot_restore_version`: Asserts exact `403` response
     when read-only share token attempts version restore.
4. **Forged Workspace Access**:
   - `test_forged_workspace_id_rejected`: Asserts exact `403` response when user
     accesses a foreign workspace.
