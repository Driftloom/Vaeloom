# ENT-P04 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P04` (Project Planning and Delivery Governance)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead Program Planner & Governance Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | Key Planning Guidance & Constraints Extracted                                                              |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust requirements, and test suites.            |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records the baseline execution trajectory across MVP phases 0 through 21.                                  |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and operational requirements.                         |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Product Management           | Canonical scope boundary separating MVP core capabilities from advanced enterprise features.               |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Product Strategy             | Canonical enterprise vision: institutional multi-tenancy, candidate sovereign vaults, and 28 agents.       |
| **INT-07** | `02-system-architecture.md`                                     | Systems Architecture         | Multi-tenant cell architecture, global control plane, and localized data plane topology.                   |
| **INT-08** | `03-agent-workflow.md`                                          | AI Engineering               | 28-agent ReAct orchestration, human-in-the-loop (HITL) approval gates, and tool execution boundaries.      |
| **INT-09** | `04-memory-knowledge-graph.md`                                  | Knowledge Systems            | Cognitive memory topology, graph relations, and vector retrieval pipelines.                                |
| **INT-10** | `gap/completion reports`                                        | Quality Assurance            | Documentation maturity baselines and legacy audit logs (informational only; not runtime evidence).         |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority                         |   Verified Snapshot    | Required Implementation Controls                                                                   |
| :--------- | :------------------------------------------- | :--------------------: | :------------------------------------------------------------------------------------------------- |
| **EXT-01** | Model Context Protocol (MCP)                 |       2026-07-28       | Client protocol adapters, version-pinned profiles, sandboxed tool execution.                       |
| **EXT-02** | OWASP Top 10 for Agentic Applications        |      2026 Edition      | Prevention of agent goal hijacking, tool abuse, excessive agency, and memory poisoning.            |
| **EXT-03** | OWASP LLM Applications Top 10                |      2025 Edition      | Guardrails against prompt injection, unsafe output generation, and sensitive data leakage.         |
| **EXT-04** | NIST AI RMF 1.0 + GenAI Profile              |    Official Profile    | AI risk governance, continuous evaluation, and transparency documentation.                         |
| **EXT-05** | W3C WCAG 2.2 Level AA                        |     Recommendation     | Web accessibility compliance across all viewport dimensions with zero serious/critical violations. |
| **EXT-06** | RFC 9700 (OAuth 2.0 Security BCP)            |      IETF BCP 240      | PKCE enforcement, exact redirect URI matching, short-lived tokens, sender-constrained tokens.      |
| **EXT-07** | RFC 9728 (Protected Resource Metadata)       |     IETF Standard      | Machine-readable authorization server and resource server discovery metadata.                      |
| **EXT-08** | OpenAPI Specification 3.2.0                  |   OpenAPI Initiative   | Strict contract definition for all REST endpoints; validated in CI/CD pipeline.                    |
| **EXT-09** | OpenTelemetry Specification                  |     CNCF Standard      | Distributed trace context propagation across FastAPI services, BullMQ workers, and DB calls.       |
| **EXT-10** | SLSA v1.2 & Sigstore                         |  OpenSSF / Linux Fdn   | Cryptographic build provenance and supply chain security for all deployed container images.        |
| **EXT-11** | NIST SSDF SP 800-218 v1.1                    |     NIST Standard      | Secure software development lifecycle, dependency vulnerability scanning, and branch protection.   |
| **EXT-12** | Google Gmail API Push Notifications          |   Google Developers    | Webhook subscription management, push watch renewal, and quota throttling.                         |
| **EXT-13** | GitHub App Integration Permissions           |      GitHub Docs       | Fine-grained least-privilege token generation for candidate portfolio repositories.                |
| **EXT-14** | EU General Data Protection Regulation (GDPR) |  Regulation 2016/679   | Article 17 right to erasure (cryptographic key purge) and Article 20 data portability.             |
| **EXT-15** | EU Artificial Intelligence Act               | Official 2026 Guidance | Annex III high-risk AI oversight, human review queues, and algorithmic transparency citations.     |
| **EXT-16** | India DPDP Act 2023 & Rules 2025             |    MeitY Government    | Verifiable parental consent for minors and localized data processing options.                      |
| **EXT-17** | US FERPA & FTC COPPA                         |      US ED & FTC       | School official exception controls for career services and under-13 age gating.                    |

_Signed: Lead Program Planner & Governance Specialist — 2026-09-29_
