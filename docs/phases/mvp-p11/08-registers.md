# MVP-P11 — 08. Registers (Risks / Decisions / Assumptions / Changes)

## 1. Risks

| ID | Risk | Sev | Impact | Mitigation | Owner | Status |
| --------------- | ------------------------------------------------ | -------- | --------------------- | ------------------------------------------------------------------------------------ | ----------- | ----------------- |
| RISK-MVP-P11-01 | Docs mistaken for runtime completion | Critical | False readiness | Require runtime evidence/status labels + independent test re-run (287/287) | Phase owner | CLOSED (verified) |
| RISK-MVP-P11-02 | Scope/permission/data/compatibility assumed | High | Leak/loss/rework | All tenant_id filters verified; no skip_auth; webhook allowlist; encryption verified | Security | CLOSED |
| RISK-MVP-P11-03 | External API/model/standard changes | High | Regression | Pinned signxml>=4.0.4 (5.1.0), lxml for SAML, Fernet, OpenAPI 79-path verified | Integration | CLOSED |
| RISK-MVP-P11-04 | Evidence incomplete | High | Untrustworthy gate | 11-file evidence package, 16 EVDs, 287 tests re-run in 2 envs | QA | CLOSED |
| RISK-MVP-P11-05 | MVP scope expansion | High | Delay/complexity | Strict scope: trigger_sync is documented stub, no cross-user memory, no SSO SCIM | Product | OPEN (gating) |
| RISK-MVP-P11-06 | SAML replay (InResponseTo/nonce) not implemented | Medium | Assertion reuse | Deferred to P13 with explicit risk entry; fail-closed signature required now | Security | OPEN → P13 |
| RISK-MVP-P11-07 | Tenant deprovisioning TODO | Low | Orphan data | Deferred to P14; single TODO in tenant_provisioning.py:103 | Platform | OPEN → P14 |
| RISK-MVP-P11-08 | Connector permissions UI local state | Low | UX vs persistence gap | Deferred to P12 (needs backend permissions model) | Frontend | OPEN → P12 |

## 2. Decisions

| ID | Decision | Rationale | Authority | Date |
| ---------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------- | ---------- |
| DEC-P11-01 | Use signxml for SAML, gated structural fallback | Crypto required in prod; dev fallback behind SAML_ALLOW_STRUCTURAL_FALLBACK=1 | Security | 2026-08-20 |
| DEC-P11-02 | Fernet encrypt token_ref + sensitive config (connectionString/authToken/apiKey) | At-rest protection; 32-char key enforced | Security | 2026-08-20 |
| DEC-P11-03 | Parse SAML with lxml (not stdlib ET) | Stdlib renamed namespaces → exc-c14n broken; lxml preserves prefixes | Code review 024151d | 2026-08-20 |
| DEC-P11-04 | trigger_sync remains structural stub | Real sync needs per-connector clients + pagination + memory store; doc as known gap | Product | 2026-08-20 |
| DEC-P11-05 | Gate arithmetic corrected 90.5 CONDITIONAL (from claimed 96) | Weighted sum 90.5 falls in 88-94 band per §28; user approved fix | User | 2026-08-20 |

## 3. Assumptions

| ID | Assumption | Owner | Reversible? | Test |
| ---------- | ------------------------------------------------------------------------------- | -------- | -------------------------------- | ------------------------------------------ |
| ASP-P11-01 | signxml 5.1.0 + lxml available in both venv and PATH Python 3.14 | Platform | Yes — pip install signxml>=4.0.4 | import signxml in both envs |
| ASP-P11-02 | Backend /consent/me returns {items: ConsentRecord[]} (not {scopes:[]}) | API | Yes — contract test | ConsentState shape fixed in api-client.ts |
| ASP-P11-03 | SQLite dev representative for Postgres behavior (Fernet, tenant isolation) | QA | Yes — P13 Postgres integration | 287 tests use SQLite mock |
| ASP-P11-04 | Full 2343 suite not needed for P11 verdict; 20-file 287 subset covers P11 scope | QA | Yes — full run 600s timeout | P12 can run full suite with larger timeout |

## 4. Changes

| ID | Change | Impact | Approver |
| ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| CHG-P11-01 | Added signxml dep + saml lxml parse + connector config encryption + webhook allowlist | Files: 8 modified + 2 tests; no migration | Phase owner + Security |
| CHG-P11-02 | Wired ApprovalCard + Consent toggles to live APIs | Frontend 3 files; no route change | Frontend Lead |
| CHG-P11-03 | Expanded evidence package 3→11 files + corrected gate total 96→90.5 | Docs only; no code impact | User 2026-08-20 |

## 5. Open issues carried → next phase

- RISK-MVP-P11-06..08 above; P12 owns agent hardening + memory pipeline; P13
 owns SAML replay + input sanitization; P14 owns tenant cleanup + a11y audit.
