# MVP-P03 — 03. Requirements (DEL-MVP-P03-01)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4` (pushed
> 0/0). Supersedes the 2026-08-07 P03 run (CONDITIONAL GO 88/100; history
> preserved in `*-2026-08-07.md`). Predecessor: MVP-P02 re-run ACCEPTED BY USER
> 2026-08-13 — gate 88.20/100 (`19-gate-2026-08-13.md`); BQ-P02-01..04 CONFIRMED
> (DEC-P02-06). Repo truth (CF-P03-02): Next.js + FastAPI — no NestJS.

> Atomic, testable, traceable. IDs stable across phases. Acceptance per
> requirement. Owners: BA/Product. Status: `APPROVED_BASELINE` pending gate.
> Sources: INT-02, INT-05, P01/P02 evidence, BQ-P02-01..04 confirmed
> (DEC-P02-06). **Implementation status verified 2026-08-16** via zero-trust
> codebase audit — see §8 and `12-implementation-gap-requirements.md`.

## 0. Legend

- **Priority:** P0 (release-blocking) / P1 (must in MVP) / P2 (should) / P3
  (later)
- **Requirement IDs:** FR-* (functional), NFR-* (non-functional), FR-h*
  (hardened FR-52–FR-70 from INT-02), NFR-h* (hardened NFR-15–NFR-22)
- **Claim labels:** `SOURCE_DERIVED` (from INT-02 / repo evidence) ·
  `STAKEHOLDER_DECISION` (user decision — BQ rows / DEC-P02 rows) ·
  `NOT_EXECUTED` (runtime proof owned by later phases — P03 sets the requirement
  level only)
- **Phase deps:** (P07/P12/P13/P15) mark where acceptance verification is owned
  by a later phase; P03 records the contract, not the runtime result
- **Acceptance:** measurable, testable condition
- **Impl Status** (added 2026-08-16): `IMPLEMENTED` · `IMPLEMENTED_UNVERIFIED` ·
  `PARTIAL` · `NOT_IMPLEMENTED` · `DESIGN_ONLY` · `STUB` · `NOT_APPLICABLE` —
  verified by zero-trust codebase audit
- **Evidence** (added 2026-08-16): actual file path or `TBD_AT_IMPL` — never
  invented

### 0.1 Changes vs 2026-08-07 baseline (re-run)

| Change             | IDs                                   | Basis                                                                         |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------- |
| ADDED (gap fix)    | FR-h53..h59 (7 rows, §5)              | INT-02 FR-53..59; phase rule §3 requires the full hardened FR-52..FR-70 range |
| REFRAMED proposals | FR-32, FR-33, FR-34, AUTO-02, AUTO-03 | DEC-P02-05 verdict at P02 gate 2026-08-13: T2/T3 = PROPOSALS ONLY, gated      |
| Cross-ref fix      | FR-35 acceptance cites FR-h63         | Artifact-version recording per INT-02 FR-63 (mis-cited FR-34 in 2026-08-07)   |
| No removals        | —                                     | All 2026-08-07 IDs retained unchanged                                         |

## 1. Functional requirements — journeys (WS-03.1)

### 1.1 Ingest & profile

