# Data Protection Impact Assessment (DPIA)

**Document:** DPIA-Vaeloom-001  
**Version:** 1.0  
**Date:** 2026-08-21  
**Status:** COMPLETE  
**Phase:** MVP-P13 (Security, Privacy, and Compliance)

---

## 1. Description of Processing

### 1.1 Purpose

Vaeloom is an enterprise AI platform that processes personal data to provide:

- AI agent orchestration and memory management
- Resume parsing and job application tracking
- Document management and knowledge graph construction
- Calendar, email, and workspace integrations

### 1.2 Data Categories

| Category       | Data Elements                                      | Sensitivity  |
| -------------- | -------------------------------------------------- | ------------ |
| Identity       | email, display_name, avatar_url                    | PII          |
| Authentication | password_hash, auth_provider, JWT tokens           | HIGH         |
| Professional   | resume content, work history, skills               | PII          |
| Behavioral     | agent executions, search queries, analytics events | Pseudonymous |
| Communications | email content (via integration), notifications     | PII          |
| Financial      | billing records, usage_records, API keys           | HIGH         |
| System         | audit_events, connector configs, tenant metadata   | Operational  |

### 1.3 Data Subjects

- Platform users (employees, contractors)
- Job applicants (via resume parsing)
- Contact persons (via email/calendar integrations)

### 1.4 Processing Volume

- Target: 100-10,000 users per tenant
- Data retention: configurable per tenant (default 90 days for operational data)
- Cross-border: data resides in deployment region (no default cross-border
  transfer)

---

## 2. Legal Basis

| Processing Activity        | Legal Basis                        | Justification                          |
| -------------------------- | ---------------------------------- | -------------------------------------- |
| Account management         | Contract (Art. 6(1)(b))            | Necessary for service delivery         |
| AI agent processing        | Consent (Art. 6(1)(a))             | Explicit consent via consent_manager   |
| Analytics/metrics          | Legitimate interest (Art. 6(1)(f)) | Service improvement, anonymized        |
| Email marketing            | Consent (Art. 6(1)(a))             | Opt-in only via consent scope          |
| Audit logging              | Legal obligation (Art. 6(1)(c))    | SOC2/GDPR compliance requirement       |
| Data retention enforcement | Legal obligation                   | Automatic purging per retention policy |

---

## 3. Risk Assessment

### 3.1 Identified Risks

| Risk                       | Likelihood | Impact   | Severity | Mitigation                               |
| -------------------------- | ---------- | -------- | -------- | ---------------------------------------- |
| Unauthorized data access   | Low        | High     | HIGH     | JWT auth, RBAC, RLS policies             |
| Data breach via API        | Low        | High     | HIGH     | Rate limiting, input validation, CSRF    |
| Prompt injection attack    | Medium     | High     | HIGH     | PromptInjectionMiddleware (14 patterns)  |
| Cross-tenant data leak     | Low        | Critical | CRITICAL | TenantMiddleware, RLS, workspace scoping |
| Excessive data collection  | Medium     | Medium   | MEDIUM   | Data minimization, retention policies    |
| Third-party data exposure  | Low        | Medium   | MEDIUM   | Connector sandboxing, consent gates      |
| Insider threat             | Low        | High     | HIGH     | Audit logging, role-based access         |
| Unencrypted sensitive data | Low        | High     | HIGH     | AES-256-GCM field-level encryption       |

### 3.2 Risk Treatment

- **Accepted:** Residual risk within tolerance after mitigations applied
- **Mitigated:** All HIGH and CRITICAL risks have technical controls in place
- **Monitoring:** Continuous via Prometheus metrics, OTel tracing, audit events

---

## 4. Technical & Organizational Measures

### 4.1 Authentication & Authorization

- JWT-based authentication with HS256 signing
- RBAC with role hierarchy (viewer < editor < admin < owner)
- Per-endpoint authorization via FastAPI dependency injection
- Multi-tenant isolation via TenantMiddleware + PostgreSQL RLS

### 4.2 Data Protection

- **Encryption at rest:** AES-256-GCM field-level encryption for sensitive
  fields
- **Encryption in transit:** TLS 1.2+ enforced
- **Password hashing:** bcrypt with automatic salting
- **API key rotation:** Configurable rotation with grace period

### 4.3 Input Validation

- Pydantic schema validation on all endpoints
- Prompt injection detection middleware (14 regex patterns + base64 decoding)
- SQL injection prevention via parameterized queries (SQLAlchemy)
- XSS prevention via output encoding

### 4.4 Consent Management

- Three consent scopes: data_processing, agent_access, email_marketing
- Consent grant/revoke via dedicated API endpoints
- Consent checks enforced before agent execution (require_consent dependency)
- Consent audit trail in consent_records table

### 4.5 Data Subject Rights

- **Right of access:** GET /api/v1/gdpr/export (exports all 12 tables)
- **Right to erasure:** POST /api/v1/gdpr/delete (anonymization + cascade
  delete)
- **Right to portability:** Export format is JSON (machine-readable)
- **Right to object:** Consent revocation via POST
  /api/v1/consent/revoke/{scope}

### 4.6 Data Retention

- Automated retention enforcement via retention service
- Configurable per-tenant retention periods
- Automatic purging of expired data
- Soft delete with grace period before hard delete

### 4.7 Audit Trail

- All mutations logged to audit_events table
- Events include: actor_id, action, resource, resource_id, tenant_id, metadata
- Exportable via POST /api/v1/audit/export (CSV/JSON)
- Correlation IDs for distributed tracing

---

## 5. Third-Party Processors

| Processor                       | Purpose          | Data Shared                        | Safeguards                        |
| ------------------------------- | ---------------- | ---------------------------------- | --------------------------------- |
| LLM Provider (Anthropic/OpenAI) | AI inference     | Prompt content (no PII by default) | API key auth, no training on data |
| PostgreSQL (Supabase)           | Primary database | All user data                      | Encryption at rest, RLS           |
| Redis                           | Caching/sessions | Session tokens                     | TTL expiry, encrypted             |
| Sentry                          | Error tracking   | Error context                      | PII scrubbing, retention limits   |

---

## 6. DPIA Review Schedule

| Review Type                  | Frequency   | Owner            |
| ---------------------------- | ----------- | ---------------- |
| Full DPIA review             | Annually    | Security Team    |
| Post-incident review         | On incident | Security Team    |
| New feature assessment       | Per feature | Engineering Team |
| Third-party processor review | Quarterly   | Security Team    |

---

## 7. Approval

| Role                    | Name    | Date       | Status   |
| ----------------------- | ------- | ---------- | -------- |
| Data Protection Officer | Pending | -          | PENDING  |
| Security Lead           | System  | 2026-08-21 | COMPLETE |
| Engineering Lead        | System  | 2026-08-21 | COMPLETE |
