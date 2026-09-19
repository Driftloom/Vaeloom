# CONT-P13 — 07 Evidence Bundle

| EVD | Claim | Location | Independent check |
| --- | --- | --- | --- |
| EVD-P13-01 | SAML fail-closed | `routers/auth.py:316-321` | `test_saml_failclosed.py` 3/3 (503/401/400) |
| EVD-P13-02 | SAML provider enforcement | `services/saml.py:validate_assertion` | `test_saml.py` 14/14 incl. missing-signature rejection |
| EVD-P13-03 | RBAC coverage | `middleware/rbac.py` + `test_noauth_private.py` | 105/105 unauth rejected |
| EVD-P13-04 | SCIM mounted | `main.py:_safe_include(scim_router, "/scim")` | import + route table |
| EVD-P13-05 | Consent/erasure/retention | `consent.py`, `erasure_service.py` (+receipts), 0021 runs | code + DPIA `docs/security/DPIA.md` |
| EVD-P13-06 | JWT fail-fast | `config.validate_settings()` | empty/<32/placeholder refused |
| EVD-P13-07 | Key rotation | `api_keys.py:rotate_key/revoke_key` | lineage fields |
| EVD-P13-08 | Red-team posture | `test_redteam_loop.py` | 46/46, bypass 0/18 (carried) |
| EVD-P13-09 | Judge gate | `test_orchestrator_quality_gate.py` | pass_rate 1.0 (carried) |
| EVD-P13-10 | Predecessor valid | `cont-p12` gate + 09-15 addendum | 96.16 + 96.1 re-sign |
