# ENT-P20 — Source Register

| Field             | Value                                |
| ----------------- | ------------------------------------ |
| **Phase**         | ENT-P20 — Post-Deployment Validation |
| **Register date** | 2026-09-29                           |
| **Owner**         | Platform Engineering Agent           |
| **Version**       | 1.0.0                                |

---

## Internal Sources (INT-01..10)

| ID     | Source                                                                | Owner/Authority     | Use                                                                           | Location | Version/Date        | Status       |
| ------ | --------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- | -------- | ------------------- | ------------ |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`       | Vaeloom source team | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation contract | `specs/` | 2026-08-04 snapshot | VERIFIED     |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md`                              | Vaeloom source team | Authoritative MVP corrections and hardening decisions                         | `specs/` | 2026-08-04          | VERIFIED     |
| INT-03 | `vaeloom-mvp-e2e.md`                                                  | Vaeloom source team | MVP Phase 0–21 execution baseline                                             | `specs/` | 2026-08-04          | VERIFIED     |
| INT-04 | `vaeloom-enterprise-e2e.md`                                           | Vaeloom source team | Enterprise Phase 0–21 execution baseline                                      | `specs/` | 2026-08-04          | VERIFIED     |
| INT-05 | `01-vaeloom-mvp-spec.md`                                              | Vaeloom source team | Canonical MVP product scope; `05-vaeloom-mvp-spec.md` superseded              | `specs/` | 2026-08-04          | VERIFIED     |
| INT-06 | `06-vaeloom-enterprise-paper.md`                                      | Vaeloom source team | Canonical enterprise vision; `vaeloom-enterprise-paper.md` superseded         | `specs/` | 2026-08-04          | VERIFIED     |
| INT-07 | `02-system-architecture.md`                                           | Vaeloom source team | Memory-first architecture; global control-plane + region cells                | `specs/` | 2026-08-04          | VERIFIED     |
| INT-08 | `03-agent-workflow.md`                                                | Vaeloom source team | 28-agent roster, HITL approval flow, tool-use contracts                       | `specs/` | 2026-08-04          | VERIFIED     |
| INT-09 | `04-memory-knowledge-graph.md`                                        | Vaeloom source team | 22 memory types, RAG pipeline, provenance chain                               | `specs/` | 2026-08-04          | VERIFIED     |
| INT-10 | `00-gap-analysis-report.md` + `00-documentation-completion-report.md` | Vaeloom source team | Documentation maturity context only — NOT runtime evidence                    | `specs/` | 2026-08-04          | CONTEXT ONLY |

---

## External Sources (EXT-01..10)

| ID     | Source                                  | Owner/Authority    | Use                                                                                                     | Location                                                 | Version/Date       | Applicability                                |
| ------ | --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------ | -------------------------------------------- |
| EXT-01 | MCP Specification                       | MCP maintainers    | Version-pinned MCP profile, authorization, tasks/extensions; plugin manifest validation                 | https://modelcontextprotocol.io/specification/2026-07-28 | 2026-07-28         | APPLICABLE — production plugin validation    |
| EXT-02 | OWASP Agentic Applications Top 10       | OWASP              | Goal hijack, tool misuse, identity/privilege abuse, supply-chain, context-poisoning risks in production | https://owasp.org/                                       | 2026 edition       | APPLICABLE — security validation workstream  |
| EXT-03 | OWASP LLM Applications Top 10           | OWASP              | Prompt injection, unsafe output handling, sensitive disclosure, excessive agency                        | https://owasp.org/                                       | 2025 edition       | APPLICABLE — AI eval and security workstream |
| EXT-04 | NIST AI RMF 1.0 + Generative AI Profile | NIST               | Govern/Map/Measure/Manage; AI evaluation; documentation; human oversight                                | https://www.nist.gov/itl/ai-risk-management-framework    | Current official   | APPLICABLE — AI quality monitoring           |
| EXT-05 | WCAG 2.2                                | W3C                | Level AA accessibility; automated and manual evidence in post-launch UA validation                      | https://www.w3.org/TR/WCAG22/                            | W3C Recommendation | APPLICABLE — user acceptance workstream      |
| EXT-06 | RFC 9700 OAuth Security BCP             | IETF               | Production OAuth/OIDC/PKCE enforcement; token replay resistance                                         | https://www.rfc-editor.org/rfc/rfc9700                   | BCP 240            | APPLICABLE — security production validation  |
| EXT-07 | RFC 9728 Protected Resource Metadata    | IETF               | MCP resource server metadata in production                                                              | https://www.rfc-editor.org/rfc/rfc9728                   | Current            | APPLICABLE — MCP plugin validation           |
| EXT-08 | OpenAPI Specification 3.2.0             | OpenAPI Initiative | Machine-readable HTTP contracts; production API contract verification                                   | https://spec.openapis.org/oas/latest.html                | 3.2.0              | APPLICABLE — smoke test contract checks      |
| EXT-09 | OpenTelemetry Specification             | CNCF               | Trace/metric/log context; semantic conventions; privacy-aware telemetry in production                   | https://opentelemetry.io/docs/specs/                     | Latest official    | APPLICABLE — monitoring and observability    |
| EXT-10 | SLSA v1.2 + Sigstore                    | OpenSSF/Sigstore   | Build provenance; artifact integrity; supply-chain evidence for `v1.0.0` tag                            | https://slsa.dev/spec/v1.2/                              | v1.2               | APPLICABLE — evidence bundle                 |

---

## Additional External Sources

| ID     | Source                                      | Use                                                                              | Version                  | Status                                          |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| EXT-11 | NIST SSDF SP 800-218 v1.1                   | Secure development practices; post-deployment security evidence                  | v1.1                     | APPLICABLE                                      |
| EXT-12 | Gmail API Push Notifications                | Watch renewal and reconciliation validation in production                        | Current                  | APPLICABLE                                      |
| EXT-13 | GitHub App Permissions                      | Fine-grained least privilege; production connector audit                         | Current                  | APPLICABLE                                      |
| EXT-14 | GDPR                                        | Privacy/data rights; production consent enforcement                              | OJ 2016/679              | APPLICABLE — professional legal review required |
| EXT-15 | EU AI Act                                   | AI disclosure; use-case classification; transparency obligations from 2026-08-02 | Current                  | APPLICABLE — professional legal review required |
| EXT-16 | Digital Personal Data Protection Rules 2025 | India privacy duties; production data residency                                  | Staged commencement 2025 | APPLICABLE — professional legal review required |
| EXT-17 | FERPA + COPPA guidance                      | Student and under-13 privacy; institutional tenant controls                      | Current                  | APPLICABLE where applicable tenants exist       |

---

## Conflict Resolution

| Conflict                                                                                   | Resolution                                                  | Owner            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------- |
| `vaeloom-enterprise-paper.md` (superseded) vs `06-vaeloom-enterprise-paper.md` (canonical) | Canonical version governs; superseded used for context only | Architecture     |
| `05-vaeloom-mvp-spec.md` (superseded) vs `01-vaeloom-mvp-spec.md` (canonical)              | Canonical version governs                                   | Product          |
| Documentation prose vs repository/runtime evidence                                         | Repository and runtime evidence outrank all design prose    | Engineering Lead |

---

_Register closed: 2026-09-29T22:51 IST_
