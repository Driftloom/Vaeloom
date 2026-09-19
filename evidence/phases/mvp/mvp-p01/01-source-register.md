# MVP-P01 - 01. Source Register (phase-level)

> **Phase:** MVP-P01 - Discovery and Problem Definition **Status:** CLOSED
> 2026-08-13 - re-run gated 74.89/100 (`14-gate-2026-08-13.md`), accepted by
> USER: `PHASE CONDITIONALLY APPROVED - RESTRICTIONS APPLY` (DEC-P01-09);
> zero-trust audit `16-verification-report.md` **Date:** 2026-08-13 (re-run;
> prior run 2026-08-07 superseded) **Owner:** Phase owner (MVP-P01) -
> **Approver:** USER (sole gate authority per BQ-01) **Baseline:** repo `master`
> @ `1def16d` (pushed to origin, 0 ahead / 0 behind, verified 2026-08-13)
> **Register root:** `docs/phases/mvp-p01/`
>
> Sources carried from P00 (verified hashes in
> `docs/phases/mvp-p00/01-source-register.md`) are authoritative unless
> re-verified here. Prior P01 run (gate 2026-08-07, 88/100 CONDITIONAL GO,
> commit `7128e4d`) is a historical record - this re-run refreshes evidence at
> the `1def16d` baseline. New phase-level sources and the standards overlay are
> recorded below.

## 1. Governing authority order (INT-02 sec 0.2, DEC-P00-06)

1. **INT-02** `vaeloom-mvp-e2e-enterprise-hardened.md` - canonical for MVP
 execution (user-supplied, SHA-256 `2FA8966F...69640`)
2. **INT-01 substitute**
 `vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` (3x 22-phase
 32-section gatekeepers, validated ALL PASS 2026-08-04; template file itself
 never uploaded - substitute governs per user decision 2026-08-07, DEC-P00-06)
3. **INT-05** `01-vaeloom-mvp-spec.md` - canonical MVP product scope
 (`docs/01-vaeloom-mvp-spec.md`, SHA-256 `2B1264C6...21E1`)
4. **INT-07/08/09** architecture/workflow/memory intent (canonical design
 intent; repo state outranks prose for implementation truth)
5. **INT-03** `vaeloom-mvp-e2e.md` - MVP 0-21 execution baseline (subordinate to
 INT-02)
