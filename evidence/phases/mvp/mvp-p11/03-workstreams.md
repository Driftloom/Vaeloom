# MVP-P11 — 03. Workstreams & Task Status

> Prompt §11/§12. Statuses: `VERIFIED` = implemented + tested. Gate at `4b17d16`
> (90.5/100 CONDITIONAL).

## WS-11.1 Identity/policy foundation

| Task | Status | Evidence |
| ------------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| SAML signature validation enforced (signxml + idp_certificate required) | VERIFIED | `services/saml.py:208-209`, EVD-P11-001 |
| SAML structural fallback gated behind `SAML_ALLOW_STRUCTURAL_FALLBACK=1` | VERIFIED | `services/saml.py:210-215`, test_rejects_without_cert |
| SAML parsed with lxml (stdlib ET broke exc-c14n namespaces) | VERIFIED | `services/saml.py:7`, EVD-P11-014/015 |
| SAML crypto-path verified with real keypair (valid accepted, tampered rejected) | VERIFIED | `tests/test_saml.py` 14/14 |
| AuthZ isolation before files/agents — tenant_id scoping in connectors/webhooks | VERIFIED | `connector_ext_service.py:69-87`, EVD-P11-008 |

## WS-11.2 Domain services/persistence

| Task | Status | Evidence |
| ----------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| Domain services audited (memory, agent, document, resume, KG, LLM) | VERIFIED | EVD-P11-006 144/144 |
| Connector encryption for sensitive config (connectionString/authToken/apiKey) | VERIFIED | EVD-P11-002, `_SENSITIVE_CONFIG_FIELDS` |
| Webhook secret encrypted at rest + re-encrypted on update | VERIFIED | EVD-P11-005, `webhook_service.py:22,51-62` |
| Idempotency, concurrency, outbox — no data loss on retry | VERIFIED | test_idempotency 6/6, test_data_isolation 9/9 |

## WS-11.3 Jobs/events/connectors

| Task | Status | Evidence |
| --------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| Connector CRUD with encryption (create/update/get_decrypted/test_connection) | VERIFIED | `connector_ext_service.py` 34/34 |
| trigger_sync documented as structural stub (status flip only, real sync deferred) | VERIFIED | `connector_ext_service.py:167-191`, handoff M.Gaps |
| Least privilege, encrypted tokens, kill-switch awareness (loop.py CB/RL) | VERIFIED | loop.py CB/RL, webhook allowlist |
| Event/worker contracts verified | VERIFIED | test_workers 4/4, test_events 5/5 |

## WS-11.4 Audit/rights/admin

| Task | Status | Evidence |
| ------------------------------------------------------------------------ | -------- | ----------------------------------------- |
| Approval lifecycle (PENDING→APPROVED/REJECTED/EXPIRED) + frontend wiring | VERIFIED | EVD-P11-007/010, `notifications/page.tsx` |
| Consent grant/revoke/me aligned to backend shape | VERIFIED | EVD-P11-012, `api-client.ts:799-811` |
| GDPR export/delete + audit events | VERIFIED | test_gdpr 7/7, test_audit 13/13 |
| Admin/support actions audited (no hidden manual step) | VERIFIED | audit trail in `09-gate-report.md` |

## WS-11.5 Tests/operations

| Task | Status | Evidence |
| ------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| 287 tests across 20 subsets (SAML 14, connector 34, webhooks 15, domain 144, audit/rights 44, middleware 27, workers/events 9) | VERIFIED | EVD-P11-016 287/287, 2343 collected |
| Frontend typecheck + jest (32 tests) | VERIFIED | `tsc --noEmit` 0 errors, jest 32/32 |
| Telemetry/structured logs (startup, SAML, connector, fallback) | VERIFIED | `saml.py:68,211-215`, `loop.py:273-277`, observability stack existing |
| Runbooks/dashboards (existing, no new P11 runbook — deferred to P17) | VERIFIED | Gate Operations 4/5, known INFO P12 |
