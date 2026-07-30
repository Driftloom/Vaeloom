# 05 — Agent Harness & Orchestration (MVP)

> **Purpose:** Build the shared agent runtime (harness) and Orchestrator that every specialist agent runs inside — one loop, one contract, auditable by design.
> **Status:** ✅ Upgraded to enterprise quality
> **Owner:** Engineering Team
> **Last Updated:** 2026-07-13

## Overview

The Agent Harness is the production runtime environment around every model call. Instead of each specialist agent implementing its own execution logic, this phase builds one shared agentic loop — Plan → Act → Observe → Reflect → Improve — that every agent executes within. The harness enforces the agent contract (fixed mission, declared tool list, memory scopes, autonomy level, required fallback), persists loop state to Redis for crash recovery, and publishes observable events at every phase.

The Orchestrator (`router.py`) is the single entry point for all agent requests. It performs intent classification to route to the correct specialist agent, passes every request through the Permission Engine before execution begins, and manages the bounded Reflect→re-Plan loop with a maximum of 3 iterations before escalating to the user. State is checkpointed to Redis after every phase, enabling mid-loop crash recovery.

This phase defines the eight-part harness anatomy (Planner, Memory, State, Tools, Guardrails, Evals, Context, Execution Control) and maps each part to the file where it's implemented. Every future agent (file 08's seven specialist agents, plus all enterprise agents) runs inside this harness — making them auditable, measurable, and safe by construction rather than by bespoke effort.

## Goals

1. Implement the shared agent contract (`base.py`) that enforces fixed mission, tool list, memory scopes, autonomy level, and fallback behavior
2. Build the five-phase agentic loop (Plan → Act → Observe → Reflect → Improve) as distinct, observable, traceable steps
3. Implement Redis-backed state persistence for crash-resilient multi-step execution
4. Build the Orchestrator with intent-based routing and Permission Engine integration
5. Publish observable events at every loop phase for tracing and audit (file 12)

```mermaid
graph TD
    classDef primary fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef secondary fill:#e8f5e9,stroke:#2e7d32,color:#000

    REQ["User Request / Scheduled Trigger"]:::primary
    ORCH["Orchestrator (router.py)"]:::primary
    PERM["Permission Engine Check"]:::secondary

    subgraph Loop["Agentic Loop (implemented once)"]
        PLAN["1. Plan<br/>Intended action from request + context"]:::primary
        ACT["2. Act<br/>Execute tool call(s)"]:::secondary
        OBS["3. Observe<br/>Capture tool result"]:::secondary
        REFL["4. Reflect<br/>Evaluate if request is satisfied"]:::secondary
        IMPR["5. Improve<br/>Log outcome for evals"]:::primary
    end

    STATE["State Persistence<br/>(Redis checkpoint per phase)"]:::secondary
    EVENTS["Event Bus<br/>(Redis pub/sub)"]:::secondary

    subgraph Contract["Agent Contract (base.py)"]
        MISSION["fixed mission"]:::secondary
        TOOLS["declared tool list"]:::secondary
        SCOPES["memory read/write scopes"]:::secondary
        AUTONOMY["autonomy level"]:::secondary
        FALLBACK["fallback() method"]:::secondary
    end

    REQ --> ORCH
    ORCH --> PERM
    PERM --> PLAN
    PLAN --> ACT
    ACT --> OBS
    OBS --> REFL
    REFL -->|"satisfied"| IMPR
    REFL -->|"not satisfied (≤3 tries)"| PLAN
    REFL -->|"max retries exceeded"| FALLBACK
    STATE -.-> PLAN
    STATE -.-> ACT
    STATE -.-> OBS
    EVENTS -.-> LOOP
    IMPR -.-> EVENTS
```

## Context

Read `04-memory-system.md` first. This phase builds the shared runtime every specialist agent (file 08) runs inside — the harness is more important than any single agent, since it's what makes twenty-eight future agents auditable instead of twenty-eight bespoke black boxes. Get this right once; every later agent becomes cheap to add.

## Objective

Build the agent harness (the production environment around a model call) and the Orchestrator that routes requests into it. The harness implements one agentic loop, shared by every agent: **Plan → Act → Observe → Reflect → Improve.**

## Harness anatomy — the eight parts, and where each one actually lives

The model is only one component. Everything around it — the harness — is what makes an agent reliable rather than a chatbot with tools bolted on. This project splits the harness into eight named parts; none of them live only in this file, so this table is the map back to where each is actually implemented:

