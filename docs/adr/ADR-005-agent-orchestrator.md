# ADR-005: Agent Orchestrator Pattern

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

The Vaeloom backend must route user requests to specialized agents (Resume, ATS, Job Search, Gmail, Scheduler, Organization, Analytics, Application), support multi-step agentic loops with tool calls, stream responses via SSE, and allow scheduling of agent runs. Each agent has a distinct tool list, prompt template, and execution profile.

Options considered: LangChain/LangGraph, AutoGen, CrewAI, Custom orchestrator, Temporal.io workflows.

## Decision

Build a **custom lightweight agent orchestrator** with the following components:

1. **Orchestrator Router** (`orchestrator/router.py`) — classifies incoming requests and routes to the appropriate agent handler
2. **Agent Handlers** (`agents/*/handler.py`) — each agent defines its system prompt, available tools, and execution logic
3. **Execution Loop** (`orchestrator/loop.py`) — manages the agentic loop (think → tool-call → observe → continue/stop) with max-iteration guard
4. **State Manager** (`orchestrator/state.py`) — holds conversation context, tool call history, and intermediate results
5. **Streaming** — agents support both blocking and SSE streaming responses via `StreamingResponse`
6. **Scheduling** — agents can be scheduled via CRON expressions through the scheduler service

## Consequences

**Positive:**
- Minimal dependencies — no framework lock-in, full control over tool schema and streaming format
- Each agent is a single handler file with clear inputs/outputs — easy to add new agents
- Streaming SSE works natively with FastAPI `StreamingResponse` and `async for chunk in agent.execute()`
- Circuit breaker and fallback policies wrap each agent call independently
- Per-agent rate limits via `agent_limits.py` prevent single agent from consuming all capacity

**Negative:**
- Missing LangChain ecosystem features (built-in memory, toolkits, retrievers) — must implement custom equivalents
- No built-in observability for agent traces at the framework level; we use OpenTelemetry spans manually in each handler
- Multi-agent coordination (handoffs, parallel execution) must be built explicitly rather than declaratively
- Testing requires mocking both LLM calls and tool execution outputs
