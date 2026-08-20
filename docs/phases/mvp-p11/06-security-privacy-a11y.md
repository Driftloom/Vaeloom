# MVP-P11 — 06. Security, Privacy & A11y

## 1. Threat model (P11 scope)

| Asset / flow          | Threat                                                          | Control                                                                                                                                                                            | Status   |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SAML SSO              | Signature wrapping, algorithm confusion, forged assertion       | signxml required + `require_x509=True` + idp_certificate required; lxml preserves namespaces for exc-c14n; structural fallback gated behind env var; CVE-2025-48994 pinned >=4.0.4 | VERIFIED |
| SAML replay           | Assertion reuse                                                 | NOT IMPLEMENTED — InResponseTo/nonce tracking deferred to P13 (MEDIUM, RISK-MVP-P11-01)                                                                                            | DEFERRED |
| Connector credentials | DB breach exposes tokens/connection strings                     | Fernet encrypt at rest (token_ref + connectionString/authToken/apiKey); decrypt raises; is_encrypted prefix check; `get_decrypted` decrypts on read                                | VERIFIED |
| Webhook secret        | Plaintext store, mass-assignment                                | Encrypt on create; re-encrypt on update; allowlist `_ALLOWED_UPDATE_FIELDS`; HMAC uses decrypted secret                                                                            | VERIFIED |
| Workspace isolation   | Cross-tenant read/write                                         | Every connector/webhook query filters by `tenant_id` (UUID); RLS on 4/36 tables + app-level checks; `skip_auth` none found                                                         | VERIFIED |
| Approval bypass       | Agent acts without user approval                                | `lookup_approval` parameterized SQL; `has_approval` passed to agent; unapproved defaults to safe path; loop fallback logged                                                        | VERIFIED |
| Secrets in code       | Hardcoded ENCRYPTION_KEY / JWT_SECRET                           | `_get_fernet` requires ≥32 chars; `validate_settings` fails fast on default JWT secret; no hardcoded secrets found in src                                                          | VERIFIED |
| Supply chain          | signxml CVE-2025-48994 (HMAC confusion when require_x509=False) | Pinned `signxml>=4.0.4` (installed 5.1.0), `require_x509=True` in verifier                                                                                                         | VERIFIED |

## 2. Privacy / data rights

| Requirement                   | Implementation                                                                                                                                    | Evidence                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Consent grant/revoke          | `consent.py` grant/revoke/me endpoints; frontend toggles wired; ConsentRecord shape `id,user_id,tenant_id,scope,granted_at,revoked_at,ip_address` | api-client.ts:799-840, settings/page.tsx, test_consent 8/8 |
| GDPR export/delete            | `POST /gdpr/export` + `POST /gdpr/delete` (primary deletion + backup expiry 30d)                                                                  | test_gdpr 7/7, settings/page.tsx delete flow               |
| Data residency                | Not claimed in P11 (AGENTS.md notes: no residency claim until P13)                                                                                | —                                                          |
| Sensitive disclosure via logs | Logs contain IDs/scopes/status, not token values                                                                                                  | loop.py, saml.py logger calls                              |

## 3. Accessibility (P11 impact)

| Area                       | P11 change                                                                                    | Impact             |
| -------------------------- | --------------------------------------------------------------------------------------------- | ------------------ |
| SAML / connector / webhook | Backend-only                                                                                  | None               |
| Settings consent toggles   | `aria-label="Gmail read consent"` etc., checkbox native semantics                             | PASS               |
| Notifications ApprovalCard | Existing P10 a11y (keyboard a/r, aria-live) retained; P11 wiring does not alter DOM semantics | PASS (P10 EVD-004) |

## 4. Negative checks (independent)

| Check                          | Command                 | Result                                                            |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------- |
| `skip_auth` bypass             | `Get-ChildItem -Recurse | Select-String skip_auth`                                          | 0 hits |
| `TODO` in src (excl. known)    | `Select-String TODO`    | 1 known: `tenant_provisioning.py:103` (data cleanup deferred P14) |
| `connector.connector_type` bug | grep connector_type     | 0 in prod code (fixed to `connector.type`); only in .pyc cache    |
| Hardcoded passwords            | grep `password = "`     | 0 hits                                                            |

## 5. Residual risks (security)

| ID              | Risk                                    | Severity | Target |
| --------------- | --------------------------------------- | -------- | ------ |
| RISK-MVP-P11-01 | SAML replay protection not implemented  | MEDIUM   | P13    |
| RISK-MVP-P11-02 | Tenant deprovisioning cleanup TODO      | LOW      | P14    |
| RISK-MVP-P11-03 | Connector permissions still local state | LOW      | P12    |
