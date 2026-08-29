# ADR-043 — Strangler Adapter (MVP Monolith → Cell)

**Status:** Accepted | **Date:** 2026-08-29 | **Deciders:** Cloud Architect, SRE
| **Horizon:** W2→P10 | **Owner:** Cloud/SRE

## Context

MVP monolith `apps/api 27 routers` must evolve to cells without big-bang.

## Decision

- Adapter `migration-control-plane/adapter` per tenant — control plane routes
  via `feature_flag` per-tenant (`adapter error<p99, latency delta <20ms`).
- Dual-run shadow reads + reconciliation ledger + kill switch per cell (3/30s CB
  existing).
- Horizon `W2→P10`, metric `adapter error`, retirement `direct 100%`.

## Consequences

- No all-tenant cutover until design-partner evidence.

## Verification

- `feature-flags 4` + `supervisor gather` parallel.
