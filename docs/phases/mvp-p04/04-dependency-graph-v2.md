# MVP-P04 — 04. Dependency Graph & Critical Path (DEL-MVP-P04-02) — V2

> **Version:** 2.0 (supersedes `04-dependency-graph.md` dated 2026-08-15)
> **Owner:** Engineering Manager · **Baseline:** master @ `dac2630` (P03 CLOSED
> 2026-08-14) · **Repo truth:** Next.js (apps/web) + FastAPI (apps/api) — no
> NestJS (CF-P04-01) · **Status:** APPROVED_BASELINE pending gate

**V2 improvements:** Added risk-adjusted timelines, slack analysis,
resource-loaded dependencies, contingency paths, and specific verification
commands per dependency.

## 1. Phase dependency graph (MVP track)

```text
P05 (architecture)
 ├─ P06 (stack/standards)
 │    └─ P07 (RLS/schema design: 6-memory model, workspace isolation)
 │        └─ P08 (OpenAPI contracts + approval API + OAuth RFC 9700)
 │            ├─ P09 (UI/UX) .............. parallel to P07/P08 (off critical path)
 │            ├─ P10 (web) ................ branches off P08/P09 (off critical path)
 │            └─ P11 (backend) ............ CRITICAL PATH
 │            P12 (AI/memory + eval harness) starts AFTER P07+P08, overlaps P11 tail
 │                │
 │                ▼
 │            P13/P14 (security/legal + QA/eval evidence)
 │                ▼
 │            P15 (perf/rel) → P16 (CI/CD) → P17 (ops) → P18 (docs)
 │                ▼
 │            P19 (release) → P20 (validation) → P21 (maintenance)
 └─ (P06 also feeds P09 directly for design tokens)
```

Linear spine (per phase sequence):
`P05 → P06 → P07 → P08 → P10/P11/P12 → P13/P14 → P15 → P16/P17/P18 → P19 → P20 → P21`.

- **P09 (UI/UX)** runs parallel to P07/P08, starting from P05 — never on the
  critical path.
- **P12 (AI/memory)** starts only after P07+P08 (schema + contracts exist) and
  may overlap the P11 tail (independent services).
- **P16 (CI/CD)** already partially exists in the repo (GitHub Actions workflows
  for backend, frontend, docker, deploy, release — see AGENTS.md) → verify and
  extend early, before it is needed on the path.
- **P13/P14** converge: P13 (security/legal) feeds P14 (QA/eval evidence); P14
  gates certification, not P13's legal-review portion (T2/T3 only).

## 2. Critical path

`P05 → P06 → P07 → P08 → P11 → P13 → P14 → P15 → P16 → P17 → P18 → P19 → P20 → P21`

- Longest chain: design → data → contracts → backend → harden → certify → ship.
- **P10 (web) branches off P08/P09** — not on critical path; may lag P11.
- **P09 (UX)** parallel; **P12 (AI/memory)** overlaps P11 tail; neither
  stretches the path.
- **P16 (CI/CD)** partially exists in repo → verify/extend early so it is not a
  late surprise.
- Legal review within P13 is NOT on the MVP path (T2/T3 enablement only, see §3
  and §4).

## 3. Key dependencies (facts, not assumptions)

| Dep                                                                   | Needed by             | Provides                                                    | Risk if late                                                           | Verification Command                                                          |
| --------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P07 RLS/schema design (6-memory model, workspace isolation)           | P11, P12              | Tenant/workspace-scoped relational schema, memory model     | Blocks backend + AI implementation                                     | `cd apps/api && python -c "from src.api.models import *; print('Models OK')"` |
| P08 OpenAPI contracts + approval API + OAuth RFC 9700                 | P10, P11, P12         | Typed contract, approval API, OAuth flow                    | Blocks all implementation surfaces                                     | `openapi-generator validate -i openapi.yaml`                                  |
| P08 OAuth design (RFC 9700)                                           | P13 + Gmail           | Least-privilege scopes, PKCE, replay resistance             | Security blocker; verification cost at $0 (RISK-MVP-P02-12)            | Design review against RFC 9700                                                |
| P12 eval harness (≥90% deadline extraction / ≥80% retrieval evidence) | P14, P13              | Gate evidence for AI/memory quality                         | Certification delayed — evidence missing                               | `cd apps/api && python -m pytest tests/agents/ -v --tb=short`                 |
| P13 legal review                                                      | T2/T3 enablement ONLY | DPDP + ToS positions                                        | NOT on MVP path (gated; no MVP-blocking risk)                          | Legal review document in `docs/phases/mvp-p13/`                               |
| P19 credentials                                                       | P19                   | Production Gmail/OAuth credentials                          | Blocks go-live (UNK-02)                                                | Credential verification checklist                                             |
| VB-07 cohort                                                          | P20                   | Validation users for beta                                   | Beta validation BLOCKED/UNKNOWN until signup                           | Cohort signup tracking                                                        |
| Gmail quota verification                                              | P07                   | Quota behavior at cohort scale                              | Schema/connector design risk (UNK-P02-02)                              | Gmail API quota test                                                          |
| Google OAuth verification at $0                                       | P19                   | Verified OAuth consent screen (unverified = 100-user limit) | Launch blocker if unmitigated (RISK-MVP-P02-12)                        | OAuth consent screen status                                                   |
| Naukri partner gate                                                   | job-platform surface  | B2B-only partner API (no public apply API)                  | Job-platform integration surface blocked (RISK-MVP-P02-13, UNK-P02-05) | Partner program status check                                                  |

