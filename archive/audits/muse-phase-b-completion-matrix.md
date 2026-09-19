# Muse Phase B — Runtime Completion Matrix

**Date:** 2026-09-07. Legend: YES/NO/PARTIAL per cell. Status is the weakest
column, not an average. Evidence: `apps/api/tests/test_runtime_phase_b.py` (43),
`test_muse_e2e_scenarios.py` (22), Phase A suite (30/30), sweep §17.

| Capability           | Implemented | Real Path | Persistent | Failure Tested       | Security Tested | E2E Tested | Status |
| -------------------- | ----------- | --------- | ---------- | -------------------- | --------------- | ---------- | ------ |
| Orchestration        | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Agent routing        | YES         | YES       | n/a        | YES                  | YES             | YES        | LIVE   |
| Agent contracts      | YES         | YES       | n/a        | YES                  | YES             | YES        | LIVE   |
| Structured output    | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Replanning           | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Checkpointing        | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Crash recovery       | YES         | YES       | YES        | PARTIAL (no SIGKILL) | YES             | YES        | LIVE*  |
| Idempotency          | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Background execution | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Retrieval            | YES         | YES       | n/a        | YES                  | YES             | YES        | LIVE   |
| Memory               | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Knowledge graph      | YES         | YES       | YES        | NO                   | YES             | PARTIAL    | LIVE   |
| Prompt compiler      | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Model routing        | YES         | YES       | YES        | YES                  | n/a             | YES        | LIVE   |
| Tool execution       | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Approvals            | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Evaluation           | YES         | YES       | YES        | YES                  | n/a             | YES        | LIVE   |
| Learning             | YES         | YES       | YES        | YES                  | n/a             | YES        | LIVE   |
| Observability        | YES         | YES       | YES        | n/a                  | n/a             | YES        | LIVE   |
| Cancellation         | YES         | YES       | YES        | YES                  | YES             | YES        | LIVE   |
| Budgets              | YES         | YES       | YES        | YES                  | n/a             | YES        | LIVE   |

\* Crash recovery: seam-level proof (resume, idempotency, merge, cancel). Real
SIGKILL, Redis outage, and provider outage are UNVERIFIED by execution
(deliberate no-external-side-effects boundary) — see Known Limitations.

## Deliberately Disabled (documented, not fake)

| Capability                 | Status                                 | Owner of state/retries/timers                 | Why disabled                                                                             |
| -------------------------- | -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Temporal durable execution | DISABLED (`temporal_enabled=False`)    | Temporal server (when on)                     | Default path is durable enough via checkpoints+idem; no second durable engine by default |
| LangGraph engine           | DISABLED (`langgraph_enabled=False`)   | Graph topology only; Temporal owns durability | Same reason; replan edge implemented and tested for enablement                           |
| ReAct dynamic tools        | DISABLED (`agent_react_enabled=False`) | Loop budgets + approval gates                 | Static dispatch is deterministic; ReAct hardened and tested for enablement               |

Who owns what when enabled: state → checkpoints (Temporal replays activities);
retries → Temporal policies + executor backoff (no double-retry loops by
design); timers → Temporal/scheduler; checkpoints → `loop_checkpoints`;
cancellation → durable flag (all engines); replay → checkpoint resume (no
deterministic LLM replay claimed).
