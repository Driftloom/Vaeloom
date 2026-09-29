# ENT-P13 Source Register

**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** Security Architect  
**Reviewer:** Privacy Engineer + Compliance Specialist  
**Date:** 2026-09-29  
**Status:** ACTIVE

---

## Internal Sources (INT)

| ID     | Source                                                                           | Owner/Authority       | Use                                                                  | Location                             | Verified |
| ------ | -------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- | ------------------------------------ | -------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md                    | Vaeloom source team   | Governing 32-section prompt; evidence, DoR/DoD, gate and remediation | `specs/phase-contracts/`             | ✅       |
| INT-02 | ENT-P12 handoff + gate report                                                    | AI Safety Lead / CISO | Predecessor authorization baseline                                   | `evidence/phases/ent/ent-p12/`       | ✅       |
| INT-03 | `apps/api/src/api/` — full source tree                                           | Engineering           | Backend implementation state; middleware, auth, RLS, agents          | Repository HEAD                      | ✅       |
| INT-04 | `apps/api/tests/` — full test suite                                              | QA Lead               | 731 test baseline; security suite 404/404; live cognitive 31/31      | Repository HEAD                      | ✅       |
| INT-05 | `specs/ai/REGISTRY_INDEX.md`                                                     | AI Safety Lead        | 28-agent roster; autonomy tiers; tool trust tiers                    | `specs/ai/REGISTRY_INDEX.md`         | ✅       |
| INT-06 | `apps/api/src/api/schemas/memory.py`                                             | Data Architect        | 22 MemoryType literals; model validators; supersedes_id              | `apps/api/src/api/schemas/memory.py` | ✅       |
| INT-07 | `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md`                                   | Security Architect    | ~25 tables with `USING (true)` service policies; remediation plan    | `docs/security/`                     | ✅       |
| INT-08 | `docs/adr/` — ADR-001..036                                                       | Architecture Board    | Approved architectural decisions; no silent overrides                | `docs/adr/`                          | ✅       |
| INT-09 | `specs/phase-contracts/03-enterprise/ENT-P13-security-privacy-and-compliance.md` | Program owner         | Phase contract; scope, deliverables, gate                            | `specs/phase-contracts/`             | ✅       |
| INT-10 | `apps/api/src/api/middleware/` — auth, CORS, rate-limit, CSRF, tenant            | Security Architect    | Live middleware stack; zero-trust enforcement chain                  | Repository HEAD                      | ✅       |

---

## External Sources (EXT)

| ID     | Standard/Source                                  | Verified Snapshot                        | Applicability                       | Required Use                                                                       |
| ------ | ------------------------------------------------ | ---------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| EXT-01 | MCP Specification 2026-07-28                     | 2026-07-28                               | Plugin/MCP server integration       | Version-pinned MCP profile; authorization; compatibility testing                   |
| EXT-02 | OWASP Agentic Applications Top 10 — 2026 edition | 2026                                     | 28-agent cognitive pipeline         | Goal hijack; tool misuse; identity/privilege abuse; supply chain; memory poisoning |
| EXT-03 | OWASP LLM Applications Top 10 — 2025 edition     | 2025                                     | System 1 (Jev) + System 2 (Gemma 4) | Prompt injection; unsafe output; sensitive disclosure; excessive agency            |
| EXT-04 | NIST AI RMF 1.0 + Generative AI Profile          | Official current                         | AI governance                       | Govern/Map/Measure/Manage; evaluation; human oversight; residual-risk ownership    |
| EXT-05 | WCAG 2.2 — W3C Recommendation                    | 2023-10-05                               | Frontend UI                         | Level AA complete-process; automated and manual evidence                           |
| EXT-06 | RFC 9700 — OAuth 2.0 Security BCP (BCP 240)      | 2025-01                                  | SSO/OIDC flows                      | Exact redirect matching; PKCE; replay resistance; constrained tokens               |
| EXT-07 | RFC 9728 — Protected Resource Metadata           | 2025                                     | MCP OAuth resource                  | OAuth/MCP resource metadata                                                        |
| EXT-08 | OpenAPI Specification 3.2.0                      | 2024                                     | 241-path API (openapi.yaml)         | Machine-readable HTTP contracts; version pinning                                   |
| EXT-09 | OpenTelemetry Specification — CNCF               | Current (2026)                           | Distributed tracing                 | Trace/metric/log context; semantic conventions; privacy-aware telemetry            |
| EXT-10 | SLSA v1.2 + Sigstore                             | 2024                                     | CI/CD pipeline                      | Build/source provenance; artifact integrity; supply-chain evidence                 |
| EXT-11 | NIST SSDF SP 800-218 v1.1                        | 2023                                     | Software development lifecycle      | Secure development practices; evidence documentation                               |
| EXT-12 | Gmail API Push Notifications                     | Current Google API                       | Gmail connector                     | Watch renewal; reconciliation; least-privilege scopes                              |
| EXT-13 | GitHub App Permissions                           | Current GitHub Docs                      | GitHub connector                    | Fine-grained least privilege; app permissions; quotas                              |
| EXT-14 | GDPR — EU Regulation 2016/679                    | Fully in force                           | EU user data                        | Privacy; data rights; lawful basis; processors; breach duties                      |
| EXT-15 | EU AI Act                                        | Transparency obligations from 2026-08-02 | AI system classification            | AI disclosure; use-case classification; documentation; oversight                   |
| EXT-16 | India DPDP Rules 2025                            | Staged commencement verified             | India-region users                  | Notice/consent; rights; children's data; security; breach duties                   |
| EXT-17 | FERPA — 34 CFR Part 99                           | Current ED guidance                      | Institution/student data            | Institution-controlled education-record roles; contracts                           |
| EXT-18 | COPPA — FTC Revised Rule + guidance              | Current                                  | Under-13 exclusion                  | Age gate; parental consent controls; child-directed design                         |

---

## Conflict Resolution Log

| Conflict                                                    | Sources in conflict | Resolution                                                                                                          | Owner            | Date       |
| ----------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| GDPR vs DPDP consent models                                 | EXT-14 vs EXT-16    | Highest-common-denominator: explicit opt-in always required; purpose-specific granular consent                      | Privacy Engineer | 2026-09-29 |
| EU AI Act transparency vs product UX                        | EXT-15 vs INT-05    | AI-disclosure banner implemented at system entry; legal review required before self-declaring compliance            | Legal Reviewer   | 2026-09-29 |
| FERPA institution visibility vs individual memory ownership | EXT-17 vs INT-05    | Individual memory immutable; institution can only access records they directly created under an active ConsentGrant | Privacy Engineer | 2026-09-29 |

---

_Register version: 1.0.0 — Security Architect — 2026-09-29_
