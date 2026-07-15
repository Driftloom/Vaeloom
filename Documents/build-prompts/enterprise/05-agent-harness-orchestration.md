# 05 — Agent Harness & Orchestration (Enterprise upgrade)

## Read first
`mvp/05-agent-harness-orchestration.md`.

## Objective
Promote two concepts that were informal in MVP (the "Improve" loop phase's logging, and guardrail middleware) into two real, standalone agents — Self-Improvement and Quality Assurance — plus upgrade State to durable, cross-session persistence and enable richer multi-agent handoffs.

## Where this file ends and file 17 begins
This file upgrades the harness itself — the eight-part anatomy from `mvp/05`'s Harness Anatomy table, now running at enterprise scale. It does NOT cover how requests get routed among 28 agents, tenant-aware dispatch, request prioritization, or circuit-breaking a misbehaving agent — that's genuinely a different, larger problem once you're past MVP's 8 agents and single-tenant assumption, and it has its own file: `17-agent-orchestration-at-scale.md`. Read this file for what the harness's parts become; read file 17 for how requests actually find their way through 28 of them.

## Requirements
- **State, upgraded to durable and cross-session:** MVP's state checkpointing (Redis, single-service-instance lifetime) becomes a durable, distributed state store — a long-running multi-step plan (see Cross-agent negotiated handoffs, below) must survive a full service restart, a deploy, or a node failure, and resume from its last completed step days later if needed, not just across a single crash-restart cycle. Back this with a persisted store (Postgres or a dedicated durable-workflow store), not Redis alone — Redis's role becomes a fast-path cache in front of it.
- **Quality Assurance Agent (`apps/ai-service/agents/qa_agent/`):** a real gate, not MVP's harness-level guardrail middleware alone — sits structurally between every action-capable agent and delivery/execution. Reviews a candidate output (a proposed rename, a drafted email, an application about to submit) against correctness and policy checks, returns pass/flag. Deliberately conservative: a flagged-but-fine output costs one extra confirmation click; a passed-but-wrong output costs trust. Per-agent QA thresholds should be learned from that agent's historical accuracy (a well-proven agent needs a lighter check than a newly added one) — pull this from the eval framework's per-agent scores (`enterprise/10-evaluation-framework.md`).
- **Self-Improvement Agent (`apps/ai-service/agents/self_improvement_agent/`):** consumes the eval framework's per-agent accuracy trends and the guardrail/QA flag rates, and proposes concrete prompt or tool-list refinements for underperforming agents. **Human-reviewed autonomy only** — this agent never edits another agent's prompt/config directly; it opens a reviewable proposal.
- **Cross-agent negotiated handoffs — the harness-level mechanism:** the harness must be able to hold and execute a multi-step plan touching more than one agent's memory scopes in one coherent flow (e.g. "help me decide between these two offers" touching Career, Preference, and Goal memory) as a single durable unit of state (see above), rather than a chain of independent, disconnected calls. File 17 owns how the Orchestrator decides to assemble and sequence such a plan across the full 28-agent roster; this file owns making sure the harness can actually hold and resume one once assembled.
- **Subagent context isolation:** for genuinely parallelizable work (e.g. researching multiple job platforms simultaneously), allow the harness to spin up isolated subagent contexts that don't share working memory with each other, merging results deliberately back into the parent request rather than letting them silently interleave.

## Out of scope
Removing or bypassing MVP's harness-level guardrail middleware (`mvp/11-guardrails-safety.md`) — the QA Agent is additive, not a replacement for input/output validation. Routing/coordination policy across the full agent roster — that's file 17.

## Acceptance criteria
- [ ] The QA Agent's flag rate is measurably lower for an agent with a strong eval track record than for a newly added, unproven agent, using the same underlying check logic.
- [ ] A Self-Improvement Agent proposal for a deliberately underperforming test agent is generated and requires explicit human approval before any prompt change takes effect.
- [ ] A multi-agent test request (touching at least two memory scopes) completes as one coordinated plan, traceable as a single logical flow in observability (file 12), not disconnected calls.
- [ ] Two parallel subagent research tasks against different job platforms complete without cross-contaminating each other's working memory.
- [ ] A durable multi-step plan survives a full `ai-service` deploy/restart mid-plan and resumes correctly from its last completed step, verified by a test that deploys mid-execution.
