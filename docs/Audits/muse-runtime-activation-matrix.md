# Muse Runtime Activation Matrix

**Date:** 2026-09-07. Method: import-graph grep + live-path tracing + test
proof. A module merely existing is DECORATIVE until a default-path caller
invokes it.

| Capability                          | Exists  | Wired | Default Path                   | Persistent         | Tested  | Status                                  |
| ----------------------------------- | ------- | ----- | ------------------------------ | ------------------ | ------- | --------------------------------------- |
| Orchestrator (`router.handle`)      | YES     | YES   | YES                            | phases             | YES     | LIVE                                    |
| Agent loop (`run_agent_loop`)       | YES     | YES   | YES                            | checkpoints        | YES     | LIVE                                    |
| Supervisor DAG                      | YES     | YES   | conditional multi-intent       | pause phases       | YES     | LIVE                                    |
| AgentCard authorization             | YES     | YES   | YES                            | n/a                | YES     | LIVE                                    |
| Approval integrity + atomic consume | YES     | YES   | YES                            | `agent_approvals`  | YES     | LIVE                                    |
| PromptCompiler                      | YES     | YES   | YES (manifest+quarantine)      | manifest           | YES     | LIVE                                    |
| ContextEngine                       | YES     | YES   | YES (policy+manifest)          | manifest           | YES     | LIVE                                    |
| AgentContracts                      | YES     | YES   | YES (ReAct enforce)            | n/a                | YES     | LIVE                                    |
| LoopController                      | YES     | YES   | YES (supervisor)               | snapshot           | YES     | LIVE                                    |
| InferencePolicy (helpers)           | YES     | YES   | YES (fallback log, shape tags) | shadow log         | YES     | LIVE                                    |
| InferencePolicy.route               | YES     | NO    | NO                             | n/a                | YES     | DEPRECATED (superseded by model_router) |
| Loop safety + budgets               | YES     | YES   | YES                            | state.spent        | YES     | LIVE                                    |
| Graph replan                        | YES     | YES   | behind flag                    | n/a                | YES     | LIVE (bounded; engine opt-in)           |
| LangGraph engine                    | YES     | YES   | NO (`langgraph_enabled=False`) | MemorySaver local  | YES     | OPTIONAL/DISABLED                       |
| Temporal engine                     | YES     | YES   | NO (`temporal_enabled=False`)  | Temporal server    | YES     | OPTIONAL/DISABLED                       |
| Checkpointing v2 + CAS              | YES     | YES   | YES                            | `loop_checkpoints` | YES     | LIVE                                    |
| Crash resume (same-process)         | YES     | YES   | YES                            | state+idem rows    | YES     | LIVE                                    |
| Crash resume (SIGKILL)              | n/a     | n/a   | n/a                            | same rows          | NO      | UNVERIFIED                              |
| Durable idempotency                 | YES     | YES   | YES (writes)                   | `tool_idempotency` | YES     | LIVE                                    |
| Deterministic replay                | NO      | NO    | NO                             | n/a                | NO      | DEAD (not claimed; LLM nondeterminism)  |
| Memory consolidation                | YES     | YES   | YES (post-run)                 | entities           | YES     | LIVE                                    |
| Memory admission policy             | NEW §17 | YES   | YES                            | metadata audit     | YES     | LIVE                                    |
| Knowledge graph retrieval           | YES     | YES   | YES (`query_graph` in RAG)     | entities/edges     | YES     | LIVE                                    |
| Hybrid retrieval + ranking          | YES     | YES   | YES                            | n/a                | YES     | LIVE                                    |
| Structured outputs                  | YES     | YES   | YES (ReAct gate)               | validation errors  | YES     | LIVE                                    |
| Model fallback (tier)               | YES     | YES   | YES                            | chain metadata     | YES     | LIVE                                    |
| Model fallback (cross-provider)     | NEW §23 | YES   | YES                            | chain metadata     | YES     | LIVE                                    |
| Trajectory evaluation + gates       | YES     | YES   | YES (post-run)                 | phases             | YES     | LIVE                                    |
| Improvement pipeline                | YES     | YES   | YES (personalization auto)     | candidates*        | YES     | LIVE                                    |
| Observability/provenance            | YES     | YES   | YES                            | state manifest     | YES     | LIVE                                    |
| Failure taxonomy codes              | NEW §30 | YES   | YES                            | termination        | YES     | LIVE                                    |
| Cancellation (user)                 | NEW §31 | YES   | YES                            | state flag         | YES     | LIVE                                    |
| Risk-tier action model              | NEW §26 | YES   | YES                            | audit tags         | YES     | LIVE                                    |
| Capability-aware selection          | NEW §7  | YES   | YES                            | n/a                | YES     | LIVE                                    |
| Background envelope                 | YES     | YES   | YES                            | queue rows         | YES     | LIVE                                    |
| Queue worker (BullMQ/Redis)         | YES     | YES   | YES (Redis present)            | Redis streams      | PARTIAL | LIVE                                    |
| MCP consume                         | YES     | YES   | YES                            | n/a                | YES     | LIVE                                    |
| MCP expose                          | NO      | NO    | NO                             | n/a                | n/a     | NOT APPLICABLE                          |
| Tenant/workspace isolation + RLS    | YES     | YES   | YES                            | PG policies        | YES     | LIVE                                    |

\* Improvement candidates beyond auto-apply kinds require approval records; no
candidate store table exists yet — candidates live in logs/approvals (see Known
Limitations in the final report).
