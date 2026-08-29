# ADR-042 — Data Classes & Residency

**Status:** Accepted | **Date:** 2026-08-29 | **Deciders:** Data Architect,
Security/Privacy | **Horizon:** W2 | **Owner:** Data Architect

## Context

Classification, residency, keys, backup, deletion, projection rebuild not
per-cell.

## Decision

- Classes `PII` / `Residency IN/EU/US via cell` /
  `Keys via SecretManager Infisical` per-cell master key.
- Backup `pg_basebackup` per cell + WAL PITR, restore drill quarterly
  `2026-11-22`.
- Deletion `DELETE CASCADE` + backup expiry 30d + legal hold separation.
- Projection rebuild `reindex` from `Entity/Memory` truth →
  `embedding`/`knowledge_nodes` (never infer).

## Consequences

- Checksum per cell, dual-read shadow 0 divergence.

## Verification

- `rg reindex` + `memory_service` + `0021_retention`.
