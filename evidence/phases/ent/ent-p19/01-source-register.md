# ENT-P19 — Source Register

**Phase:** ENT-P19 — Release Readiness and Production Deployment  
**Version:** 1.0  
**Owner:** Release Manager  
**Date:** 2026-09-29  
**Status:** ACTIVE

---

## Internal Sources (INT-01 .. INT-10)

| ID     | Source                                                          | Owner/Authority     | Use                                                                        | Location                       | Verified   |
| ------ | --------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------- | ------------------------------ | ---------- |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom source team | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation       | `specs/`                       | 2026-09-29 |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Vaeloom source team | Authoritative MVP corrections; release evidence baseline                   | `specs/`                       | 2026-09-29 |
| INT-03 | `vaeloom-mvp-e2e.md`                                            | Vaeloom source team | MVP Phase 0–21 execution baseline                                          | `specs/`                       | 2026-09-29 |
| INT-04 | `vaeloom-enterprise-e2e.md`                                     | Vaeloom source team | Enterprise Phase 0–21 execution baseline                                   | `specs/`                       | 2026-09-29 |
| INT-05 | `01-vaeloom-mvp-spec.md`                                        | Vaeloom source team | Canonical MVP product scope; supersedes `05-vaeloom-mvp-spec.md`           | `specs/`                       | 2026-09-29 |
| INT-06 | `06-vaeloom-enterprise-paper.md`                                | Vaeloom source team | Canonical enterprise vision and compliance targets                         | `specs/`                       | 2026-09-29 |
| INT-07 | `02-system-architecture.md`                                     | Vaeloom source team | Global control-plane + regional cell architecture; 28-agent roster         | `specs/`                       | 2026-09-29 |
| INT-08 | `03-agent-workflow.md`                                          | Vaeloom source team | Agent lifecycle, approval flow, kill switches                              | `specs/`                       | 2026-09-29 |
| INT-09 | `04-memory-knowledge-graph.md`                                  | Vaeloom source team | 22 memory types; RAG pipeline; provenance                                  | `specs/`                       | 2026-09-29 |
| INT-10 | ENT-P18 evidence bundle (all 15 files)                          | ENT-P18 phase team  | Predecessor gate evidence; documentation IA; ADR index; training materials | `evidence/phases/ent/ent-p18/` | 2026-09-29 |

---

## External Sources (EXT-01 .. EXT-10)

| ID     | Source                                  | Owner/Authority    | Use                                                                          | URL                                                      | Version/Date                  | Applicability                     |
| ------ | --------------------------------------- | ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------- | --------------------------------- |
| EXT-01 | Model Context Protocol Specification    | MCP maintainers    | Version-pinned MCP profile; authorization; tasks/extensions; compatibility   | https://modelcontextprotocol.io/specification/2026-07-28 | 2026-07-28                    | APPLICABLE — MCP server ecosystem |
| EXT-02 | OWASP Top 10 for Agentic Applications   | OWASP              | Agent goal hijack; tool misuse; identity/privilege abuse; supply chain risks | https://owasp.org/                                       | 2026 edition                  | APPLICABLE — 28-agent deployment  |
| EXT-03 | OWASP GenAI/LLM Security Top 10         | OWASP              | Prompt injection; unsafe output; sensitive disclosure; excessive agency      | https://owasp.org/                                       | 2025 edition                  | APPLICABLE — LLM integrations     |
| EXT-04 | NIST AI RMF 1.0 + Generative AI Profile | NIST               | Govern/Map/Measure/Manage; evaluation; documentation; human oversight        | https://www.nist.gov/itl/ai-risk-management-framework    | Official profile              | APPLICABLE — AI governance        |
| EXT-05 | WCAG 2.2                                | W3C                | Level AA complete-process accessibility                                      | https://www.w3.org/TR/WCAG22/                            | W3C Recommendation 2023-10-05 | APPLICABLE — UI/web               |
| EXT-06 | RFC 9700 OAuth 2.0 Security BCP         | IETF               | PKCE; exact redirect matching; replay resistance; constrained tokens         | https://www.rfc-editor.org/rfc/rfc9700                   | BCP 240 / 2025                | APPLICABLE — SSO/OIDC/SAML        |
| EXT-07 | OpenAPI Specification 3.2.0             | OpenAPI Initiative | Machine-readable HTTP contracts; 241 endpoint coverage                       | https://spec.openapis.org/oas/latest.html                | 3.2.0                         | APPLICABLE — API surface          |
| EXT-08 | OpenTelemetry Specification             | CNCF               | Trace/metric/log context; semantic conventions; privacy-aware telemetry      | https://opentelemetry.io/docs/specs/                     | Latest stable                 | APPLICABLE — observability        |
| EXT-09 | SLSA v1.2                               | OpenSSF            | Build/source provenance; artifact integrity; supply-chain evidence           | https://slsa.dev/spec/v1.2/                              | v1.2                          | APPLICABLE — release pipeline     |
| EXT-10 | NIST SSDF SP 800-218 v1.1               | NIST               | Secure software-development practices and evidence                           | https://csrc.nist.gov/pubs/sp/800/218/final              | v1.1                          | APPLICABLE — release gate         |

---

## Extended External Sources (EXT-11 .. EXT-17)

| ID     | Source                              | Owner/Authority            | Use                                                                              | URL                                                                       | Version/Date                        | Applicability                         |
| ------ | ----------------------------------- | -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| EXT-11 | GDPR (Regulation EU 2016/679)       | European Union             | Data subject rights; DPA Article 28; lawful basis; breach duty                   | https://eur-lex.europa.eu/eli/reg/2016/679/oj                             | In force                            | APPLICABLE — EU customers             |
| EXT-12 | EU AI Act                           | European Union             | AI disclosure; use-case classification; transparency obligations from 2026-08-02 | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai | 2024 (obligations in force 2026-08) | APPLICABLE — AI features              |
| EXT-13 | India DPDP Act 2023 + Rules 2025    | Government of India        | Notice/consent; rights; children's data; security; breach duty                   | https://www.meity.gov.in/                                                 | Staged commencement 2025            | APPLICABLE — India customers          |
| EXT-14 | FERPA official guidance             | US Department of Education | Institution-controlled education-record roles and contracts                      | https://studentprivacy.ed.gov/                                            | Current                             | CONDITIONAL — if EDU contracts signed |
| EXT-15 | COPPA revised rule                  | FTC                        | Under-13 exclusion; parental consent controls                                    | https://www.ftc.gov/business-guidance/resources/coppa-rule                | Current                             | APPLICABLE — age gates required       |
| EXT-16 | SOC 2 Trust Service Criteria        | AICPA                      | Security/Availability/Confidentiality criteria for Type II audit                 | https://www.aicpa-cima.com/                                               | 2017 TSC                            | APPLICABLE — SOC 2 readiness          |
| EXT-17 | CREST Penetration Testing Standards | CREST                      | Provider qualification; test scope; findings classification                      | https://www.crest-approved.org/                                           | Current                             | APPLICABLE — external pentest         |

---

## Conflict Resolution Log

| Conflict                                                                   | Resolution                                                                                                   | Owner          | Date       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | ---------- |
| GDPR Art.28 vs. internal DPA template                                      | Legal Reviewer to validate final DPA template against Art.28 requirements                                    | Legal Reviewer | 2026-09-29 |
| EU AI Act transparency obligations (active 2026-08-02) vs. launch timeline | Disclosure documentation complete per ENT-P18; Professional legal review required before claiming compliance | Legal Reviewer | 2026-09-29 |

---

_Source register verified: 2026-09-29T22:50:00+05:30_
