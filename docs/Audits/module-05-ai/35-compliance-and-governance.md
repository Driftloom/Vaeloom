# Module 05: Compliance, Governance & Audit Logging
**Audit Identifier**: `AUD-M05-AI-35`
**Scope**: SOC2, HIPAA, GDPR compliance mappings, audit trails, and data retention rules.

---

## 1. Compliance Control Mapping

| Standard / Framework | Requirement | Vaeloom Module 05 Implementation |
|---|---|---|
| **SOC 2 Type II (CC6.1)** | Logical access controls & tenant isolation | PostgreSQL RLS + `TenantMiddleware` + zero-trust vector filters |
| **SOC 2 Type II (CC6.6)** | Protection against malicious software | `FileSecurityService` magic bytes + MIME + EICAR signature scanner |
| **SOC 2 Type II (CC6.8)** | Unauthorized disclosure prevention | Strict S3 key isolation + non-exportable credential encryption |
| **GDPR (Article 17)** | Right to Erasure ("Right to be Forgotten") | `ErasureService.execute_erasure()` with multi-store cascade & receipt |
| **HIPAA Security Rule** | Transmission security & data encryption | TLS 1.3 in transit + AES-256 at rest across PostgreSQL & S3 |

---

## 2. Audit Event Retention

Every workspace modification, document upload, rename, archive, restore, and share grant logs an immutable record to the `audit_events` and `document_actions` tables.
