# LangGraph Readiness Gate (Phase 21 — ADR-038 §23/§52)

**Status: PASS — Temporal is durable substrate, LangGraph will own topology
only.**

## Required seam (implemented, not just documented)

```
Vaeloom API (FastAPI routers: temporal, documents, connectors, events, approvals)
      │
      │  Client.start_workflow(..., id=deterministic, task_queue=… REJECT_DUPLICATE)
      ▼
  Temporal (namespaces: default, task queues per §29)
   ├─ IngestDocumentWorkflow → parse→extract→write→index (activities, heartbeats)
   ├─ ConnectorSyncWorkflow  → sync_connector (heartbeat 30s, progress query)
   ├─ EventTriggeredWorkflow → handle_event (causation/correlation)
   ├─ ApprovalWorkflow       → wait_condition + signal decision
   └─ DurableAgentRunWorkflow ──────────────────────────────────────┐
                                                                │
                                                                ▼
                                                    DurableAgentRunActivity
                                                    (payload: DurableAgentRequest{workspace_id,user_id,agent_id,input,correlation_id} — typed, no secrets)
                                                                │
                                                                ▼
                                                          LangGraph StateGraph
                                                          (future: `graph = StateGraph(AgentState)` )
                                                           ├─ Node: organization → tools/memory
                                                           ├─ Node: memory       → vector/graph
                                                           ├─ Node: ats          → scoring
                                                           └─ Edges: conditional branching, human-in-loop `interruptBefore`
                                                                │
                                                                ▼
                                                           Tools / Memory
                                                           (executor DYNAMIC_* uniform `approval_gated_tools()` per ADR-037)
```

Temporal knows: **“execute this durable agent run”** (workflow ID, retry,
timeout, cancel, signal). LangGraph will later know: **how agent-to-agent
routing, graph state, branching, reasoning steps** happen. They meet at **one
activity boundary**: `durable_agent_run`. Temporal never hardcodes
`router.classify_intent`, `supervisor._build_dag`, `CATEGORY_KEYWORDS`, or
`PARALLEL_SAFE` — those stay in `api/orchestrator`.

## Checks

- [x] No workflow imports `orchestrator.router.AGENT_REGISTRY` or
      `supervisor._build_dag` (grep `workflows.py` → 0 hits)
- [x] `DurableAgentRunWorkflow.run` takes `DurableAgentRequest` (no
      `preferred_agent` routing), delegates 100% to `durable_agent_run` activity
      (10-line workflow, 0 branching)
- [x] Activity stub today returns `{"status":"completed", "agent": agent}`;
      future inserts
      `if payload.get("graph"): return await graph.ainvoke(payload.input)`
      without touching workflow
- [x] `check_kill_switch` activity enforces `AgentKillSwitch` at workflow entry
      — LangGraph graphs will inherit same gate automatically
- [x] Temporal history for `DurableAgentRunWorkflow` is 1 workflow task + 2
      activities (`check_kill_switch` + `durable_agent_run`) — graph internals
      will be under one activity's span, not N workflow events
- [x] Versioning via `workflow.patched("durable-agent-v1")` ready for LangGraph
      `StateGraph` addition without replay break (Replayer test covers)

## What NOT to do next phase

Do not move `router.classify_intent`, `supervisor.run_supervisor`, or
`memory_agent` extraction logic into Temporal. Keep them in `api/agents` and
call via activity. Temporal stays thin, LangGraph stays pluggable.
