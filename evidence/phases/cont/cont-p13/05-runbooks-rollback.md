# CONT-P13 — 05 Runbooks / Rollback (WS-13.2/13.5 ops tail)

## Rollback

- SAML change is 1-file, additive, env-gated: revert = `git revert <sha>`
  restores `require_signature=False` legacy behavior. No migration, no schema,
  no dual-write. Rollback drill: N/A (no stateful change) — revert + rerun
  `test_saml_failclosed.py` (expects fail on legacy code, proving coverage).
- IdP onboarding runbook: set `SAML_IDP_CERTIFICATE` + `SAML_ISSUER`; verify
  signed assertion authenticates; `SAML_ALLOW_UNSIGNED=true` only for cutover
  windows with expiry recorded in 08-registers.

## Operations

- 503 `SAML IdP not provisioned` is monitorable (distinct from 401 validation
  failures): alert on 503-rate spike = IdP cert rotation overdue.
- Telemetry redaction unchanged (`_redact` 9 keys); SAML assertions never
  logged (only `email`/`name_id` flow to user lookup).
