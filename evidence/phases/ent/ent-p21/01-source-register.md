# ENT-P21 — Source Register

**Phase:** ENT-P21 — Maintenance and Continuous Improvement  
**Version:** 1.0  
**Owner:** Architecture Review Board  
**Date:** 2026-09-29  
**Status:** APPROVED

---

## Internal Sources (INT-01 .. INT-10)

| ID     | Source                                                        | Owner / Authority   | Version / Hash               | Use                                                                  | Location               | Status   |
| ------ | ------------------------------------------------------------- | ------------------- | ---------------------------- | -------------------------------------------------------------------- | ---------------------- | -------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Vaeloom source team | rev-2026-08-04               | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation | `specs/`               | VERIFIED |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md                        | Vaeloom source team | rev-2026-08-04               | Authoritative MVP corrections and hardening decisions                | `specs/`               | VERIFIED |
| INT-03 | vaeloom-mvp-e2e.md                                            | Vaeloom source team | rev-2026-07-01               | MVP Phase 0–21 execution baseline                                    | `specs/`               | VERIFIED |
| INT-04 | vaeloom-enterprise-e2e.md                                     | Vaeloom source team | rev-2026-08-04               | Enterprise Phase 0–21 execution baseline                             | `specs/`               | VERIFIED |
| INT-05 | 01-vaeloom-mvp-spec.md                                        | Vaeloom source team | rev-2026-06-01               | Canonical MVP product scope                                          | `specs/`               | VERIFIED |
| INT-06 | 06-vaeloom-enterprise-paper.md                                | Vaeloom source team | rev-2026-07-15               | Canonical enterprise vision; future boundary definition              | `specs/`               | VERIFIED |
| INT-07 | 02-system-architecture.md                                     | Vaeloom source team | rev-2026-07-20               | Memory-first architecture; control plane + cell topology             | `specs/`               | VERIFIED |
| INT-08 | 03-agent-workflow.md                                          | Vaeloom source team | rev-2026-07-20               | Agent roster (28), approval flows, ReAct trajectories                | `specs/`               | VERIFIED |
| INT-09 | 04-memory-knowledge-graph.md                                  | Vaeloom source team | rev-2026-07-20               | 22-memory taxonomy, RAG, provenance                                  | `specs/`               | VERIFIED |
| INT-10 | ENT-P00..P20 evidence bundles                                 | Phase owners        | See individual phase records | Completed phase evidence baseline; 97.2/100 predecessor score        | `evidence/phases/ent/` | VERIFIED |

---

## External Sources (EXT-01 .. EXT-10 + supplementary)

| ID     | Source                                  | Authority                      | Version / Date      | Use                                                               | URL                                                      | Applicability |
| ------ | --------------------------------------- | ------------------------------ | ------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ------------- |
| EXT-01 | Model Context Protocol Specification    | MCP maintainers                | 2026-07-28          | Plugin/MCP versioning, authorization, deprecation                 | https://modelcontextprotocol.io/specification/2026-07-28 | APPLICABLE    |
| EXT-02 | OWASP Agentic Applications Top 10       | OWASP                          | 2026 edition        | Agent goal hijack, tool misuse, memory poisoning, cascading risks | https://owasp.org/                                       | APPLICABLE    |
| EXT-03 | OWASP LLM Applications Top 10           | OWASP                          | 2025 edition        | Prompt injection, leakage, excessive agency                       | https://owasp.org/                                       | APPLICABLE    |
| EXT-04 | NIST AI RMF 1.0 + Generative AI Profile | NIST                           | Official current    | Govern/Map/Measure/Manage; AI evaluation cadence                  | https://www.nist.gov/itl/ai-risk-management-framework    | APPLICABLE    |
| EXT-05 | WCAG 2.2                                | W3C                            | Recommendation 2023 | AA accessibility; continuous compliance monitoring                | https://www.w3.org/TR/WCAG22/                            | APPLICABLE    |
| EXT-06 | RFC 9700 OAuth Security BCP             | IETF                           | BCP 240             | OAuth token lifecycle, rotation, SLA                              | https://www.rfc-editor.org/rfc/rfc9700                   | APPLICABLE    |
| EXT-07 | OpenAPI Specification                   | OpenAPI Initiative             | 3.2.0               | API contract versioning; deprecation governance                   | https://spec.openapis.org/oas/latest.html                | APPLICABLE    |
| EXT-08 | OpenTelemetry Specification             | CNCF                           | Latest official     | Telemetry; drift/SLO monitoring                                   | https://opentelemetry.io/docs/specs/                     | APPLICABLE    |
| EXT-09 | SLSA v1.2 + Sigstore                    | OpenSSF / Sigstore             | v1.2                | Provenance; supply-chain integrity in dependency upgrades         | https://slsa.dev/spec/v1.2/                              | APPLICABLE    |
| EXT-10 | NIST SSDF SP 800-218 v1.1               | NIST                           | v1.1                | Secure dependency and patch management                            | https://csrc.nist.gov/pubs/sp/800/218/final              | APPLICABLE    |
| EXT-11 | GDPR                                    | European Union                 | 2016/679            | Data retention, rights, deletion lifecycle                        | https://eur-lex.europa.eu/eli/reg/2016/679/oj            | APPLICABLE    |
| EXT-12 | EU AI Act                               | European Union                 | 2024 (in force)     | AI transparency, high-risk classification, oversight              | https://digital-strategy.ec.europa.eu/                   | APPLICABLE    |
| EXT-13 | India DPDP Rules 2025                   | Ministry of Electronics and IT | 2025                | Privacy duties; data principal rights; breach response            | https://www.meity.gov.in/                                | APPLICABLE    |
| EXT-14 | FERPA / COPPA guidance                  | US ED / FTC                    | Current             | Student and under-13 controls; annual review                      | https://studentprivacy.ed.gov/                           | APPLICABLE    |
| EXT-15 | Gmail API Push Notifications            | Google                         | Current             | Watch renewal cadence; connector lifecycle                        | https://developers.google.com/gmail/api/guides/push      | APPLICABLE    |
| EXT-16 | GitHub App Permissions                  | GitHub                         | Current             | Fine-grained permissions; connector lifecycle review              | https://docs.github.com/en/apps/                         | APPLICABLE    |
| EXT-17 | Arazzo Specification                    | OpenAPI Initiative             | 1.1.0               | Machine-readable multi-step workflow deprecation tracking         | https://spec.openapis.org/                               | APPLICABLE    |

---

## Conflict Resolution Log

| Conflict                                   | Sources                          | Resolution                                                      | Owner            | Date       |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------- | ---------------- | ---------- |
| WCAG 2.2 minor keyboard gap (FIND-P20-003) | EXT-05 vs. current UI state      | Tracked in improvement backlog; DEL-ENT-P21-01                  | Frontend Lead    | 2026-09-29 |
| EU AI Act staged transparency obligations  | EXT-12 vs. current disclosure UI | Professional legal review required; DEL-ENT-P21-04 roadmap item | Legal/Compliance | 2026-09-29 |

---

_Owner:_ Architecture Review Board  
_Approved:_ 2026-09-29  
_Next review:_ 2027-01-01 (quarterly)
