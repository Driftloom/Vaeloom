# MVP-P11 — 07. Evidence & Traceability

## 1. Evidence register (16 items → 287 tests)

| Evidence ID | Claim                                                                        | Requirement | Type | Location                                            | Result       | Date       |
| ----------- | ---------------------------------------------------------------------------- | ----------- | ---- | --------------------------------------------------- | ------------ | ---------- |
| EVD-P11-001 | SAML signature validation enforced (signxml+idp_certificate, gated fallback) | MVP-P11-R01 | code | `services/saml.py:208-221`                          | VERIFIED     | 2026-08-20 |
| EVD-P11-002 | Connector credentials + config encrypted at rest                             | MVP-P11-R03 | code | `services/connector_ext_service.py:14-20,146-159`   | VERIFIED     | 2026-08-20 |
| EVD-P11-003 | SAML tests pass (incl. rejection + crypto path)                              | MVP-P11-R04 | test | `tests/test_saml.py`                                | 14/14 PASS   | 2026-08-20 |
| EVD-P11-004 | Connector tests pass (with encryption)                                       | MVP-P11-R04 | test | `tests/test_connector_ext_service.py`               | 34/34 PASS   | 2026-08-20 |
| EVD-P11-005 | Webhook tests pass (with re-encryption)                                      | MVP-P11-R04 | test | `tests/test_webhooks.py`                            | 15/15 PASS   | 2026-08-20 |
| EVD-P11-006 | Domain service tests pass                                                    | MVP-P11-R04 | test | `test_memory_service.py` etc. (6 files)             | 144/144 PASS | 2026-08-20 |
| EVD-P11-007 | Audit/rights tests pass                                                      | MVP-P11-R04 | test | `test_approval.py` etc. (5 files)                   | 44/44 PASS*  | 2026-08-20 |
| EVD-P11-008 | Middleware/isolation tests pass                                              | MVP-P11-R04 | test | `test_auth_middleware.py` etc. (4 files)            | 27/27 PASS   | 2026-08-20 |
| EVD-P11-009 | Consent toggles wired to backend API                                         | MVP-P11-R01 | code | `settings/page.tsx:62-74,159-174`                   | VERIFIED     | 2026-08-20 |
| EVD-P11-010 | ApprovalCard wired to live approval API                                      | MVP-P11-R01 | code | `notifications/page.tsx:52-73`                      | VERIFIED     | 2026-08-20 |
| EVD-P11-011 | approvalApi added to client                                                  | MVP-P11-R02 | code | `lib/api-client.ts:870-896`                         | VERIFIED     | 2026-08-20 |
| EVD-P11-012 | ConsentState/Record aligned to backend                                       | MVP-P11-R01 | code | `lib/api-client.ts:795-811`                         | VERIFIED     | 2026-08-20 |
| EVD-P11-013 | Fallback logging added                                                       | MVP-P11-R01 | code | `orchestrator/loop.py:273-277`                      | VERIFIED     | 2026-08-20 |
| EVD-P11-014 | SAML crypto path: valid signxml assertion accepted                           | MVP-P11-R03 | test | `tests/test_saml.py:TestSamlCryptographicSignature` | 1/1 PASS     | 2026-08-20 |
| EVD-P11-015 | SAML tampered signature rejected                                             | MVP-P11-R03 | test | `tests/test_saml.py:TestSamlCryptographicSignature` | 1/1 PASS     | 2026-08-20 |
| EVD-P11-016 | Full P11 subset 287/287 across 20 files                                      | MVP-P11-R04 | test | `apps/api/tests/` (20 files)                        | 287/287 PASS | 2026-08-20 |

*Gate report previously listed 66/66 for EVD-P11-007 but correct is 44/44
(approval 8 + consent 8 + gdpr 7 + audit 13 + encryption 8 =44); 66 was
double-count. Total still 287.

## 2. Traceability chain

| Source                                    | Requirement  | Design                             | File                                   | Test                                  | Evidence     | Risk                 | Gate           |
| ----------------------------------------- | ------------ | ---------------------------------- | -------------------------------------- | ------------------------------------- | ------------ | -------------------- | -------------- |
| INT-05 (spec: 8 agents, draft-only Gmail) | R01 scope    | ADR-001 monolith                   | `connector_ext_service.py` + `saml.py` | test_saml 14/14, test_connector 34/34 | EVD-001..004 | RISK-P11-01 (replay) | 10-handoff     |
| INT-08 (workflow: approval-gated)         | R03 security | `loop.py` fallback+approval lookup | `loop.py:273-295`                      | test_approval 8/8                     | EVD-010,013  | —                    | 02-predecessor |
| EXT-06 (RFC 9700)                         | R03 OAuth    | Least-privilege connectors         | `connector_ext_service.py` encrypt     | test_connector                        | EVD-002      | —                    | 06-security    |
| EXT-14/16 (GDPR/DPDP)                     | R03 privacy  | consentApi/gdprApi                 | `settings/page.tsx`                    | test_consent/gdpr                     | EVD-009,012  | —                    | 06-security    |

## 3. Test → evidence mapping (20 files → 287)

- Total collected (full suite): 2343 (previously 2341 +2 new crypto tests).
- P11 subset: 287 (listed in 05-test-results.md). All `is_encrypted` →
  `decrypt_value` paths covered; webhook re-encryption path covered; SAML crypto
  path now covered (was missing before lxml fix).

## 4. Immutable locations

- Gate report: `docs/phases/mvp-p11/09-gate-report.md` @ `4b17d16`
- Handoff: `docs/phases/mvp-p11/10-handoff-to-p12.md` @ `024151d` (code) /
  `4b17d16` (baseline pin)
- Audits: `.agents/findings/P11-*.md` committed in `024151d`
