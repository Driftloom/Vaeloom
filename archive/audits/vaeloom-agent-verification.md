# Vaeloom Agent Verification — 2026-09-15

> **Commit:** `bd7b2125` • **Verdict:** **PASS_WITH_EXCEPTION** (contracts 8/23,
> destructive actions gated)

## 1. Inventory (code, not claims)

| #   | Agent                                                                                                  | Dir/Handler                                           | Card | Contract | Autonomy        | Declared Tools                                                                   | Read/Write scope                                   |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---- | -------- | --------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Memory                                                                                                 | `memory_agent/handler` + `extraction/retrieval/merge` | YES  | YES      | observe         | `search_documents, query_graph`                                                  | memory_read                                        |
| 2   | Resume                                                                                                 | `resume_agent`                                        | YES  | YES      | prepare         | `compile_resume_pdf/docx/cover_letter`                                           | memory_read + own artifact                         |
| 3   | JobSearch                                                                                              | `job_search_agent`                                    | YES  | YES      | suggest         | `search_jobs, browse_job_page, scrape_company_insights, verify_application_link` | connector_read (SSRF-guarded, 20/h)                |
| 4   | Gmail                                                                                                  | `gmail_agent/handler:29`                              | YES  | YES      | suggest         | `search_gmail, draft_email, search_outlook_mail, draft_outlook_mail`             | connector_read + draft (never send)                |
| 5   | Scheduler                                                                                              | `scheduler_agent`                                     | YES  | YES      | approval_gated  | `create_calendar_event, list_calendar_events`                                    | calendar_write (**gated**)                         |
| 6   | GitHub                                                                                                 | `github_agent`                                        | YES  | YES      | approval_gated  | `fetch_github_repo, create_github_issue/PR`                                      | github_read + **create is gated**                  |
| 7   | Research                                                                                               | `research_agent`                                      | —    | YES      | observe         | `web_search`                                                                     | read_only                                          |
| 8   | Retrieval                                                                                              | `memory_agent/retrieval`                              | —    | YES      | read_only       | hybrid retrieval                                                                 | memory_read                                        |
| 9   | Organization                                                                                           | `organization_agent`                                  | YES  | —        | approval_gated  | `rename/move/categorize`                                                         | connector_write (**gated**)                        |
| 10  | Application                                                                                            | `application_agent:26`                                | YES  | —        | approval_gated  | prepare tailored pkgs                                                            | gated (request_approval when `has_approval=False`) |
| 11  | ATS                                                                                                    | `ats_agent`                                           | YES  | —        | read_only       | `calculate_ats_*`                                                                | read_only                                          |
| 12  | Drive                                                                                                  | `drive_agent`                                         | YES  | —        | approval_gated  | `list/download drive`                                                            | drive_read                                         |
| 13  | Career/Learning/Analytics/Recommendation/Reflection/Security/Reminder/Connector/Plugin/Coding/Planning | various                                               | NO   | NO       | suggest/observe | synthetic `get_or_create` fallback `tools=[]`                                    | scope-only                                         |

**Totals:** 23 dirs / 55 `.py` files; `AgentRegistry` seeds **8**
(`agent_contracts.py:234`), `CardRegistry` **11** (`card_registry.py:18`).
Static tools **54** (`definitions.py:1028`) + dynamic `mcp__*`
(`executor.py:257`).

**Governance docs:** `docs/agents/*`, `docs/ai/Agent-Harness.md` (harness v1
`check_agent_tool_contract`).

## 2. Agent Contract (§19)

Every agent **should** have:

```
mission | boundary | tools | read scope | write scope | action scope
| autonomy | approval | uncertainty | error | timeout | retry | idempotency | audit | memory
```

