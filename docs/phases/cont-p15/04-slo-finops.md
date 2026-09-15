# CONT-P15 — 04 SLO / Error Budget + FinOps (WS-15.4/15.5, DEL-03/04)

## SLO/error budget (DEL-03)

Per `docs/operations/SLO.md` + §19 ladder: 50% consumed normal ops →
75% freeze features → 100% emergency + redesign. Grafana 23 panels carry
latency/error signals (P17 baseline, no drift).

## FinOps / triggers (DEL-04)

- Unit cost: `model_router.py` per-1k pricing × tracked usage
  (`agent_costs`, per-agent/per-workspace) + Wave-1 enforceable budgets +
  Temporal daily quotas (1000 req / 100k tokens).
- Scaling triggers: HPA CPU70/MEM80 (measured, not guessed); queue lag via
  Temporal metrics; model spend via budget-exhausted cards.
- Cost target carried: $0.02/1k baseline era; current catalog pricing in code
  is authoritative (no invented rollup here).

## Scaling runbook (DEL-05)

`docs/phases/cont-p13/05-runbooks-rollback.md` pattern + HPA + worker
concurrency + graceful shutdown + revert-by-commit. No new scaling change in
this phase (validation only).
