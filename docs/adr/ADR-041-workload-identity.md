# ADR-041 — Workload Identity (Temporal Workers + API)

**Status:** Accepted | **Date:** 2026-08-29 | **Deciders:** Security Architect |
**Related:** ADR-030/038 | **Horizon:** W1→P12 | **Owner:** Security Architect

## Context

Workers and API use `token_ref EncryptedString` for connectors but no mTLS
workload identity for `worker→pg/redis`.

## Decision

- `api CN=api-{cellId}` + `worker CN=worker-{cellId}` via SPIFFE/mTLS (K8s
  ServiceAccount → SecretManager), per-cell master key.
- HPA `2→8` + `max_concurrent_activities` per queue, audit `workload_id` in
  logs.

## Consequences

- Reversible fallback `token_ref` until drill passes.

## Verification

- `rg workload` + `interceptors workflow_inbound` + `security 63`.
