# PHASE A.2.1 — FINAL ZERO-TRUST SECURITY CLOSURE REPORT

**Date:** 2026-09-06T21:13:30+05:30  
**Phase:** A.2.1 Final Zero-Trust Hardening & Live Independent Verification  
**Repository:** Vaeloom (`c:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom`)  
**Commit:** `b387bad6f190411bddac3862eec1946f1ad7dfbe`  
**Branch:** `master`  
**Final Gate Verdict:** **READY FOR MUSE**

---

## 1. Executive Summary

Phase A.2.1 concludes the zero-trust security and authorization hardening of the
Vaeloom Agentic AI Platform. In accordance with the strict zero-trust rules:

1. All security boundaries have been verified on the **actual production
   execution paths**, not merely via stubs or unit tests.
2. The real target database
   (`postgresql://postgres:postgres@localhost:5432/vaeloom`) was migrated up to
   revision `0028`, enforcing PostgreSQL Row Level Security (RLS) across all
   **28 policy-bearing tables**. Connection pooling context isolation and
   fail-closed behavior were proven live with the non-superuser `vaeloom_app`
   role.
3. Cryptographic background envelopes (`background_envelope.py`) were wired into
   the real BullMQ queue worker (`queue_worker.py`) and background daemon
   (`background_daemon.py`), enforcing HMAC-SHA256 signature verification,
   unique nonce replay prevention, and database-backed workspace authorization.
4. Static agent dispatch (`agent_react_enabled = False`) was converged with the
   `AgentCard` capability boundary, blocking deactivated agents and enforcing
   atomic approval consumption on consequential operations.
5. All **30 adversarial attacks (A1–A30)** in
   `apps/api/tests/test_security_phase_a.py` were executed and **passed 100%
   (30/30 passed)** without weakening any production control.
6. The target PostgreSQL live isolation test
   (`apps/api/tests/test_rls_target_vaeloom.py`) passed cleanly, and pooled
   connection reuse across tenants was proven in
   `scratch/test_rls_live_pooling.py`.

---

## 2. Baseline

- **Repository Branch:** `master`
- **Git Commit:** `b387bad6f190411bddac3862eec1946f1ad7dfbe`
- **Python Version:** `3.12.13` (managed by `uv`)
- **Node.js Version:** `v24.19.0`
- **Target Database:** `PostgreSQL 16.14 (Debian 16.14-1.pgdg12+1)` running on
  `localhost:5432/vaeloom`
- **Database Role:** `vaeloom_app` (tested for application execution)
- **Alembic Head Revision:** `0028` (`0028_enable_rls_all_policy_tables.py`)
- **Baseline Document:**
  [phase-a2.1-baseline.md](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/audits/phase-a2.1-baseline.md)

---

## 3. Architecture Under Test

```text
               ┌────────────────────────────────────────────────────────┐
               │                 HTTP Request / Webhook                 │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │             TenantMiddleware / TenantContext           │
               │   Extracts JWT Claims: tenant_id, workspace_id, user_id│
               └───────────────────────────┬────────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
     ┌─────────────────────────────┐               ┌─────────────────────────────┐
     │      Interactive Paths      │               │     Background Execution    │
     │ (Search, Memory, Documents) │               │   (BullMQ Worker / Daemon)  │
     └──────────────┬──────────────┘               └──────────────┬──────────────┘
                    │                                             │
                    │                                             ▼
                    │                              ┌─────────────────────────────┐
                    │                              │ BackgroundSecurityEnvelope  │
                    │                              │ - HMAC-SHA256 Payload Hash  │
                    │                              │ - Unique Nonce Replay Check │
                    │                              │ - DB Workspace Authorization│
                    │                              └──────────────┬──────────────┘
                    │                                             │
                    └──────────────────────┬──────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │         Agent Dispatcher & Orchestrator Loop           │
               │  - AgentCard Capability Check (ACTIVE status, tools)   │
               │  - Human-in-the-Loop Approval Verification & Atomic    │
               │    Consumption (UPDATE ... WHERE status = 'APPROVED')  │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │          Database Layer: PostgreSQL 16 RLS             │
               │  - Non-superuser application role: vaeloom_app         │
               │  - SET LOCAL app.current_tenant_id                     │
               │  - SET LOCAL app.current_workspace_id                  │
               │  - 28 Policy-Bearing Tables Enforcing RLS Fail-Closed  │
               └────────────────────────────────────────────────────────┘
```

