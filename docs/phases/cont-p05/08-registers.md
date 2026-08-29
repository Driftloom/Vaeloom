# CONT-P05 — 08 Registers

**Version:** 1.0 | **Date:** 2026-08-29 | **Commit:** `bd7adc6`+`cont-p05` |
**Owner:** Enterprise Architect

## Risk Register

| ID               | Risk                                        | Severity | Impact               | Mitigation                                                             | Owner            | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | ---------------------------------------------------------------------- | ---------------- | ------ |
| RISK-CONT-P05-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels (64+40 tests, 11 dry-run)       | Phase owner      | OPEN   |
| RISK-CONT-P05-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible validated decision, validate_no_secrets proof      | Product/Arch/Sec | OPEN   |
| RISK-CONT-P05-03 | External API/model/standard changes         | High     | Regression           | Pin versions mcp 2026-07-28, openapi 3.2.0, temporal 1.26, kill switch | Integration/AI   | OPEN   |
| RISK-CONT-P05-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable 06-gate-report + EVD bundle                                  | QA/Release       | OPEN   |
| RISK-CONT-P05-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation/pause/rollback DEL-05                                   | Migration        | OPEN   |

## Decision Register

| ID              | Decision                                                     | Date       | Owner                | Status   |
| --------------- | ------------------------------------------------------------ | ---------- | -------------------- | -------- |
| DEC-CONT-P05-01 | Adopt tenant cells + control plane (ADR-040)                 | 2026-08-29 | Enterprise Architect | Accepted |
| DEC-CONT-P05-02 | Workload identity mTLS CN=api/worker-{cellId} (ADR-041)      | 2026-08-29 | Security Architect   | Accepted |
| DEC-CONT-P05-03 | Data classes PII/residency/keys/projection rebuild (ADR-042) | 2026-08-29 | Data Architect       | Accepted |
| DEC-CONT-P05-04 | Strangler Adapter per-tenant flag (ADR-043)                  | 2026-08-29 | Cloud/SRE            | Accepted |
| DEC-CONT-P05-05 | Horizon W2→P19 per 146, cutover per design partner           | 2026-08-29 | Program              | Accepted |

## Assumption Register

| ID              | Assumption                                                     | Owner             | Expiry   |
| --------------- | -------------------------------------------------------------- | ----------------- | -------- |
| ASM-CONT-P05-01 | Design partners + windows deferred BQ-05 (U-01) until CONT-P19 | Business/Program  | CONT-P19 |
| ASM-CONT-P05-02 | Procurement BQ-06 deferred, no PaaS→K8s cost invented          | Accountable owner | CONT-P16 |
| ASM-CONT-P05-03 | MVP 787053a 99 paths + bd7adc6 LangGraph 110 paths as truth    | Engineering       | P05      |

## Evidence Register (EVD-CONT-P05)

| ID               | Claim                                                                   | Type | Location                                       |
| ---------------- | ----------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| EVD-CONT-P05-001 | C4 L1-3 + deployment + trust + data-flow Mermaid 1.0                    | file | `01-c4-deployment.md`                          |
| EVD-CONT-P05-002 | Service contracts 110 OpenAPI + typed RoutingDecision/Handoff/Eval      | file | `02-service-contracts.md`                      |
| EVD-CONT-P05-003 | ADRs 040-043 versioned, horizon W2→P19, owner, metric, cutover/rollback | file | `03-adrs-evolution.md` + `docs/adr/ADR-04*.md` |
| EVD-CONT-P05-004 | Threat-informed architecture OWASP Agentic 2026 + GenAI 2025, 42/42 RLS | file | `04-threat-architecture.md`                    |
| EVD-CONT-P05-005 | Failure/evolution expand–contract W2                                    | file | `05-failure-evolution.md`                      |
| EVD-CONT-P05-006 | Tests 64 graph +40 temporal WE, 11 dry-run, typecheck 0                 | log  | `pytest`, `worker --dry-run`                   |
| EVD-CONT-P05-007 | Repo baseline bd7adc6 + CONT-P04 95.62 GO                               | log  | `git rev-parse`, `06-gate-report`              |

## Traceability

`CONT-P05-R01→DEL-01 01-c4` `R02→all DELs` `R03→04-threat` `R04→64+40`
`R05→05-failure` `R06→02-contracts` `R07→EVD` `R08→06-gate` — no unexplained
gap.

## Change Register

No scope/contract/permission/retention changes in this phase — additive DELs
only.