| ID    | Requirement                                                                                              | Acceptance                                                                                          | Prio | Impl Status            | Evidence                                         |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- | ---------------------- | ------------------------------------------------ |
| FR-01 | User signs up with email/password (India, 18+, individual) (`STAKEHOLDER_DECISION`: BQ-03/04)            | Signup completes; age/region/entity captured; consent notice shown (DPDP §5)                        | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/routers/auth.py`               |
| FR-02 | Onboarding captures profile (name, education, skills, experience, target roles)                          | Structured profile saved to workspace; editable                                                     | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/memory_service.py`    |
| FR-03 | Resume upload (PDF/DOCX/TXT) parsed into structured profile                                              | Parse accuracy ≥90% on eval set (`STAKEHOLDER_DECISION`: BQ-P02-03); errors surfaced for correction | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/resume_service.py`    |
| FR-04 | User can paste job links; system extracts title/org/desc/skills/deadline                                 | Enrichment record with provenance (source URL, timestamp)                                           | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/job_board_client.py`  |
| FR-05 | Correction of any extracted fact creates new version + supersession link, never silent overwrite (FR-68) | Correction history retained; provenance intact                                                      | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/memory_versioning.py` |

### 1.2 Memory (6 types — INT-02)

| ID    | Requirement                                                                                              | Acceptance                                                                        | Prio | Impl Status            | Evidence                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-10 | Persistent memory stores 6 types: profile, preferences, applications, deadlines, interactions, learnings | Every type queryable; retrieval hit-rate ≥80% (`STAKEHOLDER_DECISION`: BQ-P02-03) | P0   | PARTIAL                | `apps/api/src/api/services/memory_service.py`, `apps/api/src/api/models/schema.py:227` (memories table exists; 6-type taxonomy via `schemas/memory_types.py` — UNVERIFIED) |
| FR-11 | Memory retrieval is source-grounded; low-confidence inference never shown as confirmed fact (FR-64)      | Unconfirmed facts labeled; source link on confirmed facts                         | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/memory_service.py`                                                                                                                              |
| FR-12 | Memory facts versioned with provenance (model/prompt/retrieval/tool versions — FR-63)                    | Version metadata recorded per fact                                                | P0   | PARTIAL                | `apps/api/src/api/services/memory_versioning.py` (keeps versions in-memory — persistence UNVERIFIED per ADR-022)                                                           |
| FR-13 | Untrusted retrieved content cannot modify policy/approval/tool authz (FR-70)                             | Injection attempts fail; tests prove no policy change                             | P0   | PARTIAL                | `apps/api/src/api/middleware/prompt_injection.py` mounted; `apps/api/tests/security/` tests exist                                                                          |

### 1.3 Organization agent

| ID    | Requirement                                                                              | Acceptance                                                    | Prio | Impl Status            | Evidence                                      |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- | ---------------------- | --------------------------------------------- |
| FR-20 | Documents classified, named, tagged, deduplicated; file ops proposed, never auto-applied | Proposals list shown; move/rename/archive only after approval | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/organization_agent/` |

### 1.4 Resume & ATS agents

| ID    | Requirement                                                           | Acceptance                                           | Prio | Impl Status            | Evidence                                |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------- | ---- | ---------------------- | --------------------------------------- |
| FR-21 | Resume tailored to a job description (keyword matching + suggestions) | Suggested edits with rationale; user applies edits   | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/resume_agent/` |
| FR-22 | ATS compatibility score computed (parseability, keywords, format)     | Score reproducible on eval set; explanation provided | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/ats_agent/`    |

### 1.5 Job Search & Application agent (DEC-P02-05 tiered — T2/T3 PROPOSALS ONLY, gated)

| ID    | Requirement                                                                                                                                                            | Acceptance                                                                    | Prio                       | Impl Status            | Evidence                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| FR-30 | (T1) Track user-performed searches/applications; status updates via manual entry + Gmail confirmations (`STAKEHOLDER_DECISION`: DEC-P02-05)                            | Tracker reflects source-of-truth status; provenance recorded                  | P0                         | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/job_search_agent/`                                  |
| FR-31 | (T1) Rank saved opportunities by fit (profile×JD) and propose deep-links                                                                                               | Ranked list with reason; no auto-submission                                   | P0                         | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/recommendation_service.py`                        |
| FR-32 | (T2 proposal) Read-only discovery scraping of public listings behind flag AUTO-02 — OFF default, opt-in, pacing, kill switch; legal review (P13) before any default-ON | Flag OFF by default; per-user opt-in; no anti-bot evasion; kill stops fetches | P2 (gated proposal)        | DESIGN_ONLY            | `12-implementation-gap-requirements.md` GAP-11                               |
| FR-33 | (T3 proposal) Auto-apply review-first mode (draft → user edit → send) — ships P1 in MVP; per-application approval; autopilot aspect gated (FR-34)                      | Per-application approval record; send only with user action; idempotent       | P1 (review-first proposal) | DESIGN_ONLY            | `12-implementation-gap-requirements.md` GAP-11                               |
| FR-34 | (T3 proposal) Autopilot mode (per-plan rules) — EXCLUDED from MVP; gated on legal review (P13) + per-plan consent + AUTO-03 + user re-confirmation                     | Plan config, pacing caps, audit, kill; never default-ON                       | P3 (gated proposal)        | DESIGN_ONLY            | `12-implementation-gap-requirements.md` GAP-11                               |
| FR-35 | Every application records source, approval, artifact versions, status provenance, timestamps (FR-h63)                                                                  | Full audit trail per application                                              | P0                         | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/models/schema.py` (agent_actions, approval_request tables) |

