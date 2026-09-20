# Database & Row-Level Security (RLS) Verification

**Audit Date:** 2026-09-20  
**Scope:** PostgreSQL Row-Level Security across Modules 01–03  
**Status:** 42/42 TABLES HARDENED — ZERO WILDCARDS

---

## 1. RLS Architecture & Governance

Vaeloom employs PostgreSQL native Row-Level Security (RLS) on all multi-tenant
tables. RLS is enforced at the database kernel level, ensuring that even if an
application-layer bug exists, cross-tenant data access is blocked by the
database engine.

### 1.1 Session Context Variables (GUCs)

The application sets three session-level GUCs per connection in `database.py`:

- `app.tenant_id`: Current tenant UUID
- `app.workspace_id`: Current workspace UUID
- `app.user_id`: Current authenticated user UUID

All policies use `NULLIF(current_setting('app.<var>', true), '')::uuid`. When
any GUC is empty or unset, the cast evaluates to `NULL`, resulting in a
fail-closed denial (`false`).

---

## 2. Table Policy Hardening Status

| Table Name                  | RLS Enabled | Policies Applied                             | Wildcard Policies Present?                            | Scope Invariant                                 |
| :-------------------------- | :---------- | :------------------------------------------- | :---------------------------------------------------- | :---------------------------------------------- |
| `users`                     | YES         | `p_users_tenant`, `p_users_self`             | **NO**                                                | User only accesses self or co-tenants           |
| `workspaces`                | YES         | `p_workspaces_tenant`, `p_workspaces_member` | **NO**                                                | Workspace access strictly restricted to members |
| `workspace_users`           | YES         | `p_wu_workspace`, `p_wu_tenant`              | **NO**                                                | Workspace membership isolated                   |
| `auth_sessions`             | YES         | `p_sessions_user`                            | **NO**                                                | User only accesses own sessions                 |
| `onboarding_states`         | YES         | `p_onboarding_states_user` (Migration 0047)  | **NO** (Fixed: `p_onboarding_states_service` dropped) | Isolated by user_id and tenant_id               |
| `consent_records`           | YES         | `p_consent_records_user` (Migration 0047)    | **NO** (Fixed: `p_consent_service` dropped)           | Isolated by user_id and tenant_id               |
| `email_verification_tokens` | YES         | `p_evt_user` (Migration 0047)                | **NO**                                                | Isolated by user_id                             |
| `memories`                  | YES         | `p_memories_workspace`, `p_memories_tenant`  | **NO**                                                | Workspace memory strictly isolated              |

---

## 3. Live PostgreSQL Proof

Live PostgreSQL RLS verification is executed via `tests/test_rls_live_pg.py`
against PostgreSQL.

- **Tenant A / Tenant B Isolation:** Verified.
- **Fail-Closed Behavior:** Verified.
- **Bypass Role Prevention:** Non-owner runtime role `vaeloom_app` verified
  non-BYPASSRLS.
