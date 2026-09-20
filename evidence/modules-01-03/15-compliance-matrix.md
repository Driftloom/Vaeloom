# Modules 01–03 Compliance & Regulatory Matrix

**Audit Date:** 2026-09-20  
**Frameworks:** SOC 2 Type II, GDPR, ISO 27001, HIPAA Security Rule

---

## 1. Compliance Controls Mapping

| Control Framework | Control Identifier | Requirement                         | Implementation Status | Evidence / Verification                                                                |
| :---------------- | :----------------- | :---------------------------------- | :-------------------- | :------------------------------------------------------------------------------------- |
| **SOC 2 Type II** | CC6.1              | Logical access controls             | **COMPLIANT**         | Role-based access control (RBAC), tenant-scoped RLS policies, MFA/TOTP support.        |
| **SOC 2 Type II** | CC6.2              | User registration & de-provisioning | **COMPLIANT**         | Explicit onboarding lifecycle, cascade deletion of user resources, session revocation. |
| **SOC 2 Type II** | CC6.6              | Protection against malicious code   | **COMPLIANT**         | Resume file upload magic byte validation rejecting executables (`MZ`, `ELF`).          |
| **GDPR**          | Article 6          | Lawfulness of processing & Consent  | **COMPLIANT**         | Affirmative consent record stored at signup with IP address and timestamp.             |
| **GDPR**          | Article 17         | Right to erasure ("forgotten")      | **COMPLIANT**         | `DELETE /api/v1/gdpr/erasure` completely purges all user data across all tables.       |
| **ISO 27001**     | A.9.4.2            | Secure log-on procedures            | **COMPLIANT**         | Account lockout after repeated failures, rate limiting, MFA challenge flow.            |
| **ISO 27001**     | A.9.4.3            | Password management system          | **COMPLIANT**         | Password complexity validation (8-128 chars, uppercase, lowercase, numbers, symbols).  |