### 1.6 Gmail agent (draft-only base; T3 per-user send — proposal)

| ID    | Requirement                                                                                  | Acceptance                                                                                  | Prio | Impl Status            | Evidence                                                                              |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ---------------------- | ------------------------------------------------------------------------------------- |
| FR-40 | Gmail read via official API (polling; push = upgrade path EXT-12)                            | Polling watcher extracts new mail; fallback sync; no send scope by default                  | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/clients/gmail_client.py`                                            |
| FR-41 | Deadline extraction from email (interviews, offers, application windows)                     | Accuracy ≥90% on eval set (`STAKEHOLDER_DECISION`: BQ-P02-03); facts stored with provenance | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/gmail_agent/`                                                |
| FR-42 | Draft creation (cover letters, replies, follow-ups) — never auto-send                        | Drafts created only on explicit user action or T3 review-first approval (FR-33)             | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/clients/gmail_client.py` (draft-only confirmed)                     |
| FR-43 | Reminder scheduling from deadlines; external calendar writes need approval (Scheduler agent) | Reminder fired on schedule; calendar writes approved                                        | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/scheduler_agent/`, `apps/api/src/api/agents/reminder_agent/` |

### 1.7 Trust/approval UX

| ID    | Requirement                                                                       | Acceptance                                                                                                 | Prio | Impl Status            | Evidence                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-50 | Consequential actions require immutable payload-bound expiring approval (ADR-009) | Approval record binds action+payload+user+expiry; replay fails                                             | P0   | IMPLEMENTED            | `apps/api/src/api/services/approval.py`, `apps/api/src/api/middleware/idempotency.py` (ADR-021: IMPLEMENTED_UNVERIFIED — hash binding/expiry/immutability unverified) |
| FR-51 | Proposals separate from actions; suggestion never auto-executes (INT-02 §3)       | Zero action outside bound approval (acceptance: replay/payload-mutation/expiry/cross-workspace tests pass) | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/approval.py`                                                                                                                               |

### 1.8 Export/erasure

| ID    | Requirement                                                                                        | Acceptance                                                                    | Prio | Impl Status            | Evidence                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-60 | Export all user data in documented, versioned, importable format (NFR-23)                          | Export completes; format spec documented; PII-free CI test                    | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/export_service.py`                                                                              |
| FR-61 | Erasure across relational, graph, vector, search, object versions, cache, queue, secret, analytics | 100% completeness verified by test matrix (`STAKEHOLDER_DECISION`: BQ-P02-03) | P0   | PARTIAL                | `apps/api/src/api/services/erasure_service.py`, `apps/api/src/api/services/gdpr.py` (breadth across all stores UNVERIFIED) |
| FR-62 | Deletion receipt: immediate actions, backup expiry, exceptions, status                             | Receipt issued; distinguishes primary vs backup completion (NFR-20)           | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/erasure_service.py`                                                                             |

## 2. Quality attributes & SLOs (WS-03.2)

| ID     | Requirement                                                                                        | Acceptance                                                      | Prio | Impl Status            | Evidence                                                                                 |
| ------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- | ---------------------- | ---------------------------------------------------------------------------------------- |
| NFR-01 | Availability SLO ≥99.5% monthly for core API (`STAKEHOLDER_DECISION`; measured P15+)               | Measured via health checks; alerting                            | P1   | PARTIAL                | `apps/api/src/api/routers/health.py` exists; `/metrics` COMMENTED OUT (`main.py:135`)    |
| NFR-02 | p95 latency: LLM-assisted replies ≤15s; read paths ≤500ms (`STAKEHOLDER_DECISION`; verify P13)     | Load test at 100 concurrent (`STAKEHOLDER_DECISION`: BQ-P02-04) | P1   | NOT_IMPLEMENTED        | No load test evidence; `testing/performance/k6-script.js` exists but UNVERIFIED          |
| NFR-03 | Design for 100 concurrent; verify 1,000 concurrent upper bound (`STAKEHOLDER_DECISION`: BQ-P02-04) | Load test proves headroom; scale trigger measured               | P1   | NOT_IMPLEMENTED        | Same as NFR-02                                                                           |
| NFR-04 | Error/timeout/retry/backpressure defined per integration (prompt §13)                              | Failure-injection tests cover provider outage                   | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/infrastructure/agent_fallback.py`, `circuit_breaker.py`                |
| NFR-05 | Connector outage degrades only that capability; no memory corruption/duplication (NFR-22)          | Isolation test: Gmail down → other agents unaffected            | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/infrastructure/agent_fallback.py`                                      |
| NFR-06 | Webhooks/queue consumers at-least-once safe (idempotency+dedup) (NFR-17)                           | Duplicate delivery produces no duplicate side effect            | P0   | IMPLEMENTED            | `apps/api/src/api/middleware/idempotency.py`, `apps/api/src/api/workers/queue_worker.py` |
| NFR-07 | Optimistic concurrency on consequential writes (NFR-16)                                            | Version conflicts detected; precondition tokens enforced        | P0   | PARTIAL                | Idempotency middleware exists; optimistic concurrency on writes UNVERIFIED               |

## 3. Data requirements (WS-03.3)

| ID     | Requirement                                                                                              | Acceptance                                                    | Prio | Impl Status            | Evidence                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-10 | Relational (Postgres) = system of record; graph/vector/search/cache are rebuildable projections (INT-02) | Rebuild test: projection rebuilt from relational, byte-equal  | P0   | PARTIAL                | `apps/api/src/api/infrastructure/search.py` (SearchIndex ABC + MeilisearchIndex); `apps/api/src/api/infrastructure/vector_store.py`; rebuild-job capability UNVERIFIED per ADR-024 |
| NFR-11 | Provenance carried through transformations, retrieval, AI output, action                                 | Every fact/action traceable to source artifact + version      | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/provenance_service.py`                                                                                                                                  |
| NFR-12 | Stable IDs + versioned mappings; no inferred migration/memory values                                     | Schema tests; no placeholder inference                        | P0   | IMPLEMENTED_UNVERIFIED | SQLAlchemy models in `apps/api/src/api/models/schema.py`; Alembic migrations in `alembic/`                                                                                         |
| NFR-13 | Retention per purpose; user deletion = primary erasure + backup-expiry semantics (NFR-20)                | Retention policy table; deletion status model per INT-02 §6.6 | P0   | PARTIAL                | `apps/api/src/api/services/retention.py` exists; breadth UNVERIFIED                                                                                                                |