## 4. Parallelization & overlap

- P09 ∥ P07/P08; P12 ∥ P11 tail; P16 prep ∥ P10–P12; P14 planning starts at P10.
- Gmail quota verification (UNK-P02-02) scheduled into P07 so schema/connector
  design is not reworked.
- Enterprise work (SSO/SCIM, admin, billing, marketplace, multi-region) stays
  OUT of the MVP critical path (prompt §12.6) — deferred to the enterprise
  track, not imported.

## 5. Slack analysis

| Phase | Float             | Risk-Adjusted Float   | Buffer Recommendation                              |
| ----- | ----------------- | --------------------- | -------------------------------------------------- |
| P05   | 0 (critical)      | 0                     | None — must start immediately                      |
| P06   | 0 (critical)      | 0                     | None — sequential from P05                         |
| P07   | 0 (critical)      | -1 (Gmail quota risk) | Add 1 iteration buffer for quota verification      |
| P08   | 0 (critical)      | -1 (OAuth risk)       | Add 1 iteration buffer for OAuth design            |
| P09   | +2 (parallel)     | +1                    | 1 iteration buffer for design iteration            |
| P10   | +1 (off critical) | 0                     | None — can lag P11 by 1 phase                      |
| P11   | 0 (critical)      | 0                     | None — must complete on schedule                   |
| P12   | +1 (overlaps P11) | 0                     | None — must complete before P13                    |
| P13   | 0 (critical)      | 0                     | None — must complete before P14                    |
| P14   | 0 (critical)      | 0                     | None — must complete before P15                    |
| P15   | 0 (critical)      | 0                     | None — must complete before P16                    |
| P16   | 0 (critical)      | 0                     | None — must complete before P17                    |
| P17   | 0 (critical)      | 0                     | None — must complete before P18                    |
| P18   | 0 (critical)      | 0                     | None — must complete before P19                    |
| P19   | 0 (critical)      | -1 (credential risk)  | Add 1 iteration buffer for credential verification |
| P20   | 0 (critical)      | -2 (cohort risk)      | Add 2 iteration buffer for cohort activation       |
| P21   | 0 (critical)      | 0                     | None — final phase                                 |

## 6. Kill switches / rollback points per dependency stage

- Each phase gate is a rollback point (`git revert` clean-tree discipline) — a
  failed gate rolls back the dependency stage, not the whole program.
- Feature flags: AUTO-01 (T1, ON), AUTO-02 (T2, OFF), AUTO-03 (T3, OFF)
  (DEC-P02-05/DEC-P03-01) — enablement is independent of code presence; T2/T3
  stay inert until legal review (P13) + USER re-confirmation.
- Connector outage isolation (NFR-15/h15) prevents cascading failure — one
  failure domain cannot take down the app (no synchronized retries).
- Dependency stages rule: keep enterprise work outside the MVP critical path;
  treat it as kill-switch territory, never as a path blocker.

### Kill-switch procedures (operable)

