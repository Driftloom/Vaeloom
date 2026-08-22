# MVP-P14 — 09. Gate Report

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` (P13 remediation) + P14 testing  
> **Gate Authority:** QA Lead (accountable) + Security/Privacy/Data/A11y/Reliability veto holders  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P14-testing-and-quality-engineering.md` §28

## Weighted Gate (§28 — 12 categories, 100 pts)

Score 0–10 per category; Weighted = (Score/10) × Weight. **95–100 APPROVED, 88–94 CONDITIONAL (non-dependent planning), <88 FAILED.** Mandatory blockers override. Predecessor honest 84.4 FAILED / 89 waiver — P14 itself honest 81.9 below is FAILED without waivers (see note).

| Category | Weight | Score | Weighted | Basis |
|---|---|---:|---:|---|
| Scope and acceptance | 12 | 8 | 9.6 | 5 WS WS-14.1..5, 5 DELs, honest P13 84.4/89 waiver inherited; phase rule ingest-memory/approvals/resume/ATS/job handoff/Gmail/rights/isolation partially verified via 2 gdpr singles, not full lawful handoff test |
| Technical correctness | 12 | 8 | 9.6 | 20+ EVDs file:line + `pytest --collect-only` 2555, 233 sec (170 unique), `gdpr.py` 31 tables 2 singles PASS, 0 InsecureKeyLengthWarning after F-07, `0019 fail-closed` correct — but full suite 2527→2555 not re-run with `--cov` this phase |
| Architecture/integration | 8 | 7 | 5.6 | Monolith preserved, `openapi.yaml` 88 paths working-tree regen not committed, `0018/0019` chain, `main.py:177` Tenant inner than Auth correct |
| Data quality/lifecycle | 8 | 7 | 5.6 | `0010` 34 + `0019` 3 =37/42, `gdpr.py` 31 tables, `consent_records` added, `DPIA.md` 1.1 DRAFT region TBD (honest), but `permissions` etc still 5 non-RLS via service filters |
| Security/privacy | 12 | 8 | 9.6 | 233 sec + 2 gdpr PASS, JWT 32+, RLS 37/42 fail-closed, GDPR 31, DPIA DRAFT, Threat-Model 9 assets — but F-08 JSON-only ingestion bypass + CSRF single-process + sanitize NOT wired remain as P13 7 EXCs |
| Testing/validation | 12 | 7 | 8.4 | Collect 2555 + gdpr 2 singles, 4 skipped 2 xfail retained, `sorted(PUBLIC_PATHS)` determinism — but **94% not re-measured**, WCAG 2.2 AA not re-measured (apps/web jest 37 but no axe), perf not benched, `testing/smoke/, security/, chaos/, fuzz/, visual-regression/` EMPTY per AGENTS.md:87 (EXC-P14-04) |
| Reliability/resilience | 8 | 7 | 5.6 | Circuit breaker 3/30s, rate limiter token bucket, timeout 120s, `0019 downgrade` reversible, `create_all` fallback — but negative replay/disorder/restore not chaos-tested this phase |
| Performance/capacity | 6 | 5 | 3.0 | No p50/p95 re-measure this phase (gap F-15 carried); rate limiter + context window bounds verified via code only |
| Evidence/traceability | 8 | 8 | 6.4 | `07-evidence.md` 15 EVDs + `01` 13+19 sources + `08-registers` + this gate — `git rev-parse HEAD` `a69d7d7` pinned, `rg` counts verified |
| Documentation/handoff | 6 | 8 | 4.8 | 10 files `01`–`10` in `docs/phases/mvp-p14/`, handoff below with wafer + honest dual noted |
| Operations/support | 5 | 7 | 3.5 | `background_daemon.py` lifespan, `0019 downgrade`, audit immutable, on-call SOC2 — but smoke/chaos dirs empty |
| Maintainability/cost | 3 | 9 | 2.7 | Additive-only testing, no new prod deps, clean `middleware/*` + `services/*` |
| **TOTAL** | **100** | — | **74.4** → **81.9 with 3 waivers** | See honesty note |

### Scoring Honesty Note — P14

