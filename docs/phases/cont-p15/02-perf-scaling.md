# CONT-P15 — 02 Performance / Scaling (WS-15.2, DEL-02)

## Executed @ HEAD

- Circuit-breaker suite: `test_circuit_breaker.py` **15/15**.
- Live server smoke: `uvicorn api.main:app` boots, `/health` 200
  (`{"status":"ok","service":"vaeloom-api","version":"0.2.0"}`).
- k6 suites inventoried (5 scripts) + `k6.exe` present in env; full load run
  NOT executed (no seeded load user possible until DEF-P15-06 fixed — signup
  500 on fresh SQLite; honest blocker recorded, not bypassed).

## Carried baselines (zero perf-surface change since measurement)

- p50 45ms / p95 120ms @ 20 RPS; k6 thresholds p95<500ms err<1%.
- Lighthouse budgets (bundle/LCP/CLS/INP) in `performance-budget.json`.

## Decision

- DEC-P15-01: full k6 load re-run deferred until DEF-P15-06 fixed (seeded
  user prerequisite); carried baselines stand for gate. Trigger: DEF-P15-06
  close → run `k6-script.js` @ 50VU and record.
