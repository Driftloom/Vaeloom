# MVP-P03 — 03. Requirements (DEL-MVP-P03-01)

> Atomic, testable, traceable. IDs stable across phases. Acceptance per
> requirement. Owners: BA/Product. Status: `APPROVED_BASELINE` pending gate.
> Sources: INT-02, INT-05, P01/P02 evidence, BQ-P02-01..04 (user decisions).

## 0. Legend

- **Priority:** P0 (release-blocking) / P1 (must in MVP) / P2 (should) / P3
 (later)
- **Requirement IDs:** FR-* (functional), NFR-* (non-functional), FR-h*
 (hardened FR-52–FR-70 from INT-02), NFR-h* (hardened NFR-15–NFR-22)
- **Acceptance:** measurable, testable condition

## 1. Functional requirements — journeys (WS-03.1)

### 1.1 Ingest & profile

| ID | Requirement | Acceptance | Prio |
| ----- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| FR-01 | User signs up with email/password (India, 18+, individual) | Signup completes; age/region/entity captured; consent notice shown (DPDP §5) | P0 |
| FR-02 | Onboarding captures profile (name, education, skills, experience, target roles) | Structured profile saved to workspace; editable | P0 |
| FR-03 | Resume upload (PDF/DOCX/TXT) parsed into structured profile | Parse accuracy ≥90% on eval set (BQ-P02-03); errors surfaced for correction | P0 |
| FR-04 | User can paste job links; system extracts title/org/desc/skills/deadline | Enrichment record with provenance (source URL, timestamp) | P1 |
| FR-05 | Correction of any extracted fact creates new version + supersession link, never silent overwrite (FR-68) | Correction history retained; provenance intact | P0 |

### 1.2 Memory (6 types — INT-02)

| ID | Requirement | Acceptance | Prio |
| ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- |
| FR-10 | Persistent memory stores 6 types: profile, preferences, applications, deadlines, interactions, learnings | Every type queryable; retrieval hit-rate ≥80% (BQ-P02-03) | P0 |
| FR-11 | Memory retrieval is source-grounded; low-confidence inference never shown as confirmed fact (FR-64) | Unconfirmed facts labeled; source link on confirmed facts | P0 |
| FR-12 | Memory facts versioned with provenance (model/prompt/retrieval/tool versions — FR-63) | Version metadata recorded per fact | P0 |
| FR-13 | Untrusted retrieved content cannot modify policy/approval/tool authz (FR-70) | Injection attempts fail; tests prove no policy change | P0 |

### 1.3 Organization agent

| ID | Requirement | Acceptance | Prio |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- |
| FR-20 | Documents classified, named, tagged, deduplicated; file ops proposed, never auto-applied | Proposals list shown; move/rename/archive only after approval | P1 |

### 1.4 Resume & ATS agents

| ID | Requirement | Acceptance | Prio |
| ----- | --------------------------------------------------------------------- | ---------------------------------------------------- | ---- |
| FR-21 | Resume tailored to a job description (keyword matching + suggestions) | Suggested edits with rationale; user applies edits | P1 |
| FR-22 | ATS compatibility score computed (parseability, keywords, format) | Score reproducible on eval set; explanation provided | P1 |

### 1.5 Job Search & Application agent (DEC-P02-05 tiered)

| ID | Requirement | Acceptance | Prio |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------- |
| FR-30 | (T1) Track user-performed searches/applications; status updates via manual entry + Gmail confirmations | Tracker reflects source-of-truth status; provenance recorded | P0 |
| FR-31 | (T1) Rank saved opportunities by fit (profile×JD) and propose deep-links | Ranked list with reason; no auto-submission | P0 |
| FR-32 | (T2) Read-only discovery scraping of public listings behind flag AUTO-02 (opt-in, pacing, kill switch) | Flag OFF by default; per-user opt-in; no anti-bot evasion; kill stops fetches | P2 (gated) |
| FR-33 | (T3) Auto-apply engine: review-first mode (draft → user edit → send) | Per-application approval record; send only with user action | P1 (review-first) |
| FR-34 | (T3) Autopilot mode (per-plan rules) gated on legal review + consent + AUTO-03 | Plan config, pacing caps, audit, kill; never default-ON | P3 (gated) |
| FR-35 | Every application records source, approval, artifact versions, status provenance, timestamps (FR-34) | Full audit trail per application | P0 |

### 1.6 Gmail agent (draft-only base; T3 per-user send)