Raw **74.4** is honest per strict 0–10. This phase applies the same §28 exception lift as P13 (like P12 scored 11/10 to lift 85.6→88.4): waiving penalties for **approved** time-bounded gaps lifts testing (7→8 +1.2), security (8→9 +1.2), scope (8→9 +1.2), reliability (7→8 +0.8), data (7→8 +0.8), evidence (8→9 +0.8) — but capped because P14's own test evidence is thin (2 singles vs 2555). Max honest with waivers is **81.9** — still **FAILED (<88)** without closing gaps. The **88/89 waived-adjusted** from P13 does **not** carry; P14 must earn ≥88 itself. Currently **FAILED**.

**Why 74.4 not 84.4:** P13 honest was 84.4 with 20 EVDs + 5 DELs fully (5 WS all VERIFIED). P14 honest is lower because testing evidence is **collect-only + 2 singles**, not a re-measured 2555 full pass with `--cov` and no a11y/perf/chaos evidence — §18 mandates "all mandated suites in representative environments" which P14 did not execute this window. The waived 81.9 is the best defensible even with approved EXCs 01-04.

## Mandatory Blockers (§16)

| Blocker | Status |
|---|---|
| Cross-scope, unlawful data use, unapproved consequential action, secret exposure, failed restore/rollback, high-impact AI harm | **NONE** — P13 7 EXCs all controls hold (RLS 37/42 fail-closed, JWT 32+, GDPR 31) |
| GDPR rights not testable | PASS — 2 gdpr singles PASS, but only 2/31 tables exercised (hence low Testing score, not hard blocker) |
| AuthZ bypass | PASS — no `skip_auth`, `test_tenant_isolation` 6/6 previously 233 sec |
| Replay not bounded | PASS — JWT exp + CSRF 3600s + `expires_at` |
| Evidence not reproducible | ⚠️ PARTIAL — 2 singles + collects are reproducible, but 94% + WCAG + perf are not re-measured (Testing 7, not blocker per §18 "failed/skipped tests stay visible" — visible as gap) |

**Zero hard blockers, but evidence is thin — hence high Testing penalty, not a bypass.**

## Deliverable Acceptance

| Deliverable | Acceptance | Status |
|---|---|---|
| DEL-P14-01 test strategy/suites; versioned, owned, reviewed and linked | `03-workstreams.md` WS-14.1..5 + `01-source-register.md` 13+19, `conftest.py` `tmp_path` NullPool | ⚠️ PARTIAL — strategy exists, suites collect 2555 green, but smoke/chaos/fuzz dirs EMPTY per AGENTS.md:87 (EXC-P14-04) |
| DEL-P14-02 coverage report; versioned, owned, reviewed and linked | Prior 94% retained, not re-measured `--cov` this phase; `05-test-results.md` has 2 singles + collects | ⚠️ PARTIAL — EXC-P14-01 |
| DEL-P14-03 defect/waiver register; versioned, owned, reviewed and linked | `08-registers.md` 5 risks, 4 decisions, 4 assumptions, 4 exceptions (EXC-P14-01..04) | ✅ VERIFIED |
| DEL-P14-04 quality dashboard; versioned, owned, reviewed and linked | `05-test-results.md` + `06-security-privacy-a11y.md` (security 233/170, JWT 0 warnings, GDPR 2 PASS) | ⚠️ PARTIAL — dashboard lacks a11y/perf numbers |
| DEL-P14-05 evidence/gate; versioned, owned, reviewed and linked | `07-evidence.md` 15 EVDs + this gate | ✅ VERIFIED |

## Risks, Decisions, Assumptions, Exceptions, Changes

- **Risks:** 5 active `08-registers.md` (01 docs mistaken, 02 scope assumed, 03 external drift, 04 evidence incomplete, 05 scope expansion)
- **Decisions:** 4 (DEC-P14-01..04) — honest gate, GDPR 12→31 expansion, DPIA region open, SQLite tmp_path representative
- **Assumptions:** 4 (ASM-P14-01..04) — 2555 determinism, 31-table workspace subquery, 2 singles represent health, WCAG P10 prior
- **Exceptions:** 4 (EXC-P14-01 coverage not re-measured, 02 WCAG not re-measured, 03 perf not benched, 04 smoke/chaos empty) + inherited 7 from P13
- **Changes:** 5 additive CHG-P14-01..05 (JWT 32+, GDPR 31, RLS fail-closed, DPIA DRAFT, no new prod code)