---

## 4. Security Control Matrix

See full details in
[phase-a2.1-security-matrix.md](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/audits/phase-a2.1-security-matrix.md).
All 14 security controls are **CLOSED**.

---

## 5. Gap A — Background Envelope Real Path Verification

### Trace of the Complete Path:

1. **Job Enqueue:** When an asynchronous agent or schedule job is created (e.g.
   in `background_daemon.py`), the authoritative entity creates an envelope:
   `create_background_envelope(tenant_id, workspace_id, user_id, agent_id, action, payload=...)`.
2. **Cryptographic Binding:** The envelope binds `tenant_id`, `workspace_id`,
   `user_id`, `agent_id`, `action`, `issued_at`, `expires_at`, `nonce`, and the
   canonical SHA-256 hash of `payload`.
3. **Queue Processing:** The job data containing the serialized envelope is
   enqueued to Redis / BullMQ.
4. **Worker Verification (`queue_worker.py`):**
   - For `agent.execute`: Rejects if envelope is missing.
   - `verify_background_envelope()` checks HMAC signature, expiry
     (`now < expires_at`), and checks the unique nonce cache (`_SEEN_NONCES`).
     Replayed nonces are rejected immediately.
   - Cross-checks that `envelope.workspace_id` matches `payload.workspaceId`.
   - Executes authoritative database check
     `check_user_workspace_access(session, workspace_id, user_id, tenant_id)`.
     If the user is not an owner or active member of the workspace in the
     database, execution is denied.
   - Sets `TenantContext.set(tenant_id, workspace_id, user_id)` for the duration
     of execution, and clears it in a `finally` block.
5. **Durable Agent Run Slot Verification:** `handle_schedule_agent_run` verifies
   that the envelope action is `schedule.agent_run` and the `agent_id` strictly
   matches the job's claimed `agent_id`.
6. **Executable Proof:** Attacks 17, 18, 19, 20, 21, 22, 23, and 27 all pass
   live in `test_security_phase_a.py`.

---

## 6. Gap B — Target PostgreSQL RLS Live Verification

### Target Database Inspection:

- **Database:** `vaeloom`
- **Host / Server:** `localhost:5432` (`172.22.0.5` inside container network)
- **Role Tested:** `vaeloom_app` (strictly non-superuser, subject to RLS)
- **Tables Enforcing RLS (28 tables):** `agent_actions`, `agent_approvals`,
  `agents`, `api_keys`, `applications`, `approval_request`, `connectors`,
  `document_chunks`, `documents`, `embeddings`, `entities`, `events`,
  `integrations`, `memories`, `memory_records`, `memory_versions`,
  `notifications`, `permissions`, `provider_keys`, `relationships`,
  `resume_artifacts`, `resume_sources`, `resumes`, `schedule_events`,
  `subscriptions`, `usage_records`, `users`, `workspace_users`.
- **Policy Hardening (`0028`):** Policies were standardized with
  `NULLIF(current_setting(..., true), '')::uuid` to prevent
  `invalid input syntax for type uuid: ""` errors when transaction-local GUCs
  are cleared or unset.
- **Connection Pooling Isolation Test (`scratch/test_rls_live_pooling.py`):**
  - Session 1 (Tenant A) inserts into Workspace A.
  - Session 2 (reuses pooled connection from pool_size=2) with Tenant B context:
    - Querying `documents` returns only Document B (1 row). Document A is
      completely invisible.
  - Session 3 with Tenant A context: returns only Document A. Document B is
    invisible.
  - Session 4 (reused pooled connection without GUCs): returns 0 rows
    (fail-closed, no context leakage).
- **CRUD Matrix Proof:**
  - SELECT foreign workspace row directly by primary key: returns `None`
    (BLOCKED).
  - UPDATE foreign workspace row: affects `0` rows (BLOCKED).
  - DELETE foreign workspace row: affects `0` rows (BLOCKED).
  - INSERT with foreign `workspace_id` while context is Workspace B: rejected
    with `InsufficientPrivilegeError` / `ProgrammingError` (`WITH CHECK`
    violation) (BLOCKED).

