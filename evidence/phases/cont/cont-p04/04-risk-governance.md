# CONT-P04 — 04 Risk / Governance Model — Burn-down

**Deliverable:** `DEL-CONT-P04-04` | **Owner:** Risk Owner + Program

## Burn-down

| Risk                                | Sev      | Mitigation                     | Review Cadence | Expiry     |
| ----------------------------------- | -------- | ------------------------------ | -------------- | ---------- |
| RISK-CONT-P00-01 Docs as runtime    | Critical | Falsifiable `01 6 PS`          | Per-wave gate  | `CONT-P21` |
| RISK-CONT-P00-05 Old/new divergence | Critical | `SETNX EX120` per-wave ledger  | Per-wave       | `CONT-P21` |
| R-06 Tenant cells                   | High     | `42/42 RLS` + cell `isolation` | `CONT-P07`     | `CONT-P07` |

_Decision-expiry reviews: each wave gate reviews `DEC-CONT-P0x-01..` expiry
`quarterly 2026-11-22` `22 backlog` precedent._

## Governance

- **Kill switches:** `LANGGRAPH_ENABLED=false`, `AGENT_REACT_ENABLED=false`,
  `BROWSER_TOOLS_ENABLED` per `05-phase-map` + expiry audit
- **Rollback checkpoints:** per-wave `sched_job:{id}:{slot} SETNX` +
  `REJECT_DUPLICATE` + `WorkflowReplayer` `p21 chaos 5 faults`