## 4. Security/privacy/accessibility (WS-03.3)

| ID     | Requirement                                                                                               | Acceptance                                                                     | Prio | Impl Status            | Evidence                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-15 | Cross-workspace isolation via DB policy + composite constraints + service authz + tests (NFR-15)          | Isolation suite passes (per-workspace queries, RLS)                            | P0   | PARTIAL                | `apps/api/src/api/infrastructure/data_isolation.py` (app-level only); RLS on 4/13 tenant_id tables; TenantMiddleware NOT MOUNTED (`main.py`); `SET app.tenant_id` NEVER CALLED — see FR-71..74 |
| NFR-16 | OAuth per RFC 9700 BCP; least-privilege scopes; secrets encrypted                                         | OAuth flows pass security tests; no secret in logs                             | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/auth_service.py`, `apps/api/src/api/services/secrets_service.py`                                                                                                    |
| NFR-17 | Consent + notice per DPDP §5/§6; consent withdrawal functional                                            | Notice shown; withdrawal works; consent records kept                           | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/consent.py`                                                                                                                                                         |
| NFR-18 | Prompt injection defense on all LLM input paths                                                           | Injection tests pass; policy/approval unchanged (FR-70)                        | P0   | PARTIAL                | `apps/api/src/api/middleware/prompt_injection.py` mounted; `apps/api/tests/security/test_xss.py` exists                                                                                        |
| NFR-19 | Security-relevant audit append-only + periodic anchoring (NFR-26)                                         | Audit log append-only tests pass                                               | P0   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/audit.py`, `apps/api/src/api/services/audit_service.py`                                                                                                             |
| NFR-20 | WCAG 2.2 AA on all MVP web workflows (NFR-21)                                                             | a11y tests (axe) pass; keyboard-only, SR, reduced-motion, zoom, non-color-only | P0   | PARTIAL                | `testing/accessibility/` has config files (axe-config.ts, audit-pages.ts); no actual test runs UNVERIFIED                                                                                      |
| NFR-21 | Supply chain: SBOM, dependency/image/IaC scans, signed release images, provenance (NFR-19)                | CI produces SBOM + scans; images signed                                        | P1   | PARTIAL                | `.github/workflows/security-audit.yml`, `security-scan.yml` exist; SBOM/sigstore UNVERIFIED                                                                                                    |
| NFR-22 | Raw content to external models minimized, purpose-bound, logged, governed by provider DPA config (NFR-25) | Provider config validated; egress minimal; DPA setting recorded                | P1   | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/services/llm_service.py`, `apps/api/src/api/config.py`                                                                                                                       |