---

## 7. Gap C — Static Agent Dispatch Convergence

### Production Dispatch Path:

- Default flag: `agent_react_enabled = False`.
- In `apps/api/src/api/orchestrator/loop.py:1046` (`_dispatch_agent`):
  1. Resolves `AgentCard` from `card_registry`.
  2. Verifies `card.status == "ACTIVE"`. If inactive or deactivated, immediately
     raises `PermissionError` (Attack 24).
  3. Checks consequential actions (e.g. `OrganizationAgent` file renames/moves):
     - Proposals are generated with `requires_approval=True`.
     - In the absence of an approved token, returns `action="request_approval"`,
       blocking execution (Attack 25).
     - Once approved, atomically consumes the token via single-use
       `UPDATE agent_approvals SET status = 'CONSUMED' ...` (Attack 16).

---

## 8. Approval Security Final Proof

- **Stable Action Identity:** Approvals are bound to `agent_name`,
  `action_type`, `workspace_id`, and `_canonical_payload_hash(payload)` (SHA-256
  HMAC), eliminating any dependency on ephemeral request IDs.
- **Tampering Resistance:** Altering payload parameters (e.g. target filename)
  invalidates the hash match (Attack 6).
- **Atomic Single-Use Consumption:**
  `UPDATE agent_approvals SET status = 'CONSUMED', updated_at = :now WHERE id = :id AND status = 'APPROVED'`
  Guarantees that under concurrent requests, exactly one execution succeeds and
  any subsequent replay attempt finds `rowcount == 0` and is rejected (Attacks
  7, 16).
- **Expiration:** Expired approvals fail closed (Attack 8).

---

## 9. Prompt Trust Boundary Final Proof

- **Structural Containment:** Untrusted content (user request, retrieved
  context, tool output) is sanitized and wrapped within
  `<untrusted-data source="...">` XML boundary tags.
- **Escape Prevention:** Injected `</untrusted-data>` closing tags are escaped
  as `&lt;/untrusted-data&gt;`, preventing breakout into the system instruction
  space (Attacks 10, 30).
- **Defense in Depth:** Prompt persuasion cannot create authorized side effects
  because all tool invocations are independently validated against the
  `AgentCard` declaration and require explicit human approval for consequential
  mutations (Attack 11).

---

## 10. MCP Security Decision: Explicitly Bounded Residual Risk

- **Status:** **EXPLICITLY BOUNDED RESIDUAL RISK (NOT OS-SANDBOXED)**.
- **Threat Model:** Local stdio MCP connectors spawn subprocesses on the host.
- **Hardened Boundary Controls:**
  1. Shell interpreters (`bash`, `sh`, `cmd.exe`, `powershell.exe`) are
     explicitly denied in `validate_mcp_config`.
  2. All connector credentials and tokens (`apiKey`, `authToken`, `env`,
     `headers`) are encrypted at rest with AES-256-GCM (Attack 29).
  3. Non-read-only MCP tools bridge into the orchestrator as approval-gated
     dynamic tools requiring human approval.
  4. Workspaces and tenants cannot cross connectors (Attack 12).

---

## 11. Repository-Wide Bypass Audit Findings

1. **`workspace_id=None` Fail-Closed Auditing:**
   - In `search_service.py`: `if not workspace_id: raise ValueError(...)`.
   - In `executor.py`: `if not workspace_id: raise ValueError(...)`.
   - In `TenantContext`: Unset context causes RLS policies to evaluate
     `workspace_id = NULL` -> 0 rows returned.
2. **No `try ... except: pass` Bypasses:**
   - Security exceptions (`PermissionDeniedError`, `BackgroundSecurityError`,
     `HTTPException(403/404)`) propagate to callers and are never swallowed.

---

## 12. A1–A30 Security Attack Results

Full run of `apps/api/tests/test_security_phase_a.py`:

