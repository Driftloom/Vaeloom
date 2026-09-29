# ENT-P01 — 01 Source Register — Authoritative Sources & Control Mapping

> **Phase:** `ENT-P01` (Discovery and Problem Definition)  
> **Deliverable:** Phase Source Authority & Compliance Mapping  
> **Owner:** Enterprise Standards Lead & Compliance Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document Name & Authority                                       | Specific Application in ENT-P01                                                           | Verification Status   |
| :--------- | :-------------------------------------------------------------- | :---------------------------------------------------------------------------------------- | :-------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Governing 32-section execution protocol, DoR/DoD, and §85 weighted scorecard.             | Canonical (Governing) |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Authoritative MVP baseline corrections, security invariants, and release evidence.        | Verified against HEAD |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Historical MVP Phase 00–21 execution records.                                             | Historical Reference  |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Canonical Enterprise Phase 00–21 execution roadmap and multi-tenant vision.               | Baseline Roadmap      |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Canonical product scope definition for wedge and individual job seeker.                   | Verified Product Spec |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Multi-tenant institutional vision, regional cells, and 28-agent / 22-memory architecture. | Architectural Target  |
| **INT-07** | `02-system-architecture.md`                                     | Memory-first system architecture, dual-tier cognitive pipeline, and RLS schema.           | Active Architecture   |
| **INT-08** | `03-agent-workflow.md`                                          | ReAct reasoning loops, tool executor sandbox, and HITL approval gates.                    | Active Implementation |
| **INT-09** | `04-memory-knowledge-graph.md`                                  | Structured career memory, pgvector indexing, and knowledge graph relations.               | Active Implementation |
| **INT-10** | `EXECUTION-LOG.md`                                              | Monorepo implementation and audit log (Commit `592db98e`, 46/46 E2E verified).            | Real-time Verified    |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Regulation                                   | Verified Snapshot     | Required Application & Control Mapping                                               |
| :--------- | :------------------------------------------------------ | :-------------------- | :----------------------------------------------------------------------------------- |
| **EXT-01** | **Model Context Protocol (MCP)**                        | Spec 2026-07-28       | Version-pinned connector profiles, capability manifests, and token scoping.          |
| **EXT-02** | **OWASP Top 10 for Agentic Applications**               | 2026 Edition          | Mitigation of agent goal hijacking, tool misuse, and context poisoning.              |
| **EXT-03** | **OWASP Top 10 for LLM Applications**                   | 2025 Edition          | Prompt injection defenses, XML context fencing, sensitive data redaction.            |
| **EXT-04** | **NIST AI Risk Management Framework (AI RMF 1.0)**      | Generative AI Profile | Govern, Map, Measure, and Manage functions for autonomous agent evaluation.          |
| **EXT-05** | **W3C Web Content Accessibility Guidelines (WCAG 2.2)** | Level AA              | Zero critical/serious violations across core routes in dark and light modes.         |
| **EXT-06** | **RFC 9700 / BCP 240 (OAuth 2.0 Security BCP)**         | Current IETF BCP      | Exact redirect URI matching, PKCE enforcement, and secure token rotation.            |
| **EXT-07** | **RFC 9728 (Protected Resource Metadata)**              | Current IETF RFC      | OAuth / MCP resource server metadata discovery and authorization scopes.             |
| **EXT-08** | **OpenAPI Specification 3.2.0**                         | Current Minor Pin     | Machine-readable API contracts (`specs/api/openapi.yaml`, 241 paths / 294 ops).      |
| **EXT-09** | **OpenTelemetry Semantic Conventions**                  | Current CNCF Pin      | Distributed trace context propagation without logging sensitive candidate PII.       |
| **EXT-10** | **SLSA v1.2 & Sigstore**                                | OpenSSF Standard      | Cryptographic build provenance and supply-chain artifact verification.               |
| **EXT-11** | **NIST SSDF (SP 800-218 v1.1)**                         | NIST Publication      | Secure software development practices and automated vulnerability gates.             |
| **EXT-12** | **Google Gmail API Push Notifications**                 | Official API v1       | Push-watch renewal, least-privilege OAuth scopes, and webhook idempotency.           |
| **EXT-13** | **GitHub App Permissions & Webhooks**                   | Official v3/v4        | Granular, fine-grained installation tokens and HMAC-SHA256 signature verification.   |
| **EXT-14** | **EU General Data Protection Regulation (GDPR)**        | Regulation 2016/679   | Lawful basis, purpose limitation, right to erasure, and regional data residency.     |
| **EXT-15** | **EU Artificial Intelligence Act**                      | Guidance 2026-08-02   | Transparency disclosures for generative outputs, human oversight for high-risk AI.   |
| **EXT-16** | **India Digital Personal Data Protection (DPDP) Act**   | Final Rules 2025      | Purpose-bound consent, child data protections (<18), and breach notification duties. |
| **EXT-17** | **Family Educational Rights and Privacy Act (FERPA)**   | 34 CFR Part 99        | Student education record protections, institutional directory role scoping.          |

---

## 3. Conflict Resolution & Precedence

1. **Precedence Hierarchy:**
   - Level 1: Governing Prompt & Hardened Security Baseline
     (`Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`,
     `vaeloom-mvp-e2e-enterprise-hardened.md`).
   - Level 2: Target Enterprise Canonical Papers
     (`06-vaeloom-enterprise-paper.md`, `vaeloom-enterprise-e2e.md`).
   - Level 3: Canonical MVP Product Specifications (`01-vaeloom-mvp-spec.md`).
   - Level 4: External Standards and Regulations (`EXT-01` through `EXT-17`).
   - Level 5: Legacy or Superseded Historical Documents
     (`05-vaeloom-mvp-spec.md`, unhardened notes).

2. **Compliance Statement:** All deliverables generated during Phase `ENT-P01`
   strictly comply with this source register. Any deviation from these canonical
   sources is prohibited without an approved Architecture Decision Record (ADR).
