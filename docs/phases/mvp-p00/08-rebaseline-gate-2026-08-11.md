# MVP-P00 — 08. Re-Baseline Gate Report (2026-08-11)

> **Phase:** MVP-P00 — Intake and Existing-State Assessment — RE-BASELINE run
> **Date of scoring:** 2026-08-11 (evidence run same day) **Baseline:** repo
> `master` @ `d09fa07` (post: 66-prompt pack placement, canonical baseline
> pinning, P11 batch-1 commit `bfae40f`) **Scorer:** Phase owner
> (evidence-driven) · **Human gate authority:** USER (sole approver per BQ-01)
> **Purpose:** Re-run of P00 intake per the fresh source-of-truth pack
> (`docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/`), superseding
> the 2026-08-06 scoring where evidence changed. Original report
> `06-gate-report.md` remains the approved historical record. **Register root:**
> `docs/phases/mvp-p00/`

## 1. What changed since the 2026-08-06/07 gate

| #   | Change                                           | Evidence                                                                                                                                                                                                                 |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 66-prompt pack placed in repo as source of truth | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/` — 76 files SHA-256 verified vs `SHA256SUMS.md` (0/75 failures, 2026-08-11); `EXECUTION-STATUS.md` overlay; commit `f7b03fc` + pristine restore `d09fa07` |
| 2   | Canonical baselines pinned in repo               | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` (INT-02, governing), `docs/vaeloom-mvp-e2e.md` (INT-03), `docs/vaeloom-enterprise-e2e.md` (INT-04); SHA-256 recorded in source register                                    |
| 3   | Downloads archives hash-pinned                   | 6 zips incl. INT-01 substitute gatekeeper compendium — hashes in `01-source-register.md` §Downloads                                                                                                                      |
| 4   | P11 batch 1 committed                            | `bfae40f`: approval API, idempotency middleware, migrations 0003–0006, memory taxonomy/supersession, static OpenAPI (76 paths)                                                                                           |
| 5   | Prettier reformat risk neutralized               | `.prettierignore` now excludes the integrity-pinned pack (was silently breaking SHA256SUMS via lint-staged hook)                                                                                                         |
| 6   | P11 batch 2 in flight (uncommitted)              | gmail watcher draft endpoints: `routers/gmail.py`, `services/gmail_service.py`, `schemas/gmail.py`, `migrations/0007_gmail_watch.py` (+ modified `clients/gmail_client.py`, `models/`, `main.py` mount at line 160)      |

## 2. Fresh intake evidence (2026-08-11, HEAD `d09fa07`)

| Area            | Measured                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend sources | 26 routers (22 unconditional + 8 enterprise-gated), 46 services, 12 middleware, 26 schemas, 54 agent packages (8 canonical + 14 gated enterprise extras), 7 migrations (0003–0007 WIP)                                  |
| Scope lock      | `mvp_scope_enforced=True`, `enterprise_routes_enabled=False` (config.py:69-70); orchestrator `MVP_CANONICAL_AGENTS` 8-name gate (router.py:178,231)                                                                     |
| Frontend        | 23 page routes (17 MVP, 6 enterprise-flagged); typed `api.ts`/`api-client.ts` with `transformKeys`; loading/error/not-found ×8; middleware = auth-only                                                                  |
| Tests           | 129 test files (incl. 8 integration); pytest cache 2384 nodeids, **27 lastfailed** (auth-env dependent `*_requires_auth`; stale `test_storage.py` no longer exists); documented passes: 2241 (P00) → 2264 (P01 handoff) |
| Approval UX     | `ApprovalCard.tsx` + spec exist; **not wired** to backend (`/approval*` fetch absent; only self-imported)                                                                                                               |
| Rights/consent  | Static consent-scope UI in settings; `consentApi`/`gdprApi` wrappers unused                                                                                                                                             |
| CI/CD           | 11 workflows (ci, backend, frontend, integration, a11y, security ×2, docker, docs, deploy ×2); **no pipeline-run artifacts** in repo                                                                                    |
| Infra           | infra/ 149 files (k8s 21 apps, terraform 14 modules, prometheus/alertmanager); runbooks: DEPLOYMENT_RUNBOOK, DISASTER_RECOVERY, DEVELOPER_ONBOARDING + 7 ops runbooks                                                   |
| Docs            | 491 .md in docs/, 20 ADRs (001–020), openapi.yaml 137 KB; 15 security docs                                                                                                                                              |
| Testing assets  | Playwright config + 3 specs; k6 script; **chaos/fuzz/security/smoke/visual-regression dirs empty**                                                                                                                      |
| Ops evidence    | SLO/SLA/SLI docs present but status "New"; no live deployments, no incident logs, no on-call roster                                                                                                                     |

## 3. Gate weights and scores (prompt §28) — RE-BASELINE

| Category                 | Weight  | Score (0–100) | Weighted        | Evidence basis (2026-08-11)                                                                                                                                     |
| ------------------------ | ------- | ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope and acceptance     | 12      | 75            | 9.00            | BQ-01/03/04/05 answered; scope lock enforced in code (R5/R6 held); CF-01/02 prompt-skeleton mismatch still OPEN                                                 |
| Technical correctness    | 12      | 70            | 8.40            | 2241/2264 documented passes; approval+idempotency committed; 27 lastfailed (auth-env); **6-memory CHECK not enforced** (22-type registry) — doc/code divergence |
| Architecture/integration | 8       | 70            | 5.60            | ADR-001..020 coherent; gmail batch-2 uncommitted (in-flight, tracked in EXECUTION-STATUS)                                                                       |
| Data quality/lifecycle   | 8       | 60            | 4.80            | Migrations 0003–0006 + RLS; projection-rebuild evidence absent; memory taxonomy divergence (6 vs 22)                                                            |
| Security/privacy         | 12      | 75            | 9.00            | JWT fail-fast, sanitize, rate-limit per-user fixes verified; security+middleware 265/265; legal review pending; DPDP doc absent                                 |
| Testing/validation       | 12      | 75            | 9.00            | 129 files/2384 nodeids; e2e collects 42; a11y/load/fuzz/chaos not run                                                                                           |
| Reliability/resilience   | 8       | 55            | 4.40            | Runbooks exist; no SLO enforcement, no DR drill, chaos dir empty                                                                                                |
| Performance/capacity     | 6       | 55            | 3.30            | k6 scripts exist; no runs/evidence                                                                                                                              |
| Evidence/traceability    | 8       | 85            | 6.80            | Pack SHA-256 verified; baselines hashed; zips pinned; EXECUTION-STATUS live                                                                                     |
| Documentation/handoff    | 6       | 85            | 5.10            | 491 docs, 20 ADRs, openapi 137 KB, pack README + map entry                                                                                                      |
| Operations/support       | 5       | 50            | 2.50            | Runbooks on disk; no live ops/on-call/monitoring evidence                                                                                                       |
| Maintainability/cost     | 3       | 75            | 2.25            | Clean monorepo, ADRs, no cost model                                                                                                                             |
| **TOTAL**                | **100** |               | **70.15 / 100** |                                                                                                                                                                 |

## 4. Mandatory blockers (re-baseline)

| Blocker                                                            | Status                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| BQ-02 production environment/credentials                           | 🔶 DEFERRED to P19 (ASP-04) — non-blocking for P00–P18 (unchanged)                                                 |
| 6-memory CHECK enforcement (doc/code divergence)                   | 🟡 OPEN — owned by P07/P12; runtime 22-type registry must be reconciled with the 6-type MVP design before P12 gate |
| ApprovalCard + consent UI wiring                                   | 🟡 OPEN — P10 handoff defers to P11; P11 gate must close it                                                        |
| 27 lastfailed tests (auth-env dependent + stale `test_storage.py`) | 🟡 OPEN — env/fixture finding, owned by P11/P14; add auth env to standard test config                              |
| CI/deploy pipeline-run evidence                                    | 🔶 DEFERRED to P16/P19 — no artifacts yet, none claimed                                                            |

## 5. Verdict

> ## ⚠️ RE-BASELINED — score 70.15/100 (below ≥88 conditional threshold)
>
> **Recommendation to gate authority (USER):** the re-baseline does not change
> P00's approved outcome (proceed to P01); it re-pins the baseline truth at
> `d09fa07` with the prompt pack now in-repo and canonical sources hashed. Score
> is sub-threshold because runtime-phase evidence (tests green, approvals wired,
> deployment) is owned by later phases — same basis as the 2026-08-07 user
> approval.
>
> **User decision required:** approve re-baseline as closed (P00 stays GO,
> handoff to P01 stands) or request remediation of any blocker before P01
> re-run.

## 6. Pending remediations carried from original run

- R8 (INT-01 template): substitute recorded as governing — RESOLVED via
  DEC-P00-06; still no template file (accepted).
- CF-01/02 (prompt skeleton vs repo reality): OPEN — confirm in P05.
- CF-04 (test counts): measured evidence wins; re-measure at each phase gate.

## 7. Next actions (into P01+ per EXECUTION-STATUS)

1. MVP-P11 batch 2: commit gmail watcher + consent/GDPR wiring; wire
   ApprovalCard; close 6-memory reconciliation; produce P11 gate report +
   handoff to P12.
2. P12: enforce 6-memory taxonomy at runtime (CHECK + registry migration).
3. Re-run full suite with auth env to retire the 27 lastfailed before P14.
