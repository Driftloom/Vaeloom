# CONT-P00 — 01 Source Register — Canonical Source Authority & Conflict Resolution

**Phase:** `CONT-P00 MVP Handoff Validation and Migration Baseline` | **Mode:**
`DISCOVERY` | **Commit:** `78c2d71` | **Date:** 2026-08-28 **Owners:** Program
Manager (gate), Enterprise Architect (authority), Product Manager (scope),
Security Architect (classification) **Standard:**
`Universal_Enterprise_Phase_Prompt_Generator §4 Source Register` — immutable
snapshots, conflict protocol, `95/100` entry gate

## 1. Inventory Method

- Inspected real repository at `C:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom`
  (`git status --short --branch`, `git rev-parse HEAD 78c2d71`,
  `git log -n 20 --oneline`, `find . -maxdepth 4`,
  `rg TODO|FIXME|NOT_EXECUTED|skip_auth|tenant_id|approval|idempot`).
- Recorded hash/location/owner/scope/limitations per source; classified
  `SOURCE_DESIGN / IMPLEMENTED_UNVERIFIED / EXECUTED_EVIDENCE / SUPERSEDED / CONFLICTING / MISSING / NOT_APPLICABLE`.
- Evidence hierarchy
  `real runtime > WorkflowEnvironment > ainvoke > integration > unit > static > docs`
  — design never promoted to runtime.

## 2. Canonical Source Register

