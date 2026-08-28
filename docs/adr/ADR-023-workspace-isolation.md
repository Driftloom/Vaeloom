# ADR-023: Workspace Isolation Hardening (App Scoping + Postgres RLS)

| Metadata | Value |
| ------------ | ------------------------------------------------------------------------------------------ |
| **Status** | ADOPTED — IMPLEMENTED_UNVERIFIED (verify policy coverage; isolation suite P14; NFR-15/h15) |
| **Date** | 2026-08-15 (design re-run); first documented 2026-08-07 |
| **Deciders** | Engineering Team |
| **Owner** | Security Architect |

## Context

Pooled multi-tenancy (ADR-013) isolates via app-level `tenant_id` filtering; one
missed filter is a cross-tenant leak (NFR-15/h15). Prior P05 recorded RLS as
absent; inspection @ `6e8a7b4` (`01-source-register.md` §4) finds RLS machinery,
so this records hardening as implemented-but-unverified.

## Decision

Keep **app-level scoping as the primary control**; add **Postgres RLS as
defense-in-depth** — never rely on either alone.

- `infrastructure/data_isolation.py` — `RowLevelSecurityMixin`,
 `TenantScopedQuery`, `TenantAwareBase` provide tenant-filtered ORM helpers.
- `migrations/0005_rls.py` — enables RLS and installs `tenant_isolation_<table>`
 policies (USING/WITH CHECK on `current_setting('app.tenant_id')`) on
 `memories`, `events`, `usage_records`, `api_keys`. PostgreSQL only; SQLite
 (dev/test) no-op.
- Composite (tenant, workspace) constraints remain a P07 concern.

## Consequences

**Positive:** Defense-in-depth for NFR-15/h15; a missed app-level filter is
blocked at the DB for covered tables; engine-enforced and auditable.

**Negative:** **Coverage caveat** — `0005_rls.py` covers only 4 tables
(`RLS_TABLES`), breadth UNVERIFIED; SQLite no-op means isolation must be proven
against PostgreSQL (isolation suite P14); policy compares `tenant_id` as text —
cast correctness UNVERIFIED.

## Reversibility / Rollback

Yes — `0005` downgrade drops policies and disables RLS; app-level scoping
remains the baseline control.

## Verification (P07/P14)

Verify RLS coverage breadth at P07; run the isolation suite at P14 against
PostgreSQL (NFR-15/h15; `01-source-register.md` §4 Gaps).