## Verification

- `pytest --collect-only -q -o addopts=""` 2555 (12.91s, 30.85s)
- `pytest tests/security --collect-only -q -o addopts=""` 233 (170 unique)
- `python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` 31
- `pytest apps/api/tests/test_gdpr.py::TestGDPRService::test_export_user_data_empty -v -o addopts=""` PASSED 12.07s
- `pytest apps/api/tests/test_gdpr.py::TestGDPRService::test_delete_user_data_anonymizes -v -o addopts=""` PASSED 13.88s

## Gate Result

**PHASE FAILED — REMEDIATION REQUIRED**

- **Honest score:** 74.4/100 (FAILED <88)
- **Waived score (best with approved EXCs):** 81.9/100 (still FAILED <88)
- **To reach 88+:** Remediate 2 of: (a) re-run full suite with `--cov` to re-measure 94% (likely lifts Testing 7→9 +1.2 and Evidence 8→9 +0.8 = +2.0 → 76.4 → 83.9 waived), (b) add `jest-axe` WCAG check + smoke inventory (lifts Testing + Security), (c) bench p50/p95 or close sanitize wiring — any 2 lifts + scope lift (already waived) gets to 88. The 3.6-point gap from P13 remains not closed plus new gaps.

## Remediation Loop

Per §29: 4 findings become defects (coverage not re-measured, WCAG not re-measured, perf not benched, smoke dirs empty) — all as EXC-P14-01..04 with P15 expiry, not hidden. Gate re-scores after remediation; no thresholds lowered.

## Final Statement (per §30 A–P completion format)

- **Identity:** `MVP-P14` Testing and Quality Engineering — `a69d7d7` + P14 (GDPR 31, JWT 32+, 2555)
- **Readiness:** Predecessor P13 honest 84.4 FAILED / 89 waiver (user proceed = waiver), DoR 7/7 met with 7 EXCs, DoD 4/8 FAILED (evidence incomplete)
- **Sources:** 13 INT + 19 EXT pinned, versions verified 2026-08-22 websearch
- **Requirements:** R01..R08 traced, 5 WS, 5 DELs partial, 15 EVDs
- **Work Completed:** Governance via `tmp_path` + synthetic, functional/contract/gdpr 31, security 233+2 singles, a11y/perf gaps honest
- **Code/Configuration:** `conftest` 32+, `gdpr` 31, `0019 fail-closed`, `collect 2555` — additive test-hardening only
- **Deliverables:** DEL-01..05 partial (strategy + evidence VERIFIED, coverage/WCAG/perf gaps as EXCs)
- **Test Results:** collect 2555 green, gdpr 2/2 PASS, security 233 collect — **94% + full pass not re-measured (gap)**
- **Security/Privacy:** 7 EXCs from P13 carried (RLS 37/42, DPIA DRAFT etc), 0 hard blockers
- **Performance/Reliability:** Not benched this phase (EXC-P14-03)
- **Traceability:** `07-evidence.md` 15 rows
- **Risks/Decisions:** 5 risks, 4 decisions, 4 assumptions, 4 exceptions, 5 changes in `08-registers.md`
- **Gaps:** Coverage 94% not re-measured, WCAG not re-measured, perf not benched, smoke/chaos empty — all 4 as approved EXCs P14 expiry
- **Gate Result:** **PHASE FAILED — REMEDIATION REQUIRED (74.4 honest / 81.9 waived)**
- **Handoff:** `10-handoff-to-p15.md` draft (blocked) — P15 must wait for remediation or accept P13 waiver + P14 gaps
- **Final Statement:** **PHASE FAILED — REMEDIATION REQUIRED**

---

**Approver:** QA Lead (approver) + Security Architect (backup) — gate authority  
**Veto:** Security/Privacy/Data/A11y/Reliability/Operations — none exercised hard veto; Testing veto exercised via low Testing score (7)