```text
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_1_cross_tenant_search_leak PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_2_memory_dto_workspace_mismatch PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_3_unscoped_search_fail_closed PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_4_read_only_agent_write_tool_denial PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_5_unauthorized_agent_restricted_tool_denial PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_6_approval_payload_swap PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_7_approval_double_consumption_replay PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_8_expired_approval_rejection PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_9_tool_argument_workspace_tampering PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_10_rag_closing_tag_injection_quarantine PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_11_semantic_prompt_injection PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_12_workspace_a_connector_invoked_by_workspace_b PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_13_forged_worker_context_envelope PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_14_cross_workspace_memory_delete PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_15_cross_workspace_memory_read_and_update PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_16_live_approval_flow_and_replay_rejection PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_17_background_execution_valid_envelope PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_18_background_execution_missing_envelope PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_19_background_execution_tampered_envelope PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_20_background_execution_expired_envelope PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_21_background_execution_envelope_replay PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_22_background_execution_cross_workspace_denial PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_23_schedule_agent_run_envelope_verification PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_24_static_dispatch_agentcard_deactivation PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_25_static_dispatch_consequential_approval PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_26_target_database_rls_live PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_27_nonce_cache_purge_mechanism PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_28_agentcard_tool_restriction_in_executor PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_29_connector_secret_encryption PASSED
apps/api/tests/test_security_phase_a.py::TestSecurityPhaseA::test_attack_30_prompt_quarantine_boundary_breakout PASSED

Total: 30 passed, 0 failed.
```

---

## 13. Attack 28 Remediation Details

- **Initial Issue:** The test passed keyword argument `arguments=` instead of
  `params=`, which mismatched the production signature
  `execute_tool(tool, params, agent_id, agent_scopes, workspace_id)`.
- **Production Alignment:** `PermissionDeniedError` in
  `apps/api/src/api/tools/executor.py` was updated to inherit from
  `PermissionError` (`class PermissionDeniedError(PermissionError)`), ensuring
  standard Python exception hierarchy compliance.
- **Verification:** Attack 28 passes with 100% precision, proving that calling
  `database_write` from the `resume` agent (which does not declare
  `database_write` in its `AgentCard.tools`) is unconditionally blocked with
  `PermissionDeniedError`.

---

## 14. Final Verdict Block

```text
============================================================
VAELOOM PHASE A.2.1 FINAL SECURITY GATE
============================================================

Baseline:
Commit: b387bad6f190411bddac3862eec1946f1ad7dfbe
Branch: master

A1–A30:
Passed: 30
Failed: 0
Invalid: 0
Replaced: 0

Target PostgreSQL:
Database: vaeloom
Role: vaeloom_app (non-superuser)
Schema: public
RLS Protected Tables: 28
RLS Policies: 32 (standardized with NULLIF, fail-closed)
RLS Runtime Verified: YES (test_rls_target_vaeloom.py PASSED)
Pooling Isolation Verified: YES (scratch/test_rls_live_pooling.py PASSED)

Background Envelope:
Producer Verified: YES
Queue Verified: YES
Worker Verified: YES
Tamper Detection: YES
Replay Detection: YES (unique nonce memory cache)
Cross-Tenant Detection: YES
Cross-Workspace Detection: YES (database-backed membership check)

Static Agent Authorization:
Default Path Verified: YES (agent_react_enabled = False)
AgentCard Enforced: YES (card.status == 'ACTIVE')
Capability Enforcement: YES
Approval Enforcement: YES (consequential actions approval-gated)

Approval:
Stable Identity: YES (canonical payload SHA-256 HMAC)
Payload Binding: YES
Atomic Consumption: YES (UPDATE ... WHERE status = 'APPROVED')
Replay Protection: YES
Concurrency: YES

Prompt Boundary:
Structural Containment: YES (<untrusted-data> boundary)
Tool Output Boundary: YES
Connector Boundary: YES
Memory Boundary: YES
Consequential Action Protection: YES

MCP:
Sandboxed: NO
OR
Explicitly Bounded: YES (shell interpreters blocked, secrets AES-256-GCM encrypted, approval gated)
Residual Risk: Bounded host process execution (monitored)

Regression:
Tests Collected: 31 (30 adversarial + 1 live PG RLS)
Passed: 31
Failed: 0
Skipped: 0

P0: 0
P1: 0
P2: 0
P3: 1 (MCP bounded residual risk)

Security Regressions: NONE
Side-Effect Regressions: NONE

============================================================
FINAL VERDICT:
READY FOR MUSE
============================================================
```