## 5. Hardened requirements — FR-52..FR-70 (INT-02, phase rule)

| ID     | Requirement                                                                                                                                             | Acceptance                                                                    | Prio |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| FR-h52 | Provider-neutral embedding interface; persist model/version/dimension/input-type/normalization/chunking metadata (FR-52)                                | Embedding registry + metadata persisted; NFR-24 no fixed dimension assumption | P0   |
| FR-h53 | Re-embedding creates a new vector version; previous version retained until validation and cutover complete (FR-53)                                      | Cutover test: old version queryable until switch; rollback works              | P0   |
| FR-h54 | Every retrieved fact carries provenance: source object, version, location, extraction version, confidence (FR-54)                                       | Retrieval results include full provenance fields                              | P0   |
| FR-h55 | Proposed actions separated from applied actions; immutable approval record for every consequential action (FR-55)                                       | Approval suite tests pass (FR-50/51)                                          | P0   |
| FR-h56 | Every action-application request supports idempotency; replay with changed payload rejected (FR-56)                                                     | Idempotency/replay tests pass                                                 | P0   |
| FR-h57 | Long-running ingestion/agent/export/deletion/connector operations run as async jobs with status, progress, cancellation policy, terminal result (FR-57) | Job state-machine tests pass (progress/cancel/terminal)                       | P0   |
| FR-h58 | Webhook ingestion verifies signature where supported, deduplicates events, tolerates out-of-order delivery, reconciles missed events (FR-58)            | Duplicate/out-of-order/missed-event tests pass                                | P0   |
| FR-h59 | Workspace identity derived from verified membership + server-owned authz state; never trusted from path/body alone (FR-59)                              | Cross-workspace injection tests pass                                          | P0   |
| FR-h60 | Service-to-service calls authenticate workload identity; carry user/workspace/actor/purpose/policy/trace context (FR-60)                                | Context propagation verified in integration tests                             | P0   |
| FR-h61 | Complete erasure workflow across all stores (FR-61)                                                                                                     | Erasure matrix test passes (NFR-13)                                           | P0   |
| FR-h62 | Deletion receipt (FR-62)                                                                                                                                | Receipt fields per INT-02 §6                                                  | P0   |
| FR-h63 | AI model/prompt/tool-schema/retrieval/policy versions recorded per agent result (FR-63)                                                                 | Version record exists per result; NFR-18 reproducibility                      | P0   |
| FR-h64 | Source-grounded explanations; low-confidence facts labeled (FR-64)                                                                                      | Label tests pass                                                              | P0   |
| FR-h65 | Quarantine unsupported/malicious/malformed/oversized docs; safe failure state (FR-65)                                                                   | Quarantine tests pass                                                         | P0   |
| FR-h66 | External-integration registry: access basis, scopes, quota, terms-review date, owner, kill switch (FR-66)                                               | Registry rows exist for Gmail; AUTO-01..03 present                            | P0   |
| FR-h67 | Version-pinned MCP profile; spec upgrade needs security+interop regression tests (FR-67)                                                                | MCP pin + regression gate                                                     | P1   |
| FR-h68 | Memory correction with provenance + supersession (FR-68)                                                                                                | Correction history test (FR-05)                                               | P0   |
| FR-h69 | Export/deletion progress without leaking internal infra details (FR-69)                                                                                 | UI shows safe progress only                                                   | P1   |
| FR-h70 | Untrusted content cannot modify policy/tool authz/approval (FR-70)                                                                                      | Injection suite pass                                                          | P0   |