6. **MVP-P01 prompt** (this phase's execution contract) - 66-prompt pack,
 SHA-256 per `SHA256SUMS.md` (pack re-verified 75/75, 2026-08-12)

## 2. Phase execution contract

| ID | Source | Class | Use | Verified |
| ----------------------------- | --------------------------------------------- | ---------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| MVP-P01 | `MVP-P01-discovery-and-problem-definition.md` | CANONICAL phase prompt | Mission, roles, scope, DoR/DoD, gate | 2026-08-07 (pack validated); re-run 2026-08-13 |
| 05-cross-track-gate-policy.md | 66-prompt pack | CANONICAL gate policy | GO >=95/0 blockers; conditional 88-94 non-dependent only | 2026-08-07; re-run 2026-08-13 |

## 3. Internal sources (INT-01...12 - carried from P00 register, baseline/date updated)

| ID | Source | Class | Owner/authority | Verified at | Location |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | MISSING TEMPLATE - not in repo/Downloads/any archive; applied output (3-track 32-section gatekeeper compendiums) located 2026-08-07 in `~/Downloads/vaeloom/vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` (validated ALL PASS 2026-08-04); substitute governs (DEC-P00-06) | Vaeloom source team | 2026-08-07 (substitute located) | template not found; substitute zip SHA-256 per zip `SHA256SUMS.md` |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md | **CANONICAL - GOVERNING for MVP (user-supplied)** | Vaeloom source team | 2026-08-06 (user provided; SHA-256 verified `2FA8966F...69640`, 91,469 bytes) \| in-repo copy re-hashed 2026-08-12 `F32A2A85...E55F` (110,343 B) | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` (placed in repo 2026-08-11) - authenticity confirmed |
| INT-03 | vaeloom-mvp-e2e.md | CANONICAL (MVP baseline, subordinate to INT-02) | Vaeloom source team | 2026-08-06 \| in-repo copy re-hashed 2026-08-12 `38540987...D545` (210,008 B) | `docs/vaeloom-mvp-e2e.md` (placed in repo 2026-08-11) |
| INT-04 | vaeloom-enterprise-e2e.md | CANONICAL (enterprise baseline - reference only for MVP) | Vaeloom source team | 2026-08-06 \| in-repo copy re-hashed 2026-08-12 `F22D3F9B...C752A2` (173,278 B) | `docs/vaeloom-enterprise-e2e.md` (placed in repo 2026-08-11) |
| INT-05 | 01-vaeloom-mvp-spec.md | CANONICAL MVP scope | Vaeloom source team | 2026-08-06 | `docs/01-vaeloom-mvp-spec.md` SHA-256 `2B1264C6...21E1` |
| INT-06 | 06-vaeloom-enterprise-paper.md | CANONICAL enterprise vision (reference only) | Vaeloom source team | 2026-08-06 | `docs/06-vaeloom-enterprise-paper.md` SHA-256 `DA1F02C2...F7A7` |
| INT-07 | 02-system-architecture.md | CANONICAL architecture intent | Vaeloom source team | 2026-08-06 | `docs/02-system-architecture.md` SHA-256 `DC966A6E...0920` |
| INT-08 | 03-agent-workflow.md | CANONICAL agent/approval flow intent | Vaeloom source team | 2026-08-06 | `docs/03-agent-workflow.md` SHA-256 `E243B2BD...5025` |
| INT-09 | 04-memory-knowledge-graph.md | CANONICAL memory/RAG intent | Vaeloom source team | 2026-08-06 | `docs/04-memory-knowledge-graph.md` SHA-256 `3F651453...858A` |
| INT-10 | 00-gap-analysis-report.md + 00-documentation-completion-report.md | DOCS-MATURITY ONLY - never runtime evidence | Vaeloom source team | 2026-08-06 | `docs/00-gap-analysis-report.md` `7430299D...6283`; `docs/00-documentation-completion-report.md` `5F9F2B85...5DF00` |
| INT-11 | MVP-P01 prompt (this phase's governing execution contract) | CANONICAL for this phase | 66-prompt pack | 2026-08-06 (pack validated); re-run 2026-08-13; SHA-256 per `SHA256SUMS.md` (pack 75/75 verified 2026-08-12) | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P01-discovery-and-problem-definition.md` |
| INT-12 | 66-prompt pack manifest + master index + SHA256SUMS | CANONICAL (prompt set integrity) | 66-prompt pack | 2026-08-06; **re-verified 2026-08-12 - 75/75 SHA256SUMS matches, 0 failures** | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/` (76 files incl. live `EXECUTION-STATUS.md` overlay, SHA-256 verified vs `SHA256SUMS.md`) |

## 4. External standards register (EXT-01...19 - prompt sec 4 rows exactly; EXT-18/19 carried from P00)

| ID | Standard | Owner/authority | Use | Location |
| ------ | ------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| EXT-01 | MCP Specification 2026-07-28 | MCP maintainers | Protocol/security/interoperability | https://modelcontextprotocol.io/specification/2026-07-28 |
| EXT-02 | OWASP Agentic Applications Top 10 2026 | OWASP | Agent/tool/memory/identity risks | https://owasp.org/ |
| EXT-03 | OWASP LLM Applications Top 10 2025 | OWASP | Prompt injection, leakage, excessive agency | https://owasp.org/ |
| EXT-04 | NIST AI RMF + Generative AI Profile | NIST | AI governance and evaluation | https://www.nist.gov/itl/ai-risk-management-framework |
| EXT-05 | WCAG 2.2 | W3C | AA accessibility | https://www.w3.org/TR/WCAG22/ |
| EXT-06 | RFC 9700 OAuth Security BCP | IETF | OAuth security | https://www.rfc-editor.org/rfc/rfc9700 |
| EXT-07 | RFC 9728 Protected Resource Metadata | IETF | OAuth/MCP resource metadata | https://www.rfc-editor.org/rfc/rfc9728 |
| EXT-08 | OpenAPI Specification 3.2.0 | OpenAPI Initiative | Current API contract | https://spec.openapis.org/oas/latest.html |
| EXT-09 | OpenTelemetry Specification | CNCF | Telemetry/context propagation | https://opentelemetry.io/docs/specs/ |
| EXT-10 | SLSA v1.2 and Sigstore | OpenSSF/Sigstore | Provenance and signing | https://slsa.dev/spec/v1.2/ |
| EXT-11 | NIST SSDF SP 800-218 v1.1 | NIST | Secure development | https://csrc.nist.gov/pubs/sp/800/218/final |
| EXT-12 | Gmail API Push Notifications | Google | Watch renewal and reconciliation | https://developers.google.com/gmail/api/guides/push |
| EXT-13 | GitHub App Permissions | GitHub | Fine-grained least privilege | https://docs.github.com/en/apps/ |
| EXT-14 | GDPR | European Union | Privacy/data rights | https://eur-lex.europa.eu/eli/reg/2016/679/oj |
| EXT-15 | EU AI Act | European Union | AI use-case classification | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai |
| EXT-16 | Digital Personal Data Protection Rules 2025 | Government of India | India privacy/child-data duties | https://www.meity.gov.in/ |
| EXT-17 | FERPA and COPPA guidance | US ED/FTC | Student and under-13 privacy | https://studentprivacy.ed.gov/ |
| EXT-18 | Protobuf/Python compatibility (actual env truth) | EXTERNAL_VERIFIED (env) | protobuf 4.25.9 incompatible with Python 3.14.6 - blocks OTEL import unless `OTEL_SDK_DISABLED=true` (carry to P17) | P00 register sec 3 (EVD-MVP-P00-004 env contract) |
| EXT-19 | Arazzo Specification 1.1.0 | OpenAPI Initiative | Optional machine-readable multi-call workflows/dependencies (reference only) | https://spec.openapis.org/arazzo/latest.html |

**Standard decisions:** re-verify version/applicability at every phase start;
record owner/control-mapping/evidence per standard in the phase register.
Professional legal review required before any compliance claim; none
self-claimed here.

## 5. Standards overlay (15 standards - prompt lines 47-70, verified at phase start 2026-08-13)

> For a DISCOVERY phase no runtime control is implemented here; each row names
> the owning phase where the control is implemented and recorded (same pattern
> as the P00 register's standards note). Verification evidence is `NOT_EXECUTED`
> until the owning phase attaches it.

| # | Standard | Verified snapshot | Applicability to P01 (DISCOVERY) | Decision owner | Control mapping (phase where implemented) | Verification evidence status |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------- | ----------------------------------------- |
| 1 | Model Context Protocol specification | 2026-07-28 (pinned per prompt; re-verify at use) | Framing only - version-pinned profile/authorization controls belong to P08; P01 records risk | Architecture | P08 (MCP pinning) | NOT_EXECUTED (owned P08) |
| 2 | OWASP Top 10 for Agentic Applications | 2026 edition | Input to trust/safety constraints + value/risk hypotheses (WS-01.3); no control in P01 | Security | P13 (agent/tool/memory/identity controls) | NOT_EXECUTED (owned P13) |
| 3 | OWASP GenAI/LLM security guidance | Current official project | Framing for AI risk hypotheses (prompt injection, disclosure, excessive agency) | Security | P13 (LLM controls) | NOT_EXECUTED (owned P13) |
| 4 | NIST AI RMF 1.0 + Generative AI Profile | Official NIST profile | Govern/Map/Measure/Manage framing; AI evaluation design owned later | AI Product | P13 (AI evaluation) | NOT_EXECUTED (owned P13) |
| 5 | WCAG 2.2 | W3C Recommendation | AA target recorded in non-goals/metrics (WS-01.4); no a11y controls in P01 | UX | P14 (WCAG AA verification) | NOT_EXECUTED (owned P14) |
| 6 | OAuth 2.0 Security BCP | RFC 9700 / BCP 240 | Trust/approval UX framing (redirect matching, PKCE, least privilege); contract controls later | Architecture/API | P08 (OAuth/MCP contract design) | NOT_EXECUTED (owned P08) |
| 7 | RFC 9728 Protected Resource Metadata | IETF | Reference for connector/MCP resource-metadata design; framing only | Architecture | P08 (OAuth/MCP contract design) | NOT_EXECUTED (owned P08) |
| 8 | OpenAPI Specification | 3.2.0 current at snapshot | API contract standard recorded; machine-readable contracts owned by P08 | API | P08 (API contracts) | NOT_EXECUTED (owned P08) |
| 9 | Arazzo Specification | 1.1.0 current at snapshot | Optional multi-call workflows - reference only (EXT-19), not required for P01 | Architecture | P08 (optional use) | NOT_EXECUTED (owned P08; optional) |
| 10 | OpenTelemetry | Verify latest official spec at execution - UNKNOWN until P17 re-check | Ops/metrics framing for success metrics; telemetry design owned by P17; import blocked on Py 3.14 unless `OTEL_SDK_DISABLED=true` (EXT-18) | Platform | P17 (observability) | NOT_EXECUTED (owned P17; version UNKNOWN) |
| 11 | SLSA | 1.2 current at snapshot | Supply-chain/provenance framing; controls owned by P16 | Platform | P16 (SLSA/SSDF) | NOT_EXECUTED (owned P16) |
| 12 | NIST SSDF | SP 800-218 v1.1 | Secure-development framing; evidence owned by P16 | Platform | P16 (SLSA/SSDF) | NOT_EXECUTED (owned P16) |
| 13 | EU AI Act official guidance | Transparency obligations applicable from 2026-08-02; other timelines must be re-verified | Classification/disclosure obligations recorded for AI features; legal review owned by P13 | Legal | P13 (legal/AI) | NOT_EXECUTED (owned P13) |
| 14 | India DPDP Act 2023 + final DPDP Rules 2025 | Staged commencement; verify provisions in force | Notice/consent/rights/child-data framing for India 18+ launch scope (BQ-03/04); legal review P13 | Privacy/Legal | P13 (legal/AI) | NOT_EXECUTED (owned P13) |
| 15 | FERPA + COPPA revised rule and FTC guidance + Gmail/GitHub integration docs | FERPA current; COPPA revised rule current; Gmail/GitHub: verify current API versions/scopes | FERPA/COPPA recorded NOT_APPLICABLE for India 18+ launch (BQ-03/04, CF-P01-02), re-check on region/age expansion; Gmail push (EXT-12) + GitHub apps (EXT-13) framing; Gmail watch + draft-only code committed in P11 batch 2 (`929e659`), connector certification owned P08/P13 | Legal / Connector | P13 (legal review) / P08 (connector contracts) | NOT_EXECUTED (owned P08/P13) |

## 6. External research sources (WS-01.1/01.2 - must be cited per claim)

- Official docs only: Google Gmail API, GitHub Apps, job platforms' official
 partner APIs (LinkedIn/Meta/Naukri - verify official programs; no scraping).
- Domain research: NACE/industry employment surveys, India employment/education
 statistics (MoSPI, AISHE), FTC/NCMEC for student-safety guidance.
- Competitive view: publicly documented capabilities of personal assistant /
 job-search AI products (marketing claims != evidence; compare only what is
 observable).

## 7. Conflict resolution log

| ID | Conflict | Resolution | Authority |
| --------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| CF-P01-01 | Marketing/claimed features vs. repo reality | Repo + tests outrank prose; claims require reproducible evidence | Gate policy sec 4 |
| CF-P01-02 | Student-segment privacy (FERPA/COPPA) vs. India 18+ launch | BQ-03/04 approved: India, 18+, individual job seekers -> FERPA/COPPA record as NOT_APPLICABLE for launch, re-check on region expansion | DEC 2026-08-07 |
| CF-P01-03 | Prior P01 run (2026-08-07, 88/100 CONDITIONAL GO) vs. re-run at new baseline | Prior run treated as historical record (gate/register renamed `06-gate-2026-08-07.md`, `07-research-brief-2026-08-07.md`); this re-run refreshes registers + evidence at `1def16d` and re-gates | Plan 2026-08-13 (user-approved re-run) |
