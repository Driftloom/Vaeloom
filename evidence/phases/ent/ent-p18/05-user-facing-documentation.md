# DEL-ENT-P18-05 — User-Facing Documentation & Help Center

**Deliverable ID:** DEL-ENT-P18-05  
**Phase:** ENT-P18 — Documentation and Knowledge Transfer  
**Version:** 1.0.0  
**Owner:** Technical Writer + Product Designer  
**Reviewer:** Legal Reviewer + Product Lead  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p18/05-user-facing-documentation.md`

---

## 1. End-User Help Center Structure

The user documentation portal is structured into 4 primary self-service guides:

### 1.1 Candidate Memory Sovereignty & Consent Grants

- **What is a ConsentGrant?** Explanation of how candidates control
  institutional visibility.
- **Granting Access:** Step-by-step tutorial on issuing time-bounded,
  purpose-specific sharing permits.
- **Instant Revocation:** How revoking a grant immediately terminates university
  or recruiter access without deleting candidate records.
- **Exercising GDPR Art. 17 (Right to Erasure):** How cryptographic erasure
  destroys DEK encryption keys within 30 days.

### 1.2 AI Resume Builder & Document Tailoring

- **Using Industry Templates:** Guide to the 5 executive Jinja2 templates (Tech,
  Finance, Healthcare, Creative, Academic).
- **AI Bullet Enhancement (XYZ Formula):** How Gemma 4 reformulates achievements
  into _“Accomplished [X], as measured by [Y], by doing [Z]”_.
- **Semantic ATS Audit:** Understanding keyword gap scores, formatting analysis,
  and Playwright PDF compilations.

### 1.3 Autonomous Job Search & Applications

- **Configuring Job Search Agents:** Setting salary floors, remote preferences,
  and target companies.
- **Human-in-the-Loop Approvals:** How to review and cryptographically authorize
  Tier 4 job submissions.
- **Application Tracking:** Monitoring submission statuses and interview notes.

### 1.4 Enterprise Administrator Manual

- **SAML 2.0 & OIDC SSO Configuration:** Integrating Okta, Azure AD, and Google
  Workspace.
- **SCIM 2.0 Automated User Provisioning:** Managing cohort lifecycle, roles,
  and automated offboarding.
- **Audit Log Export:** Streaming compliance logs to institutional SIEM systems
  via S3 / HTTPS webhooks.

---

_Deliverable DEL-ENT-P18-05 v1.0.0 — Technical Writer — 2026-09-29_