## 6. Hardened NFR-15..NFR-22 (INT-02, phase rule)

| ID      | Requirement                                                                            | Acceptance                                       | Prio |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| NFR-h15 | Isolation via policy+constraints+authz+tests, not convention (NFR-15)                  | Isolation tests pass                             | P0   |
| NFR-h16 | Optimistic concurrency / precondition tokens on consequential writes (NFR-16)          | Concurrency tests pass                           | P0   |
| NFR-h17 | At-least-once safe consumers (idempotency/dedup) (NFR-17)                              | Duplicate-delivery tests pass                    | P0   |
| NFR-h18 | AI outputs reproducible from stored metadata (NFR-18)                                  | Reproducibility test (same inputs → same output) | P1   |
| NFR-h19 | SBOM + scans + signed images + provenance in CI (NFR-19)                               | CI artifacts exist                               | P1   |
| NFR-h20 | Deletion distinguishes primary vs backup-expiry completion (NFR-20)                    | Status model test                                | P0   |
| NFR-h21 | WCAG 2.2 AA incl. keyboard/SR/reduced-motion/zoom/non-color-only (NFR-21)              | a11y suite passes                                | P0   |
| NFR-h22 | Connector outage degrades only affected capability; no corruption/duplication (NFR-22) | Outage tests pass                                | P0   |

## 7. Automation-tier requirements (DEC-P02-05, CF-P03-01)

| ID      | Requirement                                                                                                         | Acceptance                                            | Prio     |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| AUTO-01 | Tier-1 lawful automation always-on (watch, extract, draft, remind) (`STAKEHOLDER_DECISION`: DEC-P02-05)             | Runs on official APIs; kill switch operable           | P0       | IMPLEMENTED_UNVERIFIED | `apps/api/src/api/agents/` (23 agent dirs); kill switches in AUTO-01..03 |
| AUTO-02 | Tier-2 discovery scraping — PROPOSAL: flag OFF default, opt-in, pacing, kill; legal review (P13) before default-ON  | Flag defaults OFF; opt-in consent; kill stops fetches | P2 gated | DESIGN_ONLY            | `12-implementation-gap-requirements.md` GAP-11                           |
| AUTO-03 | Tier-3 auto-apply — PROPOSAL: review-first default; autopilot gated (legal review, per-plan consent, pacing, audit) | Review-first ships P1; autopilot P3 behind gate       | P1/P3    | DESIGN_ONLY            | `12-implementation-gap-requirements.md` GAP-11                           |

## 8. Implementation gap requirements (zero-trust audit 2026-08-16)

> Derived from a line-by-line codebase audit verifying actual implementation
> state against documented claims. Each requirement maps to a specific gap
> identified in `12-implementation-gap-requirements.md`. Full gap details, root
> causes, and fix efforts in that document.

