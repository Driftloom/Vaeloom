# Orchestrator

The central orchestrator agent and shared agent harness.

## Components

| File        | Purpose                                                      |
| ----------- | ------------------------------------------------------------ |
| `base.py`   | `BaseAgent` abstract class + `Tool`, `MemoryScopes` models   |
| `loop.py`   | Plan→Act→Observe→Reflect→Improve loop (317 lines)            |
| `router.py` | Intent classification + agent registry + QA gate (297 lines) |
| `state.py`  | `LoopState` management + checkpointing                       |

## Agent Harness

Every specialist agent runs on the shared 5-phase loop:

1. **Plan** — Agent generates a plan based on the user request
2. **Act** — Agent executes tools and produces output
3. **Observe** — Agent observes the results of its actions
4. **Reflect** — Agent reflects on what worked and what didn't
5. **Improve** — Agent refines its approach for next iteration

Max 3 iterations per request. After max iterations, escalates to user.

## Intent Classification

Two-stage classification:

1. **Stage 1:** Keyword-based coarse category mapping (14 categories)
2. **Stage 2:** Disambiguation within multi-agent categories

## Agent Registry

`AGENT_REGISTRY` maps 21 agent names to handler classes. MVP gating via
`MVP_CANONICAL_AGENTS` frozenset + `settings.mvp_scope_enforced`.

## Approval Integration

`lookup_approval()` queries `agent_approvals` table for approved decisions.
Wired into `act_phase()` for: ApplicationAgent, GmailAgent, DriveAgent,
SchedulerAgent.

## QA Gate

All agent output passes through `QAAgent` validation with 3 retries. Invalid
output is rejected and the agent loop continues.
