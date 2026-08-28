# MVP-P00 — 01. Canonical Source Register

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Status:** BASELINE
> COMPLETE — runtime truth re-verified 2026-08-12 (full re-run, see
> `09-gate-2026-08-12.md`) and **zero-trust re-audited 2026-08-16** (see
> `15-zero-trust-reaudit-2026-08-16.md`) **Owner:** Phase owner (MVP-P00) ·
> **Approver:** USER (sole approver per BQ-01) **Baseline:** P00 evidence pinned
> at repo `master` @ `3ad6bca68ca827050cb0e1c4c323f2ba4fee88ac`; **repo HEAD
> since moved** to `2f12d944d5e8247763ad0af7711134d4403b3f06` (2026-08-16,
> P01–P05 executed; 0 ahead / 0 behind origin). ⚠️ **Working tree has
> UNCOMMITTED P06/P07 work** (4 new alembic migrations 0003–0006, 3 new services
> erasure/export/provenance, schema consent/retention fields) — see CF-07.
> **Register root:** `docs/phases/mvp-p00/`

## 1. Classification legend

| Class | Meaning |
| ------------------- | ------------------------------------------------------- |
| `CANONICAL` | Authoritative for decisions; conflicts resolve to it |
| `SUPERSEDED` | Historical; superseded by a canonical item |
| `CONFLICTING` | Contradicts another source; resolution pending/recorded |
| `MISSING` | Referenced but not found in repo or provided corpus |
| `NOT_APPLICABLE` | Out of MVP scope or not used |
| `EXTERNAL_VERIFIED` | External standard, verified at snapshot date |

## 2. Governing and baseline sources

| ID | Source | Class | Owner/authority | Verified at | Location |
| ------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | MISSING TEMPLATE — not in repo/Downloads/any archive; **applied output (3-track 32-section gatekeeper compendiums) located 2026-08-07** in `~/Downloads/vaeloom/vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` (validated ALL PASS 2026-08-04); user-supplied INT-02 remains governing for MVP execution (DEC-P00-06) | Vaeloom source team | 2026-08-07 (substitute located) | template not found; substitute zip archived (SHA-256 per zip `SHA256SUMS.md`) |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md | **CANONICAL — GOVERNING for MVP (user-supplied)** | Vaeloom source team | 2026-08-06 (user provided; SHA-256 verified `2FA8966F…69640`, 91,469 bytes) \| in-repo copy re-hashed 2026-08-12 `F32A2A85…E55F` (110,343 B) | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` (placed in repo 2026-08-11) — authenticity confirmed |
| INT-03 | vaeloom-mvp-e2e.md | CANONICAL (MVP baseline, subordinate to INT-02) | Vaeloom source team | 2026-08-06 \| in-repo copy re-hashed 2026-08-12 `38540987…D545` (210,008 B) | `docs/vaeloom-mvp-e2e.md` (placed in repo 2026-08-11) |
| INT-04 | vaeloom-enterprise-e2e.md | CANONICAL (enterprise baseline — reference only for MVP) | Vaeloom source team | 2026-08-06 \| in-repo copy re-hashed 2026-08-12 `F22D3F9B…C752A2` (173,278 B) | `docs/vaeloom-enterprise-e2e.md` (placed in repo 2026-08-11) |
| INT-05 | 01-vaeloom-mvp-spec.md | CANONICAL MVP scope | Vaeloom source team | 2026-08-06 | `docs/01-vaeloom-mvp-spec.md` SHA256 `2B1264C6…21E1` |
| INT-06 | 06-vaeloom-enterprise-paper.md | CANONICAL enterprise vision (reference only) | Vaeloom source team | 2026-08-06 | `docs/06-vaeloom-enterprise-paper.md` SHA256 `DA1F02C2…F7A7` |
| INT-07 | 02-system-architecture.md | CANONICAL architecture intent | Vaeloom source team | 2026-08-06 | `docs/02-system-architecture.md` SHA256 `DC966A6E…0920` |
| INT-08 | 03-agent-workflow.md | CANONICAL agent/approval flow intent | Vaeloom source team | 2026-08-06 | `docs/03-agent-workflow.md` SHA256 `E243B2BD…5025` |
| INT-09 | 04-memory-knowledge-graph.md | CANONICAL memory/RAG intent | Vaeloom source team | 2026-08-06 | `docs/04-memory-knowledge-graph.md` SHA256 `3F651453…858A` |
| INT-10 | 00-gap-analysis-report.md + 00-documentation-completion-report.md | DOCS-MATURITY ONLY — never runtime evidence | Vaeloom source team | 2026-08-06 | `docs/00-gap-analysis-report.md` `7430299D…6283`; `docs/00-documentation-completion-report.md` `5F9F2B85…5DF00` |
| INT-11 | MVP-P00 prompt (this phase's governing execution contract) | CANONICAL for this phase | 66-prompt pack | 2026-08-06 | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P00-…md` SHA256 `165AEC91…A52` |
| INT-12 | 66-prompt pack manifest + master index + SHA256SUMS | CANONICAL (prompt set integrity) | 66-prompt pack | 2026-08-06; **re-verified 2026-08-12 — 75/75 SHA256SUMS matches, 0 failures**; **re-audited 2026-08-16 — 75/75 PASS again** | `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/` (76 files incl. live `EXECUTION-STATUS.md` overlay, SHA256-verified vs `SHA256SUMS.md`) |

