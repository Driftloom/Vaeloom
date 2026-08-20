# MVP-P11 — README

## Status

**BACKEND_IMPLEMENTATION — RE-AUDITED + CLOSED** against P11 commit + post-fix
working tree (2026-08-20). Gate: **90.5/100 PHASE CONDITIONALLY APPROVED —
RESTRICTIONS APPLY** (`09-gate-report.md` — weighted Σ(Score/10×Weight)=90.5,
corrected from claimed 96.0 Σ Score; §28 band 88–94).

Audit trail: original gate 96/100 → independent re-audit 82/100
(`.agents/findings/P11-deep-audit-2026-08-20.md`) → fixes applied → second
independent audit 85/100 with 2 new blockers → fixes applied (incl. lxml
namespace fix) → post-fix gate 96/100.

## What was implemented

| #   | Change                                                                                                                                      | Files                                         | Evidence       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| 1   | SAML signature validation enforced: signxml + idp_certificate required; structural fallback gated behind `SAML_ALLOW_STRUCTURAL_FALLBACK=1` | `services/saml.py`, `pyproject.toml`          | EVD-P11-001    |
| 2   | SAML parsed with lxml — stdlib ET renamed namespaces (`ns0`/`ns1`) and broke exc-c14n, causing valid signatures to be rejected              | `services/saml.py`                            | EVD-P11-014/15 |
| 3   | Connector credentials + sensitive config fields (connectionString/authToken/apiKey) encrypted via Fernet at rest; decryption failures raise | `services/connector_ext_service.py`           | EVD-P11-002    |
| 4   | Webhook update allowlist + secret re-encryption on update                                                                                   | `services/webhook_service.py`                 | EVD-P11-005    |
| 5   | Unknown agent fallback now logged with agent_type + request_id                                                                              | `orchestrator/loop.py`                        | EVD-P11-013    |
| 6   | `approvalApi` typed client + `ConsentState`/`ConsentRecord` aligned to backend shape                                                        | `lib/api-client.ts`                           | EVD-P11-011/12 |
| 7   | ApprovalCard wired to live `/approvals` API; consent toggles wired to `consentApi`                                                          | `notifications/page.tsx`, `settings/page.tsx` | EVD-P11-009/10 |
| 8   | SAML crypto-path tests: real keypair + signxml-signed assertion accepted; tampered signature rejected (2 tests)                             | `tests/test_saml.py`                          | EVD-P11-014/15 |
| 9   | `signxml>=4.0.4` pinned (CVE-2025-48994) and installed in project venv (5.1.0)                                                              | `pyproject.toml`, `.venv`                     | EVD-P11-016    |

## Verification run (2026-08-20, post-fix)

| Check                 | Command                              | Result                        |
| --------------------- | ------------------------------------ | ----------------------------- |
| P11 subset (20 files) | `pytest <20 test files> -q`          | **287 passed, 0 failed**      |
| Full suite collected  | `pytest tests/ --collect-only`       | 2341 tests                    |
| Env A (venv, 3.14.3)  | `.venv\Scripts\python.exe -m pytest` | 287/287, signxml 5.1.0        |
| Env B (PATH, 3.14.7)  | `python -m pytest`                   | SAML subset 14/14, signxml OK |

## Deferred (owned, tracked)

- SAML replay protection (InResponseTo/nonce) → P13
- Tenant deprovisioning cleanup → P14
- Connector permissions UI persistence → P12
- In-memory infra (circuit breaker, rate limiter) → P12

## Scope guardrails honored

- No new migrations; no new routes; one new runtime dep (`signxml>=4.0.4`).
- Gmail stays draft-only; trigger_sync documented as structural stub.
- Structural SAML fallback remains dev-only behind env var; fail-closed default.
- Everything workspace-scoped; RLS isolation verified by tests.
