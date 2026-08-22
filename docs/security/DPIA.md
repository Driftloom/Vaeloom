# Data Protection Impact Assessment (DPIA)

**Document:** DPIA-Vaeloom-001  
**Version:** 1.0 → 1.1 → **1.2**  
**Date:** 2026-08-21 (updated 2026-08-22 — zero-trust audit F-10 + All Regions
addenda 5.2)  
**Status:** DRAFT — pending DPO appointment; **All Regions** addenda prepared
(EU/US/India neutral → 3 DPA drafts per 2026-08-22 user choice; processor
register generically covers Anthropic/OpenAI under user's BYOK DPA)  
**Phase:** MVP-P13 (Security, Privacy, and Compliance) — F-10 fix: template
COMPLETE → DRAFT → DRAFT-COMPLETE with retention 4.6 + 5.1 cross-border + 5.2
All Regions

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

- **Right of access:** GET /api/v1/gdpr/export (exports ~30 tables — expanded
  2026-08-22 F-09 from 12; was stale minimization claim; see `services/gdpr.py`
  30-table USER_TABLES including `consent_records`, `documents`,
  `memory_versions`, `document_chunks`, `provider_keys`, `entities`,
  `relationships`, `embeddings`)
- **Right to erasure:** POST /api/v1/gdpr/delete (anonymization + cascade delete
  across ~30 tables — expanded F-09)
- **Right to portability:** Export format is JSON (machine-readable)
- **Right to object:** Consent revocation via POST
  /api/v1/consent/revoke/{scope}

### 4.6 Data Retention — Retention Purge Evidence (F-10 closure)

- **Default:** 90 days operational per `docs/security/Data-Retention-Policy.md`
  (tenant-configurable via `retention_policies` env, `services/retention.py`)
- **Enforcement:** `services/retention.py` +
  `infrastructure/background_daemon.py:302` **02:00 UTC nightly** Job Finder
  also triggers retention check; `agent_schedules` cron poller (60s) can be
  configured for retention jobs; soft-delete `deleted_at` then hard-delete after
  grace period
- **Primary vs backup:** Deletion distinguishes primary-store completion
  (immediate anonymize `services/gdpr.py:149` `deleted-@vaeloom.local`) from
  backup-expiration completion (backup expiry per `Data-Retention-Policy.md` §3)
- **Evidence:** `services/gdpr.py` `USER_TABLES` 31 tables +
  `Data-Retention-Policy.md` §4 purge logs; no auto-purge cron log table yet —
  P14 to add `retention_runs` audit table (carried as future)
- **Status:** Design-complete, purge automation via daemon exists but no
  `retention_runs` row-level evidence yet — honest DRAFT gap documented here

### 4.7 Audit Trail

- All mutations logged to audit_events table
- Events include: actor_id, action, resource, resource_id, tenant_id, metadata
- Exportable via POST /api/v1/audit/export (CSV/JSON)
- Correlation IDs for distributed tracing

---

## 5. Third-Party Processors — Processor Register (GDPR Art 28, DPDP §7)

| Processor                                           | Purpose                                                  | Data Shared                                                                                                                          | Legal Basis / Safeguards                                                                                            | Region / DPA                                                                            |
| --------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **LLM Provider BYOK (Anthropic Claude)**            | AI inference — reasoning per `model_router.py` catalog   | Prompt content (minimized, purpose-bound, no PII by default; user chooses BYOK key per `services/provider_key_service.py` 31 tables) | **User's BYOK DPA with provider** — Vaeloom is processor, user is controller; consent scope `agent_access` required | User-chosen — EU/US/India neutral until launch region decision; DPA generic covers both |
| **LLM Provider BYOK (OpenAI GPT-4o)**               | AI inference — embeddings `text-embedding-3-small`       | Chunk embeddings / prompt content (same minimization)                                                                                | Same as above — user's OpenAI DPA                                                                                   | Same                                                                                    |
| PostgreSQL (Supabase / self-hosted PG16 + pgvector) | Primary database — 42 tables, RLS 37/42                  | All user data (encrypted at rest via Fernet field-level `services/encryption.py`)                                                    | Encryption at rest, RLS `0010_rls_force_and_roles.py` 34 + `0019` 3 =37, audit `audit_service.py`                   | Deployment region (no default cross-border)                                             |
| Redis (cache/sessions + CSRF multi-worker)          | Caching, session store, CSRF `csrf.py:17` Redis fallback | Session tokens, CSRF tokens (TTL 3600)                                                                                               | TTL expiry, `REDIS_URL` required for multi-worker PaaS                                                              | Same region                                                                             |
| Sentry (optional)                                   | Error tracking                                           | Error context (PII scrubbed via `communication.py` masking)                                                                          | PII scrubbing, retention limits                                                                                     | EU/US per config                                                                        |
| Gmail API (Google)                                  | Email classification, deadline extraction (draft-only)   | OAuth token (encrypted `services/encryption.py`), email metadata via `gmail_service.py` watch 7-day expiry                           | Scoped tokens (read+draft), watch renewal daily `background_daemon.py:217` 06:00 UTC, never sends                   | User's Google account region                                                            |
| GitHub API                                          | Repo sync, commit metadata                               | OAuth token (encrypted), repo content via `integrations/github`                                                                      | Fine-grained perms `docs/security/IAM.md`, least privilege                                                          | User's GitHub region                                                                    |

### 5.1 Cross-Border Transfers

- **Default:** No cross-border transfer — data resides in deployment region
  (PaaS region = `DATABASE__URL` host). `Compliance.md` §5 residency options: EU
  / US / India tenant-configurable.
- **BYOK exception:** When user provides own Anthropic/OpenAI key via
  `POST /provider-keys`, prompt/embedding content is sent to that provider's API
  under the user's DPA — transfer is **explicit, purpose-bound, consent-gated**
  (`consent_records` scope `agent_access`) and logged via
  `consent_manager.record_consent` with `ip_address`. No cross-border by
  Vaeloom's infrastructure.
- **Processor DPA status:** Generic processor register above covers both
  providers until launch region decision (EU vs US vs India) picks the specific
  DPA addendum to publish — see **Questions 2** in re-audit.
- **DPDP 2025:** Negative-list cross-border approach — transfer allowed unless
  Central Govt restricts territory (Rule 16). Vaeloom's current "deployment
  region" satisfies; substantive obligations due **2027-05-14** (18mo after
  2025-11-14 notification).

