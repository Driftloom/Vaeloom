# CONT-P00 — 08 Registers — Consolidated

**Commit:** `78c2d71` | **Date:** 2026-08-28

## Risk Register (5)

| ID               | Risk                      | Sev      | Mitigation                           | Owner          | Status                |
| ---------------- | ------------------------- | -------- | ------------------------------------ | -------------- | --------------------- |
| RISK-CONT-P00-01 | Docs mistaken for runtime | Critical | Runtime evidence labels `95.47` gate | Phase owner    | OPEN (mitigated)      |
| RISK-CONT-P00-02 | Scope/permission assumed  | High     | Expand-contract shadow               | Arch/Sec       | OPEN                  |
| RISK-CONT-P00-03 | External API/model drift  | High     | Pin MCP 2026-07-28 kill switches     | Integration/AI | OPEN                  |
| RISK-CONT-P00-04 | Evidence incomplete       | High     | Immutable `git SHA 78c2d71`          | QA             | MITIGATED `93 passed` |
| RISK-CONT-P00-05 | Old/new divergence        | Critical | Reconciliation/pause/rollback        | Migration      | OPEN                  |

## Decision Register

| ID              | Decision                                               | Owner   | Date       | Impact                  |
| --------------- | ------------------------------------------------------ | ------- | ---------- | ----------------------- |
| DEC-CONT-P00-01 | 14 INT canonical order `01/06 > runtime > baselines`   | EntArch | 2026-08-28 | SSOT bound P01+         |
| DEC-CONT-P00-02 | 8 MVP canonical vs 20 enterprise via shadow            | Product | 2026-08-28 | CONT-P12 per-wave flags |
| DEC-CONT-P00-03 | 6→22 memory additive never guessed                     | Data    | 2026-08-28 | Stable IDs provenance   |
| DEC-CONT-P00-04 | Strangler `SETNX EX120` dual-run only where measurable | SRE     | 2026-08-28 | CONT-P07/P08/P10        |
| DEC-CONT-P00-05 | Pilot windows UNKNOWN deferred to CONT-P19             | Program | 2026-08-28 | NOT blocking baseline   |

## Assumption Register

| ID   | Assumption                      | Owner       | Trigger               | Blocks? |
| ---- | ------------------------------- | ----------- | --------------------- | ------- |
| A-01 | 14 INT correct                  | EntArch     | Re-verify at CONT-P01 | No      |
| A-02 | `MCP 2026-07-28` pinned         | Integration | Compat tests          | No      |
| A-03 | `Desktop/VSCode NOT_APPLICABLE` | Product     | No dead button        | No      |

## Evidence Register (excerpt)

| ID     | Location                      |
| ------ | ----------------------------- |
| EVD-01 | `01-source-register.md`       |
| EVD-02 | `02-asset-inventory.md`       |
| ...    | `...`                         |
| EVD-10 | `test_product_closure_e2e 10` |

## Change Register

| Change                                                | Type                        | Gate                                |
| ----------------------------------------------------- | --------------------------- | ----------------------------------- |
| `01..05` baseline documents                           | `NEW_DESIGN`                | CONT-P00 approval                   |
| `standardize_docs.py` mojibake fixes (→ `M` 203 docs) | `IMPLEMENTED_WITH_EVIDENCE` | `F-SEC-01` trust boundary unchanged |

## Traceability: Source → Req → Design → File → Test → Evidence → Gate → Handoff

| Source `01:149` | CONT-P00-R01 | `05-phase-map` | `05-phase-map.md` | `10 E2E`
| `EVD-05` | `06-gate 95.47` | `09-handoff` |
