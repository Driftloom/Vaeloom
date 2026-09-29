# ENT-P18 Source Register

**Phase:** ENT-P18 — Documentation and Knowledge Transfer  
**Version:** 1.0.0  
**Owner:** Technical Writer  
**Date:** 2026-09-29  
**Status:** VERIFIED

---

## Internal Sources (INT-01..10)

| ID     | Source                                                          | Owner / Authority          | Version / Commit | Use in ENT-P18                                                                            | Location                           |
| ------ | --------------------------------------------------------------- | -------------------------- | ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom source team        | 2026-08-04       | Governing 32-section prompt; evidence, DoR/DoD, gate and remediation standards            | `specs/`                           |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Vaeloom source team        | 2026-08-04       | Authoritative MVP corrections; hardening decisions referenced in ADRs                     | `specs/`                           |
| INT-03 | `vaeloom-enterprise-e2e.md`                                     | Vaeloom source team        | 2026-08-04       | Enterprise Phase 0–21 execution baseline; deliverable chain                               | `specs/`                           |
| INT-04 | `02-system-architecture.md`                                     | Vaeloom Architecture Owner | HEAD `7981824b`  | Control-plane / cell architecture; 5 architecture invariants                              | `specs/`                           |
| INT-05 | `03-agent-workflow.md`                                          | Vaeloom Architecture Owner | HEAD `7981824b`  | 28-agent roster; approval flows; agent lifecycle                                          | `specs/`                           |
| INT-06 | `04-memory-knowledge-graph.md`                                  | Vaeloom Architecture Owner | HEAD `7981824b`  | 22-memory taxonomy; knowledge graph; RAG pipeline                                         | `specs/`                           |
| INT-07 | `AGENTS.md`                                                     | Engineering Lead           | HEAD `7981824b`  | Engineering source of truth; agentic task definitions; tool permissions                   | repo root                          |
| INT-08 | `docs/mcp/servers/seed-configs.md`                              | MCP Integration Lead       | HEAD `7981824b`  | MCP connector seed configurations; server definitions                                     | `docs/mcp/servers/`                |
| INT-09 | `docs/adr/` (ADR-001..045)                                      | Architecture Owner         | HEAD `7981824b`  | Existing ADR library; decision history; ENT-P13..P17 decisions                            | `docs/adr/`                        |
| INT-10 | ENT-P13..P17 evidence bundles                                   | Phase owners               | HEAD `7981824b`  | Security invariants (INV-SEC-01..05); quality invariants (INV-QA-01..05); phase decisions | `evidence/phases/ent/ent-p13..17/` |

---

## External Sources (EXT-01..10)

| ID     | Source                                  | Owner / Authority   | Version / Date      | Applicability                                                      | Location                                                 |
| ------ | --------------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| EXT-01 | Model Context Protocol Specification    | MCP maintainers     | 2026-07-28          | MCP connector documentation; version-pinned integration guide      | https://modelcontextprotocol.io/specification/2026-07-28 |
| EXT-02 | OWASP Agentic Applications Top 10       | OWASP               | 2026 edition        | Agent documentation; security guidance in developer portal         | https://owasp.org/                                       |
| EXT-03 | OWASP LLM Applications Top 10           | OWASP               | 2025 edition        | Prompt injection; unsafe output; disclosure warnings in docs       | https://owasp.org/                                       |
| EXT-04 | NIST AI RMF 1.0 + Generative AI Profile | NIST                | Official            | AI agent documentation; governance; human oversight                | https://www.nist.gov/itl/ai-risk-management-framework    |
| EXT-05 | WCAG 2.2                                | W3C                 | Recommendation      | Developer portal accessibility; help center AA conformance         | https://www.w3.org/TR/WCAG22/                            |
| EXT-06 | OpenAPI Specification 3.2.0             | OpenAPI Initiative  | 3.2.0 current       | API documentation; 241 paths / 294 ops OpenAPI spec                | https://spec.openapis.org/oas/latest.html                |
| EXT-07 | OAuth 2.0 Security BCP — RFC 9700       | IETF                | RFC 9700 / BCP 240  | SDK authentication documentation; token handling guide             | https://www.rfc-editor.org/rfc/rfc9700                   |
| EXT-08 | GDPR                                    | European Union      | Regulation 2016/679 | Privacy rights guide; ConsentGrant / portability / erasure docs    | https://eur-lex.europa.eu/eli/reg/2016/679/oj            |
| EXT-09 | India DPDP Act 2023 + Rules 2025        | Government of India | 2025 Rules          | India user privacy documentation; consent and notice requirements  | https://www.meity.gov.in/                                |
| EXT-10 | OpenTelemetry Specification             | CNCF                | Latest official     | Observability documentation consistent with ENT-P17 telemetry spec | https://opentelemetry.io/docs/specs/                     |

---

## Conflict Resolution Notes

| Conflict                                                              | Resolution                                                                                         | Owner              | Date       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| ADR-034..040 (pre-ENT-P13 decisions) vs. ENT-P13..P17 phase decisions | ENT-P13..P17 phase evidence outranks older ADR prose; new ADR-046..050 capture updated decisions   | Architecture Owner | 2026-09-29 |
| `vaeloom-documentation-site.md` vs. `02-system-architecture.md`       | `02-system-architecture.md` and phase evidence are authoritative; documentation site is contextual | Technical Writer   | 2026-09-29 |

---

_Owner: Technical Writer — 2026-09-29T17:19:00Z_