| Kill Switch                     | Enable Command                                                              | Disable Command                                  | Owner            | Audit Trail                                     |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ---------------- | ----------------------------------------------- |
| AUTO-01 (T1 lawful automation)  | Set `AUTO_T1_ENABLED=true` in `.env`                                        | Set `AUTO_T1_ENABLED=false` in `.env`            | Product          | Log in `docs/phases/mvp-p17/kill-switch-log.md` |
| AUTO-02 (T2 discovery scraping) | Set `AUTO_T2_ENABLED=true` in `.env` + legal review P13                     | Set `AUTO_T2_ENABLED=false` in `.env`            | Platform         | Log in `docs/phases/mvp-p17/kill-switch-log.md` |
| AUTO-03 (T3 auto-apply)         | Set `AUTO_T3_ENABLED=true` in `.env` + legal review P13 + USER confirmation | Set `AUTO_T3_ENABLED=false` in `.env`            | Product/Security | Log in `docs/phases/mvp-p17/kill-switch-log.md` |
| Gmail watcher                   | `DELETE /api/v1/connectors/gmail/watch` endpoint                            | `POST /api/v1/connectors/gmail/pause` endpoint   | Integration      | Log in connector audit trail                    |
| Scraper                         | `DELETE /api/v1/connectors/scraper/stop` endpoint                           | `POST /api/v1/connectors/scraper/pause` endpoint | Platform         | Log in connector audit trail                    |
| Auto-apply                      | `DELETE /api/v1/jobs/auto-apply/stop` endpoint                              | `POST /api/v1/jobs/auto-apply/pause` endpoint    | Product          | Log in job audit trail                          |

## 7. Blocking-dependency honesty note

Any dependency with UNKNOWN status is recorded as BLOCKED/UNKNOWN with owner +
due phase — never fabricated as resolved:

| Dep                                | Status          | Owner                  | Due phase | Note                                                   | Verification                |
| ---------------------------------- | --------------- | ---------------------- | --------- | ------------------------------------------------------ | --------------------------- |
| VB-07 cohort signup                | BLOCKED/UNKNOWN | USER (founder network) | P20       | Interviews UNKNOWN until signup; proxy evidence stands | Cohort tracking spreadsheet |
| VB-08 synthetic resume consent     | BLOCKED/UNKNOWN | USER                   | P13/P14   | Eval corpus NOT_EXECUTED; public sets suffice          | Consent tracking            |
| Google OAuth verification timeline | UNKNOWN         | Product/Platform       | P19       | Cost/limit at $0 (RISK-MVP-P02-12); mock mode for dev  | OAuth console status        |
| Naukri partner program cost/access | UNKNOWN         | Product/Platform       | P19       | RISK-MVP-P02-13, UNK-P02-05                            | Partner program inquiry     |
| Gmail quota at cohort scale        | UNKNOWN         | Technical              | P07       | UNK-P02-02                                             | Gmail API quota test        |
| P19 production credentials         | UNKNOWN         | Access/Founder         | P19       | UNK-02 — blocks go-live                                | Credential checklist        |

## 8. Evidence

| ID              | Claim                                                                                                                                                                                                                                     | Requirement | Type           | Location         | Result                         | Date       | Verified by         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- | ---------------- | ------------------------------ | ---------- | ------------------- |
| EVD-MVP-P04-021 | Dependency graph reflects P03 baseline master @ dac2630 (P03 CLOSED 2026-08-14), **26-package** repo (Next.js apps/web + FastAPI apps/api, no NestJS CF-P04-01); 11 GitHub Actions workflows verified                                     | MVP-P04-R01 | SOURCE_DERIVED | this file (§1)   | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-022 | Critical path chain P05→P06→P07→P08→P11→P13→P14→P15→P16→P17→P18→P19→P20→P21 = longest chain (design→data→contracts→backend→harden→certify→ship); P10/P09/P12 off path                                                                     | MVP-P04-R01 | NEW_DESIGN     | this file (§2)   | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-023 | Key dependencies incl. P12 eval harness thresholds (≥90% deadline extraction / ≥80% retrieval evidence) → P14/P13; enterprise features kept OUT of MVP critical path (prompt §12.6)                                                       | MVP-P04-R02 | SOURCE_DERIVED | this file (§3–4) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-024 | Kill switches/rollback points: per-gate git revert discipline; feature flags AUTO-01 (T1 ON), AUTO-02 (T2 OFF), AUTO-03 (T3 OFF) (DEC-P02-05/DEC-P03-01) enablement independent of code presence; connector outage isolation (NFR-15/h15) | MVP-P04-R02 | SOURCE_DERIVED | this file (§5–6) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-025 | Blocking-dependency honesty: UNKNOWN deps (VB-07/VB-08 cohort, OAuth verification timeline, Naukri partner gate, Gmail quota, P19 credentials) recorded BLOCKED/UNKNOWN with owner + due phase, never fabricated resolved                 | MVP-P04-R05 | SOURCE_DERIVED | this file (§7)   | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-026 | Slack analysis completed for all phases with risk-adjusted float and buffer recommendations                                                                                                                                               | MVP-P04-R01 | NEW_DESIGN     | this file (§5)   | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-027 | Kill-switch procedures documented with specific enable/disable commands and audit trail requirements                                                                                                                                      | MVP-P04-R05 | NEW_DESIGN     | this file (§6)   | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
