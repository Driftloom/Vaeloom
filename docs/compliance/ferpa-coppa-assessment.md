# FERPA and COPPA — Vaeloom Applicability Assessment

| Metadata | Value |
| ----------------- | ------------------------------------------------------- |
| **Status** | Accepted |
| **Date** | 2026-08-16 |
| **Owner** | Legal/Compliance Team |
| **Frameworks** | FERPA (20 U.S.C. §1232g), COPPA (15 U.S.C. §§6501–6506) |
| **Applicability** | US education records and under-13 users |

## FERPA Assessment

### What is FERPA?

The Family Educational Rights and Privacy Act (FERPA) protects the privacy of
student education records. It applies to:

- Educational agencies/institutions receiving federal funding
- Third parties accessing education records on behalf of institutions

### Does FERPA Apply to Vaeloom?

**Potentially, if Vaeloom:**

1. Partners with US educational institutions (universities, schools)
2. Processes education records on behalf of institutions
3. Is used by institutions as an official education record system

### Current Vaeloom Scope

Vaeloom is a **personal productivity tool for individual students and
professionals**. It is:

- ❌ NOT an educational institution
- ❌ NOT receiving federal funding
- ❌ NOT processing education records on behalf of institutions
- ✅ A personal tool used by individuals who happen to be students

### FERPA Compliance Assessment

| FERPA Requirement | Applicability | Vaeloom Status |
| ---------------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| **Institutional control of education records** | Not Applicable — Vaeloom doesn't process institutional records | 🚫 Not Applicable |
| **Directory information rules** | Not Applicable — Vaeloom doesn't publish student info | 🚫 Not Applicable |
| **Student access rights** | Not Applicable — Vaeloom provides user data export (GDPR) | 🚫 Not Applicable |
| **Record disclosure restrictions** | Not Applicable — Vaeloom doesn't share records with institutions | 🚫 Not Applicable |
| **Re-disclosure prohibition** | Not Applicable — Vaeloom doesn't re-disclose records | 🚫 Not Applicable |

### FERPA Implications for Enterprise Expansion

If Vaeloom expands to institutional sales:

| Scenario | FERPA Requirement | Compliance Need |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------ |
| University licenses Vaeloom for students | "School official" designation required | Data Processing Agreement (DPA) |
| Vaeloom integrates with LMS (Canvas, Blackboard) | Education record access requires consent | FERPA-compliant data handling |
| Vaeloom provides institutional analytics | De-identification required | Aggregate data only, no individual records |

### FERPA Compliance Checklist (If Applicable)

| Requirement | Status | Notes |
| ------------------------------------------- | ------------------ | ----------------------- |
| Data Processing Agreement with institutions | Not Required (MVP) | Required for enterprise |
| Education record de-identification | Not Required (MVP) | Required for analytics |
| Access controls per institution | Not Required (MVP) | Required for enterprise |
| Audit trail for record access | Not Required (MVP) | Required for enterprise |

## COPPA Assessment

### What is COPPA?

The Children's Online Privacy Protection Act (COPPA) applies to:

- Commercial websites/online services directed at children under 13
- General audience services with actual knowledge of under-13 users

### Does COPPA Apply to Vaeloom?

**Current answer: No, because Vaeloom excludes under-13 users by design.**

Vaeloom's target audience is:

- Students (typically 16+)
- Early-career professionals (typically 20+)
- The platform is NOT directed at children under 13

### COPPA Compliance Assessment

| COPPA Requirement | Applicability | Vaeloom Status |
| -------------------------------------------- | ----------------------------------- | -------------------------- |
| **Parental consent for under-13 collection** | Not Applicable — under-13 excluded | ✅ Implemented (exclusion) |
| **Privacy policy for children's data** | Not Applicable — no children's data | ✅ Not Applicable |
| **Data minimization for children** | Not Applicable — no children's data | ✅ Not Applicable |
| **Parental access/deletion rights** | Not Applicable — no children's data | ✅ Not Applicable |
| **Data retention limits for children** | Not Applicable — no children's data | ✅ Not Applicable |

### COPPA Compliance Controls

| Control | Implementation | Status |
| -------------------------------------- | ------------------------ | ----------------- |
| Age gate at signup | Not implemented (MVP) | ⚠️ Partial |
| Terms of Service exclusion | ToS states "must be 13+" | ✅ Implemented |
| No knowing collection of under-13 data | No age verification | ⚠️ Partial |
| No targeted advertising to children | No advertising | ✅ Not Applicable |

### COPPA Remediation Priority

1. **Age Verification**: Implement age gate at signup (collect birth date or age
 confirmation)
2. **Parental Controls**: If under-13 users are ever allowed, implement parental
 consent flow
3. **Child-Directed Mode**: If Vaeloom ever targets K-12, implement
 COPPA-compliant mode

## Combined FERPA/COPPA Assessment

| Framework | Applicability | Risk Level | Action Required |
| --------- | -------------------------- | ---------- | ----------------------------------------- |
| FERPA | Not Applicable (MVP) | Low | None for MVP; DPA template for enterprise |
| COPPA | Not Applicable (exclusion) | Low | Age gate at signup (recommended) |

## Recommendations

1. **MVP (Current)**: No action required. Under-13 excluded by design; not an
 educational institution.

2. **Enterprise Expansion**:
 - Create FERPA-compliant DPA template for institutional partnerships
 - Implement education record de-identification for analytics
 - Add FERPA-specific access controls per institution

3. **General Audience**:
 - Add age gate at signup (recommended for COPPA defensibility)
 - Document actual knowledge of user age (if any under-13 users detected,
 implement parental consent)

## Related Documents

- `docs/security/GDPR-Compliance.md` — GDPR compliance (overlapping
 requirements)
- `docs/01-vaeloom-mvp-spec.md` — Product scope (under-13 exclusion)
- `docs/adr/ADR-026-paas-first-mvp.md` — Deployment strategy