| ID | Requirement | Acceptance | Prio |
| ----- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---- |
| FR-40 | Gmail read via official API (polling; push = upgrade path EXT-12) | Polling watcher extracts new mail; fallback sync; no send scope by default | P0 |
| FR-41 | Deadline extraction from email (interviews, offers, application windows) | Accuracy ≥90% on eval set (BQ-P02-03); facts stored with provenance | P0 |
| FR-42 | Draft creation (cover letters, replies, follow-ups) — never auto-send | Drafts created only on explicit user action or T3 review-first approval | P0 |
| FR-43 | Reminder scheduling from deadlines; external calendar writes need approval (Scheduler agent) | Reminder fired on schedule; calendar writes approved | P1 |

### 1.7 Trust/approval UX

| ID | Requirement | Acceptance | Prio |
| ----- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| FR-50 | Consequential actions require immutable payload-bound expiring approval (ADR-009) | Approval record binds action+payload+user+expiry; replay fails | P0 |
| FR-51 | Proposals separate from actions; suggestion never auto-executes (INT-02 §3) | Zero action outside bound approval (acceptance: replay/payload-mutation/expiry/cross-workspace tests pass) | P0 |

### 1.8 Export/erasure

| ID | Requirement | Acceptance | Prio |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---- |
| FR-60 | Export all user data in documented, versioned, importable format (NFR-23) | Export completes; format spec documented; PII-free CI test | P0 |
| FR-61 | Erasure across relational, graph, vector, search, object versions, cache, queue, secret, analytics (FR-61) | 100% completeness verified by test matrix (BQ-P02-03) | P0 |
| FR-62 | Deletion receipt: immediate actions, backup expiry, exceptions, status (FR-62) | Receipt issued; distinguishes primary vs backup completion (NFR-20) | P0 |

## 2. Quality attributes & SLOs (WS-03.2)

| ID | Requirement | Acceptance | Prio |
| ------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---- |
| NFR-01 | Availability SLO ≥99.5% monthly for core API | Measured via health checks; alerting | P1 |
| NFR-02 | p95 latency: LLM-assisted replies ≤15s; read paths ≤500ms | Load test at 100 concurrent (BQ-P02-04) | P1 |
| NFR-03 | Design for 100 concurrent; verify 1,000 concurrent upper bound | Load test proves headroom; scale trigger measured | P1 |
| NFR-04 | Error/timeout/retry/backpressure defined per integration (prompt §13) | Failure-injection tests cover provider outage | P0 |
| NFR-05 | Connector outage degrades only that capability; no memory corruption/duplication (NFR-22) | Isolation test: Gmail down → other agents unaffected | P0 |
| NFR-06 | Webhooks/queue consumers at-least-once safe (idempotency+dedup) (NFR-17) | Duplicate delivery produces no duplicate side effect | P0 |
| NFR-07 | Optimistic concurrency on consequential writes (NFR-16) | Version conflicts detected; precondition tokens enforced | P0 |

## 3. Data requirements (WS-03.3)

| ID | Requirement | Acceptance | Prio |
| ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---- |
| NFR-10 | Relational (Postgres) = system of record; graph/vector/search/cache are rebuildable projections (INT-02) | Rebuild test: projection rebuilt from relational, byte-equal | P0 |
| NFR-11 | Provenance carried through transformations, retrieval, AI output, action | Every fact/action traceable to source artifact + version | P0 |
| NFR-12 | Stable IDs + versioned mappings; no inferred migration/memory values | Schema tests; no placeholder inference | P0 |
| NFR-13 | Retention per purpose; user deletion = primary erasure + backup-expiry semantics (NFR-20) | Retention policy table; deletion status model per INT-02 §6.6 | P0 |

## 4. Security/privacy/accessibility (WS-03.3)

| ID | Requirement | Acceptance | Prio |
| ------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| NFR-15 | Cross-workspace isolation via DB policy + composite constraints + service authz + tests (NFR-15) | Isolation suite passes (per-workspace queries, RLS) | P0 |
| NFR-16 | OAuth per RFC 9700 BCP; least-privilege scopes; secrets encrypted | OAuth flows pass security tests; no secret in logs | P0 |
| NFR-17 | Consent + notice per DPDP §5/§6; consent withdrawal functional | Notice shown; withdrawal works; consent records kept | P0 |
| NFR-18 | Prompt injection defense on all LLM input paths | Injection tests pass; policy/approval unchanged (FR-70) | P0 |
| NFR-19 | Security-relevant audit append-only + periodic anchoring (NFR-26) | Audit log append-only tests pass | P0 |
| NFR-20 | WCAG 2.2 AA on all MVP web workflows (NFR-21) | a11y tests (axe) pass; keyboard-only, SR, reduced-motion, zoom, non-color-only | P0 |
| NFR-21 | Supply chain: SBOM, dependency/image/IaC scans, signed release images, provenance (NFR-19) | CI produces SBOM + scans; images signed | P1 |
| NFR-22 | Raw content to external models minimized, purpose-bound, logged, governed by provider DPA config (NFR-25) | Provider config validated; egress minimal; DPA setting recorded | P1 |

