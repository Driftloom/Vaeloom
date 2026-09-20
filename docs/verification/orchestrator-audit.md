# Orchestrator Monolith Forensics: `loop.py` Deep Structural Breakdown

## 1. Executive Summary

`apps/api/src/api/orchestrator/loop.py` represents the central monolith of the
Vaeloom agent system. It spans **3,238 lines of code** and tightly entangles 7
distinct responsibilities that must be split into isolated packages.

---

## 2. Line-by-Line Structural Decomposition

| Line Range            | Primary Responsibility                                                                 | Tangled Coupling                                         | Target Architectural Package                          |
| :-------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------- | :---------------------------------------------------- |
| **Lines 1 - 135**     | Global Constants, Imports, In-Memory State                                             | Direct imports from `api.tools`, `api.database`          | `packages/agent-common/`                              |
| **Lines 136 - 450**   | Approval Management (`fetch_pending_approvals`, `lookup_approval`, `consume_approval`) | Direct database session queries on `ApprovalRequest`     | `packages/agent-policy/` & `packages/agent-security/` |
| **Lines 451 - 880**   | Context Hydration & Prompt Assembly                                                    | LLM prompt string templates and memory injection         | `packages/agent-common/`                              |
| **Lines 881 - 1220**  | ReAct Reasoning Step Loop (`_react_step`)                                              | OpenAI / Anthropic LLM API calls and token accounting    | `packages/agent-common/runtime/`                      |
| **Lines 1221 - 1850** | Tool Invocation & Approval Gate Interception                                           | Calls `executor.py` and checks `_BASE_APPROVAL_GATED`    | `packages/agent-tools/` & `packages/agent-policy/`    |
| **Lines 1851 - 2450** | Sub-Agent Spawning & Delegation Handling                                               | Recursive in-process execution of sub-agents             | `packages/agent-delegation/`                          |
| **Lines 2451 - 3238** | SSE Streaming & Event Generation                                                       | FastAPI `EventSourceResponse` formatting and yield loops | `runtimes/messages-api-worker/` & `apps/api/`         |

---

## 3. Critical Flaws in the Monolithic Loop

1. **Excessive Cyclomatic Complexity**:
   - The primary ReAct iteration loop spans over 1,000 lines with nested
     `try...except`, recursive tool execution branches, and conditional
     sub-agent delegation.
2. **In-Memory Non-Durable State**:
   - While state checkpoints are written to `loop_checkpoints` table, execution
     state during ReAct steps is kept in local Python variables.
   - If the API worker process restarts or crashes mid-step, the active
     iteration is lost unless backed by Temporal durable workflows.
3. **Implicit Sub-Agent Recursion**:
   - When an agent delegates to another agent (e.g. `CareerAgent` ->
     `ATSAgent`), the child agent runs in the same thread and call stack,
     risking call-stack overflows and unconstrained token consumption.

---

## 4. Modular Refactoring Target

Extract `loop.py` into:

- `packages/agent-common/vaeloom_agent_common/runtime/loop.py` (Core ReAct
  engine)
- `packages/agent-policy/vaeloom_agent_policy/engine.py` (Approval & permission
  validation)
- `packages/agent-tools/vaeloom_agent_tools/dispatcher.py` (Tool execution
  dispatch)
- `packages/agent-delegation/vaeloom_agent_delegation/router.py` (DAG-bounded
  sub-agent delegation)
