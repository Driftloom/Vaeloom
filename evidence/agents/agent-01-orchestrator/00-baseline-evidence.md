# Baseline Forensic Evidence — Agent 01: Orchestrator / Supervisor

**Date**: 2026-09-20  
**Auditor**: Zero-Trust Security & Systems Verification Team  
**Evaluation Standard**: Zero-Trust (Treat all prior PASS claims as unverified
historical information)  
**Initial Verdict**: `NOT VERIFIED`

---

## 1. Environment & Runtime Context

- **Python**: 3.12.13 (`apps/api/.python-version`)
- **FastAPI**: 0.141.1
- **Database**: PostgreSQL (Supabase pooler
  `aws-0-ap-south-1.pooler.supabase.com:6543`) / SQLite in-memory test engine
- **Async Framework**: AnyIO / asyncio with `asyncpg` and `aiosqlite`
- **Initial Verification Status**: FAILING (Critical P0 and P1 defects
  discovered on fresh runtime probe)

---

## 2. Pre-Remediation Test Suite Execution Results

Fresh execution of existing test suites for Agent 01 yielded the following
baseline results:

| Suite                                    | Tests Collected | Passed  | Failed | Status   | Root Cause                                                                                                                        |
| ---------------------------------------- | --------------- | ------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `test_orchestrator.py`                   | 60              | 58      | 2      | **FAIL** | `AttributeError: 'AgentResponse' object has no attribute 'action'` in `loop.py:3122` & `3133`                                     |
| `test_orchestrator_router.py`            | 32              | 32      | 0      | **PASS** | Mocks `loop.run_agent_loop` at router boundary                                                                                    |
| `test_supervisor_dynamic.py`             | 4               | 4       | 0      | **PASS** | Evaluates supervisor DAG ordering & approval detection                                                                            |
| `security/test_redteam_loop.py`          | 46              | 46      | 0      | **PASS** | Tier 1/2 adversarial prompts screened at step 0                                                                                   |
| `test_qa_loop_gate.py`                   | 3               | 1       | 2      | **FAIL** | `AttributeError` on loop completion (`test_loop_executes_qa_verification_gate` & `test_loop_qa_gate_triggers_retry_on_rejection`) |
| `eval/test_orchestrator_quality_gate.py` | 8               | 6       | 2      | **FAIL** | Benign queries crash on `run_agent_loop` completion (`test_benign_inputs_are_wellformed`, `test_gate_pass_rate_is_total`)         |
| `test_react_loop_cards.py`               | 5               | 5       | 0      | **PASS** | Tests `act_phase` ReAct tool execution directly                                                                                   |
| **TOTAL**                                | **158**         | **152** | **6**  | **FAIL** | **Systemic runtime contract crash on all successful loop terminations**                                                           |

---

## 3. Discovered Defects & Forensic Root Causes

### Finding 01 (P0): `AgentResponse` Class Contract Mismatch

- **Location**: `apps/api/src/api/orchestrator/loop.py:3122` and `loop.py:3133`
- **Exact Exception**:
  ```text
  AttributeError: 'AgentResponse' object has no attribute 'action'
  ```
- **Code Trace**:
  ```python
  # loop.py:3114-3125
  state.terminate("success", "success")
  resp = await improve_phase(state, request)
  await save_checkpoint(state)
  _eval_ok(state, request, resp)
  resp.termination_reason = state.termination_reason
  await _broadcast_ws(request.workspace_id, "AGENT_COMPLETE", {
      "agent": request.agent_name,
      "status": "success",
      "action": resp.action,  # <--- CRASH: AgentResponse has no 'action'
      "summary": resp.result.get("summary") if isinstance(resp.result, dict) else str(resp.result)[:200],  # <--- CRASH: AgentResponse has no 'result'
  })
  return resp
  ```