### Downloads archive register (kept in Downloads; SHA-256 pinned 2026-08-11)

| Zip / file | SHA-256 (full) | Role |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `vaeloom-complete-three-track-phase-gatekeeper-deliverables.zip` | `7B0E837FCE31AA5BCD3E10FECC54F01350483DA27C049A8E4A59F5F574CA280A` | INT-01 substitute — governing 3-track 32-section gatekeeper compendiums (validated ALL PASS 2026-08-04) |
| `vaeloom-66-independent-end-to-end-phase-prompts.zip` | `B92BA494AC7152ACB71897F15E4250F8B655302ED960211354ED88C6130062BE` | Original 66-prompt pack archive (unpacked copy in repo `docs/prompts/`) |
| `vaeloom-mvp-enterprise-phase-prompt-pack.zip` | `63777CCCDB59BE9828CEED6625954280335CAA725095369DE82FC8F5DB8F7706` | Prior MVP+enterprise prompt pack (historical) |
| `vaeloom-six-enterprise-control-prompts.zip` | `C050AC85BEDB0BE468E46931D5293D8B7A40908A82A5BB4D6A59C52B86139A5E` | Six enterprise control prompts (historical) |
| `vaeloom-three-phase-deliverables.zip` | `BA59B23ADCC4FDF4A7DD00F167E85927F9C458EB26B418263EE07CCF0350066C` | Prior three-phase deliverables (historical) |
| `files (1).zip` | `E4B9E1345DEB480D8CC80C46F9DFD366DB031CADD62DF44A767E8A3A38733FFB` | Unknown content — inspect before use |

### Superseded / conflicting in-repo docs

| Source | Class | Reason |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `docs/05-vaeloom-mvp-spec.md` | SUPERSEDED | Replaced by `01-vaeloom-mvp-spec.md` (per prompt INT-05) |
| `docs/vaeloom-enterprise-paper.md` | SUPERSEDED | Replaced by `06-vaeloom-enterprise-paper.md` (per prompt INT-06) |
| `docs/vaeloom-complete-documentation.md`, `docs/vaeloom-documentation-site.md`, `docs/vaeloom-how-it-works-visual.md` | CONTEXT-ONLY | Presentation views; never outrank canonical docs |
| `docs/IMPLEMENTATION-GAP-REPORT.md`, `docs/MIGRATION-REPORT.md`, `docs/AUDIT-REPORT.md` | CONFLICTING (unverified) | Claim completeness; must be validated against repo evidence, not trusted |

## 3. External standards register (snapshot 2026-08-06 → **web-verified 2026-08-16**)

> Re-verified 2026-08-16 via web research (sources below). Rows with a ★ carry
> **materially new** version/status vs the 2026-08-06 snapshot and must be
> re-applied at phase start.

