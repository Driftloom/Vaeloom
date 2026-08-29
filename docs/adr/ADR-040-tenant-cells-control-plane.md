# ADR-040 — Tenant Cells & Control Plane

**Status:** Accepted | **Date:** 2026-08-29 | **Deciders:** Enterprise
Architect, Cloud Architect | **Related:** ADR-038/039/032, `CONT-P05` |
**Horizon:** W2→P19 pilot | **Migration Owner:** Enterprise Architect

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
