# Vaeloom Agent & Capability Registry Index (Truth Index)

> **Contract Authority:** Master Zero-Trust Audit §§0–78, Autoplan B2 Amended
> Plan  
> **Status:** LIVE PRODUCTION CANONICAL INDEX  
> **Location:** `docs/ai/REGISTRY_INDEX.md`

---

## 1. Architectural Planes Overview

Vaeloom enforces a strict **deterministic core / probabilistic edge** model
structured across 8 distinct architectural planes:

| Plane                    | Core Responsibility                                                                     | Primary Implementations                                                                                  |
| :----------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **1. Control Plane**     | Orchestration, intent classification, ReAct & DAG execution, checkpointing              | `orchestrator/router.py`, `orchestrator/loop.py`, `orchestrator/state.py`, `orchestrator/state_store.py` |
| **2. Trust Plane**       | Tenant isolation, cryptographically signed approvals, sanitization, role policy         | `services/approval.py`, `middleware/prompt_injection.py`, `utils/sanitize.py`, `models/schema.py` (RLS)  |
| **3. Knowledge Plane**   | Context loading, token budgeting, multi-tier memory taxonomy, knowledge graph           | `orchestrator/context_loader.py`, `infrastructure/context_budget.py`, `services/memory_service.py`       |
| **4. Capability Plane**  | Scoped tool execution, retry/timeout enforcement, MCP trust boundary                    | `tools/definitions.py`, `tools/executor.py`, `services/mcp_client_service.py`, `utils/url_guard.py`      |
| **5. Compute Plane**     | Multi-model routing, BYOK provider abstraction, live streaming, spend ceilings          | `services/llm_service.py`, `services/model_router.py`, `services/agent_costs.py`                         |
| **6. Improvement Plane** | Golden task evaluations, LLM-judge quality rubric, trajectory consolidation             | `infrastructure/agent_eval.py`, `agents/memory/consolidator.py`, `tests/eval/`                           |
| **7. Operations Plane**  | OpenTelemetry tracing, Prometheus `/metrics`, Redis quota rate limits, circuit breakers | `infrastructure/opentelemetry.py`, `infrastructure/circuit_breaker.py`, `temporal/quota.py`              |
| **8. Interface Plane**   | Card schema definitions, client key transformations, streaming SSE                      | `orchestrator/card.py`, `orchestrator/card_registry.py`, `routers/agents.py`                             |

---

## 2. Canonical Agent Registry

Every agent in Vaeloom operates under an immutable runtime contract: identity,
mission, allowed tools, memory read/write scopes, autonomy tier, and strict JSON
output schemas.

| Agent Name         | Class                     |   Canonical Card    | Autonomy Level | Primary Tool Scopes                                                                     | Output Schema Contract                                                              |
| :----------------- | :------------------------ | :-----------------: | :------------- | :-------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **Resume**         | `ResumeAgent`             |    `RESUME_CARD`    | Suggest        | `search_documents`, `query_graph`, `calculate_semantic_ats_score`, `compile_resume_pdf` | `{"summary": str, "proposals": list, "questions": list}`                            |
| **Job Search**     | `JobSearchAgent`          |  `JOB_SEARCH_CARD`  | Suggest        | `search_jobs_board`, `browse_job_page`, `query_graph`                                   | `{"summary": str, "proposals": list, "questions": list}`                            |
| **Application**    | `ApplicationAgent`        | `APPLICATION_CARD`  | Approval-Gated | `search_documents`, `browse_job_page`, `compile_resume_pdf`, `send_email`               | `{"summary": str, "proposals": list, "questions": list, "requires_approval": bool}` |
| **ATS**            | `ATSAgent`                |     `ATS_CARD`      | Analyze        | `calculate_semantic_ats_score`, `extract_missing_hard_skills`, `audit_ats_formatting`   | `{"summary": str, "details": str, "proposals": list}`                               |
| **Organization**   | `OrganizationAgent`       | `ORGANIZATION_CARD` | Approval-Gated | `search_documents`, `query_graph`, `tag_document`                                       | `{"summary": str, "proposals": list, "questions": list}`                            |
| **Gmail**          | `GmailAgent`              |    `GMAIL_CARD`     | Approval-Gated | `search_documents`, `send_email`                                                        | `{"summary": str, "details": str, "proposals": list}`                               |
| **Scheduler**      | `SchedulerAgent`          |  `SCHEDULER_CARD`   | Suggest        | `search_documents`, `calendar_query`                                                    | `{"summary": str, "proposals": list, "questions": list}`                            |
| **Career**         | `CareerAgent`             |    `CAREER_CARD`    | Suggest        | `search_documents`, `query_graph`                                                       | `{"summary": str, "proposals": list}`                                               |
| **Memory**         | `MemoryAgentHandler`      |    `MEMORY_CARD`    | Limited-Auto   | `search_documents`, `query_graph`, `get_entity`                                         | `{"summary": str, "entities": list}`                                                |
| **Consolidator**   | `MemoryConsolidatorAgent` |      Built-in       | Suggest        | `extract_entities`, `upsert_entities`, `record_correction`                              | `{"consolidated": bool, "entities_updated": int}`                                   |
| **Drive**          | `DriveAgent`              |    `DRIVE_CARD`     | Suggest        | `search_documents`                                                                      | `{"summary": str, "documents": list}`                                               |
| **GitHub**         | `GitHubAgent`             |    `GITHUB_CARD`    | Suggest        | `search_documents`                                                                      | `{"summary": str, "repositories": list}`                                            |
| **Planning**       | `PlanningAgent`           |   `PLANNER_CARD`    | Suggest        | `search_documents`, `query_graph`                                                       | `{"roadmap": list, "milestones": list}`                                             |
| **Analytics**      | `AnalyticsAgent`          |      Extension      | Analyze        | `analytics_query`                                                                       | `{"metrics": dict, "insights": list}`                                               |
| **Coding**         | `CodingAgent`             |      Extension      | Limited-Auto   | `search_documents`, `code_sandbox`                                                      | `{"code": str, "explanation": str}`                                                 |
| **Connector**      | `ConnectorAgent`          |      Extension      | Approval-Gated | `connector_sync`                                                                        | `{"status": str, "synced_count": int}`                                              |
| **Learning**       | `LearningAgent`           |      Extension      | Analyze        | `query_graph`, `rank_preferences`                                                       | `{"preferences": list}`                                                             |
| **Plugin**         | `PluginAgent`             |      Extension      | Limited-Auto   | `plugin_execute`                                                                        | `{"output": dict}`                                                                  |
| **QA**             | `QAAgent`                 |      Built-in       | Audit          | `qa_validator`                                                                          | `{"valid": bool, "reasons": list}`                                                  |
| **Recommendation** | `RecommendationAgent`     |      Extension      | Suggest        | `query_graph`                                                                           | `{"recommendations": list}`                                                         |
| **Reflection**     | `ReflectionAgent`         |      Extension      | Analyze        | `critique_output`                                                                       | `{"critique": str, "score": float}`                                                 |
| **Reminder**       | `ReminderAgent`           |      Extension      | Limited-Auto   | `set_reminder`                                                                          | `{"reminder_id": str, "due": str}`                                                  |
| **Security**       | `SecurityAgent`           |      Extension      | Audit          | `audit_security`                                                                        | `{"alerts": list}`                                                                  |