- **Contract Analysis**: `AgentResponse` is defined at `loop.py:413` with
  `status`, `final_result`, `termination_reason`, and `failure_code`. The
  websocket broadcaster expects an Agent Card envelope (`action`,
  `result.summary`). Because `resp` lacks `action` and `result`, every execution
  reaching success or escalation crashes immediately.

### Finding 02 (P1): Caller Identity & Tenant Context Dropped at Router Dispatch

- **Location**:
  - `apps/api/src/api/routers/chat.py:66-71`
  - `apps/api/src/api/orchestrator/router.py:729-735`
  - `apps/api/src/api/orchestrator/supervisor.py:122`
- **Observed Behavior**:
  - In `chat.py`, `send_chat_message` authenticates `current_user` but
    instantiates `UserRequest` without `user_id` or `tenant_id`.
  - In `router.py:handle`, `agent_request = AgentRequest(...)` drops
    `request.user_id`, `request.tenant_id`, and `request.id` (correlation).
  - In `supervisor.py:run_supervisor`, subtasks are spawned without `user_id` or
    `tenant_id`.
- **Security Impact**:
  - Downstream `context_loader.load_context` cannot identify the caller and
    falls back to selecting an arbitrary `WorkspaceUser` record from the
    workspace.
  - `validate_resume_identity` cannot enforce tenant verification on
    single-agent resume.
  - Sub-agents operate in an unauthenticated / ambient security context.

### Finding 03 (P1): PostgreSQL UUID Operator Mismatch on Non-UUID Workspaces

- **Location**: `apps/api/src/api/orchestrator/loop.py:591, 637, 652` and
  `context_loader.py:149, 197`
- **Exact Exception**:
  ```text
  (sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class 'asyncpg.exceptions.UndefinedFunctionError'>: operator does not exist: uuid = character varying
  HINT: No operator matches the given name and argument types. You might need to add explicit type casts.
  [SQL: SELECT entities.id, ... FROM entities WHERE entities.workspace_id = $1::VARCHAR ...]
  ```
- **Contract Analysis**:
  - In `models/schema.py`, `Workspace.id`, `Entity.workspace_id`, and
    `Document.workspace_id` are strictly typed as `UUID`.
  - At the HTTP gateway (`_verify_workspace_access`), any non-UUID string is
    rejected with `400 Invalid ID format`.
  - However, when internal components or unit tests pass non-UUID mock strings
    (e.g. `"ws1"`), `context_loader` and `loop.py` issue queries binding strings
    against PostgreSQL UUID columns. PostgreSQL aborts the entire transaction
    block (`InFailedSQLTransactionError`), causing all subsequent RAG lookups to
    fail.

### Finding 04 (P1): QA Verification Gate Ordering & Structural Validation

- **Location**: `apps/api/src/api/orchestrator/loop.py:3091-3114`
- **Observed Behavior**:
  - The QA gate (`QAAgent.validate`) is nested inside
    `if reflect_result.is_satisfied:`.
  - In `reflect_phase`, if `action == "suggest"` and `confidence < 0.7`,
    `reflect_result.is_satisfied` is `False`.
  - Consequently, outputs with low confidence skip QA validation entirely during
    iterations 0 and 1.
  - No QA phase is recorded in state, and no structural validation (PII, harmful
    content, schema errors) runs until iteration 2 when retry budget is already
    exhausted.

### Finding 05 (P2): Unhandled Background Task Destruction in `_save_eval_phase`

- **Location**: `apps/api/src/api/orchestrator/loop.py:3148`
- **Observed Behavior**:
  - `loop.create_task(_save_eval_phase(state))` fires an unreferenced background
    coroutine.
  - Emits runtime warnings:
    `Task was destroyed but it is pending! task: <Task pending name='Task-9' coro=<_save_eval_phase()...>>`.
  - Threatens unobserved background failures during high concurrency or process
    termination.

---

## 4. Next Steps

Remediate the root causes following the contract-first approach approved by the
user, then execute the full re-verification, security red-team, AI quality
benchmark, and performance audit.
