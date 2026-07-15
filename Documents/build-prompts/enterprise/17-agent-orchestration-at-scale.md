# 17 — Agent Orchestration at Scale (Enterprise, new)

## Read first
`enterprise/05-agent-harness-orchestration.md` (the harness upgrades — durable state, QA Agent, Self-Improvement Agent, subagent isolation) and `enterprise/08-specialist-agents.md` (the full 28-agent roster). This file exists because routing a request among 8 agents in a single-tenant MVP and routing among 28 agents across many tenants are genuinely different engineering problems — MVP's "lightweight classification call" (see `mvp/05-agent-harness-orchestration.md`) does not scale cleanly to this, and pretending it does would just hide the complexity inside an already-full harness file instead of solving it.

## Objective
Turn the Orchestrator from MVP's simple intent-router into a routing and coordination system that can correctly and observably dispatch across 28 agents, respect tenant policy before a request ever reaches an agent, coordinate genuine multi-agent plans, and degrade gracefully when a specific agent is unhealthy.

## Requirements

**Two-stage routing:** replace MVP's single classification call with a coarse-to-fine router — first classify the request into a broad category (e.g. "career/job search," "document/organization," "schedule/time"), then select the specific agent within that category (e.g. distinguishing Job Search Agent from Internship Agent, or Scheduler Agent from Calendar Agent). When confidence at either stage is low, the Orchestrator asks a disambiguating question rather than guessing — this is the same "ask, don't guess" principle the base agent contract already requires of individual agents, applied one level up at the routing layer itself.

**Tenant-aware dispatch:** every routing decision checks the requesting tenant's ABAC policy (`enterprise/11-guardrails-safety.md`) *before* dispatch, not as an after-the-fact block once an agent has already started work. If a tenant has disallowed a capability (e.g. Application Agent's auto-submit path), the Orchestrator routes around it entirely — the disallowed agent path should be invisible to the routing decision, not attempted-then-rejected.

**Multi-agent plan assembly:** formalize the "cross-agent negotiated handoff" mechanism from `enterprise/05` into an explicit, inspectable Plan object — a directed acyclic graph of agent calls with declared dependencies between them, assembled by the Orchestrator and executed against the durable state store from `enterprise/05`. On a node's failure, the Orchestrator decides — based on the plan's declared dependency structure, not a blanket policy — whether to retry that node, skip it and continue, or abort the whole plan because downstream nodes depend on its output.

**Priority queueing:** with many agents and tenants in flight simultaneously, request handling must be priority-aware, not FIFO — an interactive chat request a user is actively waiting on should preempt a scheduled background Reflection Agent run or a bulk re-ingestion job. Implement distinct priority tiers (interactive > scheduled > background-batch) at the queue level the Orchestrator dispatches from.

**Circuit breaking:** the Orchestrator consumes the eval framework's per-agent accuracy/failure-rate signals (`enterprise/10-evaluation-framework.md`) and the observability layer's anomaly signals (`enterprise/12-observability-tracing.md`) to detect an agent that's failing repeatedly in production. When an agent trips this threshold, the Orchestrator stops routing to it automatically and instead falls back to a simpler path (a generic Document Agent response, or a direct human-review queue) rather than continuing to dispatch to a known-broken agent and burning cost/latency on calls likely to fail anyway. Circuit-broken agents are surfaced clearly on the AI Agents admin screen (`enterprise/14-frontend-workspace.md`) with a manual reset path once the underlying issue is fixed.

**Orchestration observability:** every routing decision — which agent was chosen, what alternatives existed, what confidence score decided it, whether tenant policy excluded any candidates — is itself traced as its own span (ties into `enterprise/12-observability-tracing.md`), so a reviewer can answer "why did this request go to Agent X and not Agent Y" without guessing.

## Out of scope
Changing the underlying agent contract from `mvp/05-agent-harness-orchestration.md` (mission, tools, memory_scopes, default_autonomy, fallback) — this file is purely about the routing/coordination layer sitting above unchanged agents, not a redesign of what an agent is.

## Acceptance criteria
- [ ] A test set of ambiguous requests (e.g. phrasing that could plausibly route to either Job Search Agent or Internship Agent) correctly triggers a disambiguating question rather than a silent guess, at a defined confidence threshold.
- [ ] A tenant with a disallowed capability never has a request routed to the disallowed agent path, verified by a test asserting the excluded agent doesn't even appear among considered candidates in the routing trace.
- [ ] A multi-node test plan with a deliberately failing middle node correctly aborts downstream-dependent nodes while allowing independent branches to complete.
- [ ] An interactive test request is measurably dispatched ahead of a queued background job under simulated load.
- [ ] An agent deliberately forced into a high failure rate in a test environment trips the circuit breaker within the defined threshold, and requests are correctly rerouted to the fallback path until manually reset.
- [ ] A routing decision trace, pulled for a sample request, clearly shows the candidates considered and why the winning agent was chosen.
