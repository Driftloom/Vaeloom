# CONT-P12 — 05 AI Observability & Kill Switches — DEL-CONT-P12-05

**Deliverable:** `DEL-CONT-P12-05` | **Version:** 1.0 | **Date:** 2026-09-01 |
**Owner:** SRE + AI Safety Lead | **Reviewers:** SRE, Security

## Config — task 8 lineage + oversight

`config.py:158` new flags (all safe-default off/false):

```
agent_kill_switches: dict[str,bool] = {}  # {"memory": false}
agent_shadow_enabled: bool = False; agent_shadow_percent 0-100
retrieval_hybrid_enabled: bool = True; retrieval_provenance_required: bool = True
eval_shadow_enabled: bool = False
model_lineage_enabled: bool = True; ai_bill_of_materials_enabled: bool = True
```

Parsed via `field_validator parse_kill_switches` JSON string allowed. No
production auto-enable.

## Telemetry — traces/metrics/logs/audit per phase 20

- **Metrics:** `model_router.get_global_summary()`
  `total_cost_usd/total_tokens/call_count/avg_latency_ms` + `metrics.py:7`
  histogram `0.01-10s` + `main.py:317` `/metrics` Prometheus + per-agent
  `record_usage` log `LLM usage: agent=%s model=%s in=%d out=%d cost=$%.6f`.
- **Traces:** `opentelemetry.py:19` Resource `vaeloom-api` +
  `CorrelationIDMiddleware` `X-Request-ID` + `AgentRunContext.run_id`
  `lineage {model,tokens,cost}` propagated without secrets.
- **Logs:** `logging.py:19` JSON `trace_id` + `_redact 9 keys`
  (password/api_key/secret) + `agent_runtime.shadow_compare` verdict logged.
- **Audit:** `audit_service` `AgentAction`
  `tokens_used/cost/duration_ms/idempotency_key/approval_request_id` +
  `memory_taxonomy_ledger` `checksum` + `memory_versions` `old_state/new_state`.

## Dashboards/alerts — Grafana 23 panels retained + AI overlay

Existing `infra/monitoring/grafana/dashboards/*.json` 23 panels +
`latency.json:1` 8 panels + `agents.json:1` 7 panels already cover `p95 120ms`
`SLO 5 alerts 9 rules` `prometheus.yml 15s 4 jobs`. CONT-P12 adds AI
cost/latency series via `model_router._cost_log` → Prometheus `llm_cost_usd` +
`eval_pass_rate` (future `CONT-P13` adds panel `AI cost by agent` when
`model_lineage_enabled`).

## Kill switches / flags — per-phase governance

| Flag                               | Default | Effect when tripped                                       | Owner     | Expiry         |
| ---------------------------------- | ------- | --------------------------------------------------------- | --------- | -------------- |
| `agent_kill_switches.{agent}` true | false   | `agent_runtime.kill_switch_tripped` → 503 + audit         | AI Safety | per-wave       |
| `agent_shadow_enabled` true        | false   | `shadow_compare` live traffic `agent_shadow_percent` hash | AI/ML     | CONT-P13 pilot |
| `retrieval_hybrid_enabled` false   | true    | Fallback ILIKE-only (no pgvector/tsvector)                | Data Eng  | —              |
| `eval_shadow_enabled` true         | false   | `eval_harness.run_all` shadow mode                        | Eval Eng  | pilot          |

All flags audit-logged, per-tenant/cell via `TenantMiddleware` GUC, reversible,
no required-traffic cutover until `EXC-CONT-P11-01` 2026-12-31 strangler allows.

**Tests:** `test_cont_p12: test_config_kill_switches_parsing` hybrid
true/provenance true; `test_agent_runtime_policy_and_sanitize` +
`test_shadow_compare` 9 passed; `promtool 9+4 PASS` retained (`mvp-p17`).

---

_Version 1.0 2026-09-01 —
`rg "agent_kill_switches|shadow" apps/api/src/api/config.py apps/api/src/api/services/agent_runtime.py`._
