# CONT-P08 — 03 AuthN / AuthZ / Idempotency

**Deliverable:** `DEL-CONT-P08-04` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Security Architect

## Identity & Authorization

- `JWT` `HS256` `32+` `require exp,sub` (`middleware/auth.py:48`
  `validate_settings` fail-fast).
- `TenantContext` `ContextVar` + `SET LOCAL app.tenant_id/workspace_id/user_id`
  (`database.py:23` `middleware/tenant.py:59` fail-closed, `SET LOCAL`
  PgBouncer-safe).
- `RLS 42/42 FORCE` `0010 34 +0019 3 +0020 5` `BYPASSRLS` revoked
  (`alembic 0010/0019/0020`), `FORCE` prevents owner bypass.
- `check_permission` scopes `agent_allowed_scopes = [required_scope for tool]`
  least-privilege (`loop.py:483` + `graph/nodes:369`).
- Never trust `tenant/workspace` from `path/body` alone —
  `JWT > path_param > header` (`tenant.py:90`) + DB `WorkspaceUser` verify
  `routers/temporal._verify` 404.

## Idempotency & Approval Tokens

- `Idempotency-Key` `sha256(ws:req:tool:params)`
  `UNIQUE(workspace_id,idempotency_key)` (`models/schema.py:648` +
  `nodes.tool_execute 4KB`).
- Consequential writes `approval_gated 13+dynamic` `policy_check forged→pending`
  (`graph/nodes:357` `test_tool_closure`), `ApprovalWorkflow`
  `3600s waitCondition` `REJECT_DUPLICATE` `approval:{ws}:{id}`.
- Payload-bound `validate_no_secrets` 35 keys + `20KB` (`temporal/validation`)
  at `routers/temporal 20KB` + `DurableAgentRequest` IDs only.

---

_Version 1.0 2026-08-29 — `security/test_tenant_isolation` 63 +
`graph handoff` 8._