| ID | Standard | Class | Verified version / status (2026-08-16) | Required use |
| ------ | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| EXT-01 | MCP Specification ★ | EXTERNAL_VERIFIED | `2026-07-28` **stable** (largest revision since launch: stateless core — `initialize` handshake + `Mcp-Session-Id` removed; `server/discover`; Multi Round-Trip Requests; header routing `Mcp-Method`/`Mcp-Name`; EMA auth extension stable 2026-06-18; DCR **deprecated** → CIMD; Tasks extension) — spec.modelcontextprotocol.io/specification/2026-07-28/ | Version-pinned MCP profile; design servers stateless; EMA/CIMD for enterprise auth; Tasks for long-running jobs |
| EXT-02 | OWASP Top 10 Agentic Apps 2026 ★ | EXTERNAL_VERIFIED | **2026 edition FINAL**, published 2025-12-09 (London Agentic Security Summit); risks numbered **ASI01–ASI10** (goal hijack, tool misuse, identity/privilege abuse, supply chain, unexpected code execution, delegation/containment, inter-agent) — genai.owasp.org | Agent/tool/memory/identity risk review; primary agentic security checklist |
| EXT-03 | OWASP GenAI LLM Top 10 ★ | EXTERNAL_VERIFIED | **2026 edition** published 2026-08-03/04 (re-ranked risks, maps to NIST/MITRE ATLAS/CWE); **2025 edition now ARCHIVED** — genai.owasp.org/resource/owasp-genai-llm-top-10-2026/ | Prompt injection, leakage, excessive agency; **update from "2025" → "2026" everywhere** |
| EXT-04 | NIST AI RMF 1.0 + GenAI Profile | EXTERNAL_VERIFIED | AI RMF 1.0 (2023-01-26) + AI 600-1 GenAI Profile (2024-07-26) current; **RMF 1.0 under revision** (White House AI Action Plan); NIST page updated 2026-04-08 — nist.gov/itl/ai-risk-management-framework | AI governance/evaluation baseline; watch RMF 1.1 |
| EXT-05 | WCAG 2.2 AA | EXTERNAL_VERIFIED | W3C Recommendation — unchanged/current | Accessibility target (AA) |
| EXT-06 | RFC 9700 OAuth Security BCP | EXTERNAL_VERIFIED | **BCP 240, 2025-01-30, current, NOT obsoleted** (updates 6749/6750/6819; PKCE required, implicit deprecated, exact redirect match) — rfc-editor.org/rfc/rfc9700.html | AuthN hardening; governing spec for Gmail OAuth (auth-code + PKCE) |
| EXT-07 | RFC 9728 Protected Resource Metadata | EXTERNAL_VERIFIED | **Proposed Standard, April 2025, current** — `.well-known/oauth-protected-resource`; adopted by MCP OAuth 2.1 — rfc-editor.org/rfc/rfc9728.html | OAuth/MCP resource metadata (agent resource exposure) |
| EXT-08 | OpenAPI 3.2.0 | EXTERNAL_VERIFIED | **3.2.0 released 2025-09-19, still latest** (no newer as of 2026-08-16) — spec.openapis.org/oas/v3.2.0.html | API contract |
| EXT-09 | OpenTelemetry ★ | EXTERNAL_VERIFIED | **Spec 1.60.0 (~2026-08-07)**; OTLP 1.11.0; semconv 1.44.0 — moving target; track latest minor — opentelemetry.io/docs/specs/otel/ (⚠ blocked in local env — see register §5) | Telemetry (trace/metric/log context); pin SDK/spec versions |
| EXT-10 | SLSA v1.2 ★ / Sigstore | EXTERNAL_VERIFIED | **v1.2 (announced 2025-11-24)** — adds **Source Track** alongside Build Track (L0–L3); dep/build-env tracks in dev — slsa.dev/spec/v1.2/ | Provenance / supply-chain attestation |
| EXT-11 | NIST SSDF SP 800-218 ★ | EXTERNAL_VERIFIED | **v1.1 (2022-02-03) still FINAL/current; v1.2 (SP 800-218 Rev 1) DRAFT** (IPD 2025-12-17, comments closed 2026-01-30); companion SP 800-218A GenAI profile (2024-07-26) — csrc.nist.gov/pubs/sp/800/218/final | Secure SDLC; implement v1.1 now, track v1.2 finalization |
| EXT-12 | Gmail API Push Notifications ★ | EXTERNAL_VERIFIED | watch 7-day expiry (renew daily); historyId 7-day reconciliation; **quota model standardized 2026-05-01** (1.2M units/min/project, per-method units; exceeding may bill later in 2026); OAuth-only since 2025-03-14 — developers.google.com/workspace/gmail/api/guides/push | Watch renewal/reconciliation; budget quota/billing model |
| EXT-13 | GitHub App Permissions ★ | EXTERNAL_VERIFIED | Least-privilege norm; **user access tokens (fine-grained, no OAuth scopes, ~8h expiry) now standard**; REST API version header `2026-03-10`; enterprise-team permission public preview 2026-02-09 — docs.github.com/en/apps | Least privilege; use GitHub App + short-lived user tokens |
| EXT-14 | GDPR | EXTERNAL_VERIFIED | No core amendment in force (2026); **Digital Omnibus data strand (COM(2025)837) still a proposal**; UK right-to-complain change 2026-06-19 — eur-lex.europa.eu/eli/reg/2016/679/oj | Privacy rights; full deletion incl. backups ("delete-on-restore") |
| EXT-15 | EU AI Act ★ | EXTERNAL_VERIFIED | **Art. 50 transparency LIVE 2026-08-02** (confirmed); **high-risk DELAYED by Reg. (EU) 2026/1744** → Annex III 2027-12-02, Annex I 2028-08-02; 2 new Art. 5 prohibitions 2026-12-02; GPAI 2025-08-02; fine to €15M/3% — eur-lex.europa.eu/eli/reg/2026/1744/oj | AI disclosure/interaction labeling for EU users (chatbot); NOT delayed |
| EXT-16 | India DPDP Act 2023 + Rules ★ | EXTERNAL_VERIFIED | **Rules finalized & notified 2025-11-13/14**; DPB live 2025-11-13; **consent-manager registration Nov 2026**; **full compliance 2027-05-13** (notice/consent/security/breach/retention/children) — meity.gov.in | India privacy/child data; build DPDP-shaped notice/consent/deletion flows now |
| EXT-17 | FERPA / COPPA ★ | EXTERNAL_VERIFIED | FERPA: 34 CFR 99 unchanged, SPPO active, no 2026 rulemaking. **COPPA amended rule FULLY IN FORCE 2026-04-22** (parental consent, data minimization); **COPPA 2.0 (S.836) passed Senate 2026-03-05** (under-17, Eraser Button — pending House) — ftc.gov, studentprivacy.ed.gov | Student / under-13: min-age-18 gate removes under-13 exposure; keep neutral age verification |
| EXT-18 | Protobuf/Python compatibility (actual env truth) | EXTERNAL_VERIFIED | protobuf 4.25.9 incompatible with Python 3.14.6 — blocks OTEL import (unchanged) | **protobuf 4.25.9 incompatible with Python 3.14.6 — blocks OTEL import** |
| EXT-19 | Arazzo Specification 1.1.0 | EXTERNAL_VERIFIED | **1.1.0 published 2026-05-17** — adds **AsyncAPI support** (sync+async workflows); 1.0.x remains valid — spec.openapis.org/arazzo/v1.1.0.html | Optional machine-readable multi-call workflows/dependencies (reference only) |

