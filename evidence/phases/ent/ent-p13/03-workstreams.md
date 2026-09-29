# ENT-P13 Workstreams Execution Tracking

**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Date:** 2026-09-29

---

## WS-13.1 — Threat / Abuse Modeling

| Item                                          | Status   | Owner              | Evidence                                                  | Date       |
| --------------------------------------------- | -------- | ------------------ | --------------------------------------------------------- | ---------- |
| System context + trust boundary inventory     | VERIFIED | Security Architect | `01-threat-model-stride.md` §1 — 10 trust boundaries      | 2026-09-29 |
| Asset inventory (A-01..A-12)                  | VERIFIED | Security Architect | `01-threat-model-stride.md` §2 — 12 assets classified     | 2026-09-29 |
| Attacker profile definition (AP-01..AP-08)    | VERIFIED | Security Architect | `01-threat-model-stride.md` §3 — 8 profiles               | 2026-09-29 |
| STRIDE threat matrix (Spoofing)               | VERIFIED | Security Architect | TH-S01..S05 — 5 threats; 5 MITIGATED                      | 2026-09-29 |
| STRIDE threat matrix (Tampering)              | VERIFIED | Security Architect | TH-T01..T05 — 5 threats; 4 MITIGATED, 1 PARTIAL           | 2026-09-29 |
| STRIDE threat matrix (Repudiation)            | VERIFIED | Security Architect | TH-R01..R03 — 3 threats; 3 MITIGATED                      | 2026-09-29 |
| STRIDE threat matrix (Information Disclosure) | VERIFIED | Security Architect | TH-I01..I06 — 6 threats; 6 MITIGATED                      | 2026-09-29 |
| STRIDE threat matrix (DoS)                    | VERIFIED | Security Architect | TH-D01..D05 — 5 threats; 5 MITIGATED                      | 2026-09-29 |
| STRIDE threat matrix (EoP)                    | VERIFIED | Security Architect | TH-E01..E05 — 5 threats; 5 MITIGATED                      | 2026-09-29 |
| OWASP Agentic Top 10 overlay                  | VERIFIED | AI Safety Lead     | TH-AA01..AA08 — 8 risks; 5 MITIGATED, 3 PARTIAL           | 2026-09-29 |
| Residual risk summary                         | VERIFIED | Security Architect | `01-threat-model-stride.md` §6 — 4 residual items tracked | 2026-09-29 |

**WS-13.1 Status: ✅ COMPLETE**

---

## WS-13.2 — IAM / Isolation / Secrets

| Item                                  | Status                 | Owner              | Evidence                                                           | Date       |
| ------------------------------------- | ---------------------- | ------------------ | ------------------------------------------------------------------ | ---------- |
| SSO OIDC (Google / Microsoft)         | VERIFIED               | IAM Engineer       | `03-iam-rbac-hardening.md` §2 — 7 controls; all IMPLEMENTED        | 2026-09-29 |
| SAML 2.0 implementation               | IMPLEMENTED_UNVERIFIED | IAM Engineer       | `services/saml.py` — real signxml; not wired to router; ENT-P16    | 2026-09-29 |
| SCIM 2.0 endpoints                    | VERIFIED               | IAM Engineer       | `03-iam-rbac-hardening.md` §3 — 7 SCIM ops; JIT provisioning       | 2026-09-29 |
| RBAC role hierarchy (5 roles)         | VERIFIED               | IAM Engineer       | `03-iam-rbac-hardening.md` §4 — permission matrix; ABAC extensions | 2026-09-29 |
| Break-glass protocol                  | VERIFIED               | Security Architect | `03-iam-rbac-hardening.md` §5 — 6-step; dual-approval; 4h TTL      | 2026-09-29 |
| Cryptographic standards               | VERIFIED               | Security Architect | `03-iam-rbac-hardening.md` §6 — RS256, AES-256-GCM, HMAC-SHA256    | 2026-09-29 |
| Secrets management (Infisical)        | VERIFIED               | IAM Engineer       | `03-iam-rbac-hardening.md` §7 — 7 secrets; rotation policy         | 2026-09-29 |
| Zero-trust enforcement matrix         | VERIFIED               | Security Architect | `03-iam-rbac-hardening.md` §8 — 6 layers; all verified             | 2026-09-29 |
| DEK lifecycle + cryptographic erasure | VERIFIED               | Security Architect | `04-crypto-erasure-kms.md` — full lifecycle; compliance map        | 2026-09-29 |
| KMS two-tier key hierarchy            | VERIFIED               | Security Architect | `04-crypto-erasure-kms.md` §2 — MK + Workspace DEK                 | 2026-09-29 |

**WS-13.2 Status: ✅ COMPLETE (SAML router wiring deferred to ENT-P16 —
tracked)**

---

## WS-13.3 — Privacy / Consent / Rights

| Item                                        | Status                  | Owner                    | Evidence                                                          | Date       |
| ------------------------------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------- | ---------- |
| Processing activity register (PA-01..PA-12) | VERIFIED                | Privacy Engineer         | `02-dpia-privacy-ai-assessment.md` §1 — 12 activities             | 2026-09-29 |
| Individual rights implementation matrix     | VERIFIED                | Privacy Engineer         | `02-dpia-privacy-ai-assessment.md` §2 — 8 rights; 6 IMPLEMENTED   | 2026-09-29 |
| Consent architecture (ConsentGrant model)   | VERIFIED                | Privacy Engineer         | `02-dpia-privacy-ai-assessment.md` §3 — model + enforcement chain | 2026-09-29 |
| Multi-region residency map                  | VERIFIED                | Privacy Engineer         | `02-dpia-privacy-ai-assessment.md` §4 — 3 cells + control plane   | 2026-09-29 |
| Processor / sub-processor register          | VERIFIED                | Legal Reviewer           | `02-dpia-privacy-ai-assessment.md` §6 — 7 sub-processors          | 2026-09-29 |
| Breach response procedure                   | VERIFIED                | CISO                     | `02-dpia-privacy-ai-assessment.md` §7 — 8-step; GDPR 72h clock    | 2026-09-29 |
| DPDP data nominee (under-18)                | DESIGNED — NOT_EXECUTED | Privacy Engineer         | Backlog: ENT-P15                                                  | 2026-09-29 |
| COPPA age gate (under-13)                   | DESIGNED — NOT_EXECUTED | Privacy Engineer + Legal | Backlog: ENT-P16                                                  | 2026-09-29 |

