# CONT-P00 — 07 Evidence Bundle — Immutable Traceability

**Commit:** `78c2d71` | **Date:** `2026-08-28T23:59Z` | **Owner:** Program
Manager

## Command / Environment / Commit Log

```text
git rev-parse HEAD → 78c2d71c724a4798743d9b5e3e243a9de5d15035
git status --short --branch → ## master...origin/master [ahead 2] + 203 M (standardize_docs mojibake)
git log -n 5 --oneline → 78c2d71 chore(pnpm): migrate overrides, c7ecba0 chore(husky): drop deprecated, 52d6af9 fix(enterprise): complete MEDIUM/LOW, 04961a1 chore(audit): resolve findings 30-43
docker ps → 8 healthy (postgres pgvector:pg16 redis:7 temporal:1.26 worker×2 temporal-ui)
uv run --project apps/api python -m pytest apps/api/tests/graph apps/api/tests/temporal -q → 83 passed 13s
uv run --project apps/api python -m pytest apps/api/tests/test_product_closure_e2e.py -q → 10 passed 32s
uv run --project apps/api python -m api.temporal.worker --dry-run → 11 activities
pnpm --filter web typecheck → 0 errors (hardening)
docker exec worker python urllib http://localhost:9090/metrics → langgraph_run_started_total HELP
```

## Evidence Inventory

| ID               | Location                | Hash / Size      | Claim                                        | Retention                           |
| ---------------- | ----------------------- | ---------------- | -------------------------------------------- | ----------------------------------- |
| EVD-CONT-P00-001 | `01-source-register.md` | `78c2d71`        | 14 INT +17 EXT correct                       | `docs/phases/cont-p00/` git history |
| EVD-CONT-P00-002 | `02-asset-inventory.md` | `78c2d71`        | 8 containers healthy                         | `docker ps` 3h                      |
| EVD-CONT-P00-003 | `03-maturity-matrix.md` | `78c2d71`        | docs vs code separation                      | `docs vs code` 93 vs PASS           |
| EVD-CONT-P00-004 | `04-risk-register.md`   | `78c2d71`        | 0 mandatory blocker                          | `risk 5 U-01 future only`           |
| EVD-CONT-P00-005 | `05-phase-map.md`       | `78c2d71`        | 66 prompts `MVP 93.6 → CONT active`          | `EXECUTION-STATUS 160 lines`        |
| EVD-CONT-P00-006 | `06-gate-report.md`     | `95.47`          | Gate APPROVED                                | `06-gate-report.md` 95.47           |
| EVD-CONT-P00-007 | `apps/api/.venv`        | `Python 3.12.13` | `uv` venv pin                                | `.python-version`                   |
| EVD-CONT-P00-008 | `temporal:7233`         | `1.26 healthy`   | `temporal workflow count 1251`               | `docker exec`                       |
| EVD-CONT-P00-009 | `k6-langgraph 50VU`     | `0% p95 2.81s`   | Perf not re-measured for baseline (deferred) | `hardening 27`                      |
| EVD-CONT-P00-010 | `openapi.yaml`          | `110 paths`      | Machine-readable contract `158`              | `docs/backend/openapi.yaml`         |

All evidence `git` immutable at `78c2d71`; rollback `git checkout origin/master`
restores baseline.

## Repro Steps

```bash
git checkout 78c2d71
uv run --project apps/api python -m pytest apps/api/tests/graph apps/api/tests/temporal -q   # 83
uv run --project apps/api python -m pytest apps/api/tests/test_product_closure_e2e.py -q    # 10
uv run --project apps/api python -m api.temporal.worker --dry-run   # 11
docker compose --profile temporal ps   # 8 healthy
```
