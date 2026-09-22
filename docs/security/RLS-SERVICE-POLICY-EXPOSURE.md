# RLS Service-Policy Exposure (found 2026-09-22, Loop 3 audit)

> **Status:** CONFIRMED by migration-chain reading (no live PG in this env to
> re-prove at runtime — see §5). **Severity:** High (defense-in-depth
> degradation) / **Exploitability:** Low (requires app DB credentials).

## 1. Mechanism

Postgres combines multiple permissive RLS policies with **OR**: a role needs to
satisfy only ONE policy to see a row. Migration `0047` (Supabase hardening)
correctly narrowed formerly-public `USING (true)` policies to
`TO service_role, postgres, vaeloom_app` — but `vaeloom_app` is the SAME role
that serves all user traffic. Net effect: on any PG where 0047 applied, the app
role matches a `USING (true)` policy on ~25 tables and the restrictive
workspace/tenant policies on those tables are dead letters **for that role**.

Concretely: anyone holding the app DB credentials (or code running with them — a
compromised dependency, a SQLi if one ever lands) can read/write ALL rows on
these tables with zero tenant scoping. The live boundary on these tables is
**application-layer scoping only** (TenantMiddleware GUCs + service filters),
which is real and tested — but it is one layer, not two.

## 2. Inventory (all `USING (true)` grants covering `vaeloom_app`)

| #     | Table                                                                                                      | Policy (migration)                                             | Why it exists                | Sharp edge                           |
| ----- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- | ------------------------------------ |
| 1     | `users`                                                                                                    | `p_users_service` (0047:76)                                    | auth lookups pre/post-login  | cross-tenant PII read                |
| 2     | `auth_sessions`                                                                                            | `p_auth_sessions_service` (0047:76)                            | session validate/revoke      | session hijack material              |
| 3     | `tenant_scim_tokens`                                                                                       | `p_tenant_scim_tokens_service` (0047:202)                      | SCIM provisioning            | **credential material, all tenants** |
| 4     | `consent_records`                                                                                          | `p_consent_records_service` (0047:76)                          | pre-auth consent checks      | GDPR records                         |
| 5     | `email_verification_tokens`                                                                                | `p_email_tokens_service` (0047:76)                             | pre-auth verify flow         | account-takeover tokens              |
| 6     | `onboarding_states`                                                                                        | `p_onboarding_states_service` (0047:76)                        | pre-auth onboarding          | —                                    |
| 7     | `organizations`                                                                                            | `p_organizations_service` (0047:171)                           | org resolution               | cross-tenant org graph               |
| 8     | `organization_members`                                                                                     | `p_organization_members_service` (0047:183)                    | membership checks            | cross-tenant membership              |
| 9     | `organization_invitations`                                                                                 | `p_organization_invitations_service` (0047:195)                | invite accept (pre-auth)     | invite-token replay                  |
| 10    | `revoked_user_cutoffs`                                                                                     | `p_cutoffs_service` (0037:80)                                  | auth-time watermark reads    | auth bypass if tampered              |
| 11    | `approval_decision`                                                                                        | `p_approval_decision_service` (0047:118)                       | approval reads               | approval forgery reads               |
| 12    | `notification_device_tokens`                                                                               | `p_notification_device_tokens_service` (0047:163)              | push fan-out                 | push-token leak                      |
| 13    | `memory_taxonomy_ledger`                                                                                   | `p_memory_taxonomy_ledger_service` (0047:155)                  | ledger appends               | —                                    |
| 14    | `workspace_plugin_installs`                                                                                | `p_workspace_plugin_installs_service` (0047:215)               | install resolution           | —                                    |
| 15–19 | `agent_schedules`, `dead_letter_events`, `event_subscriptions`, `job_executions`, `notification_templates` | `*_service` (0047:76)                                          | daemon/worker access         | operational                          |
| 20–22 | `plugin_executions`, `webhook_deliveries`, `tenants` (INSERT-only)                                         | `*_service` (0047:76/82)                                       | workers, signup              | operational                          |
| 23–24 | `marketplace_listings`, `marketplace_reviews`                                                              | `*_service` + `*_select TO authenticated, anon` (0047:130/139) | **public catalog BY DESIGN** | none — intended                      |
| 25–26 | `alembic_version`, `schema_migrations`                                                                     | `*_service` (0047:111)                                         | migrator                     | infra, no user data                  |

NOT in this table (verified clean): `provider_keys`, `memories`, `documents`,
`workspaces`, `api_keys`, `agent_approvals` — workspace/tenant policies only, no
`USING (true)` grant. The sharpest secrets (`provider_keys`) keep full two-layer
isolation.

## 3. Why not fixed in this loop

Removing `vaeloom_app` from these grants would break every background path that
runs AS `vaeloom_app` without tenant GUCs (retention daemon, schedulers, webhook
delivery, pre-auth consent/verify/onboarding flows). The safe fix is per-path:
(a) audit which code paths touch each table, (b) set tenant GUCs or switch
daemon paths to `service_role`, (c) tighten the grant, (d) re-prove on live PG.
Step (d) is impossible in this environment (no live PG — Docker down, local PG18
backends crash, Supabase is shared). A blind migration here risks a prod outage
worse than the exposure, so the remediation SQL is specified but **deliberately
not applied**:

```sql
-- Per table, AFTER its readers are GUC-clean (verify on staging first):
-- DROP POLICY p_<name>_service ON public.<table>;
-- CREATE POLICY p_<name>_service ON public.<table> FOR ALL
--   TO service_role, postgres
--   USING (true) WITH CHECK (true);
-- (vaeloom_app removed; pre-auth tables get token-scoped policies instead,
--  e.g. USING (token_hash = current_setting('app.token_hash', true)).)
```

## 4. Compensating controls (live today)

- App-layer scoping enforced + tested: `TenantMiddleware` GUCs
  (`middleware/tenant.py`), `check_user_workspace_access` fail-closed,
  `test_noauth_private.py` 105/105, tenant-isolation suites.
- Parameterized queries throughout (no SQLi foothold found in audit).
- App DB credentials in SecretManager/Infisical, never in repo (`.env`
  gitignored; `.env.example` placeholders only).
- `p_users_self` / `*_user` `authenticated`-role policies scope PostgREST direct
  access independently of the app role.

## 5. Verification status

- Static chain audit: COMPLETE (this file + `rls_audit2` counts).
- Live re-proof on PG: BLOCKED — no disposable PG in this environment. Promotion
  gate for the fix: run `tests/test_rls_live_pg.py` + a vaeloom_app-role
  negative matrix (assert zero rows on tables 1–12 with foreign GUCs) against
  staging PG before merging the tightening migration.