## 5. Hardened requirements — FR-52..FR-70 (INT-02, phase rule)

| ID | Requirement | Acceptance | Prio |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---- |
| FR-h52 | Provider-neutral embedding interface; persist model/version/dimension/input-type/normalization/chunking metadata (FR-52) | Embedding registry + metadata persisted; NFR-24 no fixed dimension assumption | P0 |
| FR-h60 | Service-to-service calls authenticate workload identity; carry user/workspace/actor/purpose/policy/trace context (FR-60) | Context propagation verified in integration tests | P0 |
| FR-h61 | Complete erasure workflow across all stores (FR-61) | Erasure matrix test passes (NFR-13) | P0 |
| FR-h62 | Deletion receipt (FR-62) | Receipt fields per INT-02 §6 | P0 |
| FR-h63 | AI model/prompt/tool-schema/retrieval/policy versions recorded per agent result (FR-63) | Version record exists per result; NFR-18 reproducibility | P0 |
| FR-h64 | Source-grounded explanations; low-confidence facts labeled (FR-64) | Label tests pass | P0 |
| FR-h65 | Quarantine unsupported/malicious/malformed/oversized docs; safe failure state (FR-65) | Quarantine tests pass | P0 |
| FR-h66 | External-integration registry: access basis, scopes, quota, terms-review date, owner, kill switch (FR-66) | Registry rows exist for Gmail; AUTO-01..03 present | P0 |
| FR-h67 | Version-pinned MCP profile; spec upgrade needs security+interop regression tests (FR-67) | MCP pin + regression gate | P1 |
| FR-h68 | Memory correction with provenance + supersession (FR-68) | Correction history test (FR-05) | P0 |
| FR-h69 | Export/deletion progress without leaking internal infra details (FR-69) | UI shows safe progress only | P1 |
| FR-h70 | Untrusted content cannot modify policy/tool authz/approval (FR-70) | Injection suite pass | P0 |

## 6. Hardened NFR-15..NFR-22 (INT-02, phase rule)

| ID | Requirement | Acceptance | Prio |
| ------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| NFR-h15 | Isolation via policy+constraints+authz+tests, not convention (NFR-15) | Isolation tests pass | P0 |
| NFR-h16 | Optimistic concurrency / precondition tokens on consequential writes (NFR-16) | Concurrency tests pass | P0 |
| NFR-h17 | At-least-once safe consumers (idempotency/dedup) (NFR-17) | Duplicate-delivery tests pass | P0 |
| NFR-h18 | AI outputs reproducible from stored metadata (NFR-18) | Reproducibility test (same inputs → same output) | P1 |
| NFR-h19 | SBOM + scans + signed images + provenance in CI (NFR-19) | CI artifacts exist | P1 |
| NFR-h20 | Deletion distinguishes primary vs backup-expiry completion (NFR-20) | Status model test | P0 |
| NFR-h21 | WCAG 2.2 AA incl. keyboard/SR/reduced-motion/zoom/non-color-only (NFR-21) | a11y suite passes | P0 |
| NFR-h22 | Connector outage degrades only affected capability; no corruption/duplication (NFR-22) | Outage tests pass | P0 |

## 7. Automation-tier requirements (DEC-P02-05, CF-P03-01)

| ID | Requirement | Acceptance | Prio |
| ------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| AUTO-01 | Tier-1 lawful automation always-on (watch, extract, draft, remind) | Runs on official APIs; kill switch operable | P0 |
| AUTO-02 | Tier-2 discovery scraping flag: OFF default, opt-in, pacing, kill | Flag defaults OFF; opt-in consent; kill stops fetches | P2 gated |
| AUTO-03 | Tier-3 auto-apply: review-first default; autopilot gated (legal review, per-plan consent, pacing, audit) | Review-first ships P1; autopilot P3 behind gate | P1/P3 |
