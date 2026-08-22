# MVP-P14 — 01. Source Register

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` (HEAD after P13 remediation) + P14 hardening  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P14-testing-and-quality-engineering.md` §28

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
|---|---|---|---|---|---|---|
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section contract | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | MVP corrections, hardening | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP Spec | Vaeloom source team | 8 agents, 6 memory types (spec 6 vs prompt 22 — spec controls MVP, prompt 22 deferred) | `docs/01-vaeloom-mvp-spec.md` | 2026-07-13 | VERIFIED |
| INT-04 | Architecture 6-layer | Eng Team | Interface→Connectors→Ingestion→Orchestration→Memory→Storage | `docs/02-system-architecture.md` | 2026-07-13 | VERIFIED — desktop/VSCode not implemented, consolidation dead code |
| INT-05 | Agent Workflow | Eng Team | 10-step loop, approval gate | `docs/03-agent-workflow.md` | 2026-07-13 | VERIFIED |
| INT-06 | Memory KG 22 types | Eng Team | KG + vector + 6 MVP types | `docs/04-memory-knowledge-graph.md` | 2026-07-13 | VERIFIED |
| INT-07 | P13 Gate (honest) | Security Arch | Predecessor gate honest 84.4 FAILED / 89 with waivers, 7 EXCs | `docs/phases/mvp-p13/09-gate-report.md` | 2026-08-22 a69d7d7 | VERIFIED |
| INT-08 | P13 Handoff | Security Arch | 37/42 RLS, GDPR 31 tables, JWT 32+, DPIA DRAFT | `docs/phases/mvp-p13/10-handoff-to-p14.md` | 2026-08-22 | VERIFIED |
| INT-09 | P13 Zero-trust audit | Zero-trust auditor | 19 findings F-01..19, file:line | `.agents/findings/P13-zero-trust-audit-2026-08-22.md` | 2026-08-22 | VERIFIED |
| INT-10 | P13 Remediation | Eng | 0019 fail-closed, GDPR 12→31, JWT 27→32+ | `.agents/findings/P13-remediation-2026-08-22.md` | 2026-08-22 a69d7d7 | VERIFIED |
| INT-11 | ADRs 001-032 | Arch | 32 decisions | `docs/adr/` | 2026-08-22 | VERIFIED |
| INT-12 | OpenAPI 88 paths | API | Contract live | `docs/backend/openapi.yaml` | 2026-08-22 a69d7d7 | VERIFIED — 4052 lines diff pending (not committed) |
| INT-13 | AGENTS.md counts | Eng | 2555 tests, 170 unique security | `AGENTS.md:47` | 2026-08-22 a69d7d7 | VERIFIED `pytest --collect-only` 2555 |

## External Sources (re-verified 2026-08-22 via websearch ses_fda)

| ID | Source | Authority | Required Use | Verified Version | Status |
|---|---|---|---|---|---|
| EXT-01 | MCP Spec | MCP maintainers | MCP profile, authZ, tasks/extensions | 2026-07-28 stateless core (`Mcp-Method` header, Tasks extension, auth hardening) | VERIFIED |
| EXT-02 | OWASP Agentic Top10 | OWASP | ASI01-10 (3 new: ASI07 inter-agent, ASI08 cascading, ASI10 rogue) | 2026 edition published 2025-12-09 v2.01 Jun2026 | VERIFIED |
| EXT-03 | OWASP LLM Top10 | OWASP | Prompt injection, leakage, excessive agency | 2025 | VERIFIED |
| EXT-04 | NIST AI RMF | NIST | Govern/Map/Measure/Manage | AI 100-1 + GenAI 600-1 | VERIFIED |
| EXT-05 | WCAG 2.2 | W3C | AA | 2.2 Rec | VERIFIED |
| EXT-06 | RFC 9700 BCP | IETF | PKCE everywhere, exact redirect | BCP 240 Jan2025 | VERIFIED |
| EXT-07 | OpenAPI | OpenAPI Initiative | 3.2.0 contract | 3.2.0 | VERIFIED |
| EXT-08 | SLSA 1.2 | OpenSSF | Provenance | 1.2 | NOTED |
| EXT-09 | NIST SSDF | NIST | SSDF 800-218 v1.1 | v1.1 | VERIFIED |
| EXT-10 | Gmail API Push | Google | 7-day watch, daily renewal, historyId | Current | VERIFIED |
| EXT-11 | GitHub Apps | GitHub | Least privilege fine-grained | Current | VERIFIED |
| EXT-12 | GDPR | EU | Art.20 portability now 31 tables | EU 2016/679 | VERIFIED |
| EXT-13 | DPDP Rules 2025 | India | Staged | 2025 | VERIFIED |
| EXT-14 | FERPA/COPPA | US | Under-13 excluded | Current | VERIFIED |
| EXT-15 | pytest collection | Test infra | `pytest --collect-only -q -o addopts=""` | 2555, 233 security (170 unique) | VERIFIED 2026-08-22 |
| EXT-16 | InsecureKeyLengthWarning | PyJWT | 27-byte HMAC <32 SHA256 | Fixed to 32+ in `conftest.py:9` | FIXED F-07 |
