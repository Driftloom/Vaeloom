# CONT-P14 — 07 Evidence Bundle

| EVD | Claim | Location | Independent check |
| --- | --- | --- | --- |
| EVD-P14-01 | Migration chain + rollback | `test_migrations.py` | 12/12 (taxonomy, downgrade, reapply) |
| EVD-P14-02 | Auth contracts stable | `test_auth.py` | 11/11 @ HEAD |
| EVD-P14-03 | OpenAPI 162 valid | `docs/backend/openapi.yaml` + `gen_openapi.py` | yaml parses, v0.2.0 |
| EVD-P14-04 | SAML posture | `test_saml` + `test_saml_failclosed` | 17/17 (carried) |
| EVD-P14-05 | RBAC coverage | `test_noauth_private.py` | 105/105 (carried) |
| EVD-P14-06 | Red-team + judge | security/eval suites | 0/18 + 1.0 (carried, zero drift) |
| EVD-P14-07 | P12 retrieval intact | `test_cont_p12` | 9/9 (carried) |
| EVD-P14-08 | CI dashboard | `.github/workflows/` (11 files) | backend/frontend/integration/temporal/security/a11y/docs jobs |
| EVD-P14-09 | Predecessor valid | `cont-p13` gate + handoff | 96.49 + authorization |
| EVD-P14-10 | Defect dispositions | `08-registers.md` / `05` | 5 items, all owned |
