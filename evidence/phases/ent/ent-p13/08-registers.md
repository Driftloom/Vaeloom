# ENT-P13 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk                                               | Severity | Likelihood | Impact | Mitigation                                                                                | Owner            | Status         | Expiry     |
| --------------- | -------------------------------------------------- | -------- | ---------- | ------ | ----------------------------------------------------------------------------------------- | ---------------- | -------------- | ---------- |
| RISK-ENT-P13-01 | Prompt injection goal hijacking depth insufficient | HIGH     | MEDIUM     | HIGH   | Enhanced detection classifier planned; current XML fencing + S1 triage active             | AI Safety Lead   | OPEN — TRACKED | 2026-12-31 |
| RISK-ENT-P13-02 | SAML router not wired (enterprise-only login path) | MEDIUM   | LOW        | MEDIUM | `services/saml.py` exists; ENT-P16 wires it; OIDC covers all current enterprise customers | IAM Engineer     | OPEN — TRACKED | ENT-P16    |
| RISK-ENT-P13-03 | DPDP data nominee not implemented                  | MEDIUM   | LOW        | MEDIUM | Designed; India-region backlog; no India-region customers in current pipeline             | Privacy Engineer | OPEN — TRACKED | ENT-P15    |
| RISK-ENT-P13-04 | Trivy high CVE in Python base image                | HIGH     | MEDIUM     | HIGH   | Base image pinned to current patch; upgrade scheduled for ENT-P16                         | DevOps           | OPEN — TRACKED | ENT-P16    |
| RISK-ENT-P13-05 | External pentest not yet completed                 | HIGH     | LOW        | HIGH   | Internal red team 9/10 blocked; external CREST-certified pentest scheduled ENT-P19        | CISO             | OPEN — TRACKED | ENT-P19    |

---

## Decision Register

| ID             | Decision                                                                     | Rationale                                                                                         | Alternatives                                               | Owner                    | Date       | Impact                                  |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------ | ---------- | --------------------------------------- |
| DEC-ENT-P13-01 | Cryptographic erasure satisfies GDPR Art.17 right-to-erasure                 | DEK rotation + 30-day destruction = permanent inaccessibility; no row deletion needed             | Physical deletion (rejected: breaks audit chain)           | Privacy Engineer + Legal | 2026-09-29 | Data model; KMS design                  |
| DEC-ENT-P13-02 | ConsentGrant model requires explicit per-purpose grant from individual       | Highest-common-denominator consent (GDPR + DPDP); protects individual sovereignty                 | Implicit consent (rejected: GDPR incompatible)             | Privacy Engineer         | 2026-09-29 | All institution data access paths       |
| DEC-ENT-P13-03 | SAML router deferred to ENT-P16 (MVP track: OIDC-only)                       | No current enterprise customers requiring SAML; OIDC supports all current IdPs                    | Ship SAML now (rejected: incomplete testing)               | IAM Engineer + CISO      | 2026-09-29 | Enterprise SSO roadmap                  |
| DEC-ENT-P13-04 | External pentest scheduled for ENT-P19 (pre-production)                      | Internal red team coverage sufficient for current dev phase; external pentest before production   | Pentest now (deferred: incomplete feature set)             | CISO                     | 2026-09-29 | SOC 2 audit timeline                    |
| DEC-ENT-P13-05 | EU AI Act self-classification as MINIMAL/LIMITED risk (pending legal review) | No use cases match Annex III high-risk criteria; professional review required before public claim | Self-declare high-risk (rejected: unnecessary burden)      | AI Safety Lead + Legal   | 2026-09-29 | Product marketing; enterprise contracts |
| DEC-ENT-P13-06 | Append-only S3 WORM audit log with hash chaining for repudiation prevention  | Meets SOC 2 CC7 + GDPR accountability; immutable by design                                        | Database audit table (rejected: mutable; admin can delete) | Security Architect       | 2026-09-29 | Audit architecture                      |

---

## Assumption Register

| ID             | Assumption                                                                               | Basis                                                         | Risk if wrong                               | Owner              | Review date |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------- | ------------------ | ----------- |
| ASM-ENT-P13-01 | Supabase PostgreSQL supports per-session GUC settings compatible with RLS                | Live test `test_rls_live_pg.py` — 5/5 pass                    | Cross-tenant data leak if GUC setting fails | Security Architect | 2026-10-31  |
| ASM-ENT-P13-02 | Ollama Cloud and TypeSafe AI Jev have adequate DPA-compatible data handling for EU users | Currently US-based; SCCs required before EU production        | GDPR violation; service suspension          | Legal Reviewer     | 2026-10-31  |
| ASM-ENT-P13-03 | KMS DEK rotation completes within 30-day GDPR erasure window                             | Async job design; 30-day is generous; KMS latency <1ms        | GDPR non-compliance if rotation is delayed  | Privacy Engineer   | 2026-11-30  |
| ASM-ENT-P13-04 | No current users are under 13 (COPPA) or under 18 India (DPDP child data rules)          | No age gate implemented yet; self-attestation at registration | COPPA/DPDP violation if minor uses platform | Legal Reviewer     | ENT-P16     |

---

## Traceability Register

| Req ID      | Requirement                                                      | Design                                      | Implementation                                | Test                          | Evidence                   | Risk        | Handoff            |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- | ----------------------------- | -------------------------- | ----------- | ------------------ |
| ENT-P13-R01 | Security, privacy, identity, consent, data rights, AI governance | 6-layer topology; STRIDE matrix             | Auth middleware; RLS; ConsentGrant; HITL gate | `tests/security/` (404 tests) | EVD-001..005               | RISK-01..05 | ENT-P14 entry      |
| ENT-P13-R02 | Every material claim links to evidence                           | Evidence-first documentation mandate        | All DELs carry version/owner/reviewer         | Gate scorecard review         | EVD-001..020               | —           | ENT-P14 entry      |
| ENT-P13-R03 | Applicable security risks designed, tested, owned                | STRIDE + OWASP overlay                      | TH-S01..TH-E05; TH-AA01..AA08                 | Red team 9/10 blocked         | EVD-003..005, EVD-019      | RISK-01..05 | ENT-P14 entry      |
| ENT-P13-R04 | Validation covers normal, negative, boundary, failure            | Test suite design                           | 731 tests + 8 negative controls               | `05-test-results.md`          | EVD-018..020               | —           | ENT-P14 entry      |
| ENT-P13-R05 | Ownership, telemetry, support, rollback, lifecycle               | Break-glass; breach response                | PAM; OTel; S3 WORM audit                      | `test_break_glass.py`         | EVD-014                    | RISK-05     | ENT-P14 entry      |
| ENT-P13-R06 | Data lineage, scope, quality, retention, AI lineage              | Processing activity register; DEK lifecycle | `PA-01..PA-12`; KMS lifecycle                 | Crypto erasure tests          | EVD-006..010, EVD-015..017 | RISK-03     | ENT-P14 entry      |
| ENT-P13-R07 | Requirements map to design, artifacts, tests, evidence, risks    | Traceability table                          | All cross-references in this register         | Gate scorecard                | EVD-001..020               | —           | ENT-P14 entry      |
| ENT-P13-R08 | Gate score ≥95 + zero mandatory blockers                         | §28 gate protocol                           | Gate report                                   | 97.3/100; 0 blockers          | EVD-018                    | —           | ENT-P14 authorized |

---

_Registers v1.0.0 — Security Architect — 2026-09-29_
