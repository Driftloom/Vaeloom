# India Digital Personal Data Protection Act 2023 — Vaeloom Compliance Mapping

| Metadata          | Value                                           |
| ----------------- | ----------------------------------------------- |
| **Status**        | Accepted                                        |
| **Date**          | 2026-08-16                                      |
| **Owner**         | Legal/Compliance Team                           |
| **Framework**     | India DPDP Act 2023 + DPDP Rules 2025           |
| **Applicability** | All data processing involving Indian users      |
| **Note**          | Staged commencement; verify provisions in force |

## Overview

The Digital Personal Data Protection Act 2023 (DPDP Act) establishes
requirements for processing personal data in India. The DPDP Rules 2025 provide
implementation details. This document maps Vaeloom's compliance posture.

## Applicability Assessment

### Does Vaeloom Process Indian Personal Data?

**Potentially yes**, if:

1. Indian users sign up for the platform
2. Indian users connect Gmail/Google accounts with Indian email addresses
3. Indian users store resume data with Indian addresses/phone numbers

### Data Fiduciary Classification

Under the DPDP Act, Vaeloom is a **Data Fiduciary** (determines purpose and
means of processing).

| Vaeloom Role   | DPDP Definition                                                               | Implications                                            |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Data Fiduciary | Person who alone or in combination determines purpose and means of processing | Must comply with all fiduciary obligations              |
| Data Processor | Not Applicable                                                                | Vaeloom processes its own data, not on behalf of others |

## Compliance Requirements

### Notice and Consent (Section 4)

| Requirement                                                           | Vaeloom Implementation                | Status                         |
| --------------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| **Notice**: Must inform data principal of purpose, processing, rights | Privacy policy, onboarding consent    | ✅ Implemented                 |
| **Consent**: Must be free, specific, informed, unconditional          | Consent form at signup (consent.py)   | ✅ Implemented                 |
| **Consent Record**: Must maintain verifiable consent records          | Consent table in database             | ✅ Implemented                 |
| **Withdrawal**: Data principal can withdraw consent                   | Account deletion (GDPR export/delete) | ⚠️ Partial (not DPDP-specific) |

### Purpose Limitation (Section 5)

| Requirement                     | Vaeloom Implementation                     | Status         |
| ------------------------------- | ------------------------------------------ | -------------- |
| Process only for stated purpose | Agent scope definitions, permission engine | ✅ Implemented |
| No incompatible processing      | Permission Engine checks every action      | ✅ Implemented |
| Notify if purpose changes       | Privacy policy update notification         | ⚠️ Partial     |

### Data Minimization (Section 6)

| Requirement                 | Vaeloom Implementation                      | Status                    |
| --------------------------- | ------------------------------------------- | ------------------------- |
| Collect only necessary data | Workspace-scoped data, per-agent tool scope | ✅ Implemented            |
| No excessive collection     | Data classification in P05                  | ✅ Implemented            |
| Retention limits            | Data retention policy (documented)          | ⚠️ Partial (not enforced) |

### Data Principal Rights (Section 7)

| Right                            | Vaeloom Implementation     | Status             |
| -------------------------------- | -------------------------- | ------------------ |
| **Right to Access**              | Account data export (GDPR) | ✅ Implemented     |
| **Right to Correction**          | Profile editing            | ✅ Implemented     |
| **Right to Erasure**             | Account deletion (GDPR)    | ✅ Implemented     |
| **Right to Grievance Redressal** | Support contact            | ⚠️ Partial         |
| **Right to Nominate**            | Not implemented            | ❌ Not Implemented |

### Security Safeguards (Section 8)

| Requirement                             | Vaeloom Implementation                  | Status             |
| --------------------------------------- | --------------------------------------- | ------------------ |
| Implement reasonable security practices | AES-256 encryption, RBAC, audit logging | ✅ Implemented     |
| Protect against data breaches           | Security headers, rate limiting, CSRF   | ✅ Implemented     |
| Notify in case of breach                | Not implemented                         | ❌ Not Implemented |

### Children's Data (Section 9)

| Requirement                                   | Vaeloom Implementation               | Status            |
| --------------------------------------------- | ------------------------------------ | ----------------- |
| Verifiable parental consent for children      | Under-13 excluded by design          | ✅ Implemented    |
| No tracking/behavioral monitoring of children | No age verification beyond exclusion | ⚠️ Partial        |
| No targeted advertising to children           | No advertising                       | ✅ Not Applicable |

### Cross-Border Transfer (Section 16)

| Requirement                             | Vaeloom Implementation               | Status                    |
| --------------------------------------- | ------------------------------------ | ------------------------- |
| Transfer only to approved jurisdictions | PaaS-first, nearest region (ADR-026) | ⚠️ Partial (not enforced) |
| Government notification of transfers    | Not implemented                      | ❌ Not Implemented        |

## Gap Summary

| Category           | Implemented | Partial | Not Implemented | Not Applicable |
| ------------------ | ----------- | ------- | --------------- | -------------- |
| Notice/Consent     | 3           | 1       | 0               | 0              |
| Purpose Limitation | 2           | 1       | 0               | 0              |
| Data Minimization  | 2           | 1       | 0               | 0              |
| Principal Rights   | 3           | 1       | 1               | 0              |
| Security           | 2           | 0       | 1               | 0              |
| Children's Data    | 1           | 1       | 0               | 1              |
| Cross-Border       | 0           | 1       | 1               | 0              |
| **Total**          | **13**      | **6**   | **3**           | **1**          |

## Remediation Priority

1. **Right to Nominate**: Implement nominee designation feature
2. **Breach Notification**: Implement breach detection and notification process
3. **Cross-Border Transfer**: Document data residency requirements
4. **Grievance Redressal**: Implement formal complaint mechanism

## Related Documents

- `docs/security/GDPR-Compliance.md` — GDPR compliance (overlapping
  requirements)
- `docs/adr/ADR-013-multi-tenancy.md` — Data isolation
- `docs/adr/ADR-026-paas-first-mvp.md` — Deployment strategy
