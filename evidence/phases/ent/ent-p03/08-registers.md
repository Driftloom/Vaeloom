# ENT-P03 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P03` (Requirements Engineering)  
> **Deliverable:** `DEL-ENT-P03-08` — Consolidated Governance Registers  
> **Owner:** Program Management Office & Risk Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                       | Severity |         Impact          | Mitigation Strategy                                                                                             | Owner         |     Status     |
| :------------------ | :----------------------------------------------------------------------------------------------------- | :------: | :---------------------: | :-------------------------------------------------------------------------------------------------------------- | :------------ | :------------: |
| **RISK-ENT-P03-01** | Scope creep from institutional customers demanding custom ATS integration workflows.                   |   High   |     Delivery delay      | Strict MoSCoW prioritization (`04-priority-release-baseline.md`); standardized MCP protocol adapters.           | Product Lead  | **CONTROLLED** |
| **RISK-ENT-P03-02** | Advisor override mechanisms compromise candidate sovereign privacy without explicit consent.           | Critical |    Compliance breach    | Cryptographic consent token verification (`ConsentGrant`); hard denial with HTTP 403 on missing grant.          | AppSec Lead   | **CONTROLLED** |
| **RISK-ENT-P03-03** | Cloud LLM outage triggers widespread resume tailoring timeouts and advisor queue backlogs.             |   High   |   Service disruption    | Automatic circuit breaker failover (`RES-01`) to self-hosted Ollama `gemma4:12b` container; BullMQ job retries. | SRE Lead      | **CONTROLLED** |
| **RISK-ENT-P03-04** | Complex 22-memory type queries cause database connection pool exhaustion under peak career fair loads. |  Medium  | API latency degradation | Tuned pgvector HNSW indexing; read-replica scaling; tenant query quotas via sliding window rate limiter.        | DBA Lead      | **CONTROLLED** |
| **RISK-ENT-P03-05** | Requirements drift between API schemas and frontend UI forms during multi-track delivery.              |  Medium  |  Integration failures   | Automated OpenAPI schema generation via `scripts/gen_openapi.py` gated in CI/CD pipeline.                       | Frontend Lead | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                                         | Context & Alternatives                                                                                                         | Chosen Rationale                                                                                                 |    Status    |
| :----------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P03-01** | **Candidate Sovereign Vault Architecture**             | Alt A: Institutional ownership of all student/employee data.<br>Alt B: Sovereign candidate vault with granular consent grants. | Chose Alt B. Adheres strictly to FERPA and GDPR Art. 6 while empowering candidates with portable career records. | **APPROVED** |
| **DEC-ENT-P03-02** | **SCIM v2.0 Enterprise Provisioning Standard**         | Alt A: Proprietary user sync webhook API.<br>Alt B: RFC 7643/7644 SCIM v2.0 protocol endpoints.                                | Chose Alt B. Provides zero-friction Okta, Entra ID, and PingFederate directory integration.                      | **APPROVED** |
| **DEC-ENT-P03-03** | **Human-in-the-Loop Advisor Review Thresholds**        | Alt A: Pure automated dispatch.<br>Alt B: Configurable advisor intervention queues for high-stakes applications.               | Chose Alt B. Satisfies EU AI Act Annex III high-risk AI oversight mandates and protects candidate outcomes.      | **APPROVED** |
| **DEC-ENT-P03-04** | **Phased 4-Wave Enterprise Delivery Roadmap**          | Alt A: Monolithic enterprise release.<br>Alt B: 4-Wave progressive delivery across ENT-P04..ENT-P21.                           | Chose Alt B. Mitigates delivery risk and enables early value capture for Higher Ed design partners.              | **APPROVED** |
| **DEC-ENT-P03-05** | **Strict Unit Cost Ceiling ($\le \$0.38\text{ USD}$)** | Alt A: Uncapped LLM token consumption.<br>Alt B: 30% System 1 routing + XML fencing token budgeting.                           | Chose Alt B. Guarantees healthy gross margins ($\ge 78\%$) on enterprise annual contracts.                       | **APPROVED** |
| **DEC-ENT-P03-06** | **Break-Glass Emergency Change Control Protocol**      | Alt A: Manual code hotfixes without audit.<br>Alt B: Time-boxed 4-hour break-glass tokens with mandatory CCB post-mortem.      | Chose Alt B. Ensures rapid production incident recovery without sacrificing SOC 2 Type II auditability.          | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                                   | Validation Method                                                                  | Invalidation Action                                                                            |    Status     |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P03-01** | Enterprise IdPs support SCIM v2.0 core schema with custom enterprise user extension attributes.                           | Review of Okta and Microsoft Entra ID integration documentation.                   | Fallback to scheduled SAML JIT (Just-in-Time) provisioning with role attribute mapping.        | **VALIDATED** |
| **ASM-ENT-P03-02** | Institutional career advisors require $\le 3\text{ minutes}$ per candidate resume review when AI highlights keyword gaps. | Usability testing with 6 university career advisors in staging sandbox.            | Enhance visual diff rendering and AI summary bullet points to reduce review fatigue.           | **VALIDATED** |
| **ASM-ENT-P03-03** | Redis BullMQ instance can buffer up to 50,000 asynchronous tailoring jobs during nationwide university hiring waves.      | Redis memory sizing calculation ($<50\text{ MB}$ queue footprint for 50k job IDs). | Enable Redis persistence (AOF) and configure secondary cluster sharding if memory exceeds 70%. | **VALIDATED** |
| **ASM-ENT-P03-04** | 22-memory type schema can be mapped to relational tables without requiring unstructured schema migration loops.           | Pydantic schema validation tests against existing Supabase PostgreSQL schema.      | Isolate dynamic memory payload extensions to typed JSONB columns with JSON schema validation.  | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline            | Category          | Verification Suite                                 | Automated Assertion                       | Phase Status |
| :------------------------------ | :---------------- | :------------------------------------------------- | :---------------------------------------- | :----------: |
| **REQ-FR-01** (Hierarchy)       | Multi-Tenancy     | `test_organizations.py`, `test_workspaces.py`      | Tenant isolation & cohort scoping         | **VERIFIED** |
| **REQ-FR-02** (Provisioning)    | Identity & Auth   | `test_auth.py`, `test_sso.py`                      | SCIM / SAML / OAuth tokens                | **VERIFIED** |
| **REQ-FR-03** (Advisor Plane)   | Operations        | `test_advisor_interventions.py`                    | Queue triage & diff approval              | **VERIFIED** |
| **REQ-FR-04** (Consent Vault)   | Privacy           | `test_consent.py`, `test_rls_live_pg.py`           | Granular grant expiry & revocation        | **VERIFIED** |
| **REQ-FR-05** (22-Memory Types) | Cognitive         | `test_knowledge_graph.py`, `test_memory_types.py`  | Temporal validity & provenance pointers   | **VERIFIED** |
| **REQ-FR-06** (Adaptive ATS)    | Intelligence      | `test_ats_pipeline.py`, `test_document_builder.py` | PDF/DOCX page budget compilation          | **VERIFIED** |
| **REQ-FR-07** (Audit Trail)     | Governance        | `test_audit.py`, `test_gdpr_export.py`             | Immutable append-only log                 | **VERIFIED** |
| **REQ-NFR-01..06** (SLOs)       | Resilience & Perf | `quality.spec.ts`, `test_noauth_private.py`        | p95 $\le 120\text{ ms}$, WCAG AA, 0 leaks | **VERIFIED** |

_Signed: Program Management Office & Risk Custodian — 2026-09-29_
