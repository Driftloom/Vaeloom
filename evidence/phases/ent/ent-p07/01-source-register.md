# ENT-P07 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P07` (Data Architecture and Database Design)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead Data Architect & Database Governance Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | Data Architecture & Database Constraints Extracted                                                         |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust requirements, and 42/42 table RLS rules.  |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records the baseline execution trajectory across MVP phases 0 through 21.                                  |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and data architecture requirements.                   |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Product Management           | Canonical scope boundary separating MVP core capabilities from advanced enterprise features.               |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Product Strategy             | Canonical enterprise vision: institutional multi-tenancy, candidate sovereign vaults, and 22 memory types. |
| **INT-07** | `02-system-architecture.md`                                     | Systems Architecture         | Multi-tenant cell architecture, global control plane, and localized data plane database topology.          |
| **INT-08** | `03-agent-workflow.md`                                          | AI Engineering               | Agent data interaction contracts, audit logging requirements, and state persistence boundaries.            |
| **INT-09** | `04-memory-knowledge-graph.md`                                  | Knowledge Systems            | Cognitive memory topology, 22-type schema taxonomy, vector embeddings, and temporal decay functions.       |
| **INT-10** | `gap/completion reports`                                        | Quality Assurance            | Documentation maturity baselines and legacy audit logs (informational only; not runtime evidence).         |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority                         |   Verified Snapshot    | Required Database Implementation Controls                                                 |
| :--------- | :------------------------------------------- | :--------------------: | :---------------------------------------------------------------------------------------- |
| **EXT-01** | PostgreSQL 16 Official Documentation         |  PostgreSQL Core Team  | Declarative table partitioning, connection limits, and JSONB index performance.           |
| **EXT-02** | pgvector 0.7+ Specification                  |    pgvector Project    | HNSW index tuning ($m=16, ef_c=64, ef_s=40$) and cosine distance operators (`<=>`).       |
| **EXT-03** | OWASP Top 10 for Agentic Applications        |      2026 Edition      | Mitigation for memory poisoning and vector embedding manipulation attacks.                |
| **EXT-04** | OWASP LLM Applications Top 10                |      2025 Edition      | Guardrails against injection through stored memory retrieval context.                     |
| **EXT-05** | NIST AI RMF 1.0 + GenAI Profile              |    Official Profile    | Data provenance tracking, citation graph verification, and model input tracing.           |
| **EXT-06** | RFC 9700 (OAuth 2.0 Security BCP)            |      IETF BCP 240      | Token storage security, refresh token hashing, and authorization code rotation.           |
| **EXT-07** | Supabase Row Level Security Guide            | Supabase Architecture  | Session configuration GUCs (`app.tenant_id`, `app.user_id`) and fail-closed RLS policies. |
| **EXT-08** | OpenAPI Specification 3.2.0                  |   OpenAPI Initiative   | Schema mapping between database entities and REST API response models.                    |
| **EXT-09** | OpenTelemetry Database Semantic Conventions  |     CNCF Standard      | `db.system`, `db.name`, `db.statement` span attributes with sanitized query parameters.   |
| **EXT-10** | SLSA v1.2 & Sigstore                         |  OpenSSF / Linux Fdn   | Database migration script signing and deterministic checksum verification.                |
| **EXT-11** | NIST SSDF SP 800-218 v1.1                    |     NIST Standard      | Secure database schema change management and rollback procedures.                         |
| **EXT-12** | ISO/IEC 27001:2022 Control 8.24              |       ISO / IEC        | Use of cryptography: AES-256 encryption at rest and TLS 1.3 in transit.                   |
| **EXT-13** | SOC 2 Type II Trust Services Criteria        |         AICPA          | CC6.1 Logical access security, CC6.6 boundary protection, and CC7.2 backup restoration.   |
| **EXT-14** | EU General Data Protection Regulation (GDPR) |  Regulation 2016/679   | Article 17 right to erasure (cryptographic shredding) and Article 20 data portability.    |
| **EXT-15** | EU Artificial Intelligence Act               | Official 2026 Guidance | Annex III transparency: verified provenance metadata for training and retrieval corpora.  |
| **EXT-16** | India DPDP Act 2023 & Rules 2025             |    MeitY Government    | Candidate data sovereignty, purpose limitation, and consent-gated access logging.         |
| **EXT-17** | US FERPA & FTC COPPA                         |      US ED & FTC       | Institutional education record role isolation and under-13 age gating controls.           |

_Signed: Lead Data Architect & Database Governance Specialist — 2026-09-29_
