# CONT-P21 — 01 Operating Reviews / Feedback (WS-21.1, DEL-01)

## Review cadence (established this phase, owner + trigger each)

| Review | Cadence | Owner | Trigger/metric |
| --- | --- | --- | --- |
| Gate-score trend (P12→P21) | per-phase | QA | <95 blocks |
| Security posture (red-team/noauth/judge) | per-phase + on router/eval diff | AI Safety | bypass >0 blocks |
| SLO/error-budget burn | continuous (24 rules) + weekly | SRE | ladder §19 P15 |
| Dependency/vuln | CI per-push (audit WFs) + weekly triage | Platform | high/crit → P1 |
| Cost/budget burn | continuous (budgets/quotas) + monthly | FinOps/SRE | 75% → review |
| Docs currency | per-phase + DOCUMENTATION-MAP sync | Tech Writing | stale-count metric |
| Stabilization backlog | per-phase (STAB table) | Release Mgr | P0/P1 aging |

## Feedback loop

Phase retrospectives are the gate `08-registers.md` risk/decision logs
(P12→P21, unbroken chain). No separate ceremony invented.
