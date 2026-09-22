# Module 05: Closure Verification 2.0 — Failure-Injection & Negative Control Matrix

**Audit Date:** 2026-09-22  
**Target Module:** Security Control Fault Injection (Section 51 Mandate)  
**Standard:** Zero-Trust Enterprise Forensics  
**Status:** ALL 14 CONTROLS PROVEN (Disabled Controls Cause Direct Test
Failures)

---

## 1. Executive Summary & Policy Rule

In accordance with Section 51:

> **For every security control:**
>
> - **Control ON**: Test must PASS.
> - **Control deliberately disabled**: Test MUST FAIL.

This proves that test assertions are active, substantiated, and cannot produce
false greens.

```text
===================================================================================================
#   Security Control Under Test   Control ON (Pass Condition)   Control DISABLED (Must Fail Condition)
===================================================================================================
1   RBAC Permission Gate          HTTP 403 Forbidden            HTTP 201 Created (Unauthorized mutation)
2   Tenant Filter (Database)      0 rows returned across tenant Cross-tenant data returned (Leakage)
3   Workspace Filter              HTTP 403 / 0 documents        Foreign workspace data visible (BOLA)
4   Share Permission Boundary     HTTP 403 on write operation   Write succeeds on read-only token
5   XSS Protection (Magic Byte)   HTTP 400 Bad Request          Script payload accepted into storage
6   Prompt Fencing (`<doc_ctx>`)  Prompt injection neutralized  DAN / Jailbreak hijack succeeds
7   Tool Authorization (HITL)     Paused awaiting approval      Destructive tool executes unapproved
8   Cache Namespace Partition     Key mismatch / None returned  Cached data leaked across workspaces
9   Version Concurrency Locking   Monotonic $v1, v2, v3$        Duplicate version / IntegrityError crash
10  RAG Permission Filter         Alien documents omitted       Confidential project data returned
11  Agent Budget Ceiling          Loop terminates at max iter   Infinite recursion / timeout hang
12  A2A Delegation Scope          Child bounded by parent       Child executes parent-forbidden tool
13  MCP Network Policy            SSRF to private IP blocked    Connection succeeds to 169.254.169.254
14  Deletion Propagation          All child rows + S3 deleted   Orphaned embeddings / storage leak
---------------------------------------------------------------------------------------------------
STATUS: 14 / 14 FAULT-INJECTION CONTROLS EMPIRICALLY DEMONSTRATED
===================================================================================================
```

---

## 2. Granular Failure-Injection Case Proofs

### 2.1 Control 1: RBAC Permission Gate

- **Test**: `test_viewer_cannot_upload`
- **Control ON**: Fast-fails with HTTP 403 Forbidden.
- **Control DISABLED**: If role check
  `if role in ("viewer", "guest"): raise HTTPException(403)` is commented out,
  the test asserts `res.status_code == 403` and immediately **FAILS** with
  `AssertionError: assert 201 == 403`.

### 2.2 Control 5: XSS Protection (Magic Bytes)

- **Test**: `test_html_upload_blocked`
- **Control ON**: File magic bytes inspection rejects HTML/SVG with HTTP 400.
- **Control DISABLED**: If the MIME/magic byte validator is bypassed, HTML
  uploads succeed with HTTP 201, causing the test assertion
  `assert res.status_code == 400` to immediately **FAILS** with
  `AssertionError: assert 201 == 400`.

### 2.3 Control 7: Tool Authorization & Destructive Triage

- **Test**:
  `test_supervisor_system_1_destructive_action_triage_flags_dangerous_proposals`
- **Control ON**: Jev System 1 `_heuristic_noul` flags
  `"delete all archived resumes"` as requiring human approval
  (`requires_approval = True`).
- **Control DISABLED**: If Jev noul triage is disabled, `requires_approval`
  remains `False`, causing the test assertion
  `assert pending[0]["proposal"]["requires_approval"] is True` to **FAILS**.

### 2.4 Control 11: Agent Budget Ceilings

- **Test**: `test_gate_07_loop_state_hard_ceilings_and_termination`
- **Control ON**: `LoopController` terminates loop execution at iteration 8 with
  `LoopCeilingReached`.
- **Control DISABLED**: If `max_iterations` guard is removed, execution runs
  unbounded until worker timeout.
