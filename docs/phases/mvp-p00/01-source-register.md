# MVP-P00 — 01. Canonical Source Register

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Status:** BASELINE
> COMPLETE — runtime truth measured 2026-08-06 **Owner:** Phase owner (MVP-P00)
> · **Approver:** TBD (see BQ-01) **Baseline:** repo `master` @
> `bea5fe8c381d435f89352a51c61c0e9fc87b232a` (ahead of origin 4 commits)
> **Register root:** `docs/phases/mvp-p00/`

## 1. Classification legend

| Class               | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| `CANONICAL`         | Authoritative for decisions; conflicts resolve to it    |
| `SUPERSEDED`        | Historical; superseded by a canonical item              |
| `CONFLICTING`       | Contradicts another source; resolution pending/recorded |
| `MISSING`           | Referenced but not found in repo or provided corpus     |
| `NOT_APPLICABLE`    | Out of MVP scope or not used                            |
| `EXTERNAL_VERIFIED` | External standard, verified at snapshot date            |

## 2. Governing and baseline sources

| ID     | Source                                                            | Class                                                                                                                                                                                                                                                                                                                                  | Owner/authority     | Verified at                                                                 | Location                                                                                                                         |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md     | MISSING TEMPLATE — not in repo/Downloads/any archive; **applied output (3-track 32-section gatekeeper compendiums) located 2026-08-07** in `~/Downloads/vaeloom/vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` (validated ALL PASS 2026-08-04); user-supplied INT-02 remains governing for MVP execution (DEC-P00-06) | Vaeloom source team | 2026-08-07 (substitute located)                                             | template not found; substitute zip archived (SHA-256 per zip `SHA256SUMS.md`)                                                    |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md                            | **CANONICAL — GOVERNING for MVP (user-supplied)**                                                                                                                                                                                                                                                                                      | Vaeloom source team | 2026-08-06 (user provided; SHA-256 verified `2FA8966F…69640`, 91,469 bytes) | `C:\Users\Dell\Downloads\vaeloom\vaeloom-mvp-e2e-enterprise-hardened.md` — same content recorded earlier, authenticity confirmed |
| INT-03 | vaeloom-mvp-e2e.md                                                | CANONICAL (MVP baseline, subordinate to INT-02)                                                                                                                                                                                                                                                                                        | Vaeloom source team | 2026-08-06                                                                  | Downloads `vaeloom-mvp-e2e.md` SHA256 `AD8550F5…AFBF`                                                                            |
| INT-04 | vaeloom-enterprise-e2e.md                                         | CANONICAL (enterprise baseline — reference only for MVP)                                                                                                                                                                                                                                                                               | Vaeloom source team | 2026-08-06                                                                  | Downloads `vaeloom-enterprise-e2e.md` SHA256 `C9021F33…A825`                                                                     |
| INT-05 | 01-vaeloom-mvp-spec.md                                            | CANONICAL MVP scope                                                                                                                                                                                                                                                                                                                    | Vaeloom source team | 2026-08-06                                                                  | `docs/01-vaeloom-mvp-spec.md` SHA256 `2B1264C6…21E1`                                                                             |
| INT-06 | 06-vaeloom-enterprise-paper.md                                    | CANONICAL enterprise vision (reference only)                                                                                                                                                                                                                                                                                           | Vaeloom source team | 2026-08-06                                                                  | `docs/06-vaeloom-enterprise-paper.md` SHA256 `DA1F02C2…F7A7`                                                                     |
| INT-07 | 02-system-architecture.md                                         | CANONICAL architecture intent                                                                                                                                                                                                                                                                                                          | Vaeloom source team | 2026-08-06                                                                  | `docs/02-system-architecture.md` SHA256 `DC966A6E…0920`                                                                          |
| INT-08 | 03-agent-workflow.md                                              | CANONICAL agent/approval flow intent                                                                                                                                                                                                                                                                                                   | Vaeloom source team | 2026-08-06                                                                  | `docs/03-agent-workflow.md` SHA256 `E243B2BD…5025`                                                                               |
| INT-09 | 04-memory-knowledge-graph.md                                      | CANONICAL memory/RAG intent                                                                                                                                                                                                                                                                                                            | Vaeloom source team | 2026-08-06                                                                  | `docs/04-memory-knowledge-graph.md` SHA256 `3F651453…858A`                                                                       |
| INT-10 | 00-gap-analysis-report.md + 00-documentation-completion-report.md | DOCS-MATURITY ONLY — never runtime evidence                                                                                                                                                                                                                                                                                            | Vaeloom source team | 2026-08-06                                                                  | `docs/00-gap-analysis-report.md` `7430299D…6283`; `docs/00-documentation-completion-report.md` `5F9F2B85…5DF00`                  |
| INT-11 | MVP-P00 prompt (this phase's governing execution contract)        | CANONICAL for this phase                                                                                                                                                                                                                                                                                                               | 66-prompt pack      | 2026-08-06                                                                  | Downloads `01-mvp/MVP-P00-…md` SHA256 `165AEC91…A52`                                                                             |
| INT-12 | 66-prompt pack manifest + master index + SHA256SUMS               | CANONICAL (prompt set integrity)                                                                                                                                                                                                                                                                                                       | 66-prompt pack      | 2026-08-06                                                                  | Downloads `manifest.json` `04F95AE5…A59`; `00-master-index.md` `9D6A1050…87DF`; `SHA256SUMS.md` `8DD46DD8…B8BA`                  |

### Superseded / conflicting in-repo docs

| Source                                                                                                                | Class                    | Reason                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `docs/05-vaeloom-mvp-spec.md`                                                                                         | SUPERSEDED               | Replaced by `01-vaeloom-mvp-spec.md` (per prompt INT-05)                 |
| `docs/vaeloom-enterprise-paper.md`                                                                                    | SUPERSEDED               | Replaced by `06-vaeloom-enterprise-paper.md` (per prompt INT-06)         |
| `docs/vaeloom-complete-documentation.md`, `docs/vaeloom-documentation-site.md`, `docs/vaeloom-how-it-works-visual.md` | CONTEXT-ONLY             | Presentation views; never outrank canonical docs                         |
| `docs/IMPLEMENTATION-GAP-REPORT.md`, `docs/MIGRATION-REPORT.md`, `docs/AUDIT-REPORT.md`                               | CONFLICTING (unverified) | Claim completeness; must be validated against repo evidence, not trusted |

## 3. External standards register (snapshot 2026-08-06)

| ID     | Standard                                         | Class             | Required use                                                             |
| ------ | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------ |
| EXT-01 | MCP Specification 2026-07-28                     | EXTERNAL_VERIFIED | Version-pinned MCP profile, auth, compatibility testing                  |
| EXT-02 | OWASP Top 10 Agentic Apps 2026                   | EXTERNAL_VERIFIED | Agent/tool/memory/identity risk review                                   |
| EXT-03 | OWASP LLM Top 10 2025                            | EXTERNAL_VERIFIED | Prompt injection, leakage, excessive agency                              |
| EXT-04 | NIST AI RMF 1.0 + GenAI Profile                  | EXTERNAL_VERIFIED | AI governance/evaluation                                                 |
| EXT-05 | WCAG 2.2 AA                                      | EXTERNAL_VERIFIED | Accessibility target                                                     |
| EXT-06 | RFC 9700 OAuth Security BCP                      | EXTERNAL_VERIFIED | AuthN hardening                                                          |
| EXT-07 | RFC 9728 Protected Resource Metadata             | EXTERNAL_VERIFIED | OAuth/MCP metadata                                                       |
| EXT-08 | OpenAPI 3.2.0                                    | EXTERNAL_VERIFIED | API contract                                                             |
| EXT-09 | OpenTelemetry                                    | EXTERNAL_VERIFIED | Telemetry (⚠ blocked in local env — see register §5)                     |
| EXT-10 | SLSA v1.2 / Sigstore                             | EXTERNAL_VERIFIED | Provenance                                                               |
| EXT-11 | NIST SSDF SP 800-218 v1.1                        | EXTERNAL_VERIFIED | Secure SDLC                                                              |
| EXT-12 | Gmail API Push Notifications                     | EXTERNAL_VERIFIED | Watch renewal/reconciliation                                             |
| EXT-13 | GitHub App Permissions                           | EXTERNAL_VERIFIED | Least privilege                                                          |
| EXT-14 | GDPR                                             | EXTERNAL_VERIFIED | Privacy rights                                                           |
| EXT-15 | EU AI Act                                        | EXTERNAL_VERIFIED | AI transparency (2026-08-02 obligations)                                 |
| EXT-16 | India DPDP Rules 2025                            | EXTERNAL_VERIFIED | India privacy/child data                                                 |
| EXT-17 | FERPA / COPPA                                    | EXTERNAL_VERIFIED | Student / under-13                                                       |
| EXT-18 | Protobuf/Python compatibility (actual env truth) | EXTERNAL_VERIFIED | **protobuf 4.25.9 incompatible with Python 3.14.6 — blocks OTEL import** |

**Standard decisions:** re-verify version/applicability at every phase start;
record owner/control-mapping/evidence per standard in the phase register.
Professional legal review required before any compliance claim; none
self-claimed here.

## 4. Key conflicts surfaced (must be resolved before P05+)

| ID    | Conflict                                                                                                                                                                                                    | Parties                                       | Resolution status                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CF-01 | Prompt §14 expects `apps/core-api`, `apps/ai-service`, `packages/contracts`, `packages/design-system` — **none exist**. Actual: `apps/backend`, `apps/web`, `packages/shared-types`, `packages/ui-kit`      | Prompt skeleton vs repo reality               | Repo ADR-009 governs; prompt structure is aspirational. OPEN — confirm in P05            |
| CF-02 | Docs describe NestJS+FastAPI two-service split; repo has **FastAPI only** (`apps/backend`), Next.js web. `ADR-001-use-fastapi.md` documents the decision                                                    | `docs/02-…`, `00-gap-analysis` vs ADRs + repo | ADR-001/009 + repo win. OPEN — confirm                                                   |
| CF-03 | Track status "PRE-CODE / NOT_EXECUTED" vs repo implementing 23 agents, 124 backend test files, 2193 passing tests                                                                                           | Prompt track framing vs repo                  | Repo truth wins; track framing reclassified (see 03-maturity)                            |
| CF-04 | AGENTS.md claims "1626 tests pass" — actual measured: 2193 passed / 47 failed / 2 xfailed (env-caused)                                                                                                      | AGENTS.md vs measured run                     | Measured evidence wins. OPEN — env fix required                                          |
| CF-05 | Agent inventory: MVP scope = 8 agents; repo = 23 agent dirs (incl. enterprise: coding, security, analytics, learning, research, qa, reflection, reminder, recommendation, plugin, drive, github, connector) | MVP scope (INT-05) vs repo                    | Enterprise extras must stay disabled/out-of-scope for MVP. OPEN — scope audit in P01–P05 |
| CF-06 | Web router inventory: `billing`, `admin`, `marketplace`, `organizations`, `feature-flags`, `webhooks` routes exist — all out of MVP scope                                                                   | MVP scope vs repo                             | OPEN — must be flagged/unshipped in MVP builds                                           |

## 5. Blocker register (P00)

| Blocker                                                                                                                                                                      | Category             | Owner         | Due                             | Affects                          | Blocks work?                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- | ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| INT-01 template absent — **applied output located 2026-08-07** (3-track gatekeeper compendiums zip, validated ALL PASS); user-supplied INT-02 remains governing (DEC-P00-06) | Input resolved       | User          | 2026-08-07 (substitute located) | Gate contract                    | **RESOLVED via DEC-P00-06** — INT-02 authority order (§0.2) governs MVP execution; INT-01 substitute archived |
| BQ-01 approver unnamed                                                                                                                                                       | Approval             | Founder/PM    | Before P01 gate                 | All phase gates                  | YES for GO (not for docs-only)                                                                                |
| BQ-02 deploy target/env/credentials undefined                                                                                                                                | Access               | Platform      | Before P19                      | Release, runtime validation      | YES for GO                                                                                                    |
| BQ-03/BQ-04 launch region, min age, entity set undefined                                                                                                                     | Stakeholder decision | Legal/Product | Before P13                      | Privacy/consent design           | YES for GO                                                                                                    |
| BQ-05 team/budget/cohort/ship window                                                                                                                                         | Commitment           | Founder       | Before P04                      | Planning realism                 | YES for GO                                                                                                    |
| protobuf 4.25.9 × Python 3.14.6                                                                                                                                              | Environment defect   | Platform      | Before P03 rerun                | OTEL + full-app tests (47 fails) | Partial — 2193 tests still pass                                                                               |
| @playwright/test not installed at web root                                                                                                                                   | Dependency gap       | Platform      | Before P14                      | e2e smoke suite                  | Partial                                                                                                       |

## 6. Authority-order note (2026-08-06, user-supplied)

Per INT-02 §0.2, when statements conflict the order is now:

1. `vaeloom-mvp-e2e-enterprise-hardened.md` (INT-02 — governing, user-supplied)
2. `01-vaeloom-mvp-spec.md` (canonical MVP scope)
3. `02-system-architecture.md`, `03-agent-workflow.md`,
   `04-memory-knowledge-graph.md`
4. `vaeloom-complete-documentation.md` / `vaeloom-documentation-site.md`
5. `vaeloom-mvp-e2e.md` (original 22-phase structure)
6. Historical/superseded docs only as context

New confirmed inputs from INT-02 now binding for MVP: canonical 8-agent roster
(§2.2 —
Application/Recommendation/Reflection/Analytics/Connector/GitHub/Coding/Document/Learning/Planning
agents are NOT separate agents), provider-neutral embedding interface (Anthropic
has no embeddings — §5.1), WCAG 2.2 AA, PostgreSQL 16 + pinned AGE/pgvector
(ADR-007), RLS + composite FKs (ADR-010), approval/idempotency tables, deletion
lifecycle, integration registry disabled-by-default, production release blocked
until §16 checklist.
