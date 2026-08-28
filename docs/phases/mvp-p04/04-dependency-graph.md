# MVP-P04 — 04. Dependency Graph & Critical Path (DEL-MVP-P04-02)

> Owner: Engineering Manager · Baseline: master @ dac2630 (P03 CLOSED
> 2026-08-14) · Repo truth: Next.js (apps/web) + FastAPI (apps/api) — no NestJS
> (CF-P04-01) · Status: APPROVED_BASELINE pending gate.

## 1. Phase dependency graph (MVP track)

```text
P05 (architecture)
 └─ P06 (stack/standards)
     └─ P07 (RLS/schema design: 6-memory model, workspace isolation)
         └─ P08 (OpenAPI contracts + approval API + OAuth RFC 9700)
             ├─ P09 (UI/UX) .............. parallel to P07/P08 (off critical path)
             ├─ P10 (web) ................ branches off P08/P09 (off critical path)
             └─ P11 (backend) ............ CRITICAL PATH
             P12 (AI/memory + eval harness) starts AFTER P07+P08, overlaps P11 tail
                 │
                 ▼
             P13/P14 (security/legal + QA/eval evidence)
                 ▼
             P15 (perf/rel) → P16 (CI/CD) → P17 (ops) → P18 (docs)
                 ▼
             P19 (release) → P20 (validation) → P21 (maintenance)
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

| Dep | Needed by | Provides | Risk if late |
| --------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| P07 RLS/schema design (6-memory model, workspace isolation) | P11, P12 | Tenant/workspace-scoped relational schema, memory model | Blocks backend + AI implementation |
| P08 OpenAPI contracts + approval API + OAuth RFC 9700 | P10, P11, P12 | Typed contract, approval API, OAuth flow | Blocks all implementation surfaces |
| P08 OAuth design (RFC 9700) | P13 + Gmail | Least-privilege scopes, PKCE, replay resistance | Security blocker; verification cost at $0 (RISK-MVP-P02-12) |
| P12 eval harness (≥90% deadline extraction / ≥80% retrieval evidence) | P14, P13 | Gate evidence for AI/memory quality | Certification delayed — evidence missing |
| P13 legal review | T2/T3 enablement ONLY | DPDP + ToS positions | NOT on MVP path (gated; no MVP-blocking risk) |
| P19 credentials | P19 | Production Gmail/OAuth credentials | Blocks go-live (UNK-02) |
| VB-07 cohort | P20 | Validation users for beta | Beta validation BLOCKED/UNKNOWN until signup |
| Gmail quota verification | P07 | Quota behavior at cohort scale | Schema/connector design risk (UNK-P02-02) |
| Google OAuth verification at $0 | P19 | Verified OAuth consent screen (unverified = 100-user limit) | Launch blocker if unmitigated (RISK-MVP-P02-12) |
| Naukri partner gate | job-platform surface | B2B-only partner API (no public apply API) | Job-platform integration surface blocked (RISK-MVP-P02-13, UNK-P02-05) |

## 4. Parallelization & overlap

- P09 ∥ P07/P08; P12 ∥ P11 tail; P16 prep ∥ P10–P12; P14 planning starts at P10.
- Gmail quota verification (UNK-P02-02) scheduled into P07 so schema/connector
 design is not reworked.
- Enterprise work (SSO/SCIM, admin, billing, marketplace, multi-region) stays
 OUT of the MVP critical path (prompt §12.6) — deferred to the enterprise
 track, not imported.

## 5. Kill switches / rollback points per dependency stage

- Each phase gate is a rollback point (`git revert` clean-tree discipline) — a
 failed gate rolls back the dependency stage, not the whole program.
- Feature flags: AUTO-01 (T1, ON), AUTO-02 (T2, OFF), AUTO-03 (T3, OFF)
 (DEC-P02-05/DEC-P03-01) — enablement is independent of code presence; T2/T3
 stay inert until legal review (P13) + USER re-confirmation.
- Connector outage isolation (NFR-15/h15) prevents cascading failure — one
 failure domain cannot take down the app (no synchronized retries).
- Dependency stages rule: keep enterprise work outside the MVP critical path;
 treat it as kill-switch territory, never as a path blocker.

## 6. Blocking-dependency honesty note

Any dependency with UNKNOWN status is recorded as BLOCKED/UNKNOWN with owner +
due phase — never fabricated as resolved:

| Dep | Status | Owner | Due phase | Note |
| ---------------------------------- | --------------- | ---------------------- | --------- | ------------------------------------------------------ |
| VB-07 cohort signup | BLOCKED/UNKNOWN | USER (founder network) | P20 | Interviews UNKNOWN until signup; proxy evidence stands |
| VB-08 synthetic resume consent | BLOCKED/UNKNOWN | USER | P13/P14 | Eval corpus NOT_EXECUTED; public sets suffice |
| Google OAuth verification timeline | UNKNOWN | Product/Platform | P19 | Cost/limit at $0 (RISK-MVP-P02-12); mock mode for dev |
| Naukri partner program cost/access | UNKNOWN | Product/Platform | P19 | RISK-MVP-P02-13, UNK-P02-05 |
| Gmail quota at cohort scale | UNKNOWN | Technical | P07 | UNK-P02-02 |
| P19 production credentials | UNKNOWN | Access/Founder | P19 | UNK-02 — blocks go-live |

## 7. Evidence

| ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- | ---------------- | ------------------------------ | ---------- | ------------------- |
| EVD-MVP-P04-021 | Dependency graph reflects P03 baseline master @ dac2630 (P03 CLOSED 2026-08-14), 25-package repo (Next.js apps/web + FastAPI apps/api, no NestJS CF-P04-01) | MVP-P04-R01 | SOURCE_DERIVED | this file (§1) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-022 | Critical path chain P05→P06→P07→P08→P11→P13→P14→P15→P16→P17→P18→P19→P20→P21 = longest chain (design→data→contracts→backend→harden→certify→ship); P10/P09/P12 off path | MVP-P04-R01 | NEW_DESIGN | this file (§2) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-023 | Key dependencies incl. P12 eval harness thresholds (≥90% deadline extraction / ≥80% retrieval evidence) → P14/P13; enterprise features kept OUT of MVP critical path (prompt §12.6) | MVP-P04-R02 | SOURCE_DERIVED | this file (§3–4) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-024 | Kill switches/rollback points: per-gate git revert discipline; feature flags AUTO-01 (T1 ON), AUTO-02 (T2 OFF), AUTO-03 (T3 OFF) (DEC-P02-05/DEC-P03-01) enablement independent of code presence; connector outage isolation (NFR-15/h15) | MVP-P04-R02 | SOURCE_DERIVED | this file (§5) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |
| EVD-MVP-P04-025 | Blocking-dependency honesty: UNKNOWN deps (VB-07/VB-08 cohort, OAuth verification timeline, Naukri partner gate, Gmail quota, P19 credentials) recorded BLOCKED/UNKNOWN with owner + due phase, never fabricated resolved | MVP-P04-R05 | SOURCE_DERIVED | this file (§6) | APPROVED_BASELINE pending gate | 2026-08-15 | Engineering Manager |

All five evidence rows share status APPROVED_BASELINE pending gate — final
confirmation subject to the MVP-P04 gate verdict (USER, sole gate authority).
