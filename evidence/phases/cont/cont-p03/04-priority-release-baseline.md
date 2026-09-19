# CONT-P03 — 04 Priority / Release Baseline — Change-Control Gated

**Deliverable:** `DEL-CONT-P03-04` | **Owner:** Product Manager + Business
Analyst

## 1. Priority (P0 = release-blocking, who can change `BQ-06`)

| ID                                 | Priority | Blocking?                                                                                                      | Owner who can change                                 | Rationale                               |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| REQ-03-01 `6→22` additive          | P0       | **YES** blocks `CONT-P12`                                                                                      | EntArch + Data + Accountable owner `BQ-06` `Program` | Stable IDs provenance                   |
| REQ-03-02 deletion                 | P0       | YES `CONT-P07`                                                                                                 | Privacy                                              | Rights `CONT-P13 Uplift`                |
| REQ-03-03 `8→28` shadow            | P0       | YES `CONT-P12`                                                                                                 | AI Product Lead                                      | Safety                                  |
| REQ-03-04 cells residency          | P0       | YES `CONT-P07`                                                                                                 | EntArch + Legal                                      | `DPDP` + `Multi-Tenancy`                |
| REQ-03-06 MCP `mcp__*`             | P1       | NO (optional flag)                                                                                             | Integration                                          | `TOOL_TIMEOUT 30s` non-`readOnly` gated |
| NFR `p99<500ms` vs `p95 disclosed` | P0 vs P1 | **Decision:** `p95 120ms <200 20 RPS headroom 60%` is `P0` outer `p99` as `P1` per `A-04` stakeholder decision | SRE + Product                                        | `mvp-p15 93.1`                          |

## 2. Release Baseline

- **MVP baseline:** `v0.2.0` `787053a` `99→110 paths` `42/42 RLS` `94.2%`
  `p95 120ms` (CONT-P00 `mvp-p21 93.6`)
- **CONT-P03 delta:** `v0.2.cont-p03` — requirements cataloged, no code yet
  (expand-contract per-wave flags)
- **Schedule:** `CONT-P04 Migration Program Waves` will assign wave per
  `REQ-03-01..08` with `cutover flag` `reconciliation metric`
  `rollback checkpoint` per 107
- **Change-control gate:** Changes to
  `scope/contract/permission/retention/provider/deployment/gate` need
  `rationale/impact/reviewers/migration/tests/rollout/rollback` per
  `05-phase-map`

---

_Versioned `DEL-CONT-P03-04 v1.0` `78c2d71`._
