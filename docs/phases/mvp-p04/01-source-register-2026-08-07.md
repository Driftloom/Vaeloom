# MVP-P04 — 01. Source Register

> Prompt §4 + §15. Version/date/applicability verified at phase start; conflicts
> recorded; secondary sources are contextual only.

## 1. Internal sources (INT)

| ID     | Source                                                          | Owner/authority | Use                                                                                      | Status                                         |
| ------ | --------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Source team     | Governing 32-section contract, gate, remediation                                         | Available (substitute = gatekeeper compendium) |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Source team     | Authoritative MVP corrections/hardening; SHA-256 `2FA8966F…69640` re-verified 2026-08-07 | Available                                      |
| INT-03 | `vaeloom-mvp-e2e.md`                                            | Source team     | MVP 0–21 baseline                                                                        | Available                                      |
| INT-04 | `vaeloom-enterprise-e2e.md`                                     | Source team     | Enterprise baseline (context only)                                                       | Available                                      |
| INT-05 | `01-vaeloom-mvp-spec.md`                                        | Source team     | Canonical MVP scope (`docs/01-vaeloom-mvp-spec.md`)                                      | Available                                      |
| INT-06 | `06-vaeloom-enterprise-paper.md`                                | Source team     | Enterprise vision (context)                                                              | Available                                      |
| INT-07 | `02-system-architecture.md`                                     | Source team     | Architecture intent                                                                      | Available                                      |
| INT-08 | `03-agent-workflow.md`                                          | Source team     | Agent/approval flow intent                                                               | Available                                      |
| INT-09 | `04-memory-knowledge-graph.md`                                  | Source team     | Memory/RAG intent                                                                        | Available                                      |
| INT-10 | gap/completion reports                                          | Source team     | Docs maturity ONLY — never runtime evidence                                              | Available                                      |
| REPO   | `master` @ `8e7d9eb`                                            | Engineering     | Outranks design prose for actual state                                                   | Available, clean tree                          |

## 2. External standards (EXT)

| ID     | Standard                        | Snapshot            | Use                        | Applicability                                  |
| ------ | ------------------------------- | ------------------- | -------------------------- | ---------------------------------------------- |
| EXT-01 | MCP Specification               | 2026-07-28          | Pinned MCP profile         | APPLICABLE (connectors/mcp)                    |
| EXT-02 | OWASP Agentic Top 10            | 2026                | Agent/tool/memory risks    | APPLICABLE (P12/P13)                           |
| EXT-03 | OWASP LLM Top 10                | 2025                | Injection/excessive agency | APPLICABLE (P12/P13)                           |
| EXT-04 | NIST AI RMF 1.0 + GenAI profile | Official            | AI governance/eval         | APPLICABLE                                     |
| EXT-05 | WCAG 2.2                        | W3C Rec             | AA accessibility           | APPLICABLE (P09/P10)                           |
| EXT-06 | RFC 9700 OAuth BCP              | IETF                | OAuth security             | APPLICABLE (P08/P13)                           |
| EXT-08 | OpenAPI 3.x                     | current             | HTTP contracts             | APPLICABLE (P08)                               |
| EXT-09 | OpenTelemetry                   | latest              | Telemetry                  | APPLICABLE (P16/P17; repo has OTel)            |
| EXT-10 | SLSA v1.2                       | current             | Provenance                 | DEFER (release evidence P19)                   |
| EXT-11 | NIST SSDF SP 800-218 v1.1       | Final               | Secure dev                 | APPLICABLE (P06/P13)                           |
| EXT-12 | Gmail API push/quotas           | verify at P07       | Watch renewal, quotas      | APPLICABLE (P07; MVP=polling DEC-P02-01)       |
| EXT-16 | DPDP Act + DPDP Rules 2025      | 2025-11-13 notified | India privacy duties       | APPLICABLE (P13; Phase 3 2027-05-13)           |
| EXT-15 | EU AI Act                       | guidance            | Transparency               | NOT_APPLICABLE (India launch; re-check at P13) |
| EXT-14 | GDPR                            | current             | —                          | NOT_APPLICABLE (India launch)                  |
| EXT-17 | FERPA/COPPA                     | current             | —                          | NOT_APPLICABLE (18+, not institutions)         |

## 3. Conflict log

| ID        | Conflict                                                                                                                     | Resolution                                                                                         | Authority              | Date       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| CF-P04-01 | Prompt §3 lists "Next.js, NestJS, FastAPI" architecture; repo has Next.js (`apps/web`) + FastAPI (`apps/backend`), no NestJS | Repo truth outranks prose (carried from CF-P03-02); roadmap/architecture phases target actual repo | REPO > INT-05 > prompt | 2026-08-07 |
| CF-P04-02 | Prompt track exclusions list "unsupported job-platform automation"                                                           | DEC-P02-05 (user) supersedes: T1 lawful automation in MVP; T2/T3 gated (carried from CF-P03-01)    | User decision          | 2026-08-07 |
