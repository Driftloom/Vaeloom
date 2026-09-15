# CONT-P13 — 01 IAM / Isolation / Secrets (WS-13.2)

## DEL-CONT-P13-02a — SAML fail-closed (finding + fix, this phase)

**Finding:** `routers/auth.py:saml_callback_post` built
`SAMLProvider(..., require_signature=False)` — unsigned assertions could
authenticate. Provider default is `require_signature=True`
(`services/saml.py:validate_assertion` raises without `ds:Signature`); the
router explicitly downgraded it.

**Fix (committed this phase):** require signature unless IdP cert missing AND
explicit `SAML_ALLOW_UNSIGNED=true` (dev/IdP-migration windows only); missing
cert with no opt-out → 503 `SAML IdP not provisioned` (fail-closed, no auth
issued). Default issuer `https://idp.example.com` retained only as fallback
when no `SAML_ISSUER` configured (still requires signature or opt-out).

**Tests:** `tests/security/test_saml_failclosed.py` (3) + `tests/test_saml.py`
(14 provider-level) — 17/17 @ HEAD.

## RBAC coverage (verified, no change needed)

RBAC is DI-helper (`middleware/rbac.py:require_role`, hierarchy
viewer<editor<admin + permission sets), not middleware — FastAPI-idiomatic.
Coverage proven by `tests/security/test_noauth_private.py` **105/105** @ HEAD
(every non-public route rejects unauthenticated; `PUBLIC_PATHS` allowlist
reviewed, includes `/api/v1/auth/*` + `/csrf-token` by design).

## SCIM / identity

`services/scim.py` mounted at `/scim` (`main.py:_safe_include`). SSO providers
google/microsoft live; SAML runtime path now fail-closed (above). JWT
fail-fast: `config.validate_settings()` refuses empty/<32-char/placeholder
secrets. API-key rotation+revocation live (`services/api_keys.py:rotate_key/
revoke_key`, `rotated_at/rotated_from` lineage).
