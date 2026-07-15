# 12 — Observability & Tracing (MVP)

```mermaid
graph TD
    classDef primary fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef secondary fill:#e8f5e9,stroke:#2e7d32,color:#000

    REQ["API Request"]:::primary
    TRACE["Trace ID Generated"]:::primary

    subgraph Spans["Distributed Tracing (OpenTelemetry)"]
        ORCHS["Orchestrator Span"]:::secondary
        PLAN_S["Plan Span"]:::secondary
        ACT_S["Act Span"]:::secondary
        OBS_S["Observe Span"]:::secondary
        REFL_S["Reflect Span"]:::secondary
        IMPR_S["Improve Span"]:::secondary
        TOOL_S["Tool Call Span"]:::secondary
        MEM_S["Memory Read/Write Span"]:::secondary
    end

    LOGS["Structured JSON Logs<br/>trace_id, workspace_id, agent_name"]:::secondary
    AUDIT["Audit Log (agent_actions table)"]:::secondary
    DASH["Per-Agent Dashboards<br/>volume, latency, cost, failure rate"]:::secondary
    APPROVAL["Approval Rate Tracking"]:::secondary
    FAILURE["Failure Path Visibility<br/>(escalation traces)"]:::secondary

    REQ --> TRACE
    TRACE --> ORCHS
    ORCHS --> PLAN_S
    PLAN_S --> ACT_S
    ACT_S --> TOOL_S
    TOOL_S --> OBS_S
    OBS_S --> REFL_S
    REFL_S --> IMPR_S
    IMPR_S --> MEM_S
    TRACE -.-> LOGS
    ACT_S -.-> AUDIT
    LOGS --> DASH
    AUDIT --> DASH
    DASH --> APPROVAL
    DASH --> FAILURE
```

## Context
Read `05-agent-harness-orchestration.md` first. Traditional apps mostly just fail; agents can drift, loop, or quietly do the wrong thing while "succeeding." This phase makes the whole request path — not just errors — inspectable.

## Objective
Instrument the full chain (API request → Orchestrator → agent loop phases → tool calls → memory reads/writes) with distributed tracing, structured logs, and a queryable audit log, so any single request can be reconstructed end to end.

## Requirements

**Tracing (`apps/api` and `apps/ai-service`):** adopt OpenTelemetry across both services. A single incoming API request generates one trace ID that propagates through the Orchestrator, every loop phase (file 05: Plan/Act/Observe/Reflect/Improve), every tool call (file 07), and every memory read/write (file 04) — each as a child span. Export traces to a local Jaeger/Zipkin instance in dev (via docker-compose) and note the production target (e.g. a hosted APM) as a config point for file 16.

**Structured logging:** every log line is JSON with, at minimum: `trace_id`, `workspace_id`, `agent_name` (if applicable), `level`, `message`, `timestamp`. No unstructured `print()`/bare string logs anywhere in `apps/ai-service` or `apps/api`.

**Audit log wiring:** every agent action that reaches the "Act" phase writes a row to `agent_actions` (file 02) — this table IS the audit log surfaced later on the History screen (file 14), not a separate system. Include enough detail (`input_ref`, `output_ref` pointing to stored payloads) to reconstruct what happened without re-running the agent.

**Per-agent dashboards (basic MVP version):** a simple internal endpoint/script aggregating, per agent: call volume, latency percentiles, token cost (from file 09), and failure rate over a time window — doesn't need a polished UI yet, just needs to exist and be queryable.

**Failure path visibility:** when the bounded Reflect→re-Plan loop (file 05) hits its retry cap and escalates, that escalation must be traced distinctly from a normal completion — a reviewer should be able to filter traces specifically for "agent gave up and asked the user."

**Feedback signal tracking:** every approval, rejection, and correction a user makes on an agent's proposed action (file 08's suggest-mode flows) is surfaced as its own continuous, queryable stream — not just a status field buried inside individual `agent_actions` rows. Add a per-agent "approval rate" view to the same dashboards as call volume/latency/cost, so a declining approval rate for a given agent is visible the same way a rising failure rate would be. This is the signal the eval framework's human-eval hook (file 10) and, later, the Self-Improvement Agent (enterprise) actually consume — it needs to be a first-class observability concern, not an implicit byproduct of the audit log.

## Out of scope
A polished observability UI (a hosted APM's own UI is sufficient for MVP), anomaly detection / drift alerting (enterprise — Security Agent territory), long-retention compliance-grade audit storage (enterprise phase).

## Acceptance criteria
- [ ] A single test request can be traced from the API entry point through every agent loop phase to the final response, with no gaps in the span chain.
- [ ] Every `agent_actions` row has enough stored detail to answer "what exactly did this agent do and why" without re-running it.
- [ ] The per-agent dashboard query correctly surfaces a deliberately-injected slow/expensive test call as an outlier.
- [ ] A forced max-retries escalation produces a trace that's distinctly filterable from normal successful traces.
- [ ] A deliberately seeded run of rejected proposals for one agent produces a visibly declining approval-rate trend on that agent's dashboard, queryable independently of the raw audit log.

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Tracing only successful paths, not errors | The most important debugging scenarios (failures, escalations) have the least instrumentation |
| Using unstructured logs with no trace_id | Correlating a log line to a specific request requires manual timestamp matching across services |
| Keeping audit log and observability traces in separate systems | Reconstructing "what happened" requires cross-referencing two sources of truth |

## Best Practices

| Practice | Why |
|----------|-----|
| Propagate one trace ID from the API entry through every downstream call | A single trace ID ties together all spans, logs, and database rows for one request |
| Make every agent loop phase a distinct OpenTelemetry span | Enables filtering traces by phase — e.g. "show me all requests that failed during Act" |
| Surface approval rate on the same dashboard as latency and cost | A declining approval rate is an early warning for quality issues that latency doesn't capture |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Trace spans and logs may contain sensitive user content | Apply PII-filtering to span attributes and log payloads; never log full document content |
| audit log data must survive workspace deletion | Implement the documented minimal audit retention (file 15) with anonymized records |
| Approval rate dashboards could reveal user behavior patterns | Aggregate approval rate data at the team level, not per-user detail, in observability tools |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Every loop phase publishes an event → tracing overhead grows with loop iterations | Sample trace data for high-volume agents; full traces only for errors and escalations |
| Writing `agent_actions` rows on every Act phase adds database load | Batch audit log writes; flush on completion of the Improve phase |
| OpenTelemetry export to Jaeger adds network overhead | Use gRPC exporter with batching; configure max export batch size |
