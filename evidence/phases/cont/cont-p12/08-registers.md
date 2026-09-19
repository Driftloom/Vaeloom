# CONT-P12 — 08 Registers

## Risk

| ID               | Risk                                 | Severity | Impact               | Mitigation                                                                            | Owner       | Status                           |
| ---------------- | ------------------------------------ | -------- | -------------------- | ------------------------------------------------------------------------------------- | ----------- | -------------------------------- |
| RISK-CONT-P12-01 | Docs mistaken for runtime completion | Critical | False readiness      | Require runtime evidence/status labels (this phase)                                   | Phase owner | CLOSED via 10 EVDs 9 tests       |
| RISK-CONT-P12-02 | Scope/permission/data assumed        | High     | Leak/loss            | Block or reversible `REQUIRES_STAKEHOLDER_DECISION` BQ-06 provider terms              | Product     | OPEN — BQ-06                     |
| RISK-CONT-P12-03 | External API/model/standard changes  | High     | Regression           | Pin `MODEL_CATALOG` versions + `prompt_registry` checksum + kill switch               | AI/ML Eng   | MITIGATED via catalog            |
| RISK-CONT-P12-04 | Evidence incomplete                  | High     | Untrustworthy gate   | Immutable reports + baseline `e93d81c` + `0027` ledger                                | QA          | CLOSED                           |
| RISK-CONT-P12-05 | Old/new divergence `6 vs 22`         | Critical | Data/permission harm | Expand-contract additive + ledger `memory_taxonomy_ledger` + dual-read reconciliation | Data Arch   | MITIGATED — additive, no rewrite |
| RISK-CONT-P12-06 | Shadow miscompare cost/quality       | Medium   | Wrong cutover        | `shadow_compare` requires `quality>primary AND cost<=1.2*primary`                     | Eval Eng    | MITIGATED                        |

## Decisions

| ID              | Decision                                                                                     | Rationale                                        | Alt                           | Owner     | Status   |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------- | --------- | -------- |
| DEC-CONT-P12-01 | Expand-contract 6->22 additive, no backfill, `taxonomy_version 1/2`                          | Provenance lossless per ADR-040                  | Big-bang rewrite (rejected)   | Data Arch | APPROVED |
| DEC-CONT-P12-02 | Hybrid retrieval `ILIKE+pgvector+GIN tsvector+graph` `retrieval_hybrid_enabled` default true | Measured `p95 120ms` headroom retained           | Semantic-only (rejected)      | Data Eng  | APPROVED |
| DEC-CONT-P12-03 | Prompt/tool versioned `sha256[:16]` + `lineage JSONB` + BoM                                  | Traceability per R06                             | Mutable prompts (rejected)    | AI/ML Eng | APPROVED |
| DEC-CONT-P12-04 | Shadow 0% until CONT-P13 pilot, `kill_switch` per-agent fail-closed 503                      | Safety before action authority per phase rule    | All-tenant cutover (rejected) | AI Safety | APPROVED |
| DEC-CONT-P12-05 | Keep `enterprise_routes_enabled=false` + `agent_shadow_enabled=false` this phase             | MVP still serviceable per migration program rule | Enable now (rejected)         | Program   | APPROVED |

## Assumptions

| ID              | Assumption                                                             | Validation                                          | Owner    | Expiry     |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | -------- | ---------- |
| ASM-CONT-P12-01 | ` Temporal 8q 20 RPS 60% headroom` holds with 22 types + lineage JSONB | Re-measure `k6 10VUs 30s` before CONT-P13           | SRE      | 2026-09-30 |
| ASM-CONT-P12-02 | `MCP 2026-07-28` spec pinned still current for tool auth               | Re-check at CONT-P13 pilot                          | Sec      | 2026-09-30 |
| ASM-CONT-P12-03 | Design partners for CONT-P13 pilot available per BQ-05                 | `UNKNOWN` per BQ-05 — requires stakeholder decision | Business | —          |

## Exceptions

| ID              | Exception                                                                  | Controls                                                            | Approver          | Expiry     |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------- | ---------- |
| EXC-CONT-P12-01 | No physical service extraction this phase (strangler ADR-043 logical only) | `_safe_include` + `EXC-CONT-P11-01` carries                         | Backend Arch      | 2026-12-31 |
| EXC-CONT-P12-02 | BQ-05 pilot windows `UNKNOWN` — design partner not named                   | No dependent cutover until `REQUIRES_STAKEHOLDER_DECISION` resolved | Program           | —          |
| EXC-CONT-P12-03 | BQ-06 provider/data-use terms `REQUIRES_STAKEHOLDER_DECISION`              | No new provider without owner/date threshold                        | Accountable owner | —          |

## Traceability

`CONT-P12-R01..R08` → `01..05 DELs` →
`agent_runtime.py/prompt_registry.py/memory_service.py+0027/search_service.py+model_router.py+agent_eval.py`
→ `test_cont_p12 9 passed` `42/42` `110 OpenAPI` → `07` 10 → `06 gate` →
`09 handoff`.

## Changes

| Change                                                                                    | Type  | Impact                                | Owner       | Status |
| ----------------------------------------------------------------------------------------- | ----- | ------------------------------------- | ----------- | ------ |
| `0027` + `schemas/memory.py` 22 types + `services/*` 4 new files + `config` kill switches | Minor | additive, no break, PG-only migration | Data/AI Eng | DONE   |

## Blocking Questions Status

| ID                            | Status                                    | Note                                      |
| ----------------------------- | ----------------------------------------- | ----------------------------------------- |
| BQ-01 Accountable approver    | RESOLVED                                  | AI/ML Engineer + backup SRE               |
| BQ-02 Repo version            | RESOLVED                                  | `e93d81c` + `0027`                        |
| BQ-03 Entities/ages/regions   | RESOLVED                                  | `pt-BR/en` `IN/US` `GDPR+DPDP` no new PII |
| BQ-04 MVP release gates       | RESOLVED                                  | `mvp-p21 93.6` + `CONT-P11 96.16`         |
| BQ-05 Design partners/windows | `UNKNOWN — REQUIRES_STAKEHOLDER_DECISION` | Correct per gate policy, no pilot cutover |
| BQ-06 Provider/data-use terms | `REQUIRES_STAKEHOLDER_DECISION`           | Correct, no new provider without decision |