| ID     | Source                                                                                   | Path / Location                                                                                            | Owner / Authority                                                       | Version / Hash                                             | Status                        | Use in this Phase                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`                          | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`                                       | Vaeloom source team — governing execution prompt (32 sections, gate 95) | file: `M` at `78c2d71` (modified by `standardize_docs.py`) | `SOURCE_DESIGN`               | Governing DoR/DoD, gate, remediation, handoff contract — **canonical for all 66 phases**                                                                             |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md`                                                 | `docs/vaeloom-mvp-e2e-enterprise-hardened.md`                                                              | Vaeloom source team — authoritative MVP corrections/hardening           | `M` at HEAD                                                | `EXECUTED_EVIDENCE`           | MVP corrections, release evidence — outranks `vaeloom-mvp-e2e.md` where conflict                                                                                     |
| INT-03 | `vaeloom-mvp-e2e.md`                                                                     | `docs/vaeloom-mvp-e2e.md`                                                                                  | Vaeloom source team — MVP 0–21 baseline                                 | `M`                                                        | `SOURCE_DESIGN` (baseline)    | MVP Phase 0–21 traceability; superseded by `INT-02` on corrections                                                                                                   |
| INT-04 | `vaeloom-enterprise-e2e.md`                                                              | `docs/vaeloom-enterprise-e2e.md`                                                                           | Vaeloom source team — enterprise 0–21 baseline                          | `M`                                                        | `SOURCE_DESIGN`               | Enterprise delta, EFR table — not yet executed (CONT/ENT ⬜)                                                                                                         |
| INT-05 | `01-vaeloom-mvp-spec.md`                                                                 | `docs/01-vaeloom-mvp-spec.md`                                                                              | Vaeloom source team — canonical MVP product scope                       | `M`                                                        | `SOURCE_DESIGN` **canonical** | MVP 8 agents, 6 memories, 10 pages, 5 phases, suggest-mode 95% over 50; **supersedes** `05-vaeloom-mvp-spec.md`                                                      |
| INT-06 | `06-vaeloom-enterprise-paper.md`                                                         | `docs/06-vaeloom-enterprise-paper.md`                                                                      | Vaeloom source team — canonical enterprise vision                       | `M`                                                        | `SOURCE_DESIGN` **canonical** | 28 agents, 22 memories, 20+ connectors, MCP 5.3, consent `EFR-03`                                                                                                    |
| INT-07 | `02-system-architecture.md`                                                              | `docs/02-system-architecture.md`                                                                           | Vaeloom source team — memory-first architecture                         | `M`                                                        | `CONFLICTING` (annotated)     | 6 layers with `NOT IMPLEMENTED/STUB/DEAD CODE` tags `116 Desktop,118 VSCode,145 OCR,189 Consolidation,197 Encrypted storage` — **design vs implementation conflict** |
| INT-08 | `03-agent-workflow.md`                                                                   | `docs/03-agent-workflow.md`                                                                                | Vaeloom source team — agent/approval flow                               | `M`                                                        | `SOURCE_DESIGN`               | 10-step `Resume_draft_v3.pdf → 8 internships → picks 3/8` gate step 8                                                                                                |
| INT-09 | `04-memory-knowledge-graph.md`                                                           | `docs/04-memory-knowledge-graph.md`                                                                        | Vaeloom source team — memory/RAG                                        | `M`                                                        | `CONFLICTING`                 | Title says 22, body says 6 (3a) — resolved below                                                                                                                     |
| INT-10 | `gap/completion + AUDIT`                                                                 | `docs/00-gap-analysis-report.md`, `00-documentation-completion-report.md`, `AUDIT-REPORT.md`               | Vaeloom source team — docs maturity only                                | `M`                                                        | `EXECUTED_EVIDENCE` (docs)    | Never runtime evidence — docs 74→93/100                                                                                                                              |
| INT-11 | `ADR-038/039 + temporal`                                                                 | `docs/adr/ADR-038,039`, `docs/temporal/*.md`, `docs/temporal/langgraph-production-hardening-2026-08-28.md` | Enterprise track — Temporal/LangGraph runtime truth                     | `78c2d71` hardened                                         | `EXECUTED_EVIDENCE`           | **Authoritative runtime** `8 queues 6 workflows 0 imports 20KB` `83 graph/temporal 10 E2E 316 security`                                                              |
| INT-12 | `vaeloom-complete-documentation.md` / `documentation-site.md` / `how-it-works-visual.md` | `docs/vaeloom-*.md`                                                                                        | Vaeloom source team — presentation views                                | `M`                                                        | `SOURCE_DESIGN` secondary     | Context only; resolve conflicts against canonical `01/06/02/03/04`                                                                                                   |
| INT-13 | `docs/phases/mvp-p00..p21 10 files each`                                                 | `docs/phases/mvp-p*/`                                                                                      | Vaeloom source team — phase evidence                                    | `M` at `787053a` baseline                                  | `EXECUTED_EVIDENCE`           | MVP gates 75.69→93.6 APPROVED, `EXECUTION-STATUS MVP TRACK COMPLETE 2026-08-22`                                                                                      |
| INT-14 | `docs/phases/cont-p00`                                                                   | `docs/phases/cont-p00/`                                                                                    | Vaeloom source team — this phase                                        | `NEW` at `78c2d71`                                         | `EXECUTED_EVIDENCE`           | Baseline audit, handoff                                                                                                                                              |

### Superseded / Historical

| ID     | Source                        | Status       | Superseded by                                     |
| ------ | ----------------------------- | ------------ | ------------------------------------------------- |
| SUP-01 | `05-vaeloom-mvp-spec.md`      | `SUPERSEDED` | `INT-05 01-vaeloom-mvp-spec.md` (banner line 1-5) |
| SUP-02 | `vaeloom-enterprise-paper.md` | `SUPERSEDED` | `INT-06 06-vaeloom-enterprise-paper.md`           |
| SUP-03 | `Documents/ zombie`           | `SUPERSEDED` | `docs/README` DEPRECATED per `00-gap:316`         |

## 3. External Standards — Verified Snapshots (2026-08-28)

| ID     | Standard                                  | Snapshot                            | Owner             | Applicability for CONT-P00                                       | Verification                                                              |
| ------ | ----------------------------------------- | ----------------------------------- | ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| EXT-01 | MCP Spec                                  | `2026-07-28` version-pinned profile | MCP maintainers   | Protocol/security/interop for `06 458` plugin/MCP                | https://modelcontextprotocol.io/specification/2026-07-28                  |
| EXT-02 | OWASP Agentic Apps Top 10                 | 2026 edition                        | OWASP             | Agent goal hijack, tool misuse, identity abuse, memory poisoning | https://owasp.org/                                                        |
| EXT-03 | OWASP LLM Top 10                          | 2025                                | OWASP             | Prompt injection, disclosure, excessive agency                   | https://owasp.org/                                                        |
| EXT-04 | NIST AI RMF 1.0 + GenAI Profile           | NIST                                | AI governance     | Govern/Map/Measure/Manage for 28-agent expansion                 | https://www.nist.gov/itl/ai-risk-management-framework                     |
| EXT-05 | WCAG 2.2                                  | W3C Recommendation                  | Accessibility     | `Level AA complete-process` — baseline                           | https://www.w3.org/TR/WCAG22/                                             |
| EXT-06 | OAuth 2.0 Security BCP RFC 9700 / BCP 240 | IETF                                | OAuth             | Exact redirect, PKCE, least privilege                            | https://www.rfc-editor.org/rfc/rfc9700                                    |
| EXT-07 | RFC 9728 Protected Resource Metadata      | IETF                                | OAuth/MCP         | Resource metadata                                                | https://www.rfc-editor.org/rfc/rfc9728                                    |
| EXT-08 | OpenAPI 3.2.0                             | OpenAPI Initiative                  | API contract      | Current `99→110 paths` machine-readable                          | https://spec.openapis.org/oas/latest.html                                 |
| EXT-09 | OpenTelemetry                             | CNCF latest                         | Telemetry         | Trace/metric/log context                                         | https://opentelemetry.io/docs/specs/                                      |
| EXT-10 | SLSA 1.2 + Sigstore                       | OpenSSF                             | Provenance        | Build/source provenance, 12 TF modules                           | https://slsa.dev/spec/v1.2/                                               |
| EXT-11 | NIST SSDF SP 800-218 v1.1                 | NIST                                | Secure dev        | SD practices                                                     | https://csrc.nist.gov/pubs/sp/800/218/final                               |
| EXT-12 | Gmail API Push                            | Google                              | Connector         | Watch renewal/reconciliation                                     | https://developers.google.com/gmail/api/guides/push                       |
| EXT-13 | GitHub App Permissions                    | GitHub                              | Connector         | Fine-grained least privilege                                     | https://docs.github.com/en/apps/                                          |
| EXT-14 | GDPR                                      | EU                                  | Privacy           | Rights, lawful basis                                             | https://eur-lex.europa.eu/eli/reg/2016/679/oj                             |
| EXT-15 | EU AI Act                                 | EU                                  | AI classification | Transparency `2026-08-02`                                        | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai |
| EXT-16 | India DPDP Rules 2025                     | MeitY                               | India privacy     | Staged commencement — re-verify provisions                       | https://www.meity.gov.in/                                                 |
| EXT-17 | FERPA + COPPA                             | US ED/FTC                           | Student/under-13  | Education-record roles, age consent                              | https://studentprivacy.ed.gov/                                            |

## 4. Conflict Resolution Protocol

| Conflict                        | A says                            | B says                                  | Decision Owner                 | Resolution                                                                                                                                                             | Date       |
| ------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C-01 8 vs 28 agents             | `01:149` 8 MVP                    | `06:712` 28 enterprise                  | Enterprise Architect + Product | **MVP 8 is canonical for MVP baseline; 28 is enterprise delta via expand-contract shadow 498** — CONT adds 20 only after shadow+safety evidence, never big-bang        | 2026-08-28 |
| C-02 6 vs 22 memories           | `04:5` title 22 vs `04:15` body 6 | `06:603` 22 enterprise                  | Enterprise Architect           | **6 MVP (`Profile/Document/Career/Episodic/Preference/Working` `04:49`), 22 additive enterprise** — no overwriting provenance, expand-contract mapping                 | 2026-08-28 |
| C-04 `NOT IMPLEMENTED`          | `01:102 Desktop/VSCode` in scope  | `02:116 NOT IMPLEMENTED`                | Enterprise Architect           | **Implementation truth outranks spec prose** — Desktop/VSCode marked `KNOWN LIMITATION NOT_APPLICABLE` for migration, roadmap ENT                                      | 2026-08-28 |
| C-07 Redis vs Temporal          | `PRD 53` Redis/BullMQ MVP         | `temporal/catalog 99` Temporal 8 queues | Enterprise Architect + SRE     | **Temporal is durability authority** (6 workflows, `REJECT_DUPLICATE`), BullMQ `queue_worker` remains only `events` until migration gate §43 — strangler, not big-bang | 2026-08-28 |
| D-01 docs counts 256 vs 218→254 | `README 256` vs gap reports       | filesystem `>580` incl phases/prompts   | Tech Writer                    | **Counts include different scopes; source-of-truth manifest will pin** — DEL-CONT-P00-01 is manifest                                                                   | 2026-08-28 |

**Protocol going forward:** Canonical order
`INT-05/06 > INT-07/08/09 > INT-11 runtime > INT-03/04 baselines > INT-12 presentation`;
superseded marked `SUP-*` never used for acceptance; every future `NEW_DESIGN`
requires compatibility horizon, migration owner, reconciliation metric,
cutover/rollback triggers, and legacy-retirement condition (per CONT prompt
109).

## 5. Claim Labels

For every material claim in this phase, label as `SOURCE_DERIVED`,
`EXTERNAL_VERIFIED`, `NEW_DESIGN`, `STAKEHOLDER_DECISION`,
`IMPLEMENTED_WITH_EVIDENCE`, `NOT_EXECUTED`. A plan is not evidence it ran.

_Example:_ `MVP 8-agent roster SSOT → SOURCE_DERIVED INT-05:149` vs
`Temporal 42/42 RLS → IMPLEMENTED_WITH_EVIDENCE 787053a migration 0020`.

---

**Gate:** `20/20` source authority — register versioned
`CONT-P00 v1.0 2026-08-28`, owned (EntArch), reviewed (SecArch/Privacy/Data),
linked to `EVD-CONT-P00-001..00N`.