| Harness part | What it does | Where it's built |
|---|---|---|
| Planner | Turns a request + context into an intended action | The "Plan" phase, below |
| Memory | Durable knowledge the agent reads/writes | File 04 |
| State | What's in progress right now, survivable across a failure | New requirement, below |
| Tools | What the agent is allowed to call | File 07 |
| Guardrails | What the agent is not allowed to do | File 11 |
| Evals | Whether the agent is actually any good | File 10 |
| Context | What's assembled and handed to the model for this call | File 06 |
| Execution control | What actually gets to run, and under whose permission | The "Act" phase + Permission Engine (file 13) |

If a future change touches any one of these, update the relevant file above — don't duplicate harness logic into a new location just because it's convenient in the moment.

## Requirements

**Agent contract (`apps/ai-service/agents/base.py`):** every agent is a class implementing:

- `mission: str` — fixed, cannot be overridden at runtime.
- `tools: list[Tool]` — the declared, MCP-shaped tool list (file 07) this agent may call; calling anything outside this list must be impossible, not just discouraged.
- `memory_scopes: MemoryScopes` — explicit read/write permissions per memory type (file 04's types); enforced by the harness, not by the agent's own discipline.
- `default_autonomy: Literal["suggest", "full", "read_only", "approval_gated"]`.
- `fallback() -> Action` — required method defining what the agent does when uncertain (ask the user; never guess).

**The loop (`apps/ai-service/orchestrator/loop.py`):** implement each phase as a distinct, observable step (this maps directly to file 12's tracing requirements):

1. **Plan** — given the request and retrieved context (file 06), the agent produces an intended action.
2. **Act** — the harness executes the planned tool call(s), never the agent directly.
3. **Observe** — the tool result is captured and attached to the agent's context.
4. **Reflect** — the agent (or, for MVP, a simple rule-check) evaluates whether the observed result actually satisfies the original request; if not, loop back to Plan with the new information (bounded — cap at a max of 3 iterations before escalating to the user).
5. **Improve** — the outcome (success/failure/user-correction) is logged in a form the eval framework (file 10) can consume later; MVP just needs the logging hook, not automated improvement yet.

**State persistence (`apps/ai-service/orchestrator/state.py`):** a request's loop state (which phase it's in, what's been planned, what's been observed so far) is checkpointed after every phase to Redis, keyed by a request ID — not held only in an in-memory process variable. If the `ai-service` process crashes or restarts mid-loop, the request resumes from its last completed phase on restart rather than silently vanishing or restarting from Plan with no memory of prior Observe results. This is scoped to single-request resumability within one service instance's lifetime for MVP; durable, cross-session resumability for long-running multi-step plans is an enterprise upgrade (see `enterprise/05-agent-harness-orchestration.md`).

**Orchestrator (`apps/ai-service/orchestrator/router.py`):**

- Single entry point: `handle(request: UserRequest | ScheduledTrigger) -> AgentResponse`.
- Routes to the correct specialist agent based on intent (a lightweight classification call is sufficient for MVP — no need for a complex planner agent yet).
- Every routed call passes through the Permission Engine (file 13) before the target agent's loop begins — no agent-to-agent call bypasses this, including internal ones.
- Every phase of the loop publishes an event (`agent.plan`, `agent.act`, `agent.observe`, etc.) to the event bus (Redis pub/sub is sufficient for MVP; Kafka is an enterprise upgrade) for the observability layer (file 12) to consume.

## Out of scope

The Self-Improvement Agent and formal Quality Assurance Agent gate (both enterprise phase — MVP relies on the "Reflect" step's basic rule-checks and human approval instead), multi-agent negotiated handoffs, subagent context isolation for parallel work (single-threaded loop per request is fine for MVP).

## Acceptance criteria

- [ ] A stub "echo agent" (mission: repeat back what it's told) runs through all five loop phases with each phase individually visible in the logs.
- [ ] Attempting to call a tool not in an agent's declared `tools` list raises an error at the harness level, not just a lint warning.
- [ ] A forced tool failure during "Act" correctly triggers a bounded Reflect→re-Plan cycle, and escalates to the user after 3 failed attempts rather than looping forever.
- [ ] The Orchestrator correctly routes at least three distinct sample requests to three different stub agents based on intent.
- [ ] Killing the `ai-service` process mid-loop (after Observe, before Reflect) and restarting it resumes the request from the checkpointed state rather than restarting from Plan or losing the request entirely.

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Implementing the agentic loop separately per agent | Every agent becomes a unique black box — audit, evals, and guardrails can't be applied uniformly |
| Letting agents call tools outside their declared list | An agent meant for reading memory could accidentally write or delete |
| Skipping state persistence for the loop | A crash mid-operation silently drops the request with no recovery path |

## Best Practices

| Practice | Why |
|----------|-----|
| Make every loop phase observable from day one | File 12's tracing depends on discrete, named phases — retrofitting is harder than building it in |
| Cap the Reflect → re-Plan loop at 3 iterations max | Prevents infinite loops and ensures user escalation happens before timeout |
| Test fallback behavior with a mock "uncertain" agent | The fallback path is the most important safety net — it must work even when the model doesn't |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Orchestrator could route to wrong agent if intent classification is poor | Add a confidence threshold; route to a clarifying question if below threshold |
| State checkpoint data in Redis contains agent context | Encrypt Redis data at rest; set TTL on checkpoint keys |
| Agent contract `fallback()` could be left unimplemented | Make `fallback()` an abstract method — the harness must reject any agent that doesn't define it |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Redis checkpoint writes add latency to every loop phase | Async checkpoint writes (fire-and-forget with retry queue); block only on the Improve phase |
| Per-request single-threaded loop limits throughput | Horizontally scale ai-service instances; each worker handles independent requests |
| Intent classification model call adds latency to every request | Use a lightweight classifier for routing; reserve strong model for the agent's loop body |

## Scope

### In Scope

- Shared agent base class (`base.py`) enforcing fixed mission, declared tool list, memory scopes, autonomy level, and required fallback method
- Five-phase agentic loop (Plan → Act → Observe → Reflect → Improve) as distinct, observable, traceable steps
- Redis-backed state persistence checkpointing every loop phase for crash recovery
- Orchestrator (`router.py`) with intent-based routing and Permission Engine integration
- Event publishing at every loop phase for observability and audit
- Bounded Reflect→re-Plan loop with max 3 iterations before user escalation

### Out of Scope

- Self-Improvement Agent for automated loop optimization (enterprise)
- Multi-agent negotiated handoffs for complex workflows (planned Q2 2027)
- Subagent context isolation for parallel work within a request (planned Q2 2027)
- Formal Quality Assurance Agent gate (planned Q1 2027)
- Cross-session durable resumability for long-running multi-step plans (planned Q2 2027)

---

## Examples

```python
# Agent contract definition
class OrganizationAgent(BaseAgent):
    mission: str = "Organize, categorize, and deduplicate workspace documents"
    tools: list[Tool] = [rename_file, move_file, categorize_document]
    memory_scopes: MemoryScopes = MemoryScopes(
        read_types=["document"],
        write_types=["agent_actions"],
    )
    default_autonomy: str = "suggest"
    fallback: Callable = ask_user_for_clarification
```

```python
# Agentic loop implementation
async def run_agent_loop(request: AgentRequest) -> AgentResponse:
    state = await load_or_create_state(request.id)
    for iteration in range(3):  # bounded loop
        plan = await plan_phase(request, state)
        state.add_phase("plan", plan)
        await save_checkpoint(state)

        act_result = await act_phase(plan)
        state.add_phase("act", act_result)
        await save_checkpoint(state)

        observe_result = await observe_phase(act_result)
        state.add_phase("observe", observe_result)
        await save_checkpoint(state)

        reflect_result = await reflect_phase(request, observe_result)
        if reflect_result.is_satisfied:
            return await improve_phase(state)
        state.add_phase("reflect", reflect_result)

    return await escalate_to_user(state)  # max retries exceeded
```

```python
# Orchestrator router
async def handle(request: UserRequest) -> AgentResponse:
    intent = await classify_intent(request.message)
    agent = resolve_agent(intent)

    await permission_engine.check(
        agent=agent.name,
        action="execute",
        workspace_id=request.workspace_id,
    )

    trace.set_attribute("agent.name", agent.name)
    return await run_agent_loop(AgentRequest(agent=agent, ...))
```

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Multi-agent negotiated handoffs for complex workflows | Medium | High | Q2 2027 |
| Subagent context isolation for parallel work within a request | Low | High | Q2 2027 |
| Self-Improvement Agent for automated loop optimization | High | High | Q2 2027 |
| Formal Quality Assurance Agent gate (separate from harness) | Medium | Medium | Q1 2027 |
| Cross-session durable resumability for long-running multi-step plans | Low | High | Q2 2027 |

## Related Documents

- [04 — Memory System](04-memory-system.md) — Prerequisite: memory read/write interface
- [06 — RAG Retrieval](06-rag-retrieval.md) — Context assembly for the Plan phase
- [07 — MCP Tool Ecosystem](07-mcp-tool-ecosystem.md) — Tool definitions the Act phase executes
- [08 — Specialist Agents](08-specialist-agents.md) — Seven agents that extend this harness
- [12 — Observability & Tracing](12-observability-tracing.md) — Phase-span instrumentation
