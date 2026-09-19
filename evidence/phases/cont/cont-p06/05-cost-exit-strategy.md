# CONT-P06 — 05 Cost / Operability / Exit Strategy

**Deliverable:** `DEL-CONT-P06-05` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** FinOps Specialist + SRE + Cloud Architect

## 1 Cost (PaaS-first deferred per ADR-026)

- **Current:** `terraform 12` `s3+DDB` `0.02/1k` (P15), `k6`
  `20 RPS headroom 60%`, `HPA 2→8` `cpu70 mem80`, `p95 120ms <200`.
- **Scenarios (from CONT-P04 05 4 scenarios):** carry `scenario A/B/C/D` no
  invented procurement `BQ-06` — P06 pins tech, not spend.

## 2 Operability

- `runbooks 4` + `synthetic 3 probes 30s` + `health 3 probes` +
  `alerts 9 rules` + `3 Grafana dashboards 23 panels` (P17 93.2).
- `rollback:` `git revert + docker tag + Temporal REJECT_DUPLICATE` + `reindex`
  projection rebuild.

## 3 Exit Playbooks (per tech, §12.6)

| Technology               | Exit                          | Horizon | Metric            | Owner         |
| ------------------------ | ----------------------------- | ------- | ----------------- | ------------- |
| FastAPI → Flask          | `uvicorn` compat              | W2→P19  | `p95 delta <20ms` | Backend Lead  |
| Next.js → Vite           | `swr` compat                  | W2→P10  | `typecheck 0`     | Frontend Lead |
| pgvector → Qdrant        | `vector <=> vs Qdrant` shadow | W2      | `recall >0.95`    | Data/AI       |
| Temporal → in-proc       | `worker dry-run 11` fallback  | W2      | `queue lag <5m`   | SRE           |
| MCP 2026-07-28 → 2026-11 | `version bump`                | W2      | `discovery 300s`  | Integration   |

**No unbounded dual-run estate** — each exit has horizon `W2→P19`, owner,
metric, cutover/rollback, retirement `0 traffic + drill`.

---

_Version 1.0 2026-08-29 — `k6 p95 120ms` `HPA 2→8` `terraform 12`._
