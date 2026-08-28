# MVP-P04 — 01. Source Register

> Prompt §4 + §15. Standards overlay re-verified **2026-08-15** (phase start);
> conflicts recorded; secondary sources are contextual only. Supersedes prior
> P04 run 2026-08-07 (`01-source-register-2026-08-07.md`, history preserved).

## 1. Internal sources (INT)

| ID | Source | Owner/authority | Use | Status |
| ------ | --------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Source team | Governing 32-section contract, gate, remediation | Available (substitute = gatekeeper compendium) |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md` | Source team | Authoritative MVP corrections/hardening; SHA-256 `2FA8966F…69640` re-verified 2026-08-07 | Available |
| INT-03 | `vaeloom-mvp-e2e.md` | Source team | MVP 0–21 baseline | Available |
| INT-04 | `vaeloom-enterprise-e2e.md` | Source team | Enterprise baseline (context only) | Available |
| INT-05 | `01-vaeloom-mvp-spec.md` | Source team | Canonical MVP scope (`docs/01-vaeloom-mvp-spec.md`) | Available |
| INT-06 | `06-vaeloom-enterprise-paper.md` | Source team | Enterprise vision (context) | Available |
| INT-07 | `02-system-architecture.md` | Source team | Architecture intent | Available |
| INT-08 | `03-agent-workflow.md` | Source team | Agent/approval flow intent | Available |
| INT-09 | `04-memory-knowledge-graph.md` | Source team | Memory/RAG intent | Available |
| INT-10 | gap/completion reports | Source team | Docs maturity ONLY — never runtime evidence | Available |
| REPO | `master` @ `dac2630` (P03 CLOSED 2026-08-14) | Engineering | Outranks design prose for actual state | Available, clean tree |

## 2. External standards (EXT) — overlay re-verified 2026-08-15

| ID | Standard | Snapshot | Use | Applicability |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| EXT-01 | MCP Specification | 2026-07-28 (pinned) | Pinned MCP profile | APPLICABLE (connectors/mcp) |
| EXT-02 | OWASP Agentic Top 10 | 2026 | Agent/tool/memory risks | APPLICABLE (P12/P13) |
| EXT-03 | OWASP GenAI LLM Top 10 | **2026** (pub 2026-08-04) | Injection/excessive agency | APPLICABLE (P12/P13) — **supersedes 2025 release (archived)** |
| EXT-04 | NIST AI RMF 1.0 + GenAI profile | Official | AI governance/eval | APPLICABLE |
| EXT-05 | WCAG 2.2 | W3C Rec (ISO/IEC 40500:2025) | AA accessibility | APPLICABLE (P09/P10) |
| EXT-06 | RFC 9700 OAuth BCP | IETF | OAuth security | APPLICABLE (P08/P13) |
| EXT-07 | RFC 9728 Protected Resource Metadata | IETF | OAuth/MCP resource metadata | APPLICABLE (P08, carried from P03) |
| EXT-08 | OpenAPI 3.2.0 | current | HTTP contracts | APPLICABLE (P08) |
| EXT-09 | OpenTelemetry | latest | Telemetry | APPLICABLE (P16/P17; repo has OTel) |
| EXT-10 | SLSA v1.2 + Sigstore | current | Provenance | DEFER (release evidence P19) |
| EXT-11 | NIST SSDF SP 800-218 v1.1 | Final | Secure dev | APPLICABLE (P06/P13) |
| EXT-12 | Gmail API push/quotas | verify at P07 | Watch renewal, quotas | APPLICABLE (P07; MVP=polling DEC-P02-01) |
| EXT-13 | GitHub App Permissions | verify at P08 | Least privilege | APPLICABLE (P08) |
| EXT-14 | GDPR | current | — | NOT_APPLICABLE (India launch; re-check if EU users at P13) |
| EXT-15 | EU AI Act | **Art. 50 in force 2026-08-02** (verified 2026-08-15; marking grace to 2026-12-02) | Transparency obligations | UNDER REVIEW — India launch; re-verify EU-user applicability at P13 |
| EXT-16 | DPDP Act + DPDP Rules 2025 | **staged: 13-Nov-2025 / 13-Nov-2026 / 13-May-2027** (verified 2026-08-15) | India privacy duties | APPLICABLE (P13; design-to-both, ASP-P03-02) |
| EXT-17 | FERPA/COPPA | current | — | NOT_APPLICABLE (18+, not institutions) |

> Web re-verification 2026-08-15 (EXTERNAL_VERIFIED): EU AI Act Art. 50
> transparency obligations apply from **2026-08-02** (EC guidance; marking
> obligation grace to **2026-12-02** for systems placed on market before
> 2026-08-02) —
> https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
> · DPDP Act/Rules staged commencement: 13-Nov-2025 (commencement + DPB),
> 13-Nov-2026 (consent managers), 13-May-2027 (substantive: consent/notice/
> rights/security) — MeitY gazette 13-Nov-2025 (sources: AMSS, CADP,
> CMS-IndusLaw) · OWASP GenAI LLM Top 10 **2026** published 2026-08-04, current
> release, 2025 archived —
> https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/.

## 3. Conflict log

| ID | Conflict | Resolution | Authority | Date |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| CF-P04-01 | Prompt §3 lists "Next.js, NestJS, FastAPI" architecture; repo has Next.js (`apps/web`) + FastAPI (`apps/api`), no NestJS | Repo truth outranks prose (carried CF-P03-02); roadmap/architecture phases target actual repo | REPO > INT-05 > prompt | 2026-08-07 |
| CF-P04-02 | Prompt track exclusions list "unsupported job-platform automation" | DEC-P02-05 (user) supersedes: T1 lawful automation in MVP; T2/T3 gated proposals-only (DEC-P03-01) | User decision | 2026-08-07 |
| CF-P04-03 | Prompt architecture lists "apps/core-api, apps/ai-service"; repo reality = `apps/web` + `apps/api` (FastAPI monolith-style) | Planning targets `apps/api` as the API/AI host; contracts split deferred to P07/P08 | REPO > prompt | 2026-08-15 |
| CF-P04-04 | P03 re-run (2026-08-14) supersedes prior P03 baseline that prior P04 run (2026-08-07) consumed | P04 re-run consumes P03 re-run baseline (`23cc0b4`/close `dac2630`), not the 2026-08-07 P03 run | EXECUTION-STATUS | 2026-08-15 |
