# MVP-P14 → MVP-P15 Handoff — PHASE FAILED, DO NOT GO

> **From:** MVP-P14 — Testing and Quality Engineering  
> **To:** MVP-P15 — Performance, Reliability, and Scalability  
> **Date:** 2026-08-22  
> **Gate:** 74.4/100 honest FAILED — 81.9 waived FAILED (<88) — **DO NOT GO WITHOUT REMEDIATION**  
> **Baseline:** `a69d7d7` (P13 remediation) + P14 testing (GDPR 31, JWT 32+, 2555, DPIA DRAFT)  
> **Status:** PHASE FAILED — REMEDIATION REQUIRED per `09-gate-report.md` — P15 **blocked** until 88+

---

## Predecessor Handoff Validity (P13)

- **Gate:** `84.4 honest FAILED / 89 with waivers CONDITIONAL` (7 EXCs, 0 hard blockers) — user `proceed` treated as waiver for P13, allowing this P14 execution. P14 itself did **not** reach 88 even with waivers.
- **Deliverables:** 5 DELs but 3 partial (DEL-01 strategy smoke/chaos empty, DEL-02 coverage not re-measured, DEL-04 dashboard lacks a11y/perf numbers) — see `08-registers.md` EXC-P14-01..04
- **Handoff:** `docs/phases/mvp-p13/10-handoff-to-p14.md` honest dual score — this handoff does not claim successor GO.

## What P14 Actually Delivered

- **Test governance:** `tmp_path` NullPool sqlite per-test via `conftest.py` + `security/conftest.py`, `mock_llm` deterministic, `sorted(PUBLIC_PATHS)` determinism
- **Evidence:** 15 EVDs (`07-evidence.md`) — collects 2555, gdpr 31 tables 2 singles PASS
- **Code:** `gdpr.py` 12→31, `0019` fail-closed, JWT 32+, `DPIA` DRAFT — all carried from P13, no new prod code this phase (bounded per §13)
- **Tests run:** collects + 2 singles — **94% + WCAG + perf + full 2555 with `--cov` NOT re-run** (gaps as approved EXCs)

## What P14 Did NOT Deliver (blockers for P15)

1. **Coverage 94% not re-measured** — EXC-P14-01: need `pytest --cov=api --cov-report=term -q -o addopts="-n 4"` with 2555
2. **WCAG 2.2 AA not re-measured** — EXC-P14-02: `apps/web` jest 37 exists but no `jest-axe`/`playwright-axe`
3. **Perf p50/p95 not benched** — EXC-P14-03: no `wrk/k6` baseline
4. **SMOKE/security/chaos/fuzz/visual-regression EMPTY** per `AGENTS.md:87` — EXC-P14-04
5. Plus inherited 7 EXCs from P13 (RLS 5 gap, CSRF multi-worker, DPIA DRAFT, GDPR 31 only 2/31 tables exercised, injection JSON-only, sanitize NOT wired, starlette CVE)

## Verification Commands P15 Starts With (repro)

```bash
git rev-parse HEAD  # a69d7d7
git log --oneline -3
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # expect 2555
uv run --project apps/api python -m pytest apps/api/tests/security --collect-only -q -o "addopts="  # expect 233
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # expect 31

# P14 claims only 2 singles passed — P15 must re-run full coverage to unblock
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # full suite ~3-5min, expect 2459/2555
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # re-measure 94%
```

## Remediation to Unblock P15 (pick 2 to reach 88+)

| Option | Lifts | Command |
|---|---|---|
| Re-measure coverage with `--cov` on 2555 | Testing 7→9 + Evidence 8→9 = +2.0 (waived 83.9→ still 84) + closes EXC-P14-01 | `pytest --cov=api --cov-report=term -q -o addopts="-n 4"` |
| Add WCAG `jest-axe` scan + inventory smoke/chaos dirs | Testing + Security → +1.2 | `pnpm test -- --testPathPattern=a11y` |
| Bench perf p50/p95 via `wrk`/`k6` stub | Performance 5→7 + ops | `wrk -t4 -c50 -d30s http://localhost:8000/health` |

Any 2 lifts + 2019 remediation already done gets waived 81.9 → 85+; plus closing one P13 5-table RLS gap gets to 88.

## Entry Decision for P15

**NO-GO — PREDECESSOR REMEDIATION REQUIRED** per `MVP-P14 § Entry decision <88`. Do not start P15 dependent implementation until a re-scored P14 gate ≥88. `REMEDIATE_FAILED_PHASE` for P14 is required; P15 planning for `Performance, Reliability, and Scalability` must wait.
