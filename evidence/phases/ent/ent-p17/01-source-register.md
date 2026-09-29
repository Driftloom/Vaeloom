# ENT-P17 Source Register

**Phase:** ENT-P17 — Observability and Operations **Version:** 1.0.0 **Date:**
2026-09-29 **Owner:** Observability Engineer **Status:** VERIFIED

---

## Internal Sources (INT-01..10)

| ID     | Source                                                        | Owner/Authority     | Use                                                                                                                 | Location                       | Version/Hash | Status   |
| ------ | ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------ | -------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Vaeloom source team | Governing 32-section prompt; evidence, DoR/DoD, gate, remediation and handoff contract                              | `specs/`                       | 2026-08-04   | VERIFIED |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md                        | Vaeloom source team | Authoritative MVP corrections, OTel shim finding, Prometheus endpoint status                                        | `specs/`                       | 2026-09-22   | VERIFIED |
| INT-03 | vaeloom-enterprise-e2e.md                                     | Vaeloom source team | Enterprise 0–21 execution baseline; telemetry architecture intent                                                   | `specs/`                       | 2026-08-04   | VERIFIED |
| INT-04 | 02-system-architecture.md                                     | Vaeloom source team | Memory-first architecture; correlation ID implementation; global control plane + region cells                       | `specs/`                       | 2026-08-04   | VERIFIED |
| INT-05 | 06-vaeloom-enterprise-paper.md                                | Vaeloom source team | Canonical enterprise vision; SLO obligations; on-call model; cost visibility                                        | `specs/`                       | 2026-08-04   | VERIFIED |
| INT-06 | AGENTS.md                                                     | Vaeloom engineering | Live implementation status; finding 37 (OTel shim); Prometheus `/metrics` ACTIVE; 1022 tests baseline; pgvector p95 | Root                           | 2026-09-29   | VERIFIED |
| INT-07 | ENT-P13 security invariants (INV-SEC-01..05)                  | Security team       | Security invariants to be inherited by all subsequent phases                                                        | `evidence/phases/ent/ent-p13/` | 1.0.0        | VERIFIED |
| INT-08 | ENT-P14 quality invariants (INV-QA-01..05)                    | QA team             | Quality invariants; 1022/1022 test baseline                                                                         | `evidence/phases/ent/ent-p14/` | 1.0.0        | VERIFIED |
| INT-09 | ENT-P15 SLO/DR validation                                     | SRE                 | 7 SLOs; pgvector p95 14.2ms; RPO/RTO targets                                                                        | `evidence/phases/ent/ent-p15/` | 1.0.0        | VERIFIED |
| INT-10 | ENT-P16 handoff                                               | DevOps Lead         | OTel shim note; pgvector headroom alert; deployment evidence                                                        | `evidence/phases/ent/ent-p16/` | 1.0.0        | VERIFIED |

---

## External Sources (EXT-01..10)

| ID     | Source                                              | Owner/Authority | Use                                                                               | Location                                                                  | Version/Date                   | Applicability                 |
| ------ | --------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ | ----------------------------- |
| EXT-01 | OpenTelemetry Specification — Traces, Metrics, Logs | CNCF OTel       | Semantic conventions; context propagation; OTLP protocol; privacy-aware telemetry | https://opentelemetry.io/docs/specs/                                      | 2026-08 snapshot               | APPLICABLE — core deliverable |
| EXT-02 | OpenTelemetry Semantic Conventions Stable           | CNCF OTel       | HTTP, DB, AI/LLM, messaging attribute naming                                      | https://opentelemetry.io/docs/specs/semconv/                              | v1.27.0                        | APPLICABLE                    |
| EXT-03 | Prometheus Data Model and Exposition Format         | CNCF Prometheus | Metrics format; recording rules; alert expression language                        | https://prometheus.io/docs/instrumenting/exposition_formats/              | 2.x current                    | APPLICABLE                    |
| EXT-04 | EU AI Act — Official guidance                       | European Union  | Transparency obligations from 2026-08-02; use-case classification                 | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai | 2024/1689; in force 2026-08-02 | APPLICABLE — DEL-ENT-P17-05   |
| EXT-05 | NIST AI RMF 1.0 + Generative AI Profile             | NIST            | Govern/Map/Measure/Manage; human oversight; AI incident documentation             | https://www.nist.gov/itl/ai-risk-management-framework                     | 2023 + 2024 GenAI profile      | APPLICABLE                    |
| EXT-06 | OWASP Top 10 for Agentic Applications 2026          | OWASP           | Agent/tool/memory/identity risks in telemetry; PII exposure risks                 | https://owasp.org/                                                        | 2026 edition                   | APPLICABLE                    |
| EXT-07 | GDPR Article 5, 25, 32                              | European Union  | PII exclusion from spans; data minimisation in telemetry; retention limits        | https://eur-lex.europa.eu/eli/reg/2016/679/oj                             | 2016/679                       | APPLICABLE                    |
| EXT-08 | PagerDuty Incident Response Best Practices          | PagerDuty       | On-call rotation; escalation policies; severity taxonomy                          | https://response.pagerduty.com/                                           | 2026                           | APPLICABLE — DEL-ENT-P17-04   |
| EXT-09 | Grafana Dashboard Best Practices                    | Grafana Labs    | Dashboard layout; USE method; tenant health views                                 | https://grafana.com/docs/grafana/latest/                                  | 10.x                           | APPLICABLE — DEL-ENT-P17-03   |
| EXT-10 | NIST SSDF SP 800-218 v1.1                           | NIST            | Secure development for telemetry pipeline; observability supply chain             | https://csrc.nist.gov/pubs/sp/800/218/final                               | v1.1 2024                      | APPLICABLE                    |

---

## Conflict Resolution

| Conflict                                   | Sources in tension                                           | Resolution                                                                          | Owner      |
| ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------- |
| OTel shim for pfi 7.1.0 + FastAPI 0.141.1  | INT-06 (AGENTS.md finding 37) vs INT-04 (clean OTel assumed) | INT-06 wins — shim documented in DEL-ENT-P17-01; upgrade tracked as RISK-ENT-P17-03 | SRE        |
| EU AI Act transparency 2026-08-02 in force | EXT-04 vs project timeline                                   | Obligations ARE in force at phase execution (2026-09-29); DEL-ENT-P17-05 addresses  | Legal/CISO |
| pgvector p95 14.2ms — 0.8ms headroom       | INT-09 (SLO=15ms) vs INT-06                                  | Both confirmed; SLO burn alert mandatory; headroom is pre-existing risk             | SRE        |
