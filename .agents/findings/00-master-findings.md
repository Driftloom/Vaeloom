# Vaeloom Zero-Trust Audit — Master Findings

**Audit date:** 2026-08-21 **Auditor:** opencode (mimo-v2.5-free) **Scope:**
P00–P12 executed phases, full codebase, all evidence packages **Method:**
Zero-trust — every claim verified against source files, arithmetic recomputed,
paths checked on disk

---

## Executive Summary

| Severity  | Count  |
| --------- | ------ |
| CRITICAL  | 3      |
| HIGH      | 7      |
| MEDIUM    | 12     |
| LOW       | 10     |
| CLEAN     | 14     |
| **TOTAL** | **46** |

**Root cause of most findings:** Wave-2 author committed code changes (P12
implementation) without updating tests, migrations, OpenAPI spec, or
documentation to match. The code evolved but the evidence packages and tests
were not kept in sync.

---

## CRITICAL Findings

### C1 — `-n auto` in pyproject.toml breaks all pytest runs

- **File:** `apps/api/pyproject.toml`
- **Detail:** Wave-2 author added `addopts = "-n auto"` (pytest-xdist parallel)
  to `[tool.pytest.ini_options]`. But `pytest-xdist` is only a dev dependency —
  if not installed in the current Python environment, ALL pytest invocations
  fail with `error: unrecognized arguments: -n`. This was committed in `1f1a665`
  without review.
- **Impact:** Any developer or CI that doesn't have pytest-xdist installed
  cannot run tests at all.
- **Evidence:** Fresh suite run failed with this error until xdist was manually
  installed.

### C2 — 13 test failures on committed state

- **Detail:** Fresh `python -m pytest` on HEAD (`e1da219`) yields **13 FAILED,
  2404 passed**. Previous sessions reported 2405 passed / 0 failed — the
  difference is because previous runs used xdist parallel which masked some
  failures via test ordering.
- **Failing tests:**
  - `test_agent_catalog.py::test_catalog_returns_canonical_agents` — asserts
    `canonical_count == 8` but code has 10
  - `test_migrations.py` (9 tests) — migration 0008 assumes `documents` table
    exists, but no migration creates it
  - `test_mvp_scope.py::test_enterprise_agent_blocked_in_mvp[research]` —
    `research` now in canonical, not blocked
  - `test_mvp_scope.py::test_canonical_roster_matches_int02` — frozenset
    mismatch
  - `test_openapi_spec.py::test_spec_paths_match_live_app` — 6 new document
    endpoints not in committed spec

### C3 — All 10 ASI risk names fabricated in P12 security doc

- **File:** `docs/phases/mvp-p12/06-security-threat-model.md`
- **Detail:** The OWASP Agentic Top 10 2026 identifiers (ASI01–ASI10) are
  correct, but ALL 10 titles are wrong:
  - ASI01: doc says "Unbounded Agency" → official: "Agent Goal Hijack"
  - ASI02: doc says "Insecure Input Handling" → official: "Tool Misuse and
    Exploitation"
  - ASI03: doc says "Broken Tooling" → official: "Identity and Privilege Abuse"
  - ASI04: doc says "Agent Identity Confusion" → official: "Agentic Supply Chain
    Vulnerabilities"
  - ASI05: doc says "Unbounded Memory Access" → official: "Unexpected Code
    Execution"
  - ASI06: doc says "Insecure Communication" → official: "Memory and Context
    Poisoning"
  - ASI07: doc says "Prompt Injection" → official: "Insecure Inter-Agent
    Communication"
  - ASI08: doc says "Unbounded System Awareness" → official: "Cascading Agent
    Failures"
  - ASI09: doc says "Agent-to-Agent Collusion" → official: "Human-Agent Trust
    Exploitation"
  - ASI10: doc says "Unbounded Adaptation" → official: "Rogue Agents"
- **Source:** Websearch confirmed ASI01-10 taxonomy from OWASP (Dec 9 2025,
  updated v2.01 Jun 1 2026)

---

## HIGH Findings

### H1 — P02 initial gate: formula violation (72.9 true, claimed 83.1→88)

