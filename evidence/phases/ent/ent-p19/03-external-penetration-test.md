# DEL-ENT-P19-03 — External Penetration Test Engagement & Scope Brief

**Deliverable ID:** DEL-ENT-P19-03  
**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0.0  
**Owner:** CISO + Lead Security Architect  
**Reviewer:** VP Engineering + External Pentest Lead  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p19/03-external-penetration-test.md`

---

## 1. CREST-Certified Vendor Selection & Scope

As registered in waiver `WAI-P14-02`, Vaeloom formalizes its external black-box
and grey-box security assessment with a CREST-certified independent penetration
testing firm.

### Test Scope Parameters:

- **API Surface:** All 241 REST endpoints across 18 routers.
- **Enterprise Controls:** SAML 2.0 AuthN, SCIM 2.0 provisioning, ConsentGrant
  evaluation, and Break-Glass PAM.
- **Multi-Tenant Boundaries:** PostgreSQL 16.4 RLS cross-tenant isolation and
  workspace tenant leakage attacks.
- **Agentic AI & LLM Attack Surface:** Prompt injection (OWASP Agentic Top 10),
  XML fencing bypasses, memory poisoning, and unauthorized tool calls.
- **Cloud Infrastructure:** AWS EKS cluster configuration, S3 bucket
  permissions, and Infisical secrets extraction.

---

## 2. Testing Methodology & Standards Alignment

The engagement follows:

1. **OWASP ASVS v4.0.3 (Level 2):** Comprehensive verification of
   authentication, access control, and cryptographic storage.
2. **OWASP Top 10 for Agentic Applications (2026):** Goal hijacking, tool
   misuse, and context poisoning.
3. **NIST SP 800-115:** Technical guide to information security testing and
   assessment.

---

## 3. Remediation Protocol & Retest SLA

- **Critical Vulnerabilities:** Immediate notification within 2 hours; hotfix
  deployment within 24 hours.
- **High Vulnerabilities:** Remediation within 72 hours; mandatory re-testing
  and formal clearance letter before SOC 2 report issuance.
- **Deliverables:** Executive Summary Report, Technical Vulnerability Catalog,
  and Formal Attestation Letter of Assessment.

---

_Deliverable DEL-ENT-P19-03 v1.0.0 — CISO — 2026-09-29_
