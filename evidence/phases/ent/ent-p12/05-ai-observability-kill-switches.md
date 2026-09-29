# ENT-P12 — 05 AI Observability, Spend Governance & Kill Switches

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** `DEL-ENT-P12-05` (v1.0)  
> **Owner:** Principal AI SRE & Observability Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Distributed AI Trajectory Tracing with OpenTelemetry

Every multi-turn agent interaction generates an end-to-end distributed trace
conforming to the OpenTelemetry Generative AI Semantic Conventions
(`infrastructure/opentelemetry.py`):

```
[Trace: 4bf92f3577b34da6a3ce929d0e0e4736]
 ├── [Span: agent.turn — JobSearchAgent] (Duration: 842ms)
 │    ├── [Span: memory.retrieval — pgvector HNSW] (Duration: 14ms)
 │    ├── [Span: llm.system1 — TypeSafe AI Jev choice] (Duration: 32ms)
 │    ├── [Span: tool.execution — search_jobs_board] (Duration: 210ms)
 │    └── [Span: llm.system2 — Gemma 4 31B synthesis] (Duration: 580ms)
```

- **Sensitive Data Redaction:** Prompt contents, completion texts, and candidate
  PII (phone numbers, addresses, personal emails) are strictly scrubbed from
  trace attributes via `_redact()` (`logging.py`). Only token counts, latency
  histograms, and anonymous model IDs are persisted to observability backends.

---

## 2. Prometheus AI Telemetry Metrics

Metrics are exposed on the live `/metrics` endpoint
(`http://127.0.0.1:8000/metrics`) and ingested by Prometheus:

| Metric Name                             |   Type    | Labels                                              | Description                                |
| :-------------------------------------- | :-------: | :-------------------------------------------------- | :----------------------------------------- |
| `vaeloom_agent_turns_total`             |  Counter  | `agent_name`, `status`, `tenant_id`                 | Total executed agent reasoning turns       |
| `vaeloom_agent_turn_duration_seconds`   | Histogram | `agent_name`, `autonomy_tier`                       | End-to-end agent turn latency distribution |
| `vaeloom_llm_tokens_consumed_total`     |  Counter  | `provider`, `model`, `type` (`prompt`/`completion`) | Cumulative token consumption               |
| `vaeloom_llm_cost_usd_total`            |  Counter  | `tenant_id`, `provider`, `model`                    | Real-time inferred cloud spend in USD      |
| `vaeloom_tool_executions_total`         |  Counter  | `tool_name`, `status`, `trust_tier`                 | Tool invocation frequency and error rate   |
| `vaeloom_hitl_approvals_total`          |  Counter  | `action_type`, `decision` (`approved`/`rejected`)   | Human-in-the-Loop decision tracking        |
| `vaeloom_vector_search_latency_seconds` | Histogram | `memory_type`, `index_type`                         | HNSW semantic query latency                |

---

## 3. Real-Time Spend Governance & Token Ceilings

Token consumption and cloud API expenditures are tracked in real-time
(`services/agent_costs.py`):

- **Workspace Spending Allocations:** Enterprise tenants establish monthly spend
  caps (e.g. \$500 / month).
- **Soft Warning Threshold:** When a workspace reaches **80%** of its monthly
  budget, proactive UI notifications alert tenant administrators.
- **Hard Enforcement Ceiling:** When a workspace hits **100%** of its
  allocation, subsequent agent queries automatically degrade to local Ollama
  container models (`gemma4:12b`), preventing unexpected cloud billing overages.

---

## 4. Multi-Tiered Emergency Kill Switches

To guarantee absolute operational control in the event of an upstream model
degradation, prompt injection outbreak, or agent infinite loop, the platform
provides 4 instantaneous kill switches:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      EMERGENCY KILL SWITCH REGISTRY                    │
├────────────────────────┬───────────────────────────────────────────────┤
│ Switch Variable        │ Scope & Action Triggered                      │
├────────────────────────┼───────────────────────────────────────────────┤
│ AGENT_REACT_ENABLED    │ Global: Disables multi-turn ReAct reasoning;  │
│                        │ falls back to single-turn template generation.│
├────────────────────────┼───────────────────────────────────────────────┤
│ BROWSER_TOOLS_ENABLED  │ Global: Instantly disables all external web   │
│                        │ scraping and headless browser tools.          │
├────────────────────────┼───────────────────────────────────────────────┤
│ MCP_BRIDGES_ENABLED    │ Global: Halts execution of all Model Context  │
│                        │ Protocol connector tools across all tenants.  │
├────────────────────────┼───────────────────────────────────────────────┤
│ AGENT_<NAME>_ENABLED   │ Agent-specific: Disables individual agent     │
│                        │ (e.g., AGENT_GMAIL_ENABLED=false).            │
└────────────────────────┴───────────────────────────────────────────────┘
```

- **Dynamic Activation:** Kill switches can be toggled via environment variables
  or updated dynamically in Redis within $< 1\text{ second}$ without restarting
  backend server processes.

---

_Signed: Principal AI SRE & Observability Lead — 2026-09-29_
