# CONT-P15 — 07 Evidence Bundle

| EVD | Claim | Location | Independent check |
| --- | --- | --- | --- |
| EVD-P15-01 | CB suite green | `test_circuit_breaker.py` | 15/15 @ HEAD |
| EVD-P15-02 | Live boot smoke | `uvicorn api.main:app` | `/health` 200 v0.2.0 |
| EVD-P15-03 | Fresh-bootstrap defect | 2× repro + log (`run_async_migrations` warning) + 9-table probe | DEF-P15-06 |
| EVD-P15-04 | HPA model | `infra/kubernetes/overlays/prod/hpa.yaml` | api 3-10 CPU70/MEM80 + worker HPA |
| EVD-P15-05 | Perf budgets | `infra/ops/performance-budget.json` | p95 200/500ms, lighthouse floors |
| EVD-P15-06 | k6 suites | `infra/ops/load-test/` + `testing/performance/` (5 scripts) | thresholds p95<500 err<1% |
| EVD-P15-07 | SLO/error budgets | `docs/operations/SLO.md` | 6 targets + ladder |
| EVD-P15-08 | DR runbook | `docs/DISASTER_RECOVERY.md` | RTO 1h / RPO 5min, RDS+S3 |
| EVD-P15-09 | Rate/CB/worker guards | `config.py`, `circuit_breaker.py`, `worker.py` | 100rpm/3-30s/per-queue |
| EVD-P15-10 | Predecessor valid | `cont-p14` gate + handoff | 96.91 + authorization |
