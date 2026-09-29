# DEL-ENT-P13-02 — Multi-Region Privacy & AI Impact Assessment (DPIA v2.0)

**Deliverable ID:** DEL-ENT-P13-02  
**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 2.0.0  
**Owner:** Privacy Engineer  
**Reviewer:** Legal Reviewer + Compliance Specialist  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:**
`evidence/phases/ent/ent-p13/02-dpia-privacy-ai-assessment.md`

> [!IMPORTANT] This DPIA is a structured risk-mapping and evidence document. It
> is NOT a self-declared certification under GDPR Article 35, India DPDP, FERPA,
> COPPA, or EU AI Act. Professional legal review is required before any
> compliance claim is made to customers or regulators.

---

## 1. Processing Activity Register

| PA-ID | Processing Activity                  | Data Types                                            | Lawful Basis                                    | Purpose                                        | Retention                                                | Region                          | Processor/Sub-processor            |
| ----- | ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| PA-01 | User memory creation and storage     | Episodic/semantic/procedural memories; PII            | Consent (explicit opt-in per memory type)       | Career intelligence; learning; personalization | Until user deletion request + KMS erasure within 30 days | User's chosen region cell       | PostgreSQL (Supabase); MinIO       |
| PA-02 | Agent retrieval — personal memory    | 22 memory types                                       | Consent + Legitimate interest (user's own data) | AI-assisted task completion                    | Session-scoped; not persisted beyond retrieval           | Region cell                     | pgvector HNSW; Ollama Cloud        |
| PA-03 | Institutional memory visibility      | User work-product memories                            | Explicit ConsentGrant + Purpose code            | Employer-authorized workspace analytics        | ConsentGrant expiry or user revocation                   | Institutional cell              | PostgreSQL RLS                     |
| PA-04 | SSO / OIDC authentication            | Email; name; IdP sub                                  | Contract + Legitimate interest (authentication) | Identity verification                          | Session + refresh token lifetime (90d)                   | Control plane                   | Google/Microsoft IdP               |
| PA-05 | SCIM user provisioning               | User roster; attributes                               | Contract (institution-Vaeloom DPA)              | Automated account lifecycle                    | Until deprovisioning event                               | Control plane                   | SCIM client (institution's IdP)    |
| PA-06 | Billing and entitlement              | Email; payment intent; subscription plan              | Contract                                        | Revenue; access control                        | 7 years (financial obligation)                           | Control plane                   | Stripe (sub-processor)             |
| PA-07 | LLM synthesis — System 2             | Workspace context excerpt (max 4,000 chars)           | Consent + Contract                              | Grounded AI response                           | Not stored by provider (API call only)                   | Model provider's infrastructure | Ollama Cloud (DPA required)        |
| PA-08 | LLM routing — System 1               | Action description (no raw memory)                    | Legitimate interest (system function)           | Sub-50ms deterministic routing                 | Not stored by provider                                   | TypeSafe AI Jev                 | TypeSafe AI (DPA required)         |
| PA-09 | Audit log streaming                  | Actor/target/action/timestamp/purpose                 | Legal obligation + Legitimate interest          | Compliance; incident response                  | 2 years WORM immutable                                   | Control plane + cell            | S3 WORM                            |
| PA-10 | Error and OTel telemetry             | Correlation IDs; trace IDs; anonymized operation data | Legitimate interest                             | Observability; performance                     | 90 days                                                  | Control plane                   | OTel collector (internal)          |
| PA-11 | Plugin/MCP execution                 | Tool inputs/outputs per declared scope                | Consent + Contract                              | Extended agent capabilities                    | Not persisted beyond plugin response                     | Plugin operator's infra         | MCP server operator (DPA required) |
| PA-12 | Resume / career document compilation | Resume content; job descriptions                      | Consent                                         | Document generation                            | Until workspace deletion                                 | Region cell                     | Playwright Chromium (local render) |

---

## 2. Individual Rights Implementation Matrix

| Right                                    | Regulation           | Implementation                                                                                          | Status                  | Owner                                 | Evidence                                       |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------- | ---------------------------------------------- |
| Access (data portability)                | GDPR Art.15/20; DPDP | `GET /workspaces/{id}/export` — returns all memories, documents, audit entries as JSON                  | IMPLEMENTED             | Privacy Engineer                      | Route verified in openapi.yaml                 |
| Rectification                            | GDPR Art.16; DPDP    | `PATCH /memories/{id}` — corrects content; `supersedes_id` immutable chain preserved                    | IMPLEMENTED             | Privacy Engineer                      | `apps/api/src/api/routes/memory.py`            |
| Erasure (right to be forgotten)          | GDPR Art.17; DPDP    | `DELETE /memories/{id}` — soft delete + KMS DEK rotation = cryptographic erasure within 30d             | IMPLEMENTED             | Privacy Engineer + Security Architect | `services/document_builder.py`; migration 0027 |
| Restriction                              | GDPR Art.18          | `POST /memories/{id}/restrict` — marks memory `status=restricted`; excluded from agent retrieval        | IMPLEMENTED             | Privacy Engineer                      | Memory schema `status` field                   |
| Object                                   | GDPR Art.21          | `POST /workspaces/{id}/opt-out` — disables AI processing for workspace; opt-out flag checked in loop.py | IMPLEMENTED             | Privacy Engineer                      | `apps/api/src/api/services/loop.py`            |
| Withdraw consent                         | GDPR Art.7(3); DPDP  | ConsentGrant revocation via `DELETE /consent-grants/{id}` — immediately blocks institutional access     | IMPLEMENTED             | Privacy Engineer                      | `apps/api/src/api/routes/consent.py`           |
| Data nominee (death of data principal)   | DPDP Rule 10         | `POST /account/nominee` — designates nominee; nominee can exercise rights on principal's death          | DESIGNED — NOT_EXECUTED | Privacy Engineer                      | Backlog: ENT-P15                               |
| Children (under 18 DPDP; under 13 COPPA) | DPDP Art.9; COPPA    | Age gate at registration; parental consent flow for under-18 India users; COPPA: under-13 excluded      | DESIGNED — NOT_EXECUTED | Privacy Engineer + Legal Reviewer     | Backlog: ENT-P16                               |

---

## 3. Consent Architecture

### 3.1 ConsentGrant Data Model

```
ConsentGrant {
  id: UUID
  grantor_user_id: UUID          -- individual user
  grantee_institution_id: UUID   -- institution or null (personal consent)
  purpose_code: str              -- CAREER_ANALYTICS | COACHING | RESEARCH | BILLING
  memory_type_scope: list[str]   -- subset of 22 MemoryTypes or ["*"]
  time_bound: datetime | null    -- null = until revoked
  created_at: datetime
  revoked_at: datetime | null
  audit_trail: list[AuditEntry]  -- append-only
}
```

### 3.2 Consent Enforcement Chain

1. User creates memory → `consent_required=true` flag evaluated per memory type
2. Institution admin requests data → `ConsentGrant` lookup → DENY if none or
   expired
3. Agent retrieves cross-user memory → `ConsentGrant` checked in retrieval
   pipeline
4. Plugin accesses workspace data → Connector scope validated + ConsentGrant for
   cross-user

### 3.3 Privacy-by-Design Principles Applied

- **Minimization:** Agent retrieval fetches only top-k relevant memories (k ≤
  20); no bulk export in pipeline
- **Purpose limitation:** `purpose_code` enforced at query time; analytics ≠
  coaching scope
- **Storage limitation:** KMS DEK rotation = cryptographic erasure without row
  deletion
- **Integrity:** `supersedes_id` chain preserves correction history; no silent
  overwrites
- **Accountability:** Every institutional access → audit log entry with
  `actor_id`, `target_id`, `purpose_code`, `timestamp`

---

## 4. Multi-Region Residency Map

| Region                | Cell         | Applicable Regulations | Data Residency Enforcement                                             | Blast Radius                    |
| --------------------- | ------------ | ---------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| EU-WEST-1 (Frankfurt) | `cell-eu-1`  | GDPR; EU AI Act        | PostgreSQL + MinIO in EU; no cross-region replication of personal data | Single AZ; cell-level isolation |
| AP-SOUTH-1 (Mumbai)   | `cell-ap-1`  | India DPDP Rules 2025  | PostgreSQL + MinIO in India; data nominee support (backlog)            | Single AZ; cell-level isolation |
| US-EAST-1 (Virginia)  | `cell-us-1`  | FERPA; COPPA; CCPA     | PostgreSQL + MinIO in US; education-record tagging for FERPA           | Single AZ; cell-level isolation |
| Global control plane  | `ctrl-plane` | All (metadata only)    | Tenant roster; billing; SSO config — no personal memory                | Multi-AZ                        |

---

## 5. AI Impact Assessment (NIST AI RMF + EU AI Act)

### 5.1 AI Use Case Classification

| System                        | Use Case                               | EU AI Act Category         | Risk Level     | Human Oversight                       |
| ----------------------------- | -------------------------------------- | -------------------------- | -------------- | ------------------------------------- |
| System 1 — TypeSafe AI Jev    | Action routing; destructive triage     | General-purpose AI (GPAI)  | LIMITED        | HITL for Tier 4 (noul)                |
| System 2 — Ollama Gemma 4 31B | Grounded document synthesis            | GPAI                       | LIMITED        | Output reviewed by user before action |
| ATS Semantic Scorer           | Resume/JD semantic scoring             | Automated decision support | LIMITED        | User can override score               |
| Resume Tailor                 | AI resume rewriting                    | GPAI                       | MINIMAL        | User accepts/rejects diff             |
| Job Match Engine              | Semantic job matching                  | Automated decision support | LIMITED        | User controls final application       |
| Agent 28-roster               | Career coaching; application; research | GPAI orchestration         | LIMITED/MEDIUM | HITL gating; kill switches            |

> [!WARNING] None of the above systems are self-declared as **high-risk** under
> EU AI Act Annex III. Professional legal review is mandatory before any
> classification claim to regulators or enterprise customers.

### 5.2 Prohibited Uses

The following uses are explicitly prohibited by platform policy and enforced by
code:

| Prohibited Use                                                          | Enforcement                                        | Location                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Inferring protected attributes (race, religion, disability) from memory | System prompt immutable prohibition; output filter | `agents/README.md`; loop.py                 |
| Cross-tenant memory access without ConsentGrant                         | RLS + ConsentGrant check                           | `routes/consent.py`; `middleware/tenant.py` |
| Autonomous consequential actions (job apply, financial) without HITL    | `approval_gated_tools()`                           | `services/loop.py`                          |
| Training on user data without explicit consent                          | No training pipeline; API-only calls               | Architecture invariant                      |
| Fabricating citation sources (hallucination)                            | Provenance citations required in S2 output         | `llm_service.py`                            |

### 5.3 NIST AI RMF Controls

| RMF Function | Control                    | Implementation                                                           | Status      |
| ------------ | -------------------------- | ------------------------------------------------------------------------ | ----------- |
| GOVERN       | AI policy ownership        | AI Safety Lead owns 28-agent registry; policies in `REGISTRY_INDEX.md`   | IMPLEMENTED |
| GOVERN       | Kill switches              | 4 kill switches: per-agent, per-tool, per-workspace, platform-wide       | IMPLEMENTED |
| MAP          | Use case classification    | 6 use cases classified above; risk level assigned                        | IMPLEMENTED |
| MAP          | Prohibited use enforcement | Code-enforced; no workaround path                                        | IMPLEMENTED |
| MEASURE      | Evaluation                 | Adversarial eval harness; test_adversarial/ suite (9 tests)              | IMPLEMENTED |
| MEASURE      | Bias/fairness              | ATS semantic scorer; keyword gazetteer fallback; human review encouraged | PARTIAL     |
| MANAGE       | HITL approval              | Tier 4 HMAC-signed token; 15-min TTL                                     | IMPLEMENTED |
| MANAGE       | Incident response          | AI incident playbook in observability docs; OTel kill switch             | IMPLEMENTED |

---

## 6. Processor / Sub-processor Register

| Sub-processor         | Service                | DPA Status                         | Data Types Transferred                    | Region            | Adequacy                      |
| --------------------- | ---------------------- | ---------------------------------- | ----------------------------------------- | ----------------- | ----------------------------- |
| Supabase / PostgreSQL | Relational DB hosting  | DPA required before production EU  | All personal data categories              | Region-matched    | SCCs / India adequacy pending |
| MinIO                 | Object storage         | Self-hosted; no DPA needed         | Documents; attachments; resume artifacts  | Region-matched    | N/A (self-hosted)             |
| Ollama Cloud          | LLM (Gemma 4 31B)      | DPA required before production EU  | Anonymized workspace context ≤4,000 chars | US (model server) | SCCs required                 |
| TypeSafe AI Jev       | LLM routing (System 1) | DPA required before production EU  | Action description (no raw memory)        | US                | SCCs required                 |
| Stripe                | Billing                | DPA in place (Stripe DPA standard) | Email; payment intent                     | US → EU SCCs      | Adequate                      |
| GitHub Actions        | CI/CD                  | DPA in place (GitHub MSA)          | Source code; build artifacts              | US                | SCCs                          |

---

## 7. Breach Response Procedure

| Step | Action                                                        | Timeline                            | Owner                     |
| ---- | ------------------------------------------------------------- | ----------------------------------- | ------------------------- |
| BR-1 | Detect via OTel alert / SIEM correlation                      | ≤15 min detection                   | SRE on-call               |
| BR-2 | Classify: scope, affected tenants, data types                 | ≤1 hour                             | Security Architect + CISO |
| BR-3 | Contain: revoke tokens; suspend affected tenant cell          | ≤2 hours                            | SRE + Security Architect  |
| BR-4 | Notify CISO + Legal; begin 72h GDPR clock if EU data affected | ≤4 hours                            | CISO + Legal Reviewer     |
| BR-5 | Forensic evidence collection (S3 audit log, OTel traces)      | ≤8 hours                            | Security Architect        |
| BR-6 | Regulatory notification (GDPR DPA / DPDP authority)           | ≤72 hours                           | Legal Reviewer            |
| BR-7 | Affected user notification                                    | ≤72 hours (GDPR) / ≤60 hours (DPDP) | Privacy Engineer + Legal  |
| BR-8 | Post-incident review + RCA                                    | ≤5 business days                    | CISO                      |

---

_Deliverable DEL-ENT-P13-02 v2.0.0 — Privacy Engineer — 2026-09-29_  
_Legal review required before any compliance claim. This is a risk-mapping
document, not a certification._