---

## 3. Tool Classification & Trust Tiers

Tools are strictly classified to govern timeouts, retries, and approval gates:

| Category              | Default Timeout | Max Retries | Required Scope          | Trust Tier                            | Idempotent |
| :-------------------- | :-------------: | :---------: | :---------------------- | :------------------------------------ | :--------: |
| `memory_read`         |       2s        |     3x      | `memory.read`           | `core_trusted`                        |    Yes     |
| `memory_write`        |       2s        |     3x      | `memory.write`          | `core_trusted`                        |     No     |
| `connector_read`      |       5s        |     3x      | `connector.<int>.read`  | `first_party`                         |    Yes     |
| `connector_write`     |       10s       |     3x      | `connector.<int>.write` | `first_party` (approval gated)        |     No     |
| `system`              |       1s        |     1x      | `system.execute`        | `core_trusted`                        |    Yes     |
| `mcp.read`            |       5s        |     2x      | `connector.mcp.execute` | `mcp.read`                            |    Yes     |
| `mcp.workspace.write` |       10s       |     2x      | `connector.mcp.execute` | `mcp.workspace.write`                 |     No     |
| `mcp.external.write`  |       15s       |     1x      | `connector.mcp.execute` | `mcp.external.write` (approval gated) |     No     |

---

## 4. MCP Security & Trust Boundary

External Model Context Protocol (MCP) integrations are treated as capability
boundaries with zero-trust isolation:

1. **Network Guard:** All outbound HTTP transports are verified by
   `utils/url_guard.py` enforcing `https://` only and denying private/internal
   IP ranges (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, metadata endpoints).
2. **Interpreter Block:** Shell interpreters (`bash`, `sh`, `cmd.exe`,
   `powershell`, `pwsh`) and shell metacharacters (`|`, `;`, `&`, `$`, `` ` ``)
   are rejected at configuration time.
3. **Approval Gating:** Any MCP tool whose schema does not explicitly declare
   `read_only_hint: true` is assigned to `connector_write` and automatically
   enrolled into the HMAC-signed approval gate.
4. **Data Wrapping:** All outputs returned by MCP servers are treated as
   untrusted data, capped at 4,000 characters, and quoted with
   `[UNTRUSTED_DATA]` markers to block indirect prompt injection.

---

## 5. Evaluation & CI Quality Gates

All prompt, model, or loop modifications are gated by deterministic automated
test suites:

- **Quality Gate:** `tests/eval/test_orchestrator_quality_gate.py` runs
  `JUDGE_GOLDEN` benchmark cases through the orchestrator. CI fails if
  `pass_rate < 1.0`.
- **Adversarial Red-Team:** `tests/security/test_redteam_loop.py` executes
  prompt injection, jailbreak, and privilege escalation attempts against the
  live loop. CI fails if any exploit payload executes uncontained.
- **State Durability Drill:** `tests/test_state_durability.py` tests
  crash-restart recovery across file and memory StateStores.
- **Spend Ceilings Test:** `tests/test_agent_spend_ceilings.py` verifies hard
  stops at daily workspace budget limits.
