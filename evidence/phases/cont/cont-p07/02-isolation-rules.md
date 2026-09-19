# CONT-P07 — 02 Isolation / Authorization Rules

**Deliverable:** `DEL-CONT-P07-03` (isolation) | **Version:** 1.0 | **Date:**
2026-08-29 | **Owners:** Security Architect + Privacy Engineer

## Scope Keys

Every query must filter `workspace_id` or `tenant_id` — missing filter cannot
leak due to:

- `TenantContext SET app.workspace_id/app.user_id/app.tenant_id`
  (`database.py:30` `set_rls_session_vars`)
- `RLS 42/42 FAIL-CLOSED` (`0010 34 +0019 3 +0020 5` via `787053a`) —
  `USING workspace_id = current_setting('app.workspace_id')`.
- `CHECK CONSTRAINT` `workspace_id NOT NULL` on `documents, entities, memories`.

## Enforcement

- `graph/state.validate_workspace_binding` at `validate_input` + `handoff` +
  `evaluate` (`nodes.py:36`).
- `routers/temporal._verify_workflow_workspace_access` 404 fail-closed on
  `workflow_id` `durable_run:{ws}:{user}:{req}`.
- `security/test_tenant_isolation` 63 tests —
  `User A→workspace B 404→no graph→no side effect`.

## Tests

`graph 8 handoff secret` + `temporal/test_security workspace 404` +
`security 63` all pass on `0dc782d`.
