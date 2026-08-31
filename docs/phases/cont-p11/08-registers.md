# CONT-P11 — 08 Registers

## Risk

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|----|------|----------|--------|------------|-------|--------|
| RISK-CONT-P11-01 | Service extraction vacuum | Critical | 500 | Strangler `ADR-043` + `_safe_include` `main.py:328` single-DB stay | Backend Arch | CLOSED |
| RISK-CONT-P11-02 | Temporal 503 fail-open | High | Silent loss | `TemporalUnavailableError` `main.py:290` `503` `ZT-01` | SRE | CLOSED |
| RISK-CONT-P11-03 | RLS bypass via header spoof | High | Leak | `TenantMiddleware` GUC fail-closed `42/42` `database.py:30` | Sec | CLOSED |
| RISK-CONT-P11-04 | Idempotency collision | Medium | Dup write | `UNIQUE(workspace_id,idempotency_key)` `schema.py:648` `409` | SRE | CLOSED |
| RISK-CONT-P11-05 | `6→22` memory overwrite | Critical | Provenance loss | Additive column `nullable` + dual-write ledger `cont-p07` | Data Arch | MITIGATED |

## Decisions

| ID | Decision | Rationale | Alt | Owner | Status |
|----|----------|-----------|-----|-------|--------|
| DEC-CONT-P11-01 | Stay monolith logical this phase — no K8s service extraction | No p95 breach `120<200` `mvp-p15` | Split now (rejected) | Backend Arch | APPROVED |
| DEC-CONT-P11-02 | 8 Temporal queues `11 activities` fail-closed `503` | `ZT-01` durability not silently | Fail-open (rejected) | SRE | APPROVED |
| DEC-CONT-P11-03 | Keep `enterprise_routes_enabled=false` default `main.py:363` | `admin/iam` gated, MVP `mockUsers` safe | Enable by default (rejected) | Security | APPROVED |
| DEC-CONT-P11-04 | `parsers 17` additive `F-40` no new DB this phase | FR-06 Must covered | New table (not needed) | Backend Arch | APPROVED |

## Assumptions

| ID | Assumption | Validation | Owner | Expiry |
|----|------------|------------|-------|--------|
| ASM-CONT-P11-01 | ` Temporal` 8q capacity 20 RPS headroom 60% from `mvp-p15` holds with `17 parsers` | Re-measure before `CONT-P12` | SRE | 2026-09-30 |

## Exceptions

| ID | Exception | Controls | Approver | Expiry |
|----|-----------|----------|----------|--------|
| EXC-CONT-P11-01 | No physical service extraction this phase — logical boundaries only | `ADR-043` strangler + `00-audit` | Backend Arch | 2026-12-31 |

## Traceability

`CONT-P11-R01..R08` → `01..05 DELs` → `main.py` `services/*` `routers/*` `middleware/*` `parsers.py 17` → `51/51` `42/42` `jest-axe` `60e2e` → `07` 10 → `06 gate` → `09 handoff`.

## Changes

| Change | Type | Impact | Owner | Status |
|--------|------|--------|-------|--------|
| `01..05` DELs v1.0 + `00` audit | Minor | additive docs, no code/schema | Backend Arch | DONE |
