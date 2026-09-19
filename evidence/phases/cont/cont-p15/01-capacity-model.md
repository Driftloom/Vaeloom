# CONT-P15 — 01 Capacity / Workload Model (WS-15.1, DEL-01)

## Workload definition (approved baselines, carried)

| Dimension | Baseline | Source |
| --- | --- | --- |
| API throughput | 20 RPS headroom 60% | P15 `--cov` + k6 era |
| Latency budget | p50 45ms / p95 120ms (read <200ms, write <500ms) | `infra/ops/performance-budget.json` |
| Load shape | 50 VU ramp (1m→3m→1m), p95<500ms, err<1% | `infra/ops/load-test/k6-script.js` + `k6-stress.js` |
| Graph/temporal load | dedicated suites | `testing/performance/k6-langgraph.js`, `k6-temporal.js`, `k6-script.js` |
| LLM cost | per-1k pricing in `model_router.py` + workspace budgets (Wave 1) + quotas | code |

## Scaling model (verified @ HEAD)

- HPA: api 3→10 (CPU70/MEM80) + temporal-worker HPA
  (`infra/kubernetes/overlays/prod/hpa.yaml`).
- Rate limits: 100 rpm default / 1000 api-key (`config.py`); Redis-backed
  with in-memory fallback (warns when URL unset).
- Circuit breakers 3/30s + per-agent rate limits + spend/budget ceilings
  (Wave 1/3) bound blast radius per tenant.
- Worker concurrency per Temporal queue (`worker.py:max_concurrent_activities`)
  + 30s graceful shutdown.

## Finding (new, this phase)

- **DEF-P15-06 (Medium):** fresh SQLite server bootstrap yields partial schema
  (9 tables, no `users`) → signup 500. Reproduced 2×. Startup log shows
  un-awaited `run_async_migrations` coroutine warning; custom runner covers
  only 0002–0009. PG/alembic path unaffected per `test_migrations.py`
  (12/12 incl. full chain). Owner: Eng. Fix path: await/remove dead coroutine
  reference; extend or retire custom runner. Non-blocking for P15 (dev-path
  only; prod DR is RDS snapshots), must-fix before any SQLite-based
  restore drill claims.
