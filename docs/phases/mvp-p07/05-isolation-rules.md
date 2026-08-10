# MVP-P07 — 05. Isolation Rules (DEL-MVP-P07-03)

> Owner: Security Architect · Invariant: **a missing scope key can never leak
> data** (prompt §12.3). Defense-in-depth: app-level filters (existing) + RLS
> (new, ADR-023).

## 1. Scope-key model

- Every artifact row carries `tenant_id` + `workspace_id` (both UUID NOT NULL on
  new/affected tables — migration 0005 enforces composite).
- Runtime identity: `SET app.tenant_id`, `SET app.workspace_id` per request (set
  from verified JWT claims; never from client input).
- App-level: middleware + service filters (exists — `data_isolation.py`,
  `tenant_repository.py`).

## 2. RLS policies (Postgres)

Pattern per scoped table T:

```sql
ALTER TABLE T ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_T_workspace ON T
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid
         AND tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Applied to (MVP-scoped tables): workspaces, workspace_users, documents,
document_versions, memories, memory_records, resumes, applications,
approval_request, approval_decision, schedule_events, connectors, events,
event_subscriptions, dead_letter_events, notifications, agent_executions,
agent_actions, api_keys, auth_sessions, usage_records, webhooks,
webhook_deliveries, subscriptions, integrations, plugins, plugin_executions,
agent_schedules, embeddings, entities, relationships.

| Table             | Policy notes                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------- |
| users/tenants     | NOT RLS (global identity) — access via authz only                                        |
| audit events      | RLS on workspace scope; operator review path via separate role (enterprise-gated router) |
| telemetry/metrics | no personal data; not RLS-scoped (dashboard role)                                        |

## 3. Grants (least privilege)

| Role                               | Grants                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| `app` (runtime)                    | SELECT/INSERT/UPDATE/DELETE on scoped tables (RLS active); no DDL |
| `migrator`                         | DDL; no app connection in prod                                    |
| `reporter` (read-only, enterprise) | SELECT where required; RLS applies                                |

## 4. Invariant tests (P14 isolation suite)

1. Cross-workspace read/write blocked (RLS alone, no app filter).
2. App filter + RLS both on → allowed only own workspace.
3. Unset session vars → zero rows returned (fail-closed), not error-leak.
4. Composite constraint violation rejected (missing tenant/workspace).
5. SQLite test harness: RLS mocked — production Postgres-only assertions run in
   CI integration job against real Postgres (docker-compose).
6. Erasure + projection rebuild respect isolation (no cross-workspace ghost
   rows).

## 5. Acceptance mapping

NFR-15/h15 (isolation), FR-h60..66 (authz), RISK-P05-03 (cross-tenant leak) →
closed only by passing suite + RLS evidence at P13/P14.