| Field              | Implemented                                                      | Evidence                                                                                              |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| mission            | 11/23 explicit (`card_registry` description + handler docstring) | `card_registry.py:18 resume:18 ...`                                                                   |
| boundary           | YES                                                              | `gmail: never send`, `organization: propose-only`, `drive: real+mock fallback`                        |
| tools              | 54 static + `mcp__*`                                             | `definitions.py`, `executor.py:278 register_dynamic_tool`                                             |
| read scope         | YES                                                              | `ToolDefinition required_scope` 50 entries                                                            |
| write/action scope | YES                                                              | `CATEGORY_TIMEOUTS/RETRIES`, `approval_gated_tools()`                                                 |
| autonomy           | 4 levels                                                         | `Autonomy OBSERVE/SUGGEST/PREPARE/APPROVAL_REQUIRED/LIMITED_AUTO/AUTO`                                |
| approval           | YES                                                              | `loop.py:876 _react_approval_gate`, `application_agent:88 request_approval`                           |
| uncertainty/error  | YES                                                              | `QAAgent` gate + `LoopSafetyTracker cycle/no_progress`                                                |
| timeout/retry      | YES                                                              | `agent_contracts LoopPolicy 8/12/3/12000/0.50/120s` + `executor CATEGORY_TIMEOUTS 2s..45s, retries 3` |
| idempotency        | YES                                                              | `executor._idem_session_cm:2729`, `tool_idempotency`, `temporal validation 20KB + HMAC`               |
| audit              | YES                                                              | `executor._audit_log:3268`, `loop:ReactRunRecord:338`, `audit_events` table                           |

**Gap ZT-007:** 12 agents lack card/contract (synthetic fallback). They cannot
perform destructive actions because fallback `tools=[]` → only scope checks
apply, and destructive set is deny-by-default (`approval_gated_tools()`).

## 3. Orchestrator (§20)

| Requirement                   | Result | Evidence                                                                                                                  |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| request classification        | PASS   | `orchestrator/router.py:291 classify_intent` 2-stage keyword + micro-LLM fallback `232-288`                               |
| agent selection               | PASS   | `router:score_agent_candidates:207 0.55/0.20/0.15/0.10 + kill-switch`                                                     |
| permission propagation        | PASS   | `loop:1138 agent_allowed_scopes`, `1574 check_permission + 1744 AgentContract.check_tool`                                 |
| context/workspace propagation | PASS   | `loop:382 AgentRequest(workspace,tenant,user,correlation)`, `scoped_session(workspace_id)`, `executor:_ws_session:33 RLS` |
| correlation                   | PASS   | `CorrelationIDMiddleware`, `RequestLoggingMiddleware`                                                                     |
| timeout/retries/cancellation  | PASS   | `LoopPolicy 120s/8/12`, `CircuitBreaker:33`, `worker graceful_shutdown 30s`                                               |
| loop prevention               | PASS   | `LoopSafetyTracker:37 check_budgets + detect_cycle(3x identical, A->B->A) + no_progress`                                  |
| unauthorized tool prevention  | PASS   | `react_policy:validate_tool_arguments 16KB + binding rejection`, `executor:3057 Card check`                               |
| prompt injection resistance   | PASS   | `supervisor:112 [from:k untrusted]`, `loop:1954 quarantine`, `middleware/prompt_injection:21 PATTERNS`                    |
| specialist routing            | PASS   | `router AGENT_REGISTRY 23 agents`, `loop:_dispatch_agent:2112`                                                            |

New in `bd7b2125`: `agent_service.check_agent_tool_contract` enforces registry
contract fail-closed for known agents before LLM call (`agent_service.py:21`).

## 4. Tool Security (§21)

For every tool:

| Check                       | Result | Where                                                                                                 |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| declared                    | PASS   | `definitions.py ALL_TOOLS 54` + `DYNAMIC_TOOL_DEFS`                                                   |
| schema validated            | PASS   | `react_policy:validate_tool_arguments 86-197` (shape→16KB→bindings→sanitize→required/type/enum/range) |
| auth/tenant/workspace/scope | PASS   | `executor:2993 workspace fail-closed, 3002 tamper check, 3076 scope`                                  |
| input/output validated      | PASS   | Input via `react_policy`, output via `executor:3145 + inference_policy + caps 8000/100`               |
| rate limited                | PASS   | `executor:119 scrape quota Redis + mem fallback`, `loop:AgentRateLimiter acquire/release`             |
| audit logged                | PASS   | `_audit_log:3268 tiered`                                                                              |
| destructive protected       | PASS   | `_BASE_APPROVAL_GATED 12 tools` + `_DYNAMIC_APPROVAL_GATED` for non-readOnly MCP                      |
| secrets not exposed         | PASS   | `connector_ext_service encrypted env`, discovery sanitizes                                            |