| ID    | Requirement                                                                   | Acceptance                                                                                                                                 | Prio | Impl Status            | Evidence                                                                                    |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------- | ------------------------------------------------------------------------------------------- |
| FR-71 | TenantContext middleware mounted and active in request pipeline               | `main.py` middleware stack includes TenantMiddleware; `X-Tenant-ID` header parsed on every request; `app.tenant_id` GUC set for PostgreSQL | P0   | NOT_IMPLEMENTED        | `middleware/tenant.py:62` exists but `main.py` never imports it                             |
| FR-72 | IP filtering middleware mounted and active                                    | `main.py` includes IPAllowlistMiddleware; blocked IPs receive 403                                                                          | P0   | NOT_IMPLEMENTED        | `middleware/ip_filter.py:42` exists but `main.py` never imports it                          |
| FR-73 | RLS policies cover all tenant-scoped tables                                   | All 13 tables with `tenant_id` have PostgreSQL RLS policies; coverage test passes                                                          | P0   | PARTIAL                | `migrations/0005_rls.py` covers 4/13 tenant_id tables                                       |
| FR-74 | Session variable `app.tenant_id` set on every request                         | `set_rls_session_vars()` called from request path; RLS policies receive correct tenant context                                             | P0   | NOT_IMPLEMENTED        | `tenant.py:40-59` function exists but never called (depends on FR-71)                       |
| FR-75 | Authorization enforced consistently across all protected routes               | All non-public routes enforce authorization; audit of all 26 routers confirms no unprotected endpoints                                     | P0   | PARTIAL                | `middleware/rbac.py` is DI helper (`Depends`), not middleware; opt-in per-route             |
| FR-76 | `/metrics` endpoint exposed and functional                                    | `Instrumentator().instrument(app).expose(app)` uncommented; `/metrics` returns Prometheus format                                           | P1   | NOT_IMPLEMENTED        | `main.py:135` — commented out                                                               |
| FR-77 | FastAPI OTel auto-instrumentation active                                      | `instrument_fastapi(app)` uncommented; OTel spans created per request; trace context propagated                                            | P1   | NOT_IMPLEMENTED        | `main.py:136` — commented out (typo: `instrumement_fastapi`)                                |
| FR-78 | SAML signature validation implemented                                         | SAML assertion XML signature verified; unsigned assertions rejected                                                                        | P2   | STUB                   | `services/saml.py:58` — `# TODO: Add real SAML signature validation`; no router wiring      |
| FR-79 | All MVP pages use real API or documented as future scope                      | billing/admin/marketplace pages either connect to real API or are explicitly marked T2/T3                                                  | P1   | PARTIAL                | `billing/page.tsx`, `admin/page.tsx`, `marketplace/page.tsx` use hardcoded mock data        |
| FR-80 | Test infrastructure directories populated                                     | Each testing/ subdir has at least 1 test file; tests pass in CI                                                                            | P1   | NOT_IMPLEMENTED        | `testing/smoke/`, `security/`, `chaos/`, `fuzz/`, `visual-regression/` = 0 files each       |
| FR-81 | Service-to-service auth via workload identity implemented                     | Workers carry service tokens (HMAC/bearer); no user creds in service context                                                               | P1   | DESIGN_ONLY            | ADR-025: PROPOSED — zero code; grep for `service_token` = 0 hits                            |
| FR-82 | All tables storing user/workspace data have tenant_id or documented exemption | All critical tables have `tenant_id` column or alternative isolation strategy                                                              | P0   | PARTIAL                | 13/36 tables have `tenant_id`; 23 tables lack it (incl. workspaces, documents, resumes)     |
| FR-83 | Typed API contracts accessible to both frontend and backend                   | `packages/shared-types` or equivalent provides typed contracts; frontend imports verified                                                  | P0   | IMPLEMENTED_UNVERIFIED | `packages/shared-types/src/types/` (10 type files exist; import path UNVERIFIED)            |
| FR-84 | Design system components cover MVP page needs                                 | ui-kit provides tables, forms, navigation, data display used across MVP pages                                                              | P1   | PARTIAL                | `packages/ui-kit/src/components/` — only 5 components (Button, Card, Input, Modal, Spinner) |
| FR-85 | Build system references real packages only                                    | All `make` targets reference existing packages; no phantom `@vaeloom/*` references                                                         | P0   | NOT_IMPLEMENTED        | Makefile references `@vaeloom/memory-store`, `@vaeloom/auth-service` etc. — none exist      |