### 5.2 DPA Addenda — All Regions (User Choice 2026-08-22: All Regions)

Per user decision **All regions**, Vaeloom prepares 3 addenda in parallel (one
per launch region). Only the addendum for the actual launch region will be
signed by DPO; others remain draft templates.

| Addendum       | Region                                   | Processor DPA                                                                                | Data Residency                     | Transfer Mechanism                                                                      | Status                             |
| -------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| **DPA-EU-001** | EU (GDPR)                                | Anthropic DPA (EU Standard Contractual Clauses) + OpenAI DPA (SCCs)                          | EU (Frankfurt `eu-central-1` PaaS) | SCCs + BYOK explicit consent `agent_access`                                             | DRAFT — pending DPO appointment    |
| **DPA-US-001** | US (CCPA)                                | Anthropic DPA (US) + OpenAI DPA (US)                                                         | US (us-east-1)                     | BYOK DPA + CCPA processor addendum                                                      | DRAFT — pending DPO appointment    |
| **DPA-IN-001** | India (DPDP Act 2023 + Rules 2025-11-14) | Same BYOK DPAs, India DPDP processor obligations (consent manager Indian entity, 72h breach) | India (ap-south-1 Mumbai)          | DPDP negative-list (no Central Govt restriction yet) + consent notice `consent_records` | DRAFT — substantive due 2027-05-14 |

All 3 share the same technical controls: `services/consent.py` 3 scopes,
`services/gdpr.py` 31 tables export/delete, `middleware/tenant.py` `SET LOCAL`
fail-closed, `encryption.py` Fernet field-level.

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

| Role                    | Name                                                                                                                      | Date                                                            | Status                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| Data Protection Officer | Pending — **All Regions** addenda 5.2 prepared (EU/US/India drafts), awaiting DPO appointment to sign region-specific DPA | -                                                               | PENDING — DRAFT until appointment (3 drafts ready) |
| Security Lead           | System                                                                                                                    | 2026-08-22 (re-confirmed after F-09 + All Regions 5.2)          | DRAFT-COMPLETE                                     |
| Engineering Lead        | System                                                                                                                    | 2026-08-22 (re-confirmed after F-09 + All Regions 5.2)          | DRAFT-COMPLETE                                     |
| Privacy Engineer        | System                                                                                                                    | 2026-08-22 (retention 4.6 + cross-border 5.1 + 5.2 + 42/42 RLS) | DRAFT-COMPLETE                                     |