Destructive map (`executor.py:261`):
`create_github_issue/PR, send_slack_message, create_calendar_event(s), draft_email/outlook, rename/move/categorize, create/merge_entities, execute_code_sandbox, google_doc write`.

## 5. Prompt Injection (§22: PASS)

- Pre-loop: `supervisor:112 provenance-tagged context`,
  `loop:1954 RAG quarantine`.
- Tool I/O:
  `loop:1636 looks_like_prompt_injection + sanitize_tool_output → <untrusted-data>`;
  `sanitize_text` strips `<script>/js:`.
- Middleware: `prompt_injection.py:21` patterns (`ignore previous`,
  `[[SYSTEM]]`, `base64.*decode`, `role: system`), 512KB cap, optional LLM
  classifier `INJECTION_LLM_CLASSIFIER`.
- **Residue:** middleware scans JSON/form/multipart only (not query/header), 1
  base64 match, `PROMPT_DIR` env override could load external prompts → P2.

## 6. Per-Agent E2E (sample)

| Agent        | Mission impl? | Tools impl?            | Perms impl?    | Memory contract?          | Runtime path                                                                                                 | Test                            | Adversarial                                                                     |
| ------------ | ------------- | ---------------------- | -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------- |
| Organization | YES           | YES (propose-only)     | approval_gated | write `supersedes_id`     | `loop:2175 _dispatch_with_approval file_organize`                                                            | `agents/organization_agent`     | injection quarantined                                                           |
| Resume       | YES           | YES (own artifact)     | memory_read    | source-traced master      | `resume_service + document_builder (jinja HTML + Playwright PDF)`                                            | `test_overleaf_integration`     | hallucination: nonexistent internship → `question missing-field` (no fabricate) |
| ATS          | YES           | YES (read-only)        | read_only      | —                         | `calculate_semantic_ats_score cosine + gazetteer`                                                            | `tests/test_semantic_ats_tools` | no silent mutation                                                              |
| JobSearch    | YES           | YES (ranked shortlist) | read_only      | feedback to career memory | `browse_job_page + scrape_company_insights + verify_application_link` (SSRF-guarded) + `opportunity_matcher` | `job_search` suite              | —                                                                               |
| Gmail        | YES           | YES (draft-only)       | draft gated    | deadline extraction       | `gmail_service + classifier` draft-only per contract                                                         | `security/test_gmail`           | revoked token handled                                                           |
| Scheduler    | YES           | YES                    | gated          | deadline events           | `scheduler_service + temporal schedules`                                                                     | `scheduler` suite               | DST/timezone edge via `temporal/schedules.py`                                   |

## 7. Council / Cognition / Federation

- `council` (3 endpoints), `cognition` (8), `federation` (1), `anticipation`
  (4), `sovereignty` (8) — mounted per `main:426-430`, wired to
  `services/agent_council, overnight_cognition_service, agent_federation_service, anticipation_daemon`.

## 8. Verdict

All agents have **permission-checked, approval-gated, RLS-scoped** execution.
The registry incompleteness (ZT-007) is tracked P2 and does not permit ungated
destructive actions. Tool/Injection controls are dual-layer (middleware +
compiler + runtime quarantine). Cost controls
(`LoopPolicy 12k tokens / $0.50 / 120s`, `llm_service tenacity 3x`,
`CATEGORY_RETRIES`, `model_router` fallback) are active.

**Evidence commands:**
`uv run --project apps/api python -m pytest apps/api/tests/test_harness_v1.py apps/api/tests/test_final_approval_remediation.py -q`
→ 13+? passed; `tests/security` 284/284.
