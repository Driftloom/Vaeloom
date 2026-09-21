# Module 05: Authentication & RBAC Governance
**Audit Identifier**: `AUD-M05-AI-04`
**Scope**: Workspace membership, roles, permissions matrix, and member invitation flows.

---

## 1. Role-Based Access Control Matrix

Workspace membership is governed by `WorkspaceUser` (`api/models/schema.py`) supporting four distinct roles:

| Role | Document Read | Document Upload / Edit | Folder Management | Version Restore | Document Share | Workspace Admin / Delete |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Owner** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Admin** | Yes | Yes | Yes | Yes | Yes | Settings only |
| **Member** | Yes | Yes | Yes | Yes | Target WS only | No |
| **Viewer** | Yes | No | No | No | No | No |

---

## 2. Invitation & Member Onboarding Security

- **Endpoint**: `POST /api/v1/workspaces/{id}/invites`
- **Security Invariant**: Invitations can only be dispatched by an authenticated member with `owner` or `admin` role.
- **Fail-Closed Verification**: Anonymous or unauthenticated requests are rejected with `401 Unauthorized` or `403 Forbidden` (verified in `test_module05_auth.py`).
- **Cross-Tenant Guard**: User emails belonging to a foreign tenant are blocked from cross-tenant invitation unless explicit B2B federation is active.