- **File:** `docs/phases/mvp-p02/07-gate-2026-08-07.md`
- **Detail:** Table uses `Score × Weight` (sum=83.1) instead of
  `Score/10 × Weight` (sum=72.9). Then "rounds" 83.1→88 (+4.9 points). True
  weighted score is 72.9/100 (below conditional threshold of 88).

### H2 — P00: ALL backend paths use wrong prefix `apps/api/src/backend/`

- **Files:** `docs/phases/mvp-p00/01-source-register-2026-08-06.md`,
  `15-zero-trust-reaudit-2026-08-16.md`
- **Detail:** Every backend path reference uses `apps/api/src/backend/` but the
  actual path is `apps/api/src/api/`. The `backend` subdirectory does not exist.

### H3 — P09 component count: 3 contradictory numbers

- **File:** `docs/phases/mvp-p09/09-gap-closure-gate-report.md`
- **Detail:** Table says "Total new: 21" (implying 43 total). Text says "22
  existing + 19 new = 41". Reaudit says 25 existing. Filesystem count is 46.
  None match.

### H4 — P09 gate score: 70.3 computed, reported as 68

- **File:** `docs/phases/mvp-p09/09-gap-closure-gate-report.md`
- **Detail:** Σ(Score/10 × Weight) = 70.3. Report says `70.3 → 68` with
  unexplained -2.3 adjustment. No formula or justification documented.

### H5 — P12 gate arithmetic: 85.6 true, claimed 94.6 (wave-1) / 88.4 (corrected)

- **File:** `docs/phases/mvp-p12/09-gate-report-2026-08-21.md`
- **Detail:** Initial gate claimed 94.6 (wrong Σ). Wave-2 corrected to 88.4
  using adjusted formula. True Σ(Score/10 × Weight) = 85.6 (without
  approved-exception boost) or 88.4 (with it). The 88.4 score is defensible if
  exceptions are accepted, but the arithmetic path was not clean.

### H6 — P12 eval dataset: documented as 13 cases, actual is 12

- **Files:** Multiple P12 docs (01-source-register, 03-workstreams,
  05-test-results, README)
- **Detail:** Earlier docs claimed "13 cases" but `agent_eval.py` contains
  exactly 12 golden cases. Corrected in final docs but earlier versions
  propagated the wrong number.

### H7 — P12 migration 0008 breaks test suite

- **File:** `apps/api/src/api/migrations/0008_document_content.py`
- **Detail:** Assumes `documents` table exists (line 11:
  `inspect(sync_conn).get_columns("documents")`). No migration creates this
  table. Tests that run all migrations fail with `NoSuchTableError: documents`.
  9 test failures.

---

## MEDIUM Findings

### M1 — P01 gates: total weight = 105, labeled as 100

- **Files:** `docs/phases/mvp-p01/06-gate-2026-08-07.md`,
  `14-gate-2026-08-13.md`
- **Detail:** Both P01 gates use 13 categories summing to weight 105, but label
  says "TOTAL: 100". Non-comparable to other phases' 100-weight gates.

### M2 — P00 re-audit: conflates collection with execution

- **File:** `docs/phases/mvp-p00/15-zero-trust-reaudit-2026-08-16.md`
- **Detail:** Claims "2333 passed" as current truth, but test execution was at a
  different commit (`3ad6bca`). Collection count (2335) was at HEAD. Not
  qualified properly.

### M3 — P00 `MVP_CANONICAL_AGENTS`: code has 10, docs claim 8

- **Files:** `apps/api/src/api/orchestrator/router.py:192` (10 names), P00
  source register (claims 8)
- **Detail:** Frozenset includes `planning` and `research` in addition to the
  documented 8.

### M4 — P06 gate: 86.1 true, claimed 87.3→88

- **File:** `docs/phases/mvp-p06/09-gate-report-2026-08-15.md`
- **Detail:** Recomputed Σ = 86.1, not 87.3. The "never ratified" note in
  EXECUTION-STATUS confirms this was never accepted.

### M5 — P07 gate: 91.8 true, claimed 93.4

- **File:** `docs/phases/mvp-p07/09-gate-report-2026-08-16.md`
- **Detail:** Recomputed Σ = 91.8, not 93.4.

### M6 — P08 gate: 86.5 true, claimed 87.3

- **File:** `docs/phases/mvp-p08/09-gate-report-2026-08-17.md`
- **Detail:** Recomputed Σ = 86.5, not 87.3.

