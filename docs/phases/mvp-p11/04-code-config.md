# MVP-P11 — 04. Code & Configuration Changes

> Exact diff from `2e08468` (P10) → `4b17d16` (closure). P11 feature commit
> `5c9049d` + post-fix `024151d`. All paths repo-relative.

## New files

| File | Purpose |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `apps/api/tests/test_saml.py` (expanded) | SAML suite + 2 crypto-path tests (TestSamlCryptographicSignature) |
| `docs/phases/mvp-p11/*` | Phase evidence (this directory, 11 files) |
| `.agents/findings/P11-*.md` | Independent audits (deep, independent, executive) + zero-trust audit |

## Modified files — Backend (apps/api)

| File | Change | Severity |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `pyproject.toml` | Added `signxml>=4.0.4` (5.1.0 installed in .venv and global Python 3.14) | HIGH |
| `services/saml.py` | Enforced signxml+idp_certificate; gated structural fallback behind `SAML_ALLOW_STRUCTURAL_FALLBACK=1`; switched parse from `xml.etree.ElementTree` to `lxml.etree` to preserve namespace prefixes for exc-c14n (stdlib ET renamed to ns0/ns1 → valid sigs failed) | HIGH |
| `services/connector_ext_service.py` | Added `_SENSITIVE_CONFIG_FIELDS` registry; Fernet encrypt on create/update for token_ref + connectionString/authToken/apiKey; `_decrypt_credential` raises on InvalidToken; `_decrypt_config` decrypts only if `is_encrypted`; trigger_sync uses `connector.type` (was connector_type bug) + structured logging + stub doc | HIGH |
| `services/webhook_service.py` | Create encrypts secret; update allowlist `_ALLOWED_UPDATE_FIELDS`; re-encrypts secret on update if plaintext; _compute_signature decrypts before HMAC | MEDIUM |
| `orchestrator/loop.py` | Added `logger.warning("dispatch_unknown_agent", extra={agent_type, request_id})` before fallback; approval lookup via parameterized SQL + JSON payload handling | MEDIUM |
| `services/encryption.py` | No line change in P11 but verified: decrypt_value raises InvalidToken, is_encrypted prefix check gAAAAA, key derived via sha256→base64 | — |
| `tests/test_connector_ext_service.py` | Added token_ref to mocks; updated create/update fixtures | MEDIUM |

## Modified files — Frontend (apps/web)

| File | Change | Severity |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `lib/api-client.ts` | Added `approvalApi` (list/approve/reject + types ApprovalItem/ApprovalListResponse); fixed `ConsentState.items: ConsentRecord[]` and `ConsentRecord {id,user_id,tenant_id,scope,granted_at,revoked_at,ip_address}`; fixed `ConsentGrantRequest {scope}` (removed spurious consent_version) | HIGH |
| `app/workspace/[workspaceId]/settings/page.tsx` | Wired consent toggles to `consentApi.grant/revoke` with live state (`item.scope`, `revoked_at===null`); removed double cast; consent_version hard-coded removal | HIGH |
| `app/workspace/[workspaceId]/notifications/page.tsx` | Wired ApprovalCard to live `approvalApi.list({status:'PENDING'})` + approve/reject handlers + mutate | HIGH |
| `agents/README.md`, `orchestrator/README.md` | Updated from stale "intentionally empty" to current agent inventory | LOW |

## Deleted files

| File | Reason |
| ---- | ------------------------- |
| — | No deletions in P11 scope |

## Configuration / Env

| Key | Value | Notes |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `ENCRYPTION_KEY` | ≥32 chars required (`_get_fernet` enforces) | Fernet derived via sha256→base64 |
| `SAML_ALLOW_STRUCTURAL_FALLBACK` | unset by default (fail-closed); `=1` for dev only | Prod requires signxml+idp_certificate |
| `signxml` | `>=4.0.4` pinned, 5.1.0 installed | CVE-2025-48994 mitigated via `require_x509=True` |