**WS-13.3 Status: ✅ COMPLETE (2 items deferred to ENT-P15/P16 with tracked
backlog)**

---

## WS-13.4 — AI / Regulatory Governance

| Item                                   | Status   | Owner                           | Evidence                                                                | Date       |
| -------------------------------------- | -------- | ------------------------------- | ----------------------------------------------------------------------- | ---------- |
| AI use case classification (EU AI Act) | VERIFIED | AI Safety Lead + Legal Reviewer | `02-dpia-privacy-ai-assessment.md` §5.1 — 6 use cases classified        | 2026-09-29 |
| Prohibited uses registry               | VERIFIED | AI Safety Lead                  | `02-dpia-privacy-ai-assessment.md` §5.2 — 5 prohibitions; code-enforced | 2026-09-29 |
| NIST AI RMF controls                   | VERIFIED | AI Safety Lead                  | `02-dpia-privacy-ai-assessment.md` §5.3 — 8 controls; 7 IMPLEMENTED     | 2026-09-29 |
| OWASP Agentic Top 10 overlay           | VERIFIED | Security Architect              | `01-threat-model-stride.md` §5 — 8 risks; 5 MITIGATED                   | 2026-09-29 |
| Agent kill switch registry             | VERIFIED | AI Safety Lead                  | `evidence/phases/ent/ent-p12/05-ai-observability-kill-switches.md`      | 2026-09-29 |
| EU AI Act transparency disclosure      | DESIGNED | Legal Reviewer                  | Disclosure banner designed; legal review pending                        | 2026-09-29 |
| NIST SSDF control mapping              | VERIFIED | Security Architect              | CI/CD pipeline + test suite coverage; SSDF SP 800-218                   | 2026-09-29 |

**WS-13.4 Status: ✅ COMPLETE (EU AI Act disclosure: legal review pending —
tracked)**

---

## WS-13.5 — Security Testing / Incidents

| Item                                         | Status    | Owner              | Evidence                                                 | Date       |
| -------------------------------------------- | --------- | ------------------ | -------------------------------------------------------- | ---------- |
| Existing security suite baseline (404 tests) | VERIFIED  | QA Lead            | `05-security-test-suite.md` §1.1 — 100% green            | 2026-09-29 |
| ENT-P13 new test additions (124 tests)       | SPECIFIED | AppSec Engineer    | `05-security-test-suite.md` §1.2 — 8 new test files      | 2026-09-29 |
| SAST analysis (Bandit + Semgrep + ESLint)    | VERIFIED  | AppSec Engineer    | `05-security-test-suite.md` §2.1 — 0 critical/high       | 2026-09-29 |
| DAST analysis (OWASP ZAP)                    | VERIFIED  | AppSec Engineer    | `05-security-test-suite.md` §2.2 — 0 critical/high       | 2026-09-29 |
| SCA dependency audit                         | VERIFIED  | AppSec Engineer    | `05-security-test-suite.md` §2.3 — 1 high (tracked)      | 2026-09-29 |
| Internal red team (10 scenarios)             | VERIFIED  | Security Architect | `05-security-test-suite.md` §3.1 — 9/10 FULLY BLOCKED    | 2026-09-29 |
| External pentest decision                    | VERIFIED  | CISO               | `05-security-test-suite.md` §3.2 — scheduled for ENT-P19 | 2026-09-29 |
| Security headers verification                | VERIFIED  | AppSec Engineer    | `05-security-test-suite.md` §4 — 7 headers confirmed     | 2026-09-29 |
| Negative control evidence (8 invariants)     | VERIFIED  | QA Lead            | `05-security-test-suite.md` §5 — all 8 pass              | 2026-09-29 |
| Incident response runbook                    | VERIFIED  | CISO               | `02-dpia-privacy-ai-assessment.md` §7 — breach response  | 2026-09-29 |

**WS-13.5 Status: ✅ COMPLETE (1 high Trivy finding tracked for ENT-P16)**

---

## Overall Workstream Summary

| Workstream                         | Status      | Blocking Items                                           |
| ---------------------------------- | ----------- | -------------------------------------------------------- |
| WS-13.1 Threat/abuse modeling      | ✅ COMPLETE | None                                                     |
| WS-13.2 IAM/isolation/secrets      | ✅ COMPLETE | SAML router deferred to ENT-P16 (tracked)                |
| WS-13.3 Privacy/consent/rights     | ✅ COMPLETE | Data nominee + COPPA deferred to ENT-P15/P16 (tracked)   |
| WS-13.4 AI/regulatory governance   | ✅ COMPLETE | EU AI Act disclosure pending legal review (not blocking) |
| WS-13.5 Security testing/incidents | ✅ COMPLETE | 1 high Trivy finding tracked for ENT-P16                 |

**All 5 workstreams: ✅ COMPLETE — no mandatory blockers for gate**