**Standard decisions:** re-verify version/applicability at every phase start;
record owner/control-mapping/evidence per standard in the phase register.
Professional legal review required before any compliance claim; none
self-claimed here. **Web-verified 2026-08-16 by research agents** (all rows
sourced; unverified items marked). Control mapping/evidence per standard is
owned by the implementing phase (P08 MCP, P13 legal/AI, P14 WCAG, P15 SLO, P16
SLSA/SSDF) — unchanged from 2026-08-12.

## 3.1 Architecture ground truth (corrected 2026-08-16 audit)

| Component | Corrected truth | Previous misrepresentation |
| ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Backend | **Single FastAPI app** at `apps/api/` (Python ≥3.12, SQLAlchemy async, Alembic) | Docs described NestJS+FastAPI two-service split — does NOT exist |
| Frontend | **Next.js 15** at `apps/web/` | Accurately described |
| Database | **SQLAlchemy + Alembic** migrations | Some docs referenced Prisma — does NOT exist |
| Agents | **21 agents + orchestrator** in `apps/api/src/backend/agents/` | Prompt assumed 8 agents; 15 enterprise extras exist in repo |
| DB Models | **30 models** in `apps/api/src/backend/models/schema.py` | Not previously enumerated |
| Test counts | **2335 pytest** (2333 pass / 0 fail / 2 xfailed), **37 jest**, **39 e2e** | AGENTS.md had stale "1626 tests" claim — RESOLVED |
| Documentation | **574 docs**, **26 ADRs** | Previous count 492 docs was outdated |

