# CONT-P11 — 05 Runbooks & Dashboards

**Deliverable:** `DEL-CONT-P11-05` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** SRE

## Observability (no new service yet — monolith logical)

| Signal | File | Evidence |
|--------|------|----------|
| `logs JSON` `trace_id + _redact 9 keys` | `infrastructure/logging.py:19` | `_redact` `auth token + secret` |
| `OTel traces` `Resource vaeloom-api` | `infrastructure/opentelemetry.py:19` `main.py:324 instrumement_fastapi` | `prometheus :4318` |
| `metrics histogram 0.01-10s` `/metrics` | `metrics.py:7` `main.py:317 Instrumentator().expose(/metrics)` | `prometheus.yml:1` 15s 4 jobs `alerts.yml:1` 9 rules |
| `Grafana` 3 dashboards 23 panels | `infra/grafana/backend.json 8 + latency.json 8 + agents.json 7` | `mvp-p17 93.2` dashboards |
| `SLO` 99.9% 43.2m + `RPO 1h RTO 15m` | `docs/runbooks/slo-dr.md` | `synthetic 3 probes 30s` `infra/synthetic/check-health.sh:1` |

## Runbooks

| Runbook | File | Trigger |
|---------|------|---------|
| `restore/rollback` | `docs/runbooks/DISASTER.md 308` | `RPO 1h` `pg_basebackup` `infra/backup/*` |
| `ingestion 415/413` | `parsers.py:363 UnsupportedFormatError` + `main.py:256 BodySize` | `415` unsupported `17` list, `413` >25MB |
| `temporal unreachable` | `temporal/client.py` `TemporalUnavailableError 503` `main.py:290` | `fail-closed` not silent fallback `ZT-01` |
| `circuit open` | `circuit_breaker.py:17` `3/30s` | `approvals` retry after `30s` |

## Cost

- `0.02/1k` tokens `agent_costs.py` + `HPA min3 max10 cpu70 mem80` `infra/k8s/hpa.yaml` — no new infra this phase.

---
_Version 1.0 2026-08-31 — `rg "Instrumentator.*metrics" apps/api/src/api/main.py 317`._
