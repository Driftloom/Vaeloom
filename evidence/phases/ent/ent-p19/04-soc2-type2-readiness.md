# DEL-ENT-P19-04 — SOC 2 Type II Audit Readiness & Trust Services Criteria Mapping

**Deliverable ID:** DEL-ENT-P19-04  
**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0.0  
**Owner:** Compliance Lead + CISO  
**Reviewer:** CTO + External Auditor  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p19/04-soc2-type2-readiness.md`

---

## 1. AICPA Trust Services Criteria (TSC) Control Mapping

Vaeloom establishes compliance across the Common Criteria (Security),
Availability, and Confidentiality categories:

| TSC Ref   | Trust Services Criteria                  | Vaeloom Technical Implementation                                                            | Verification Evidence |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| **CC6.1** | Logical Access Security & AuthN          | Okta/Azure SSO via OIDC, SAML 2.0 with XML signing, SCIM 2.0 provisioning.                  | `DEL-ENT-P13-03`      |
| **CC6.2** | User Registration & Deprovisioning       | Automated SCIM JIT provisioning and immediate token revocation on offboarding.              | `DEL-ENT-P13-03`      |
| **CC6.3** | Role-Based Access Control (RBAC)         | Strict 5-role hierarchy (Platform Admin, Org Admin, Workspace Admin, Candidate, Recruiter). | `DEL-ENT-P13-03`      |
| **CC6.6** | Multi-Tenant Data Isolation              | PostgreSQL 16.4 `FORCE ROW LEVEL SECURITY` on all 42 tables + GUC session scoping.          | `DEL-ENT-P07-01`      |
| **CC6.7** | Data Transmission Encryption             | TLS 1.3 enforced on all external endpoints; HSTS max-age=31536000.                          | `DEL-ENT-P16-01`      |
| **CC6.8** | Data at Rest Encryption                  | AES-256-GCM envelope encryption (Two-tier KMS with Workspace DEK).                          | `DEL-ENT-P13-04`      |
| **A1.2**  | Environmental & Operational Availability | Multi-AZ EKS cluster, Istio blue-green deployments, 99.95% availability SLO.                | `DEL-ENT-P15-03`      |
| **A1.3**  | Disaster Recovery & Backup Integrity     | Continuous WAL archiving to S3; demonstrated RPO 14.8s, RTO 8m 42s.                         | `DEL-ENT-P15-03`      |
| **C1.1**  | Confidentiality & Data Sovereignty       | Candidate ConsentGrant gating required for institutional access; cryptographic erasure.     | `DEL-ENT-P13-02`      |

---

## 2. Management Assertion & Audit Window

- **Audit Period:** 6-Month Observation Window initiating upon Production Launch
  Day.
- **Auditor Engagement:** Big 4 / AICPA-accredited CPA firm under non-disclosure
  agreement.
- **Continuous Evidence Collection:** Automated compliance evidence streamed
  continuously via Infisical, GitHub Actions, AWS CloudTrail, and OTel Loki
  audit logs to a secure WORM S3 bucket.

---

_Deliverable DEL-ENT-P19-04 v1.0.0 — Compliance Lead — 2026-09-29_
