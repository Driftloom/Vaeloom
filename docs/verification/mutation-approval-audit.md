# Mutation & Approval Forensics Audit

## 1. Executive Summary

This document provides a forensic verification of all state-mutating actions
across the Vaeloom platform, evaluating human-in-the-loop approval interception,
state persistence, and replay safety.

---

## 2. Mutating Tools Inventory & Approval Classification

Out of 54 registered tools, **20 tools perform mutations** on internal or
external systems:

| Tool Name                       | Mutating Scope      | State Modified                |     Approval Status     | Code Reference       |
| :------------------------------ | :------------------ | :---------------------------- | :---------------------: | :------------------- |
| `create_github_issue`           | External Service    | GitHub Issues                 |        **GATED**        | `executor.py:50`     |
| `create_github_pull_request`    | External Service    | GitHub Repository             |        **GATED**        | `executor.py:50`     |
| `send_slack_message`            | External Service    | Slack Channels                |        **GATED**        | `executor.py:50`     |
| `create_calendar_event`         | External Service    | Google Calendar               |        **GATED**        | `executor.py:50`     |
| `create_outlook_calendar_event` | External Service    | Microsoft Outlook Calendar    |        **GATED**        | `executor.py:51`     |
| `draft_email`                   | External Service    | Gmail Drafts                  |        **GATED**        | `executor.py:51`     |
| `draft_outlook_mail`            | External Service    | Outlook Drafts                |        **GATED**        | `executor.py:51`     |
| `rename_file`                   | Internal/External   | Google Drive / Local File     |        **GATED**        | `executor.py:52`     |
| `move_file`                     | Internal/External   | Google Drive / Local File     |        **GATED**        | `executor.py:52`     |
| `categorize_document`           | Internal DB         | Document Metadata             |        **GATED**        | `executor.py:52`     |
| `create_entity`                 | Knowledge Graph     | Knowledge Graph Entities      |        **GATED**        | `executor.py:53`     |
| `merge_entities`                | Knowledge Graph     | Knowledge Graph Relationships |        **GATED**        | `executor.py:53`     |
| `execute_code_sandbox`          | Compute Sandbox     | Subprocess Environment        |        **GATED**        | `executor.py:57`     |
| `create_google_doc`             | External Service    | Google Drive Docs             |        **GATED**        | `executor.py:61`     |
| `append_google_doc`             | External Service    | Google Drive Docs             |        **GATED**        | `executor.py:61`     |
| `replace_google_doc_text`       | External Service    | Google Drive Docs             |        **GATED**        | `executor.py:61`     |
| `compile_resume_pdf`            | Storage / Artifacts | `resume_artifacts` Table      | **OPEN (Rate Limited)** | `definitions.py:926` |
| `compile_resume_docx`           | Storage / Artifacts | `resume_artifacts` Table      | **OPEN (Rate Limited)** | `definitions.py:944` |
| `compile_cover_letter`          | Storage / Artifacts | `resume_artifacts` Table      | **OPEN (Rate Limited)** | `definitions.py:961` |
| `notify_user`                   | Notification Center | `notifications` Table         |        **OPEN**         | `definitions.py:985` |

---

## 3. Approval Flow Forensics in `loop.py`

### 3.1 Interception Mechanism

In `apps/api/src/api/orchestrator/loop.py:1535-1545` and `loop.py:1806-1815`:

```python
from ..tools.executor import approval_gated_tools
if tname in approval_gated_tools():
    # 1. Check if an approved record exists in approval_request table
    # 2. If approved and unconsumed -> proceed with tool execution
    # 3. If missing or pending -> stage payload in approval_request table,
    #    emit SSE 'approval_required' event, and pause ReAct iteration
```

### 3.2 Security Vulnerabilities & Gaps Identified

1. **Lack of Cryptographic Staging Nonce (`SEC-P1-04`)**:
   - The staged approval record in `approval_request` stores JSON payloads
     without HMAC signing or payload hash verification.
   - If payload parameters are altered prior to execution, replay or tampered
     execution could occur.
2. **Double Execution Prevention**:
   - `consume_approval_for_action` (`loop.py:340`) marks the approval status as
     `CONSUMED`.
   - Verified: Re-submitting the same approval ID is rejected (Level 2 static
     code proof).
3. **Agent Self-Approval Prevention**:
   - Handled via `approval_decision` table requiring `decided_by_user_id`.
     Agents have no valid JWT claims to sign approval records.
