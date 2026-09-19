# Muse Gate 2 — Baseline (audit-first)

**Date:** 2026-09-07. **Mode:** AUDIT ONLY (no production modifications).

## Commit / Branch / Tree

- Branch: `master`
- Commit: `00d47105a2864b568c94686774fcaee138c871f4`
- Dirty: 19 modified (8 prod: consolidator, loop, router, state, agents-router,
  inference_policy, llm_service, executor; 11 tests) + 5 new
  (`test_muse_e2e_scenarios.py`, 4 muse docs). No deletions, no junk files.
- Prior bot commits (`901d49e`, `11ecce3`, `3be06b7`, `00d4710`) left in place;
  nothing discarded.

## Runtimes / Infra

- App Python 3.12.13 (uv 0.11.19). No ruff/mypy in `.venv` (test-led
  verification).
- PostgreSQL `localhost:5432/vaeloom`: REACHABLE (test suite runs against live
  PG).
- Redis `localhost:6379/0`: REACHABLE here (daemon tests still fake it).
- Dev `.env`: 76 keys (names only). Live provider keys present — suite stays
  hermetic via mocks; no live model calls in tests.

## Feature Flags (production defaults, re-verified in config.py)

`agent_react_enabled=False`, `temporal_enabled=False`,
`langgraph_enabled=False`, `mvp_scope_enforced=True`,
`agent_default_daily_budget_usd=0.0`, `agent_max_react_rounds=5` (+ per-run:
iterations 3, tools 12, tokens 12000, $0.50, 120s, replans 2).

## Test Configuration

- Runner:
  `uv run --project apps/api python -m pytest <files> -q -o addopts="" -p no:cacheprovider`
  (serial; full-suite xdist hang per finding 39 still open).
- Claimed incoming state: 640 passed / 4 skipped / 0 failed (33 files).
- Prior docs verified present: MUSE_SECURITY_HANDOFF.md, phase-a2.1 docs (3),
  muse-phase-b-final-report/completion-matrix/activation-matrix/baseline (4).
