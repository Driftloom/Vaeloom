# ENT-P08 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P08` (API Integration and Contract Design)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead API Architect & Standards Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | API Architecture & Contract Constraints Extracted                                                          |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust API requirements, and test suites.        |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records baseline API routing and service evolution across MVP phases.                                      |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and institutional API integrations.                   |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Product Management           | Canonical scope boundary separating MVP core capabilities from advanced enterprise features.               |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Product Strategy             | Canonical enterprise vision: institutional multi-tenancy, candidate sovereign vaults, and 28 agents.       |
| **INT-07** | `02-system-architecture.md`                                     | Systems Architecture         | Multi-tenant cell architecture, global control plane API gateway, and regional routing.                    |
| **INT-08** | `03-agent-workflow.md`                                          | AI Engineering               | Agent tool contracts, human-in-the-loop (HITL) approval gates, and streaming SSE endpoints.                |
| **INT-09** | `04-memory-knowledge-graph.md`                                  | Knowledge Systems            | Cognitive memory endpoints, vector retrieval contracts, and provenance payload schemas.                    |
| **INT-10** | `specs/api/openapi.yaml`                                        | Platform API Engineering     | Current live generated OpenAPI spec (v0.2.0, 241 paths / 294 operations).                                  |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority                         |  Verified Snapshot   | Required API Implementation Controls                                                                 |
| :--------- | :------------------------------------------- | :------------------: | :--------------------------------------------------------------------------------------------------- |
| **EXT-01** | OpenAPI Specification 3.2.0                  |  OpenAPI Initiative  | Machine-readable JSON/YAML schema contracts, strict response validation in CI.                       |
| **EXT-02** | Arazzo Specification 1.1.0                   |  OpenAPI Initiative  | Multi-step deterministic API workflow execution descriptors for automated testing.                   |
| **EXT-03** | Model Context Protocol (MCP)                 | 2026-07-28 Snapshot  | Unified tool definition format (`mcp__<Server>__<Tool>`), schema reflection, and scoped execution.   |
| **EXT-04** | RFC 7643 & RFC 7644 (SCIM v2.0)              | IETF Standards Track | Enterprise directory synchronization: `/scim/v2/Users` and `/scim/v2/Groups` endpoints.              |
| **EXT-05** | RFC 9700 (OAuth 2.0 Security BCP)            |     IETF BCP 240     | PKCE enforcement, exact redirect URI matching, short-lived tokens, sender-constrained tokens.        |
| **EXT-06** | RFC 9728 (Protected Resource Metadata)       |    IETF RFC 9728     | Standardized discovery metadata for OAuth 2.0 protected API resources.                               |
| **EXT-07** | RFC 8594 (Sunset HTTP Header)                |    IETF RFC 8594     | Deprecation signaling via `Sunset` and `Deprecation` HTTP response headers.                          |
| **EXT-08** | OWASP API Security Top 10                    |     2023 Edition     | Mitigation for Broken Object Level Authorization (BOLA), Broken Authentication, and SSRF.            |
| **EXT-09** | OWASP Top 10 for Agentic Applications        |     2026 Edition     | Tool execution boundary defense, agent privilege escalation prevention, and goal hijack resistance.  |
| **EXT-10** | OpenTelemetry Trace Context                  |  W3C Recommendation  | Distributed trace context propagation via `traceparent` and `tracestate` HTTP headers.               |
| **EXT-11** | Standard Webhooks Specification              | StandardWebhooks.org | HMAC-SHA256 signature verification (`Vaeloom-Signature`) and anti-replay timestamps.                 |
| **EXT-12** | RFC 7231 (HTTP Semantics)                    |    IETF RFC 7231     | Strict idempotency guarantees on `GET`, `PUT`, `DELETE` and idempotent `POST` via `Idempotency-Key`. |
| **EXT-13** | Google Gmail & Calendar API v1               |  Google Developers   | Webhook push-watch subscriptions, renewal scheduling, and least-privilege scopes.                    |
| **EXT-14** | GitHub REST & GraphQL API v3/v4              |     GitHub Docs      | Fine-grained personal access tokens and GitHub App installation token lifecycle.                     |
| **EXT-15** | EU General Data Protection Regulation (GDPR) | Regulation 2016/679  | Article 15 access, Article 17 erasure (`/account/gdpr-purge`), and Article 20 data portability.      |
| **EXT-16** | India DPDP Act 2023 & Rules 2025             |   MeitY Government   | Consent manager integration APIs, purpose-limited token issuance, and localized routing.             |
| **EXT-17** | US FERPA & FTC COPPA                         |     US ED & FTC      | Institutional directory role mapping and strict age verification checkpoints.                        |

_Signed: Lead API Architect & Standards Custodian — 2026-09-29_
