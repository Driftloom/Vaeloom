# Module 05: Agent Reasoning & ReAct Loops
**Audit Identifier**: `AUD-M05-AI-21`
**Scope**: DocumentAgent and WorkspaceAgent handlers, reasoning loops, grounded synthesis, and cycle prevention.

---

## 1. DocumentAgent Architecture

Implemented in `api/agents/document_agent/handler.py`:
- **Mission**: General-purpose document Q&A, cross-document synthesis, and grounded citation extraction.
- **Autonomy**: `read_only` default autonomy (no mutating file actions permitted without human-in-the-loop approval).
- **Tool Suite**: `search_documents`, `get_document_content`, `query_graph`, `get_document_version`.
- **Grounded Citations**: Extracted via `DocumentCitation` model linking document ID, title, section, and verbatim excerpt.

---

## 2. WorkspaceAgent Architecture

Implemented in `api/agents/workspace_agent/handler.py`:
- **Mission**: Workspace hygiene, folder structure reorganization, duplicate detection, and file lifecycle proposals.
- **Autonomy**: Proposes folder reorganizations as diffs; requires human approval for bulk operations.

---

## 3. Loop Safety & Cycle Detection

Integrated with `LoopSafetyTracker` (`api/orchestrator/loop_safety.py`):
- Tracks tool fingerprints.
- If 3 identical consecutive tool calls or recurring loops are detected, trips `cycle_detected` and breaks out to the user with a clarification question.

---

## 4. Verification Evidence

- `test_module05_agents.py`:
  - `test_grounded_agent_synthesis_and_citations`: Verifies grounded synthesis and citation structure.
  - `test_workspace_agent_sprawl_and_hygiene`: Verifies workspace agent hygiene proposals.
- `test_module05_e2e.py`:
  - Validates full end-to-end reasoning loop and citation generation.
