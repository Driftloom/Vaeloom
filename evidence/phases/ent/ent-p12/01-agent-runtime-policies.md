# ENT-P12 — 01 Agent Runtime & Execution Policies

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** `DEL-ENT-P12-01` (v1.0)  
> **Owner:** Principal Agent Architect & Cognitive Systems Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Shared Agent Runtime Architecture

All 28 specialist and core cognitive agents in the Vaeloom enterprise platform
extend the standardized `BaseAgent` harness located at
`apps/api/src/api/orchestrator/base.py`. Execution flows through the
deterministic orchestrator loop (`orchestrator/loop.py`), which orchestrates
multi-turn reasoning, tool execution, safety verification, and telemetry context
propagation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INTENT ROUTER & CLASSIFIER                      │
│  - System 1 (TypeSafe AI Jev): Sub-50ms deterministic action routing   │
│  - Selects target agent card and verifies tenant capability entitlements│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PLAN → ACT → OBSERVE → REFLECT → IMPROVE LOOP              │
│  1. Plan: Agent decomposes request into sub-goals and tool requirements│
│  2. Act: Dispatches tool call through scoped Capability Plane          │
│  3. Observe: Ingests tool execution results tagged as [UNTRUSTED_DATA] │
│  4. Reflect: Evaluates progress against user intent                    │
│  5. Improve: Refines response via 3-retry QA Validator gate           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│     AUTONOMY & APPROVAL GATES     │       │     BUDGET & TIMEOUT GOVERNANCE   │
│ - Suggest: Read-only advisory     │       │ - Max 30s per execution turn      │
│ - Analyze: Deterministic metrics  │       │ - Per-agent token budget ceilings │
│ - Limited-Auto: Safe cache writes │       │ - Circuit breaker on 3 LLM errors │
│ - Approval-Gated: Consequential   │       │ - Deterministic template fallback │
│   actions require signed token    │       │                                   │
└───────────────────────────────────┘       └───────────────────────────────────┘
```

---

## 2. Canonical 28-Agent Roster Governance Matrix

The 28 agents are partitioned across functional tiers with explicit autonomy
ratings, tool scopes, and output contracts:

| Agent Name         | Class / Module            | Tier |   Autonomy Level   | Allowed Tool Scopes                                        | Output Schema Contract                                           |
| :----------------- | :------------------------ | :--: | :----------------: | :--------------------------------------------------------- | :--------------------------------------------------------------- |
| **Resume**         | `ResumeAgent`             | MVP  |      Suggest       | `search_documents`, `query_graph`, `compile_resume_pdf`    | `{"summary": str, "proposals": list, "questions": list}`         |
| **Job Search**     | `JobSearchAgent`          | MVP  |      Suggest       | `search_jobs_board`, `browse_job_page`, `query_graph`      | `{"summary": str, "proposals": list, "questions": list}`         |
| **Application**    | `ApplicationAgent`        | MVP  | **Approval-Gated** | `search_documents`, `browse_job_page`, `send_email`        | `{"summary": str, "proposals": list, "requires_approval": true}` |
| **ATS**            | `ATSAgent`                | MVP  |      Analyze       | `calculate_semantic_ats_score`, `audit_ats_formatting`     | `{"summary": str, "details": str, "proposals": list}`            |
| **Organization**   | `OrganizationAgent`       | MVP  | **Approval-Gated** | `search_documents`, `query_graph`, `tag_document`          | `{"summary": str, "proposals": list, "questions": list}`         |
| **Gmail**          | `GmailAgent`              | MVP  | **Approval-Gated** | `search_documents`, `send_email` (draft-only by default)   | `{"summary": str, "details": str, "proposals": list}`            |
| **Scheduler**      | `SchedulerAgent`          | MVP  |      Suggest       | `search_documents`, `calendar_query`, `set_reminder`       | `{"summary": str, "proposals": list, "questions": list}`         |
| **Memory Handler** | `MemoryAgentHandler`      | MVP  |    Limited-Auto    | `search_documents`, `query_graph`, `get_entity`            | `{"summary": str, "entities": list}`                             |
| **Career**         | `CareerAgent`             | ENT  |      Suggest       | `search_documents`, `query_graph`, `rank_preferences`      | `{"summary": str, "proposals": list}`                            |
| **Learning**       | `LearningAgent`           | ENT  |      Analyze       | `query_graph`, `rank_preferences`                          | `{"preferences": list}`                                          |
| **Research**       | `ResearchAgent`           | ENT  |      Suggest       | `search_documents`, `query_graph`, `scrape_insights`       | `{"findings": list, "citations": list}`                          |
| **GitHub**         | `GitHubAgent`             | ENT  |      Suggest       | `search_documents`, `github_repo_query`                    | `{"summary": str, "repositories": list}`                         |
| **Coding**         | `CodingAgent`             | ENT  |    Limited-Auto    | `search_documents`, `code_sandbox`                         | `{"code": str, "explanation": str}`                              |
| **Reminder**       | `ReminderAgent`           | ENT  |    Limited-Auto    | `set_reminder`, `calendar_query`                           | `{"reminder_id": str, "due": str}`                               |
| **Analytics**      | `AnalyticsAgent`          | ENT  |      Analyze       | `analytics_query`                                          | `{"metrics": dict, "insights": list}`                            |
| **Recommendation** | `RecommendationAgent`     | ENT  |      Suggest       | `query_graph`, `rank_preferences`                          | `{"recommendations": list}`                                      |
| **Reflection**     | `ReflectionAgent`         | ENT  |      Analyze       | `critique_output`                                          | `{"critique": str, "score": float}`                              |
| **Security**       | `SecurityAgent`           | ENT  |      Analyze       | `audit_security`, `verify_url_guard`                       | `{"alerts": list}`                                               |
| **Connector**      | `ConnectorAgent`          | ENT  | **Approval-Gated** | `connector_sync`, `mcp_call`                               | `{"status": str, "synced_count": int}`                           |
| **Plugin**         | `PluginAgent`             | ENT  |    Limited-Auto    | `plugin_execute` (sandboxed)                               | `{"output": dict}`                                               |
| **Drive**          | `DriveAgent`              | ENT  |      Suggest       | `search_documents`                                         | `{"summary": str, "documents": list}`                            |
| **Router**         | `RouterAgent`             | Core |      Analyze       | `classify_intent`, `route_action`                          | `{"target_agent": str, "confidence": float}`                     |
| **Planning**       | `PlanningAgent`           | Core |      Suggest       | `query_graph`, `search_documents`                          | `{"roadmap": list, "milestones": list}`                          |
| **Consolidator**   | `MemoryConsolidatorAgent` | Core |    Limited-Auto    | `extract_entities`, `upsert_entities`, `record_correction` | `{"consolidated": bool, "entities_updated": int}`                |
| **Document**       | `DocumentAgent`           | Core |    Limited-Auto    | `parse_document`, `extract_text`, `generate_hash`          | `{"document_id": str, "hash": str, "pages": int}`                |
| **QA Validator**   | `QAAgent`                 | Core |      Analyze       | `validate_response`, `check_schema`                        | `{"valid": bool, "reasons": list}`                               |
| **Self Improve**   | `SelfImprovementAgent`    | Core |    Limited-Auto    | `analyze_feedback`, `update_prompt_bias`                   | `{"iteration": int, "improved": bool}`                           |
| **Supervisor**     | `SupervisorAgent`         | Core |   Orchestration    | `delegate_subtask`, `aggregate_results`                    | `{"status": str, "final_response": dict}`                        |

---

## 3. Autonomy Tiers & Consequential Action Governance

In strict compliance with EU AI Act Art. 14 and NIST AI RMF Section 3.2, agent
actions are stratified across 4 non-negotiable autonomy tiers:

1. **Suggest (Tier 1):** Read-only exploration and recommendation. The agent may
   query vector search and knowledge graphs to present candidate options. No
   state mutations permitted.
2. **Analyze (Tier 2):** Deterministic evaluation, syntax scoring (ATS), and
   statistical aggregation. Read-only output delivered as structured JSON cards.
3. **Limited-Auto (Tier 3):** Safe, reversible workspace operations (e.g.
   updating ephemeral working memory caches, scheduling local notifications,
   tagging internal notes).
4. **Approval-Gated (Tier 4):** Consequential external or irreversible
   mutations:
   - Submitting external job applications (`application_agent`).
   - Sending live emails (`gmail_agent`).
   - Mutating workspace IAM policies (`organization_agent`).
   - Overwriting approved primary resume documents (`resume_agent`).
   - Executing non-read-only MCP tools (`mcp.external.write`).

Any Tier 4 action automatically pauses agent execution, yields a cryptographic
approval token (`services/approval.py`), and notifies the user via the frontend
`ApprovalCard` modal. Execution remains halted until signed user confirmation is
submitted.

---

## 4. Execution Timeouts, Token Budgets & Failure Recovery

- **Per-Tool Timeout Policy:**
  - `memory_read`: 2s timeout, 3x exponential retries.
  - `connector_read`: 5s timeout, 3x exponential retries.
  - `connector_write`: 10s timeout, approval gated, 3x retries.
  - `mcp.read`: 5s timeout, 2x retries.
  - `mcp.external.write`: 15s timeout, 1x execution (no auto-retry).
- **Turn Context & Spend Budgets:**
  - Hard token limit: 16,384 prompt tokens / 4,096 completion tokens per
    execution turn.
  - Spend budget: Maximum \$0.15 per end-to-end agent interaction. Exceeding
    triggers automatic fallback to local Ollama 12B model.
- **Circuit Breaker & Fallback Protocol:**
  - If external cognitive APIs experience 3 consecutive errors or latency
    $> 10\text{s}$, the circuit breaker opens for 30s.
  - Requests gracefully fall back to local rule-based template builders,
    returning deterministic fallback responses without service degradation.

---

_Signed: Principal Agent Architect & Cognitive Systems Lead — 2026-09-29_
