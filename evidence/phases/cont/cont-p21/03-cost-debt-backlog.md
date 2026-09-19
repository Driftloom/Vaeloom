# CONT-P21 — 03 Cost / Debt Backlog (WS-21.4, DEL-03)

## Cost posture (current)

Model catalog pricing + per-agent/per-workspace tracking + enforceable
budgets + daily quotas (all live). No overspend signal possible offline;
FinOps review monthly per cadence (01).

## Debt backlog (prioritized, extends STAB-01..10)

| ID | Debt | Priority | Owner |
| --- | --- | --- | --- |
| (STAB-01..10 as in `cont-p20/05`) | carried verbatim | P0–P3 | as assigned |
| DEBT-11 | `commonLabels` deprecation warnings (kustomize) | P3 | Platform |
| DEBT-12 | Custom migration runner 0002–0009 vs alembic overlap | P2 (folds into STAB-01 fix) | Eng |
| DEBT-13 | FileStateStore fallback retained by design (not debt — documented keep) | — | — |

Root-cause habit: every defect since P12 carries fix-path + trigger, not
just symptoms (registers P12→P21 auditable).
