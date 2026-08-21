# MVP-P13 — 01. Source Register

> **Phase:** MVP-P13 — Security, Privacy, and Compliance  
> **Date:** 2026-08-22 · **Baseline:** `0feb7ff` (HEAD) + P13 changes  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P13-security-privacy-and-compliance.md`
> (495 lines, SHA `11e9ebf`)

## Internal Sources

| ID     | Source                                  | Owner               | Use                                         | Location                                                                           | Version/Date | Status   |
| ------ | --------------------------------------- | ------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------ | -------- |
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section execution contract     | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`               | 2026-08-04   | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened             | Vaeloom source team | Authoritative MVP corrections               | `docs/vaeloom-mvp-e2e-enterprise-hardened.md`                                      | 2026-08-04   | VERIFIED |
| INT-03 | MVP E2E Baseline                        | Vaeloom source team | MVP P0–21 baseline                          | `docs/vaeloom-mvp-e2e.md`                                                          | 2026-08-04   | VERIFIED |
| INT-04 | Enterprise E2E Baseline                 | Vaeloom source team | Enterprise baseline (context)               | `docs/vaeloom-enterprise-e2e.md`                                                   | 2026-08-04   | VERIFIED |
| INT-05 | MVP Product Spec                        | Vaeloom source team | Canonical scope — 8 agents, 22 memory types | `docs/01-vaeloom-mvp-spec.md`                                                      | 2026-08-04   | VERIFIED |
| INT-06 | System Architecture                     | Vaeloom source team | 6-layer architecture, memory spine          | `docs/02-system-architecture.md`                                                   | 2026-08-04   | VERIFIED |
| INT-07 | Agent Workflow                          | Vaeloom source team | 10-step workflow, approval gates            | `docs/03-agent-workflow.md`                                                        | 2026-08-04   | VERIFIED |
| INT-08 | Memory & Knowledge Graph                | Vaeloom source team | Memory architecture, RAG, graph             | `docs/04-memory-knowledge-graph.md`                                                | 2026-08-04   | VERIFIED |
| INT-09 | P12 Gate Report                         | P12 owner           | Predecessor gate — 88.4/100 CONDITIONAL     | `docs/phases/mvp-p12/09-gate-report.md`                                            | 2026-08-20   | VERIFIED |
| INT-10 | P12 Handoff                             | P12 owner           | Predecessor handoff to P13                  | `docs/phases/mvp-p12/10-handoff-to-p13.md`                                         | 2026-08-20   | VERIFIED |
| INT-11 | Execution Status                        | Governance          | Live tracking 66 prompts                    | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/EXECUTION-STATUS.md` | 2026-08-22   | VERIFIED |
| INT-12 | P12 Registers                           | P12 owner           | Risks/decisions/assumptions                 | `docs/phases/mvp-p12/08-registers.md`                                              | 2026-08-20   | VERIFIED |
| INT-13 | ADRs                                    | Architecture        | 32 ADRs (001–032) authoritative decisions   | `docs/adr/`                                                                        | 2026-08-04   | VERIFIED |

## External Sources

| ID     | Source                               | Authority          | Required Use                                                                             | Verified Version                                                      | Location           | Status                                  |
| ------ | ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------ | --------------------------------------- |
| EXT-01 | MCP Specification                    | MCP maintainers    | Version-pinned MCP profile, authZ, tasks/extensions                                      | 2026-07-28 (https://modelcontextprotocol.io/specification/2026-07-28) | §4 Source Register | VERIFIED 2026-08-22                     |
| EXT-02 | OWASP Agentic Applications Top 10    | OWASP              | Agent goal hijack, tool misuse, identity/privilege abuse, supply chain, memory poisoning | 2026 edition — identifiers ASI01–ASI10 published 2025-12-09           | §4 Source Register | VERIFIED                                |
| EXT-03 | OWASP LLM Applications Top 10        | OWASP              | Prompt injection, leakage, excessive agency                                              | 2025                                                                  | §4 Source Register | VERIFIED                                |
| EXT-04 | NIST AI RMF + GenAI Profile          | NIST               | Govern/Map/Measure/Manage, evaluation, human oversight                                   | AI 100-1 1.0; GenAI NIST-AI-600-1 (Jul 2024)                          | §4 Source Register | VERIFIED                                |
| EXT-05 | WCAG 2.2                             | W3C                | Level AA accessibility                                                                   | 2.2 Rec (https://www.w3.org/TR/WCAG22/)                               | §4 Source Register | VERIFIED                                |
| EXT-06 | RFC 9700 OAuth Security BCP          | IETF               | Exact redirect, PKCE, replay, constrained tokens                                         | BCP 240 / RFC 9700                                                    | §4 Source Register | VERIFIED                                |
| EXT-07 | RFC 9728 Protected Resource Metadata | IETF               | OAuth/MCP resource metadata                                                              | RFC 9728                                                              | §4 Source Register | VERIFIED                                |
| EXT-08 | OpenAPI Specification                | OpenAPI Initiative | Machine-readable HTTP contracts                                                          | 3.2.0                                                                 | §4 Source Register | VERIFIED — pinned 3.2.0, 88 paths live  |
| EXT-09 | OpenTelemetry                        | CNCF               | Trace/metric/log, semantic conventions                                                   | Latest official                                                       | §4 Source Register | VERIFIED                                |
| EXT-10 | SLSA                                 | OpenSSF            | Build/source provenance                                                                  | 1.2 (https://slsa.dev/spec/v1.2/)                                     | §4 Source Register | NOTED                                   |
| EXT-11 | NIST SSDF                            | NIST               | Secure development                                                                       | SP 800-218 v1.1                                                       | §4 Source Register | VERIFIED                                |
| EXT-12 | Gmail API Push Notifications         | Google             | Watch renewal/reconciliation                                                             | Current — 7-day expiry, daily renewal, historyId                      | §4 Source Register | VERIFIED                                |
| EXT-13 | GitHub App Permissions               | GitHub             | Fine-grained least privilege                                                             | Current (https://docs.github.com/en/apps/)                            | §4 Source Register | VERIFIED                                |
| EXT-14 | GDPR                                 | EU                 | Privacy/data rights                                                                      | https://eur-lex.europa.eu/eli/reg/2016/679/oj                         | §4 Source Register | VERIFIED                                |
| EXT-15 | EU AI Act                            | EU                 | AI use-case classification                                                               | Transparency from 2026-08-02                                          | §4 Source Register | VERIFIED — no high-risk use-case in MVP |
| EXT-16 | India DPDP Rules 2025                | Govt of India      | Notice/consent, rights, children's data                                                  | DPDP Act 2023 + Rules 2025 (staged)                                   | §4 Source Register | VERIFIED                                |
| EXT-17 | FERPA/COPPA guidance                 | US ED/FTC          | Student/under-13 privacy                                                                 | Current                                                               | §4 Source Register | VERIFIED — under-13 excluded            |
| EXT-18 | Bandit/SAST                          | PyCQA              | Static analysis                                                                          | bandit 1.9.4                                                          | Scan               | VERIFIED 2026-08-22                     |
| EXT-19 | pip-audit                            | PyPA               | Dependency vuln scan                                                                     | pip-audit 2.10.1                                                      | Scan               | VERIFIED 2026-08-22                     |

## Verification Notes

- All external standards re-checked at phase start per §15. Versions pinned in
  this register; conflicts resolved in `08-registers.md`.
- MVP scope: single-user, workspace-scoped, Gmail draft-only, 8 agents
  (Orchestrator, Organization, Memory, Resume, ATS, Job Search & Application,
  Gmail, Scheduler), 22 memory types, suggest-mode-first.
- Enterprise exclusions (SSO/SCIM, institution admin, billing, marketplace,
  multi-region cells, cross-user memory) remain disabled per `main.py:258`
  enterprise gate.
