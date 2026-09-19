# CONT-P05 — 03 ADRs / Evolution

**Deliverable:** `DEL-CONT-P05-03` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Solution Architect + Enterprise Architect

## 1 Decision Log

| ID      | Title                                                                  | Status   | Date       | Horizon      | Migration Owner       | Reconciliation Metric                        | Cutover Trigger                                | Rollback Trigger                           | Retirement                                                                       |
| ------- | ---------------------------------------------------------------------- | -------- | ---------- | ------------ | --------------------- | -------------------------------------------- | ---------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| ADR-040 | Tenant Cells & Control Plane                                           | Accepted | 2026-08-29 | W2→P19 pilot | Enterprise Architect  | `cell lag <5m, RLS 42/42 per cell`           | `feature_flag per-tenant 1%→10%→100%`          | `lag>15m OR p95>200ms OR error>1%`         | `legacy monolith 0 traffic + restore drill + archived evidence + owner approval` |
| ADR-041 | Workload Identity (Temporal Workers + API)                             | Accepted | 2026-08-29 | W1→P12       | Security Architect    | `mTLS CN=worker-{cellId}, audit workload_id` | `HPA 2→8 green + mTLS rotate drill`            | `authZ 403 spike`                          | `static token_ref removed`                                                       |
| ADR-042 | Data Classes & Residency (PII / residency / keys / projection rebuild) | Accepted | 2026-08-29 | W2           | Data Architect        | `reindex count checksum per cell`            | `reindex 100% + dual-read shadow 0 divergence` | `checksum mismatch OR backup restore >RTO` | `legacy projection 0 reads`                                                      |
| ADR-043 | Strangler Adapter (MVP monolith → cell)                                | Accepted | 2026-08-29 | W2→P10       | Cloud Architect + SRE | `adapter error<p99, latency delta <20ms`     | `adapter 100% traffic per cell`                | `latency delta >50ms OR error>0.5%`        | `adapter removed, direct cell 100%`                                              |

## 2 ADR-040 — Tenant Cells & Control Plane

**Context:** MVP is single `postgres:16-pgvector` + `redis:7` + `api:8000` with
42 RLS but no regional residency or per-tenant failure domain. Enterprise
requires `IN/EU/US` residency via cells, `DPDP`/`GDPR`/`FERPA`, failure
isolation, per-design-partner cutover.

**Decision:**

- **Control plane** (global): `api` gateway, `Temporal` scheduler, `OTel`,
  `migration-control-plane`, `feature_flags`, `audit`. Owns routing
  `workspace_id→cellId`, `feature_flag` per-tenant, reconciliation ledgers.
- **Data plane cell** (per-tenant/cell): `postgres + pgbouncer` + `redis` +
  `Temporal Workers` scaled `HPA 2→8`. Each cell `C0…N` holds `workspaces` where
  `tenant_id→cellId` mapping versioned. New workspaces assigned to
  `least-loaded cell` in `residency region`.
- **Compatibility:** `expand–contract` wave `W2`: `migrations/add_cell_id` add
  `cell_id TEXT` nullable, dual-read via control plane routing, shadow
  `cell lag` metric (`pg_replication_lag`).

**Future-readiness (§7):** horizon `W2→P19` pilot, migration owner
`Enterprise Architect`, reconciliation `cell lag <5m`, cutover `flag 1%→100%`,
rollback `lag>15m`, retirement `legacy 0 traffic`.

## 3 ADR-041 — Workload Identity

**Context:** `Temporal Workers` and `api` currently use
`token_ref EncryptedString` for connectors but no workload identity for
`worker→pg/redis` mTLS.

**Decision:**

- `api` identity `CN=api-{cellId}` via `SPIFFE`/`mTLS` (K8s `ServiceAccount` →
  `SecretManager`), `Temporal Worker` `CN=worker-{cellId}`.
- `Temporal` `Worker HPA` + `max_concurrent_activities` per queue
  (`ingest 20, agent 8…`).
- Audit `workload_id` in `structured logs`.

**Compatibility:** reversible — `token_ref` fallback until `mTLS` drill passes;
no breaking until `CONT-P13` identity uplift.

## 4 ADR-042 — Data Classes & Residency

**Context:** Data classification, residency, keys, backup, deletion, projection
rebuild not yet per-cell.

**Decision:**

- **Classes:** `PII` (user email, doc content), `Residency`
  (`workspace.tenant_id→cell region`), `Keys` via
  `SecretManager Infisical/fallback` per-key `Fernet`, per-cell master key.
- **Backup:** `pg_basebackup` per cell + point-in-time `WAL`,
  `restore drill quarterly` (`2026-11-22` per `P21`).
- **Deletion:** `primary deletion` `DELETE CASCADE workspace_id`,
  `backup expiry` 30d, `legal hold` separates.
- **Projection rebuild:** `reindex` from `Entity/Memory` truth →
  `embedding`/`knowledge_nodes`/`search` — never infer `canonical_name`.

**Compatibility:** horizon `W2`, metric `checksum per cell`, rollback
`mismatch`.

## 5 ADR-043 — Strangler Adapter

**Context:** MVP monolith (`apps/api`) hosts `27 routers` including
`agents/chat`, `memory`, `temporal`. Enterprise cells require extraction without
big-bang.

**Decision:**

- **Adapter:** `migration-control-plane/adapter` per tenant — `control plane`
  routes `GET /agents/chat` to either `monolith` or `cell` based on
  `feature_flag`; `adapter` translates `workspace_id` → `cellId`, `tenant RLS`
  preserved.
- **Dual-run:** shadow `shadow reads` `cell` + `monolith` reconciliation ledger
  `workload_identity, latency delta`, `kill switch` per cell (`kill_switch`
  existing 3/30s CB).
- **Horizon:** `W2→P10`, metric `adapter error`, retirement `direct 100%`.

## 6 Verification

- `rg ADR-040/041/042/043` 4 hits, `docs/adr 36` (33 → 37 with 040-043, exceeds
  32 baseline), `terraform validate 12`, `kustomize build` 60 yamls, `graph 64`
  `temporal 40` still green, `handoff` per W2 `feature_flag`.

---

_Version 1.0 2026-08-29 — reviewers:
Enterprise/Solution/Data/Security/Cloud/SRE/AI, `OWASP 2026` pinned, horizon
`W2→P19`._
