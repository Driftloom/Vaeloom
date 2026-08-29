# CONT-P00 — 04 Unknown / Assumption / Risk Register — Blocking Analysis

**Phase:** `CONT-P00` | **Date:** 2026-08-28 | **Approver:** Program Manager
(gate), Security/Privacy reviewers retain veto

## 1. Classification Key

- **Unknown `U-*`:** Open material unknown —
  `category, owner, due, affected decision, blocking?` (§5 req 6).
- **Assumption `A-*`:** Tentative `REQUIRES_STAKEHOLDER_DECISION` /
  `REQUIRES_PROFESSIONAL_REVIEW`; never invented values.
- **Risk `R-*`:** `Severity × Impact` → Mitigation Owner Status per §24.

## 2. Unknowns

| ID   | Unknown                                                                            | Category   | Owner            | Due        | Affected Decision              | Blocks?                                              |
| ---- | ---------------------------------------------------------------------------------- | ---------- | ---------------- | ---------- | ------------------------------ | ---------------------------------------------------- |
| U-01 | Design-partner tenant, sponsor, users, region, migration window (`BQ-05`)          | Access     | Business/Program | `CONT-P01` | Pilot/cutover tenant/cell      | **BLOCKING for CONT-P19/20 only** — NOT for baseline |
| U-02 | Gmail/GitHub rate limits / quotas at 10× scale                                     | Data/Scale | Integration/AI   | `CONT-P02` | Connector bulk sync capacity   | NON-BLOCKING (mock-safe fallback 3 mock)             |
| U-03 | `02:197 Encrypted at rest` implementation horizon                                  | Security   | SecurityArch     | `CONT-P13` | AES-256? or `KNOWN LIMITATION` | NON-BLOCKING MVP (TLS + signing covers MVP)          |
| U-04 | Regional residency requirement per tenant                                          | Compliance | Privacy/Legal    | `CONT-P07` | Cell placement                 | NON-BLOCKING baseline                                |
| U-05 | `WORKSPACE_ID` valid UUID distribution in production (test stub `len<30` fallback) | Data       | Engineering      | `CONT-P07` | Idempotency path?              | NON-BLOCKING (fallback count path handles stub)      |

## 3. Assumptions (require validation, never silent merge)

| ID   | Assumption                                                                                 | Type                   | Owner           | Validation Trigger                                                 | Blocks?         |
| ---- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------- | ------------------------------------------------------------------ | --------------- |
| A-01 | MVP 8-agent roster canonical; 20 additional agents via shadow `498`                        | `STAKEHOLDER_DECISION` | Product/EntArch | CONT-P12 necessity review before action authority                  | NO (documented) |
| A-02 | 6→22 memory additive via expand-contract, stable IDs, provenance                           | `STAKEHOLDER_DECISION` | Data/EntArch    | CONT-P12 per-wave mapping                                          | NO              |
| A-03 | `MCP spec 2026-07-28` pinned; `mcp__*` dynamic bridged at runtime `mcp_client_service`     | `EXTERNAL_VERIFIED`    | Integration     | Version pin, compat tests                                          | NO              |
| A-04 | `p95<200 ingest` vs `p95<3000 langgraph` disclosed thresholds (not p99)                    | `STAKEHOLDER_DECISION` | SRE             | `k6` rerun per release                                             | NO              |
| A-05 | `Desktop/VSCode` as `NOT_APPLICABLE` MVP roadmap deferred                                  | `STAKEHOLDER_DECISION` | Product         | No dead button in `/connectors` (least-privilege 6 providers only) | NO              |
| A-06 | `kustomize base` path bug `../../apps/web` → `../../../apps/web` as infra fix, not product | `PROFESSIONAL_REVIEW`  | Platform        | STATIC VERIFIED `deployment replicas 3` `infra`                    | NO              |

## 4. Risks (Top 5 per §24)

| ID               | Risk                                                 | Sev      | Impact                                          | Mitigation                                                                                                                                                     | Owner            | Status                                                |
| ---------------- | ---------------------------------------------------- | -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| RISK-CONT-P00-01 | Docs mistaken for runtime completion                 | Critical | False readiness `75.69→93.6` drift              | **Require runtime evidence/status labels per gate** §28 (real runtime > docs)                                                                                  | Phase owner      | **OPEN** (mitigated by this baseline)                 |
| RISK-CONT-P00-02 | Scope/permission/data/compatibility assumed          | High     | Leak/loss/rework                                | **Block or reversible validated decision + dual-run reconciliation** (expand-contract, shadow, per-wave flags)                                                 | Product/Arch/Sec | **OPEN** (mitigated by 6→22 mapping R-05)             |
| RISK-CONT-P00-03 | External API/model/standard changes (MCP/LLM/OAuth)  | High     | Regression `GPT/Gemini/Llama` unstated provider | **Pin versions, tests, owner, kill switch** `BROWSER_TOOLS_ENABLED`, `AGENT_REACT_ENABLED=false`, `LLM_API_KEY` gated                                          | Integration/AI   | **OPEN**                                              |
| RISK-CONT-P00-04 | Evidence incomplete / `NOT_EXECUTED` claimed as done | High     | Untrustworthy gate `88 CONDITIONAL` history     | **Immutable reports + baseline** `docs/phases/mvp-p* 10 files each + 787053a`                                                                                  | QA/Release       | **OPEN** (addressed by `test_product_closure_e2e 10`) |
| RISK-CONT-P00-05 | Old/new divergence during migration (6→22, 8→28)     | Critical | Data/permission harm                            | **Reconciliation/pause/rollback per-wave** `sched_job:{job_id}:{slot_minute} SETNX EX120`, `REJECT_DUPLICATE`, legacy retirement zero traffic + restore drills | Migration        | **OPEN**                                              |
| R-06             | Tenant cells / `tenant_id` isolation bypass          | High     | Cross-workspace leak                            | **RLS 42/42** `TenantContext app.tenant_id` `SET LOCAL` + `WorkspaceUser` + `validate_workspace_binding`                                                       | Security         | **MITIGATED** (42/42 verified)                        |
| R-07             | Memory context poisoning via RAG                     | High     | Goal hijack                                     | `[from:X untrusted]` tag `supervisor 112` + `rag_status` + `validate_no_secrets` recursive                                                                     | Security/AI      | **MITIGATED**                                         |

## 5. Blocking Summary

| Severity   | Total | Blocking Now | Blocking Future Wave                  | Mitigated            |
| ---------- | ----: | ------------ | ------------------------------------- | -------------------- |
| Critical   |     2 | 0            | 0 (pilot windows deferred)            | 2 expand-contract    |
| High       |     4 | 0            | 1 (`U-01` pilot windows for `P19/20`) | 3 pinned             |
| Medium/Low |     5 | 0            | 0                                     | 5 `KNOWN LIMITATION` |

**Entry decision for CONT-P00 baseline:** **NO mandatory blocker** — `95/100`
achievable; `CONDITIONAL GO` may authorize only bounded documentation/research
not dependent on unresolved facts per §8 note. This phase is `GO` for baseline.

## 6. Exception Handling

No waivers/expired waivers; `F-SEC-01 INFO` direct-client history trust boundary
`network-policies default-deny` is **TRUST BOUNDARY** not waiver — production
internal-only, API layer trusted. `F-LG-02 MEDIUM` perf `+0.71s` bounded
disclosed not waiver.

---

_Delivers `DEL-CONT-P00-04` — unknown/assumption/risk register `v1.0` owned
(Program), reviewed (Sec/Privacy)._
