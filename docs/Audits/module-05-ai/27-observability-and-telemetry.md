# Module 05: Observability, Distributed Tracing & Dynamic Kill Switches
**Audit Identifier**: `AUD-M05-AI-27`
**Scope**: OpenTelemetry context propagation, correlation IDs, latency histograms, and AgentKillSwitch.

---

## 1. Observability Infrastructure

Implemented in `api/infrastructure/agent_observability.py`:
- **Distributed Context**: `correlation_id` and `tenant_id` are propagated across FastAPI requests, Temporal activity payloads, and vector store queries via `contextvars`.
- **In-Process Latency Histograms**:
  - `record_embedding_latency(ms)`
  - `record_rag_latency(ms)`
  - `record_tool_latency(ms)`
- **Agent Metrics Aggregation**: `AgentMetricsCollector` computes success rates, p95 latencies, error breakdowns, and per-agent token/cost metrics.
- **Dynamic Kill Switch**: `AgentKillSwitch` provides sub-second circuit breaking to instantly disable individual agents or ingestion workflows during anomalies.

---

## 2. Verification Evidence

- `test_module05_observability.py`:
  - `test_module05_observability_latency_tracking`: Confirms latency snapshot recording.
  - `test_module05_observability_agent_kill_switch`: Confirms sub-second agent disabling and reactivation.
  - `test_module05_observability_metrics_aggregation`: Validates aggregation, p95 computation, and error counts.
