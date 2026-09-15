# CONT-P20 — 01 Canary / Synthetic Validation (WS-20.1, DEL-01)

## Executed live @ HEAD (boot :8002, 2026-09-15)

Synthetic suite `infra/ops/synthetic-monitoring/` defines 3 probes
(`check-health.sh`: liveness/readiness/startup, 30s interval, 3-strike
alert via `alert-on-failure.sh`). Replicated natively (no bash/docker here):

| Probe | Result |
| --- | --- |
| `GET /health` | 200 |
| `GET /health/ready` | 200 |
| `GET /health/startup` | 200 |
| `GET /metrics` (bonus) | 200 |

**4/4 PASS.** Server stopped + scratch DB removed after probe (clean tree).

## Canary framework (criteria, sponsor-gated execution)

- Stages: shadow (0% authority, measure) → 1% → 10% → 50% → 100% per
  tenant, driven by `agent_shadow_percent` + per-tenant flags.
- Promote/pause thresholds: SLO ladder (§19 P15) + error-budget policy;
  auto-pause on divergence (phase rule).
- No canary traffic exists (no sponsor) — framework VERIFIED present,
  execution NOT_EXECUTED (honest).
