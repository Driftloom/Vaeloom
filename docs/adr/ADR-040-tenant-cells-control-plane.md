# ADR-040 — Tenant Cells & Control Plane

**Status:** Accepted (design-only — see addendum 2026-09-21; NOT implemented at
runtime) | **Date:** 2026-08-29 | **Deciders:** Enterprise Architect, Cloud
Architect | **Related:** ADR-038/039/032, `CONT-P05` | **Horizon:** W2→P19 pilot
| **Migration Owner:** Enterprise Architect

## Context

MVP `bd7adc6` is single `postgres:16-pgvector` + `redis:7` with 42 RLS but no
regional residency `IN/EU/US` or per-tenant failure isolation required by
`DPDP/GDPR` and enterprise `cells` (future boundary).

## Decision

- Control plane (global) `api` gateway + Temporal scheduler + OTel +
  migration-control-plane + feature_flags + audit.
- Data plane cell per tenant `postgres+pgbouncer` + `redis` + Temporal Workers
  HPA 2→8, `workspace.tenant_id→cellId` mapping versioned, `add_cell_id`
  expand–contract.
- Compatibility horizon `W2→P19`, reconciliation `cell lag <5m`, cutover
  `flag 1%→100%`, rollback `lag>15m`, retirement
  `legacy 0 traffic + drill + archived + owner approval`.

## Consequences

- No big-bang; dual-read shadow via control plane; per-design-partner cutover.

## Verification

- `terraform 12` + `kustomize 60` + `rg cell_id` + `graph 64` pass.

## Addendum 2026-09-21 — Current status: control-plane design only (doc-drift closure)

**Runtime reality: single pooled PostgreSQL; cells do not exist.** Verified
2026-09-21 against code:

- Zero hits for `cell_id` / `cellId` / `tenant_cell` anywhere under
  `apps/api/src` — no mapping table, no `add_cell_id` migration, no cell-aware
  router. The Verification claim "`rg cell_id` pass" is therefore **false at
  runtime** (nothing references a cell identifier).
- One `postgres` service, one `postgres-data` volume
  (`docker-compose.yml:31-47`); one engine, `pool_size 20 / max_overflow 10`
  (`apps/api/src/api/database.py:28-31`). PgBouncer fronts the _same_ single
  backend in transaction mode (`docker-compose.yml:160-178`) — pooling, not
  isolation.
- Actual tenant isolation is **42/42 RLS** via transaction-scoped GUCs
  (`app.tenant_id/workspace_id/user_id`), re-applied after commit
  (`apps/api/src/api/database.py:33-54`) and set per-request by middleware —
  logical separation inside one database, with a single failure and noisy-
  neighbour domain.

This ADR therefore remains a **control-plane design** (gateway + scheduler +
migration-control-plane + flags + audit per tenant) with no data-plane cells
deployed. Nothing here changes the decision — it records the distance.

### Preconditions for cells (gates before any pilot)

1. **Per-cell data plane:** one `postgres+pgbouncer` (+ `redis` + Temporal
   worker pool) per cell; compose/K8s manifests per cell, not one shared
   `postgres` service.
2. **Cell mapping:** `workspace.tenant_id → cellId` versioned mapping plus the
   `add_cell_id` expand–contract migration this ADR names — merged, migrated,
   and read by a cell-aware session/router (today: no references in code).
3. **Control-plane routing:** gateway resolves cell per request, dual-read
   shadow path, per-design-partner cutover behind flags (`1%→100%`), rollback on
   `lag > 15m`, reconciliation `cell lag < 5m` with a probe that actually
   measures it.
4. **Residency mapping:** `IN/EU/US` cell placement tied to the DPDP/GDPR
   requirement in Context — currently no region pinning exists.
5. **Failure-isolation proof:** per-cell kill/drill evidence (kill one cell's
   PG, show others unaffected) before claiming isolation; until then, RLS is the
   isolation story and this ADR must not be cited as implemented.
6. **Verification repair:** replace "`rg cell_id` pass" with checks that fail
   today (migration present, router resolves cell, shadow-read parity), so the
   gate cannot pass on a single-pool runtime again.

### Related

- `docs/operations/HA-GAPS.md` (single-PostgreSQL row), ADR-013 (multi-tenancy /
  RLS — the mechanism that actually ships).