## 4. Key conflicts surfaced (must be resolved before P05+)

| ID | Conflict | Parties | Resolution status |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CF-01 | Prompt §14 expects `apps/core-api`, `apps/ai-service`, `packages/contracts`, `packages/design-system` — **none exist**. Actual: `apps/api`, `apps/web`, `packages/shared-types`, `packages/ui-kit` | Prompt skeleton vs repo reality | Repo ADR-009 governs; prompt structure is aspirational. OPEN — confirm in P05 |
| CF-02 | Docs describe NestJS+FastAPI two-service split; repo has **FastAPI only** (`apps/api`), Next.js web. `ADR-001-use-fastapi.md` documents the decision | `docs/02-…`, `00-gap-analysis` vs ADRs + repo | ADR-001/009 + repo win. OPEN — confirm |
| CF-03 | Track status "PRE-CODE / NOT_EXECUTED" vs repo implementing 23 agents, 124 backend test files, 2193 passing tests | Prompt track framing vs repo | Repo truth wins; track framing reclassified (see 03-maturity) |
| CF-04 | AGENTS.md claims "1626 tests pass" — actual measured: 2193 passed / 47 failed / 2 xfailed (env-caused) | AGENTS.md vs measured run | **RESOLVED 2026-08-12** — with documented env contract: **2333 passed / 0 failed / 2 xfailed** (2335 collected) |
| CF-05 | Agent inventory: MVP scope = 8 agents; repo = 23 agent dirs (incl. enterprise: coding, security, analytics, learning, research, qa, reflection, reminder, recommendation, plugin, drive, github, connector) | MVP scope (INT-05) vs repo | Enterprise extras must stay disabled/out-of-scope for MVP. OPEN — scope audit in P01–P05 |
| CF-06 | Web router inventory: **frontend** route pages exist under `apps/web/src/app/workspace/[workspaceId]/` for `billing`, `admin`, `marketplace`, `organizations`, `feature-flags`, `webhooks` — all out of MVP scope (23 pages total: 17 MVP + 6 enterprise-flagged). Backend enterprise routers present: only `billing.py`, `admin_console.py`, `webhooks.py` (enterprise-gated in `main.py`) | MVP scope vs repo | OPEN — must be flagged/unshipped in MVP builds |
| CF-07 | **P00-pinned baseline `3ad6bca` vs current HEAD `2f12d94`** — P01–P05 committed since; **UNCOMMITTED working tree** (P06/P07 in-flight): 4 new alembic migrations (0003_approval_tables, 0004_memory_taxonomy, 0005_rls_expanded, 0006_provenance), 3 new services (erasure/export/provenance), schema.py consent/retention/provenance fields, main.py + tenant.py edits, backup/restore scripts | P00 evidence pin vs repo drift | P00 evidence stays pinned at `3ad6bca` (reproducible); current-tree changes are P06/P07-owned and must be committed/verified there. **Re-audited 2026-08-16 — 2335 tests still collect at HEAD; full suite re-run owned by P07 gate** |
| CF-08 | **Approval gate inert** — `has_approval=False` hardcoded in send paths; ApprovalCard in UI exists but backend never enforces approval | Security requirement vs implementation | **Release blocker** — must wire approval middleware before any send path is live (RISK-P00-NEW-01) |
| CF-09 | **RLS on 4/36 tables, GUC never SET** — TenantMiddleware exists but NOT MOUNTED; cross-tenant isolation is app-filter only | Multi-tenancy design vs DB enforcement | **Security blocker** — must expand RLS and mount middleware (RISK-P00-NEW-02) |
| CF-10 | **3 middleware layers dead code** — IP allowlist, tenant, SCIM router all exist in code but never registered in main.py | Implementation vs runtime | Mount middleware or remove dead code (RISK-P00-NEW-03) |
| CF-11 | **Dual migration systems** — Alembic (0001–0006) and custom runner (0002–0007) with overlapping scope | Two sources of truth for schema | Consolidate to single system (RISK-P00-NEW-05) |
| CF-12 | **7 frontend pages use hardcoded mock data** — pages exist but don't call the typed API client | UI presence vs real integration | Wire to real API or remove (RISK-P00-NEW-04) |

## 5. Blocker register (P00)

