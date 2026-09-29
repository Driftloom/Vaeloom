# ENT-P13 Evidence Bundle

**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Date:** 2026-09-29  
**Total evidence items:** 20

---

| EVD-ID          | Claim                                                                       | Requirement | Type                   | Location                                   | Result   | Date       | Verified by            |
| --------------- | --------------------------------------------------------------------------- | ----------- | ---------------------- | ------------------------------------------ | -------- | ---------- | ---------------------- |
| EVD-ENT-P13-001 | System context + 10 trust boundaries mapped                                 | ENT-P13-R03 | Architectural document | `01-threat-model-stride.md` §1             | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-002 | 12 assets classified (SOVEREIGN/CONFIDENTIAL/AUTH/etc.)                     | ENT-P13-R03 | Asset inventory        | `01-threat-model-stride.md` §2             | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-003 | 8 attacker profiles defined                                                 | ENT-P13-R03 | Threat model           | `01-threat-model-stride.md` §3             | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-004 | STRIDE matrix: 29 threats; 25 MITIGATED; 4 PARTIAL                          | ENT-P13-R03 | Threat model           | `01-threat-model-stride.md` §4             | VERIFIED | 2026-09-29 | AppSec Engineer        |
| EVD-ENT-P13-005 | OWASP Agentic Top 10: 8 risks; 5 MITIGATED; 3 PARTIAL                       | ENT-P13-R03 | AI threat model        | `01-threat-model-stride.md` §5             | VERIFIED | 2026-09-29 | AI Safety Lead         |
| EVD-ENT-P13-006 | Processing activity register: 12 activities; lawful basis documented        | ENT-P13-R06 | DPIA                   | `02-dpia-privacy-ai-assessment.md` §1      | VERIFIED | 2026-09-29 | Privacy Engineer       |
| EVD-ENT-P13-007 | 8 individual rights mapped; 6 IMPLEMENTED; 2 designed-not-executed          | ENT-P13-R03 | Privacy rights         | `02-dpia-privacy-ai-assessment.md` §2      | VERIFIED | 2026-09-29 | Privacy Engineer       |
| EVD-ENT-P13-008 | ConsentGrant model: enforcement chain; grantor/grantee/purpose/scope/TTL    | ENT-P13-R03 | Consent architecture   | `02-dpia-privacy-ai-assessment.md` §3      | VERIFIED | 2026-09-29 | Privacy Engineer       |
| EVD-ENT-P13-009 | 3 region cells + control plane residency map                                | ENT-P13-R06 | Data residency         | `02-dpia-privacy-ai-assessment.md` §4      | VERIFIED | 2026-09-29 | Privacy Engineer       |
| EVD-ENT-P13-010 | AI use case classification: 6 cases; EU AI Act applicability                | ENT-P13-R06 | AI impact assessment   | `02-dpia-privacy-ai-assessment.md` §5      | VERIFIED | 2026-09-29 | AI Safety Lead + Legal |
| EVD-ENT-P13-011 | SSO OIDC (Google + Microsoft): 7 controls; all IMPLEMENTED                  | ENT-P13-R03 | IAM                    | `03-iam-rbac-hardening.md` §2              | VERIFIED | 2026-09-29 | IAM Engineer           |
| EVD-ENT-P13-012 | SCIM 2.0: 7 ops implemented; JIT provisioning + deprovisioning              | ENT-P13-R03 | Provisioning           | `03-iam-rbac-hardening.md` §3              | VERIFIED | 2026-09-29 | IAM Engineer           |
| EVD-ENT-P13-013 | RBAC: 5-role hierarchy; permission matrix; ABAC extensions                  | ENT-P13-R03 | Authorization          | `03-iam-rbac-hardening.md` §4              | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-014 | Break-glass: 6-step; dual-approval; 4h TTL; immutable audit                 | ENT-P13-R03 | PAM                    | `03-iam-rbac-hardening.md` §5              | VERIFIED | 2026-09-29 | CISO                   |
| EVD-ENT-P13-015 | KMS two-tier key hierarchy: MK + Workspace DEK; AES-256-GCM                 | ENT-P13-R03 | Encryption             | `04-crypto-erasure-kms.md` §2              | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-016 | DEK lifecycle state machine: GENERATE→ACTIVE→DEACTIVATED→DESTROYED          | ENT-P13-R03 | Key lifecycle          | `04-crypto-erasure-kms.md` §3              | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-017 | Cryptographic erasure: DEK rotation within 30 days; GDPR Art.17 compliant   | ENT-P13-R03 | Erasure                | `04-crypto-erasure-kms.md` §4 + EVD-KMS-03 | VERIFIED | 2026-09-29 | Privacy Engineer       |
| EVD-ENT-P13-018 | Security test baseline: 731/731 passing; 0 critical/high SAST/DAST findings | ENT-P13-R04 | Test evidence          | `05-test-results.md` §2-4                  | VERIFIED | 2026-09-29 | QA Lead                |
| EVD-ENT-P13-019 | Red team: 9/10 scenarios FULLY BLOCKED; 1 partial (tracked)                 | ENT-P13-R04 | Penetration test       | `05-security-test-suite.md` §3.1           | VERIFIED | 2026-09-29 | Security Architect     |
| EVD-ENT-P13-020 | Live PostgreSQL RLS: 5/5 isolation tests pass on real Supabase DB           | ENT-P13-R04 | Live test              | `05-test-results.md` §2.2                  | VERIFIED | 2026-09-29 | QA Lead                |

---

_Evidence bundle v1.0.0 — Security Architect — 2026-09-29_