### M7 — P09 EVD-MVP-P07-013/014 false claim about migration 0012

- **File:** `docs/phases/mvp-p07/07-evidence.md`
- **Detail:** Claims migration 0012 fixed RLS, but 0012 was the broken
  migration; 0013 was the fix.

### M8 — P07 RLS: 3 contradictory numbers

- **Files:** AGENTS.md ("4/36 tables"), P07 gate ("34-table RLS"), current
  migrations (24 tables)
- **Detail:** No consistent count of RLS-enabled tables across documents.

### M9 — P11 EVD-P11-007: gate says 66/66, evidence says 44/44

- **Files:** `docs/phases/mvp-p11/09-gate-report.md`, `07-evidence.md`
- **Detail:** Gate report double-counted 22 tests. Evidence register corrected
  to 44/44 but gate report not updated.

### M10 — P11 deep audit (82) vs gate report (90.5) divergence

- **Files:** `.agents/findings/P11-deep-audit-2026-08-20.md`,
  `docs/phases/mvp-p11/09-gate-report.md`
- **Detail:** Two independent audits of P11 produced different verdicts (82 vs
  90.5). Different scoring criteria applied.

### M11 — P06 source register: anachronistic paths at baseline commit

- **File:** `docs/phases/mvp-p06/01-source-register-2026-08-15.md`
- **Detail:** References `apps/api/...` paths at baseline `e48f547`, but at that
  commit backend lived at `apps/backend/src/backend/` (rename commit `c6bbf43`
  is AFTER baseline).

### M12 — P12 model router: pricing based on web research, not live API

- **File:** `apps/api/src/api/services/llm_service.py`
- **Detail:** Model router pricing (input/output per million tokens) is
  hardcoded from web research. Not verified against live provider APIs. May
  drift.

---

## LOW Findings

### L1 — P00 gate: §3 sum 74.63 ≠ printed 73.79 (self-acknowledged)

### L2 — P00 config.py line refs off by 3 (69-70 → 72-73)

### L3 — P00 router.py line refs imprecise (178 → 192)

### L4 — P00 re-audit says "pending USER"; EXECUTION-STATUS says accepted

### L5 — P00 security suite counts not independently verifiable

### L6 — P06 gate filename/title date mismatch

### L7 — P09 `routers/approval.py` does not exist (path anachronism)

### L8 — P10 predecessor audit uses stale 20/37 test counts

### L9 — P09 EXECUTION-STATUS frozen at gap-closure, ignores deep audit

### L10 — P12 AGENTS.md "2333 tests" stale (actual: 2404 on committed state)

---

## CLEAN Checks (no findings)

1. P00 evidence files: all 22 EVD files exist ✓
2. P01 evidence files: all 25 EVD files exist ✓
3. P02 evidence files: all 16 EVD files exist ✓
4. P01/P02 gate decisions match EXECUTION-STATUS ✓
5. Master index consistent across all phases ✓
6. P10 gate arithmetic: 96.0 exact match ✓
7. P10 evidence files: all 15 EVD files exist ✓
8. P10 paths: no anachronisms ✓
9. P11 gate arithmetic: 90.5 exact match ✓
10. P11 evidence files: all EVD files exist ✓
11. P11 paths: no anachronisms ✓
12. P06 re-run gate (69.9): verified correct ✓
13. P07 re-run arithmetic: verified correct ✓
14. MCP 2026-07-28 spec: confirmed via websearch ✓

---

## Recommendations

1. **Fix C1:** Remove `addopts = "-n auto"` from pyproject.toml or gate it
   behind an env var. Document xdist as optional.
2. **Fix C2:** Update tests to match current code (10 canonical agents, 0008
   migration, document endpoints in OpenAPI spec).
3. **Fix C3:** Replace all 10 ASI titles with official OWASP names.
4. **Fix H7:** Add `documents` table creation to 0008 or create a 0001
   migration.
5. **Fix H1/H4/H5:** Recompute all gate scores using consistent formula.
6. **Fix H2:** Update P00 paths from `backend` to `api`.
7. **Fix M1:** Label P01 total weight correctly as 105.
8. **Fix M3/M9:** Update docs to match code.