| Blocker | Category | Owner | Due | Affects | Blocks work? |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 template absent — **applied output located 2026-08-07** (3-track gatekeeper compendiums zip, validated ALL PASS); user-supplied INT-02 remains governing (DEC-P00-06) | Input resolved | User | 2026-08-07 (substitute located) | Gate contract | **RESOLVED via DEC-P00-06** — INT-02 authority order (§0.2) governs MVP execution; INT-01 substitute archived |
| BQ-01 approver unnamed | Approval | Founder/PM | Before P01 gate | All phase gates | YES for GO (not for docs-only) |
| BQ-02 deploy target/env/credentials undefined | Access | Platform | Before P19 | Release, runtime validation | YES for GO |
| BQ-03/BQ-04 launch region, min age, entity set undefined | Stakeholder decision | Legal/Product | Before P13 | Privacy/consent design | YES for GO |
| BQ-05 team/budget/cohort/ship window | Commitment | Founder | Before P04 | Planning realism | YES for GO |
| protobuf 4.25.9 × Python 3.14.6 | Environment defect | Platform | Before P03 rerun | OTEL + full-app tests (47 fails) | **MITIGATED 2026-08-12** — test env sets `OTEL_SDK_DISABLED=true`; full suite green (2333 passed / 0 failed / 2 xfailed); OTEL import remains blocked on Py 3.14 unless disabled — carry to P17 |
| @playwright/test not installed at web root | Dependency gap | Platform | Before P14 | e2e smoke suite | **RESOLVED 2026-08-12** — installed at repo root; `testing/e2e` Playwright config + 3 specs, **39/39 PASS** (chromium/firefox/mobile-chrome) |

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

## 7. Completion-pass pointers (2026-08-12, docs-only)

Prompt-mandated paperwork closed in the completion pass @ `3ad6bca` (no source
changes):

| Prompt item | Deliverable |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| §10 Enterprise completeness (18 domains) | `10-enterprise-completeness.md` (registry of BLOCKED rows + owning phases) |
| §23 Evidence & traceability | `11-evidence-traceability.md` (EVD-MVP-P00-001…022) |
| Future-readiness overlay (5 ideas) | `12-future-readiness-backlog.md` (FB-01…05, adoption triggers) |
| §26/§27 DoR/DoD | `13-readiness-and-done.md` |
| §30 Completion response (A–P) | `14-completion-response.md` |
| §28 gate re-score | `09-gate-2026-08-12.md` §8 (75.69/100 — user verdict pending) |

Standards overlay controls (prompt overlay, "record each selected standard,
exact version/date, applicability, decision owner, control mapping and
verification evidence in the phase source register"): the EXT-01…19 rows above
carry versions/applicability; per-standard control mapping + verification
evidence is owned by the phase where the control is implemented (P08 MCP, P13
legal/AI, P14 WCAG, P15 SLO, P16 SLSA/SSDF) and recorded there.

## 8. Zero-trust re-audit 2026-08-16 (post-`3ad6bca`)

Full detail in `15-zero-trust-reaudit-2026-08-16.md`. Highlights:

- **66-prompt pack SHA256SUMS: 75/75 PASS** (re-run 2026-08-16, all hashes
 match, 0 missing/mismatch) — integrity claim re-confirmed.
- **Canonical hashes stable:** INT-02 `F32A2A85…`, INT-03 `38540987…`, INT-04
 `F22D3F9B…` unchanged from the 2026-08-12 pin.
- **Scope lock confirmed in code:** `config.py:69-70`
 (`mvp_scope_enforced=True`, `enterprise_routes_enabled=False`);
 `orchestrator/router.py:178-232` `MVP_CANONICAL_AGENTS` 8-name gate +
 `_handle_out_of_scope` enforcement — all as documented.
- **Repo advanced past the P00 pin:** HEAD `2f12d94` (P01–P05 landed), with
 UNCOMMITTED P06/P07 work (migrations 0003–0006, services
 erasure/export/provenance, schema consent/retention/provenance fields).
- **2335 backend tests still collect** at current working tree (2026-08-16);
 full-suite execution is P07-gate-owned.
- **External standards refreshed 2026-08-16** (★ rows in §3): OWASP LLM Top 10
 **2026**, EU AI Act high-risk delay (2026/1744), DPDP Rules finalized
 2025-11-13, COPPA fully in force, Gmail quota model change, GitHub user
 tokens, SLSA v1.2 Source Track, SSDF v1.2 draft.
