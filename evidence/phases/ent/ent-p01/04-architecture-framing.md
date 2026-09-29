# ENT-P01 — 04 Architecture Framing — Enterprise Topology & Security Invariants

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** Architectural Framing & System Boundary Specification  
> **Owner:** Chief Architect & Platform Security Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Multi-Tenant Regional Cell Topology

The enterprise target architecture enforces a strict distinction between the
**Global Control Plane** and **Region-Pinned Tenant Cells**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL CONTROL PLANE                            │
│  - Identity & Authentication Gateway (SSO / OIDC / SAML 2.0 / SCIM)    │
│  - Global Organization Catalog & Tenant Router                         │
│  - Billing, Subscriptions & Entitlements Engine                        │
│  - Security Governance, Audit Archival & System Telemetry              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────┴───────────────────────────┐
       │                                                        │
       ▼                                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│      US REGIONAL CELL        │        │      EU REGIONAL CELL        │
│ - Dedicated PostgreSQL Pool  │        │ - Dedicated PostgreSQL Pool  │
│   (42/42 RLS Enforced)       │        │   (42/42 RLS Enforced)       │
│ - pgvector Tenant Partitions │        │ - pgvector Tenant Partitions │
│ - MinIO / S3 Object Storage  │        │ - MinIO / S3 Object Storage  │
│ - Redis BullMQ Queue Worker  │        │ - Redis BullMQ Queue Worker  │
│ - Playwright Render Pool     │        │ - Playwright Render Pool     │
│ - Ollama / Gemma Inference   │        │ - Ollama / Gemma Inference   │
└──────────────────────────────┘        └──────────────────────────────┘
```

1. **Global Control Plane:** Handles global identity federation, tenant routing,
   license entitlements, and cross-region health monitoring. Never stores raw
   candidate resume contents or unconsented career memories.
2. **Region-Pinned Tenant Cells:** Each cell resides entirely within a
   designated legal jurisdiction (e.g. US-East, EU-Frankfurt, India-Central).
   All relational tables, vector embeddings, object storage buckets (MinIO/S3),
   and cache entries are pinned to the cell, satisfying GDPR Art. 44 and India
   DPDP data residency requirements.

---

## 2. Personal Vault vs Institutional Shared View

To solve the Institutional Privacy Paradox (EPS-01), the database and API
enforce a strict two-tier data isolation model:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE SOVEREIGN VAULT                       │
│  - Private Journal Entries & Career Reflections                       │
│  - Compensation Targets, Health / Disability Disclosures               │
│  - Off-Campus / Private Job Applications & Personal Inquiries          │
│  - Raw Unshared Resume Drafts                                          │
│  ===> Strictly Gated: app.user_id = :current_user                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Candidate Consent Grant
                         (Granular, Time-Bounded)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      INSTITUTIONAL SHARED VIEW                         │
│  - Curated, Tailored Resumes Approved for Sharing                      │
│  - Application Statuses (Interview Scheduled, Offer Extended)          │
│  - Verified Skills & Credential Badges                                 │
│  - Advisor Feedback Threads & Intervention Action Items                │
│  ===> Accessible by: Institutional Advisors with Active Consent Token  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Candidate Sovereign Vault:** Scoped exclusively to the candidate's personal
  user ID. Even tenant administrators with `ADMIN` or `OWNER` roles cannot query
  records where `is_personal = true`.
- **Institutional Shared View:** Only records linked to an active, valid
  `ConsentGrant` record (specifying `grantee_id`, `granted_scopes`,
  `expires_at`, and `revoked_at is null`) are accessible to institutional
  advisors.

---

## 3. Two-Tier Cognitive Pipeline Architecture

Building on the verified Module 05 cognitive pipeline, enterprise reasoning
splits computation into deterministic routing and grounded generative synthesis:

1. **System 1 (TypeSafe AI Jev System One):**
   - Direct native API at `https://api.typesafe.ai/v1/systemone` using
     `JEV_API_KEY`.
   - Latency: Sub-50ms deterministic execution.
   - Responsibilities: Action routing (`choice`), destructive action triage
     (`noul`), semantic similarity ranking (`score`), and prompt-injection
     threat classification.
2. **System 2 (Ollama Cloud Gemma 4 31B):**
   - High-capacity generative model at `https://ollama.com/v1` (with local
     Ollama `gemma4:12b` fallback on `http://localhost:11434`).
   - Responsibilities: Grounded resume synthesis, cover letter compilation,
     interview question generation.
   - Enforces XML context fencing (`<document_context>...</document_context>`)
     and mandatory provenance citation back to raw memory IDs.

---

## 4. The 28-Agent Governed Roster

The 28 enterprise agents defined in `06-vaeloom-enterprise-paper.md` represent a
capability ceiling. Each agent must declare its operational permissions, rate
limits, and tool execution boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                    28 GOVERNED ENTERPRISE AGENTS                       │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│ CAREER & SEARCH     │ ADVISORY & REVIEW  │ OPERATIONS & INTEGRATION    │
│ - JobSearchAgent    │ - ATSAuditAgent    │ - ConnectorSyncAgent        │
│ - ApplicationAgent  │ - ResumeCritique   │ - ScheduleDaemonAgent       │
│ - InterviewPrepAgent│ - SkillGapAgent    │ - NotificationAgent         │
│ - SalaryNegotiator  │ - AdvisorCopilot   │ - DataRetentionAgent        │
├─────────────────────┼────────────────────┼─────────────────────────────┤
│ LEARNING & SKILLS   │ RESEARCH & INTEL   │ ENTERPRISE CONTROL PLANE    │
│ - SkillRoadmapAgent │ - CompanyIntel     │ - OrganizationAdminAgent    │
│ - ProjectBuilder    │ - MarketTrends     │ - ConsentEnforcementAgent   │
│ - AssessmentCoach   │ - SalaryBenchmark  │ - AuditLogArchivalAgent     │
└─────────────────────┴────────────────────┴─────────────────────────────┘
```

- **Approval Gates:** Any agent action altering external state (dispatching
  emails, applying to jobs, modifying calendar schedules) is intercepted by
  `approval_gated_tools()` in `loop.py` and converted into a pending
  human-approval request.
- **Circuit Breakers:** All agent tool invocations are wrapped in
  `CircuitBreaker` instances (3 consecutive failures trip the breaker for 30
  seconds).

---

## 5. Architectural Invariants Sign-Off

These architectural invariants form the non-negotiable foundation for Phase
`ENT-P02` (Domain Analysis) through `ENT-P21` (Scale-Out):

1. 100% PostgreSQL RLS on all relational tables.
2. Zero unconsented administrative access to private candidate vaults.
3. Zero mocks in live provider integration suites.
4. Deterministic HITL approval gates on destructive agent tools.

_Signed: Chief Architect & Enterprise Security Lead — 2026-09-29_
