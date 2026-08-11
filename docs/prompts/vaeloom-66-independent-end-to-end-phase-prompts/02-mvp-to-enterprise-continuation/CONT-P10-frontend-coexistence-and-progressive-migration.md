# Vaeloom MVP-to-Enterprise Continuation — Independent End-to-End Phase Prompt 10: Frontend Coexistence and Progressive Migration

> **Prompt ID:** `CONT-P10`  
> **Artifact type:** Standalone generate + audit + execute + verify + gate +
> remediate + handoff prompt  
> **Generated:** 2026-08-04  
> **Truth status:** Design/prompt artifact complete; target repository
> execution, runtime tests, deployment and certification remain `NOT_EXECUTED`
> until real evidence is attached.  
> **Primary governing source:**
> `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`

## How to Use This File

1. Attach or mount the complete Vaeloom source corpus, the exact repository
   revision, relevant environments, datasets, credentials through an approved
   secret mechanism, and the predecessor handoff.
2. Run the mandatory predecessor/current-state audit below **before** doing
   phase work.
3. Stop on blockers. Do not invent missing business, legal, security, data,
   scale, access or approval facts.
4. Execute only authorized changes. Preserve an exact action/evidence log and
   distinguish generated instructions from work actually run.
5. Run all applicable tests and independent reviews, calculate the gate score,
   remediate failures, and issue an explicit `GO`, `CONDITIONAL GO`, or `NO-GO`.
6. Generate the complete next-phase handoff only after approval.

## Track Mission and Non-Negotiable Context

**Mission:** Evolve a proven MVP into the enterprise platform through
evidence-gated expand–contract migration, compatibility, dual-run
reconciliation, design-partner pilots, reversible cutover and retirement of
legacy paths.

- Continuation is a migration program, not a greenfield rewrite and not a
  duplicate enterprise plan.
- The MVP remains serviceable during migration; every incompatible change needs
  an adapter, migration path, observability and rollback.
- Six-to-22 memory expansion preserves stable IDs, provenance, corrections, user
  ownership, retention and deletion semantics.
- Eight-to-28 agent expansion starts in shadow mode and requires permission,
  quality, cost and safety evidence before action authority.
- Use expand–contract schemas, dual writes only where justified, shadow reads,
  reconciliation ledgers and per-wave cutover checkpoints.
- Legacy retirement requires zero required traffic, successful restore/rollback
  drills, archived evidence and explicit owner approval.

**Future boundary:** Future evolution must remain compatible with tenant cells,
regional residency, plugin/MCP governance and model/provider changes without
creating an unbounded permanent dual-run estate.

## Vaeloom Source Corpus That Must Be Inspected

Use the actual available versions and record hashes/versions. Do not rely only
on summaries.

- `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` — governing
  execution, audit, evidence, gate, remediation and handoff contract.
- `vaeloom-mvp-e2e-enterprise-hardened.md` — authoritative MVP corrections and
  hardening decisions.
- `vaeloom-mvp-e2e.md` — MVP Phase 0–21 execution baseline.
- `vaeloom-enterprise-e2e.md` — enterprise Phase 0–21 execution baseline.
- `01-vaeloom-mvp-spec.md` — canonical MVP product scope;
  `05-vaeloom-mvp-spec.md` is superseded historical context.
- `06-vaeloom-enterprise-paper.md` — canonical enterprise vision;
  `vaeloom-enterprise-paper.md` is superseded historical context.
- `02-system-architecture.md`, `03-agent-workflow.md`,
  `04-memory-knowledge-graph.md` — architecture, workflow and memory intent.
- `vaeloom-complete-documentation.md`, `vaeloom-documentation-site.md`,
  `vaeloom-how-it-works-visual.md` — broader context and presentation views;
  resolve conflicts against canonical authority order.
- `00-gap-analysis-report.md`, `00-documentation-completion-report.md` —
  documentation maturity only, never runtime implementation evidence.
- Any attached repository, commit history, API/schema artifacts, environment
  configuration, tests, scans, deployment records, monitoring, incidents and
  approvals — these outrank design prose for actual implementation state.

## Current Authoritative Standards Overlay — verified 2026-08-04

The executing team must re-check the latest revision and applicability at phase
start. These references supplement the Vaeloom source corpus; they do not
silently replace approved product decisions.

| Standard / source                           | Verified snapshot                                                                        | Required use                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model Context Protocol specification        | 2026-07-28                                                                               | Version-pinned MCP profile, authorization, tasks/extensions, compatibility and deprecation testing                                                      |
| OWASP Top 10 for Agentic Applications       | 2026 edition                                                                             | Agent goal hijack, tool misuse, identity/privilege abuse, supply chain, unexpected execution, memory/context poisoning, inter-agent and cascading risks |
| OWASP GenAI/LLM security guidance           | Current official project                                                                 | Prompt injection, unsafe output handling, sensitive disclosure, excessive agency and model/tool supply-chain controls                                   |
| NIST AI RMF 1.0 + Generative AI Profile     | Official NIST profile                                                                    | Govern/Map/Measure/Manage, evaluation, documentation, human oversight and residual-risk ownership                                                       |
| WCAG 2.2                                    | W3C Recommendation                                                                       | Level AA complete-process accessibility target; automated and manual evidence                                                                           |
| OAuth 2.0 Security BCP                      | RFC 9700 / BCP 240                                                                       | Exact redirect matching, PKCE, replay resistance, constrained tokens, least privilege and secure refresh-token handling                                 |
| OpenAPI Specification                       | 3.2.0 current at snapshot                                                                | Machine-readable HTTP contracts; pin the chosen supported minor version and compatibility tests                                                         |
| Arazzo Specification                        | 1.1.0 current at snapshot                                                                | Optional machine-readable multi-call workflows and dependencies where useful                                                                            |
| OpenTelemetry                               | Verify latest official spec at execution                                                 | Trace/metric/log context, semantic conventions and privacy-aware telemetry                                                                              |
| SLSA                                        | 1.2 current at snapshot                                                                  | Build/source provenance, artifact integrity and verifiable supply-chain evidence                                                                        |
| NIST SSDF                                   | SP 800-218 v1.1                                                                          | Secure software-development practices and evidence                                                                                                      |
| EU AI Act official guidance                 | Transparency obligations applicable from 2026-08-02; other timelines must be re-verified | AI disclosure, use-case classification, documentation, oversight and professional legal review                                                          |
| India DPDP Act 2023 + final DPDP Rules 2025 | Staged commencement; verify provisions in force                                          | Notice/consent, rights, children’s data, security and breach duties for India scope                                                                     |
| FERPA official guidance                     | Current                                                                                  | Institution-controlled education-record roles and contracts where applicable                                                                            |
| COPPA revised rule and FTC guidance         | Current                                                                                  | Under-13 exclusion or separately reviewed child-directed design; age and parental-consent controls                                                      |
| Gmail and GitHub official integration docs  | Verify current API versions/scopes                                                       | Push-watch renewal/reconciliation, app permissions, quotas and least-privilege connectors                                                               |

Record each selected standard, exact version/date, applicability, decision
owner, control mapping and verification evidence in the phase source register.

## Mandatory Previous-Phase Forensic Audit and Entry Decision

Do **not** assume `CONT-P09` passed because a document says “complete.” Re-audit
its actual artifacts and evidence before executing this phase.

### Predecessor identity

- **Previous phase:**
  `CONT-P09 — UX, Consent, Admin, and Change-Experience Migration`
- **Current phase:** `CONT-P10 — Frontend Coexistence and Progressive Migration`
- **Required predecessor decision:** approved gate, immutable handoff, exact
  repository revision/environment and no expired exception.

### Expected predecessor outputs to audit

## 22. Deliverables

- `DEL-CONT-P09-01` — IA/journeys; versioned, owned, reviewed and linked.
- `DEL-CONT-P09-02` — screen/state specs; versioned, owned, reviewed and linked.
- `DEL-CONT-P09-03` — design system; versioned, owned, reviewed and linked.
- `DEL-CONT-P09-04` — content/errors; versioned, owned, reviewed and linked.
- `DEL-CONT-P09-05` — WCAG/usability evidence plan; versioned, owned, reviewed
  and linked.
- Updated risk, decision, assumption, evidence, traceability and change
  registers.
- Gate report and next-phase handoff.

### Expected predecessor Definition of Done to audit

## 27. Definition of Done

- [ ] Requirements implemented or approved NOT_APPLICABLE.
- [ ] Critical tests/reviews pass in representative environments.
- [ ] Security/privacy/data/AI/accessibility/reliability/operations blockers
      closed.
- [ ] Deliverables versioned/owned/reviewed/linked.
- [ ] Evidence/traceability complete and reproducible.
- [ ] Rollback/recovery/support proven where applicable.
- [ ] No hidden manual step or critical dependency.
- [ ] Weighted gate approves progression.

### Forensic audit procedure

1. Verify handoff identity, approver, timestamp, repository commit/release,
   environment, dataset/model/config versions and artifact hashes.
2. Reconcile predecessor requirements → design → code/config → tests → evidence
   → risks/exceptions → gate. Sample critical evidence directly; do not accept
   screenshots or summaries alone when reproducible evidence should exist.
3. Re-run or independently verify critical tests relevant to this phase,
   including negative, isolation, security/privacy, data integrity,
   rollback/recovery and failure-path checks.
4. Confirm all mandatory deliverables exist, open correctly, are current, owned,
   reviewed and match the committed implementation.
5. Inspect unresolved findings, waivers and assumptions for severity, controls,
   approver, expiry, monitoring and prohibited downstream work.
6. Check regression from later changes since predecessor approval; invalidate
   stale evidence.
7. Record every discrepancy as `FAILED`, `PARTIAL`, `MISSING`, `CONTRADICTORY`,
   `STALE`, `UNVERIFIED`, or `PASS`.

### Predecessor completion scorecard

| Category                                        | Weight | Pass condition                                                        |
| ----------------------------------------------- | -----: | --------------------------------------------------------------------- |
| Deliverables and acceptance completeness        |     20 | All mandatory artifacts satisfy approved acceptance                   |
| Test and verification evidence                  |     20 | Critical tests reproducible and passing in representative environment |
| Security, privacy, data and AI controls         |     15 | No critical/high blocker; required reviews current                    |
| Technical correctness and integration           |     15 | Implementation matches contracts and dependency assumptions           |
| Reliability, rollback, migration and operations |     10 | Recovery/rollback/support evidence exists where applicable            |
| Traceability and evidence integrity             |     10 | Complete chain with immutable locations and exact versions            |
| Documentation and handoff quality               |      5 | Current, unambiguous and usable by this phase                         |
| Residual risk and exception governance          |      5 | Owned, time-bounded, monitored and non-blocking                       |

### Entry decision algorithm

- **`GO`**: score **≥95/100**, every mandatory predecessor requirement is
  `PASS`, no critical/high blocker, no expired waiver and no stale baseline.
- **`CONDITIONAL GO — NON-DEPENDENT WORK ONLY`**: score **88–94**, zero
  mandatory blocker, and the accountable approver explicitly lists permitted
  work, prohibited work, controls and expiry. It may not authorize dependent
  implementation, migration or release.
- **`NO-GO — PREDECESSOR REMEDIATION REQUIRED`**: score below 88,
  missing/reproducibility failure, unresolved critical/high issue, invalid
  handoff, isolation/privacy/security failure, unproven rollback, or
  contradictory source/implementation.

On `NO-GO`, switch to `AUDIT_COMPLETED_PHASE` then `REMEDIATE_FAILED_PHASE` for
`CONT-P09`. Re-run its full gate and generate a new handoff before resuming this
file.

### Audit evidence table

| Audit ID        | Predecessor requirement/deliverable | Artifact/evidence | Independent check | Status       | Finding/impact | Owner          | Remediation/expiry |
| --------------- | ----------------------------------- | ----------------- | ----------------- | ------------ | -------------- | -------------- | ------------------ |
| PA-CONT-P10-001 | TO_BE_VERIFIED                      | TO_BE_VERIFIED    | TO_BE_VERIFIED    | NOT_EXECUTED | TO_BE_VERIFIED | TO_BE_VERIFIED | TO_BE_VERIFIED     |

## Phase-Specific Future-Readiness and Missing-Idea Overlay

These are additional enterprise-quality considerations. They become required
when relevant to the phase scope or risk; otherwise record them as a governed
future backlog with adoption triggers and owner.

- Enforce frontend performance and accessibility budgets in CI while retaining
  manual assistive-technology validation.
- Design resilient client state for retries, duplicate submissions, stale
  approvals, partial async jobs and reconnects.
- Prevent sensitive context from leaking into client logs, analytics, caches or
  error reporting.
- Instrument user-visible success and failure states without dark patterns or
  inaccessible motion.
- Every future-ready improvement must specify compatibility horizon, migration
  owner, reconciliation metric, cutover trigger, rollback trigger and
  legacy-retirement condition.

For each deferred idea, record: problem/evidence, target users, dependencies,
security/privacy/data implications, cost, compatibility/migration impact,
validation experiment, adoption trigger, owner and sunset/rejection condition.
Do not expand current scope silently.

---

## Copy-Ready Governing Execution Prompt

The content below is the complete phase execution prompt. The executing
agent/team must follow the added standalone audit and standards overlays above
as mandatory extensions.

# Enterprise Execution Prompt — CONT Phase 10: Frontend Coexistence and Progressive Migration

> **Mode:** `GENERATE_AND_EXECUTE_PHASE` when authorized access exists;
> otherwise preserve runtime work as `NOT_EXECUTED`. **Track status:** MIGRATION
> DESIGN BASELINE; starts only after MVP evidence gate; execution remains
> NOT_EXECUTED **Phase type:** `FRONTEND_IMPLEMENTATION` **Phase ID:**
> `CONT-P10`

```yaml
request:
  mode: GENERATE_AND_EXECUTE_PHASE
  current_phase_id: CONT-P10
  current_phase_name: Frontend Coexistence and Progressive Migration
execution_rules:
  allow_assumptions: false
  allow_destructive_changes: false
  allow_production_changes: false
  require_source_validation: true
  require_test_execution: true
  require_evidence: true
  require_traceability: true
  require_quality_gate: true
  require_next_phase_handoff: true
```

## 1. Mission

Execute a controlled migration phase that will implement the approved frontend
with typed contracts, accessibility, security, performance, tests and
rollback-safe delivery. Preserve backward compatibility, provenance, user rights
and rollback.

Track objective: Validate MVP evidence and evolve tenancy, identity, memory,
agents, platform, connectors, admin, billing and compliance via expand-contract,
dual-run, reconciliation, pilot, rollback and retirement.

Separate generated instructions, design, actual changes, tests actually run and
work that could not be executed. Never convert documentation completeness into
runtime success.

## 2. Activated Enterprise Roles

Frontend Engineer; UX Lead; Accessibility Specialist; API Engineer; Security
Engineer; QA Automation Engineer; SRE.

The accountable role owns the gate. Security, privacy, data, accessibility,
reliability and operations reviewers retain veto on mandatory blockers.

## 3. Verified Project Context

- **Context:** Controlled evolution from a proven MVP; not a rewrite and not
  permission to assume MVP success; preserves memory ownership, provenance,
  approvals, data rights and compatibility.
- **Architecture:** Strangler/expand-contract path with compatibility adapters,
  migration control plane, per-tenant/cell flags, dual-run where measurable,
  reconciliation ledgers, rollback checkpoints and explicit retirement.
- **In scope:** Validate MVP evidence and evolve tenancy, identity, memory,
  agents, platform, connectors, admin, billing and compliance via
  expand-contract, dual-run, reconciliation, pilot, rollback and retirement.
- **Out of scope:** Big-bang rewrite, silent permission expansion, unverified
  dual writes, all-tenant cutover or enterprise launch without design-partner
  evidence.
- **Phase-specific rule:** Use route/component flags and adapters; avoid
  unrelated frontend forks.
- **Truth rule:** inspect a real repository/environment before claiming
  implementation.

Track-wide fixed decisions:

- Continuation entry requires real MVP repository, release, user evidence,
  incidents, SLOs, evals and approved handoff.
- Every migration unit has mapping version, counts/checksums, owner,
  reconciliation, cutover flag and rollback.
- Six memory types evolve additively to 22 without overwriting provenance or
  guessing fields.
- Agents expand only after necessity review, shadow mode, evaluation, safety and
  retirement criteria.
- PaaS-to-Kubernetes or service extraction requires measured justification and
  operations budget.
- Cutover is per design partner/tenant/cell with canary, pause, rollback and
  stabilization.

## 4. Source Register

| ID     | Source                                                        | Owner/authority     | Use                                                                  | Location                                                                  |
| ------ | ------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Vaeloom source team | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation | uploaded project file                                                     |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md                        | Vaeloom source team | Authoritative MVP corrections and release evidence                   | uploaded project file                                                     |
| INT-03 | vaeloom-mvp-e2e.md                                            | Vaeloom source team | MVP 0–21 execution baseline                                          | uploaded project file                                                     |
| INT-04 | vaeloom-enterprise-e2e.md                                     | Vaeloom source team | Enterprise 0–21 execution baseline                                   | uploaded project file                                                     |
| INT-05 | 01-vaeloom-mvp-spec.md                                        | Vaeloom source team | Canonical MVP product scope                                          | uploaded project file                                                     |
| INT-06 | 06-vaeloom-enterprise-paper.md                                | Vaeloom source team | Canonical enterprise vision                                          | uploaded project file                                                     |
| INT-07 | 02-system-architecture.md                                     | Vaeloom source team | Memory-first architecture                                            | uploaded project file                                                     |
| INT-08 | 03-agent-workflow.md                                          | Vaeloom source team | Agent and approval flow                                              | uploaded project file                                                     |
| INT-09 | 04-memory-knowledge-graph.md                                  | Vaeloom source team | MVP memory and RAG                                                   | uploaded project file                                                     |
| INT-10 | gap/completion reports                                        | Vaeloom source team | Documentation maturity; not runtime evidence                         | uploaded project file                                                     |
| EXT-01 | MCP Specification 2026-07-28                                  | MCP maintainers     | Protocol/security/interoperability                                   | https://modelcontextprotocol.io/specification/2026-07-28                  |
| EXT-02 | OWASP Agentic Applications Top 10 2026                        | OWASP               | Agent/tool/memory/identity risks                                     | https://owasp.org/                                                        |
| EXT-03 | OWASP LLM Applications Top 10 2025                            | OWASP               | Prompt injection, leakage, excessive agency                          | https://owasp.org/                                                        |
| EXT-04 | NIST AI RMF + Generative AI Profile                           | NIST                | AI governance and evaluation                                         | https://www.nist.gov/itl/ai-risk-management-framework                     |
| EXT-05 | WCAG 2.2                                                      | W3C                 | AA accessibility                                                     | https://www.w3.org/TR/WCAG22/                                             |
| EXT-06 | RFC 9700 OAuth Security BCP                                   | IETF                | OAuth security                                                       | https://www.rfc-editor.org/rfc/rfc9700                                    |
| EXT-07 | RFC 9728 Protected Resource Metadata                          | IETF                | OAuth/MCP resource metadata                                          | https://www.rfc-editor.org/rfc/rfc9728                                    |
| EXT-08 | OpenAPI Specification 3.2.0                                   | OpenAPI Initiative  | Current API contract                                                 | https://spec.openapis.org/oas/latest.html                                 |
| EXT-09 | OpenTelemetry Specification                                   | CNCF                | Telemetry/context propagation                                        | https://opentelemetry.io/docs/specs/                                      |
| EXT-10 | SLSA v1.2 and Sigstore                                        | OpenSSF/Sigstore    | Provenance and signing                                               | https://slsa.dev/spec/v1.2/                                               |
| EXT-11 | NIST SSDF SP 800-218 v1.1                                     | NIST                | Secure development                                                   | https://csrc.nist.gov/pubs/sp/800/218/final                               |
| EXT-12 | Gmail API Push Notifications                                  | Google              | Watch renewal and reconciliation                                     | https://developers.google.com/gmail/api/guides/push                       |
| EXT-13 | GitHub App Permissions                                        | GitHub              | Fine-grained least privilege                                         | https://docs.github.com/en/apps/                                          |
| EXT-14 | GDPR                                                          | European Union      | Privacy/data rights                                                  | https://eur-lex.europa.eu/eli/reg/2016/679/oj                             |
| EXT-15 | EU AI Act                                                     | European Union      | AI use-case classification                                           | https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai |
| EXT-16 | Digital Personal Data Protection Rules 2025                   | Government of India | India privacy/child-data duties                                      | https://www.meity.gov.in/                                                 |
| EXT-17 | FERPA and COPPA guidance                                      | US ED/FTC           | Student and under-13 privacy                                         | https://studentprivacy.ed.gov/                                            |

Verify version/date/applicability at phase start. Record conflicts and approved
resolution; secondary sources are contextual only.

## 5. Phase Scope

### In scope

- Application shell/routing
- Typed data/state
- Feature workflows
- Accessibility/performance/security
- Tests/delivery

### Out of scope

- Track exclusions: Big-bang rewrite, silent permission expansion, unverified
  dual writes, all-tenant cutover or enterprise launch without design-partner
  evidence.
- Later-phase work unless needed to remove a critical dependency.
- Production changes without authority, backup, rollback, monitoring and named
  approver.
- Claims of secure/compliant/accessible/scalable/tested/production-ready without
  evidence.

## 6. Entry Criteria

- [ ] Previous phase has approved gate and valid handoff, or this is Phase 0.
- [ ] Canonical sources, repository revision and environment are identified.
- [ ] Required access exists or is BLOCKING_ACCESS_UNKNOWN.
- [ ] Owners, reviewers, approver and change authority are named.
- [ ] Requirements/dependencies are traceable and no critical blocker makes work
      unsafe.
- [ ] Test, evidence, rollback and documentation plans exist.
- [ ] Real MVP production evidence exists; design-only MVP cannot start
      migration.

## 7. Input Readiness Matrix

| Input              | Status         | Required evidence                       | Owner               | Impact                    |
| ------------------ | -------------- | --------------------------------------- | ------------------- | ------------------------- |
| Requirements       | TO_BE_VERIFIED | Approved IDs/sources/acceptance         | Product/BA          | Blocks implementation     |
| Previous handoff   | TO_BE_VERIFIED | Gate/artifacts/risks/evidence/commit    | Previous owner      | Blocks execution          |
| Repository         | TO_BE_VERIFIED | Access/branch/commit/owners             | Engineering         | Blocks changes            |
| Environment        | TO_BE_VERIFIED | Reproducible representative setup       | Platform/QA         | Blocks runtime validation |
| Data               | TO_BE_VERIFIED | Classified/licensed/representative      | Data/Privacy        | Blocks data/AI tests      |
| Security/privacy   | TO_BE_VERIFIED | Threat/classification/retention/consent | Security/Privacy    | Blocks high-risk work     |
| Contracts/design   | TO_BE_VERIFIED | Approved version/compatibility          | Architecture/API/UX | Blocks dependent work     |
| Operations/release | TO_BE_VERIFIED | SLO/on-call/rollback/authority          | SRE/Release         | Blocks release work       |

## 8. Blocking Questions

| ID    | Question                                                          | Decision                             | Expected answer                        | Owner                 | Effect                  |
| ----- | ----------------------------------------------------------------- | ------------------------------------ | -------------------------------------- | --------------------- | ----------------------- |
| BQ-01 | Who is accountable approver and backup?                           | Approval and exceptions              | Name, role, scope                      | Program/Product       | Gate blocks             |
| BQ-02 | What repository version, environment and evidence baseline apply? | Prevents stale/imaginary execution   | Commit/release/environment/evidence    | Engineering           | Execution blocks        |
| BQ-03 | Which entities, ages, regions and use cases are in scope?         | Privacy/student/employment/AI duties | Entity→region→use case→age policy      | Legal/Privacy/Product | Release blocks          |
| BQ-04 | Which MVP release actually passed production gates?               | Migration source legitimacy          | Release; commit; gate; metrics         | MVP owner             | Blocks                  |
| BQ-05 | Which design partners and migration windows are available?        | Pilot/cutover/support                | Tenant; sponsor; users; region; window | Business/Program      | Pilot blocks            |
| BQ-06 | Which approved designs/contracts/environments are frozen?         | Material boundary/acceptance         | Structured decision with owner/date    | Accountable owner     | Blocks where unresolved |

Use `UNKNOWN`, `TO_BE_VERIFIED`, `REQUIRES_STAKEHOLDER_DECISION` or
`REQUIRES_PROFESSIONAL_REVIEW`; never invent values.

## 9. Requirements and Acceptance Criteria

| ID           | Domain           | Requirement                                                                                                                                                                                                                                         | Acceptance                                                |
| ------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| CONT-P10-R01 | Scope            | Execute a controlled migration phase that will implement the approved frontend with typed contracts, accessibility, security, performance, tests and rollback-safe delivery. Preserve backward compatibility, provenance, user rights and rollback. | Approved objective/scope/owners/authority                 |
| CONT-P10-R02 | Evidence         | Every material claim links to authoritative source or reproducible evidence.                                                                                                                                                                        | No unsupported completion/security/compliance/scale claim |
| CONT-P10-R03 | Security/Privacy | Applicable security, privacy, abuse, rights and AI risks are designed, tested and owned.                                                                                                                                                            | No unresolved critical finding or expired waiver          |
| CONT-P10-R04 | Quality          | Validation covers normal, negative, boundary, failure and recovery.                                                                                                                                                                                 | Critical tests pass in representative environment         |
| CONT-P10-R05 | Operations       | Ownership, telemetry, support, rollback and lifecycle are included.                                                                                                                                                                                 | Runbook/rollback/telemetry evidence exists                |
| CONT-P10-R06 | Data/AI          | Data lineage, scope, quality, retention and AI lineage are explicit.                                                                                                                                                                                | Source/version/owner/lifecycle reconstructable            |
| CONT-P10-R07 | Traceability     | Requirements map to design, artifacts, tests, evidence, risks and handoff.                                                                                                                                                                          | No unexplained critical gap                               |
| CONT-P10-R08 | Gate             | Progression is blocked until DoD and weighted gate pass.                                                                                                                                                                                            | Score ≥95 and zero mandatory blockers                     |

Add discovered requirements only with source, owner, priority, acceptance, test
and evidence location.

## 10. Enterprise Completeness Requirements

Assess business/product, architecture, data, security, privacy, compliance,
UX/accessibility, quality, performance, reliability, operations, DevOps,
documentation, cost, sustainability, localization, responsible AI, migration and
change. Mark each `APPLICABLE`, `NOT_APPLICABLE` with reason, or `BLOCKED`.

## 11. Workstreams

1. **WS-10.1: Application shell/routing.** Assign owner, inputs, dependencies,
   acceptance, tests, evidence, risks and handoff.
2. **WS-10.2: Typed data/state.** Assign owner, inputs, dependencies,
   acceptance, tests, evidence, risks and handoff.
3. **WS-10.3: Feature workflows.** Assign owner, inputs, dependencies,
   acceptance, tests, evidence, risks and handoff.
4. **WS-10.4: Accessibility/performance/security.** Assign owner, inputs,
   dependencies, acceptance, tests, evidence, risks and handoff.
5. **WS-10.5: Tests/delivery.** Assign owner, inputs, dependencies, acceptance,
   tests, evidence, risks and handoff.

## 12. Detailed Tasks and Subtasks

1. Set up typed app architecture, routes, boundaries, state/query and secure
   sessions.
2. Generate clients from contracts and fail CI on drift.
3. Implement all workflows/states without false optimistic success.
4. Use policy-derived capability display while server authorization remains
   authoritative.
5. Instrument privacy-safe journey/error/performance telemetry and tests.
6. Use route/component flags and adapters; avoid unrelated frontend forks.
7. For every changed artifact capture compatibility, owner, evidence, rollback
   and retirement.

Status every task as `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`IMPLEMENTED_UNVERIFIED`, `VERIFIED` or `NOT_APPLICABLE`. Unverified work cannot
pass.

## 13. Technical and Implementation Requirements

- Preserve approved architecture: Strangler/expand-contract path with
  compatibility adapters, migration control plane, per-tenant/cell flags,
  dual-run where measurable, reconciliation ledgers, rollback checkpoints and
  explicit retirement.
- Apply phase rule: Use route/component flags and adapters; avoid unrelated
  frontend forks.
- Use typed contracts, least privilege, idempotency, concurrency control,
  immutable audit and reversible changes.
- Separate proposal/action, user/workload identity, source-of-truth/projection
  and business/transport status.
- Risky behavior needs scoped feature flag/kill switch with owner, default,
  expiry, audit and removal.
- Define error, timeout, retry, cancel, backpressure, partial failure,
  stale/duplicate/out-of-order/provider-outage and rollback behavior.
- Do not weaken constraints or tests to create a pass.

## 14. Repository and Artifact Inspection

Inspect: `apps`, `services`, `packages/contracts`, `migrations`, `compat`,
`migration-control-plane`, `infra`, `docs/migration`, `tests/migration`,
`.github/workflows`.

```bash
git status --short --branch && git rev-parse HEAD && git log -n 20 --oneline
find . -maxdepth 4 -type f | sort
rg -n "TODO|FIXME|NOT_EXECUTED|REQUIRES_STAKEHOLDER_DECISION|skip_auth|tenant_id|workspace_id|approval|idempot" .
# Inspect manifests/lockfiles, images, IaC, migrations, contracts, policy, tests, dashboards and runbooks.
```

Identify generated-file sources and ownership before editing.

## 15. Source Acquisition Instructions

1. Search approved requirements, code/history, ADRs, schemas, contracts,
   infrastructure, tests, logs, incidents, user research, security reports and
   handoff.
2. Use official standards, regulators, vendor docs, release notes, advisories
   and original research externally.
3. Validate identity, owner, version/date, applicability, conflicts, limitations
   and supported decisions.
4. Capture immutable snapshot/hash where permitted; never use unofficial
   tutorials for critical security/legal/API behavior.

## 16. Security, Privacy, and Compliance

- Minimize data, permissions, retention, egress and blast radius.
- Threat-model input, uploads/retrieval, connectors/webhooks, agents/tools,
  memory, plugins, admin/support, rights and migrations.
- Enforce authN, workspace/tenant authZ, workload identity, least privilege,
  secrets, encryption, audit, approval and duties.
- Treat prompts, documents, emails, webpages, tools and plugins as untrusted
  data unable to change policy.
- Map GDPR, India DPDP, FERPA, COPPA, EU AI Act and contracts through
  professional review; never self-claim compliance.
- Cross-scope access, unlawful data use, unapproved consequential action, secret
  exposure, failed restore/rollback or high-impact AI harm blocks.

## 17. Data Requirements

- Record owner, source, purpose/basis, classification, scope key, residency,
  schema/version, quality, retention, deletion and consumers.
- Carry provenance through transformations, projections, retrieval, AI output
  and action.
- Use stable IDs and versioned mappings; never infer missing migration/memory
  values.
- Preserve correction/supersession history; distinguish primary deletion, backup
  expiry and legal hold.
- Prove restore, reconciliation, dedup, idempotency, projection rebuild and
  isolation.

## 18. Testing and Validation

Run type/lint/unit/component/contract/E2E/accessibility/security/performance
tests.

Evidence must record command, environment, commit, configuration,
dataset/version, result, timestamp, owner and immutable path. Failed/skipped
tests stay visible.

## 19. Performance and Reliability

- Define SLIs/SLOs, workloads, capacity, timeout/retry, backpressure,
  degradation, availability and recovery.
- Report p50/p95/p99, throughput, saturation, errors, queue lag, provider/model
  usage and unit cost where relevant.
- Test failure domains and dependencies; avoid synchronized retries and
  unbounded work.
- Tie scaling changes to measured triggers and document residual
  risk/headroom/cost.

## 20. Observability and Operations

- Propagate trace and authorization context without secrets or unnecessary
  personal content.
- Define traces/metrics/logs/audit, dashboards and alerts for success, failure,
  latency, connectors/models, quality and security.
- Assign owners, on-call/support, severity, escalation, runbooks and
  postmortems.
- Provide flags/kill switches, recovery, replay/reconciliation and safe
  degradation.
- Review telemetry access, retention, tenant/region visibility and cost.

## 21. Documentation

- Update canonical requirements, architecture, ADRs, schemas, API/events,
  security/privacy/AI, tests, runbooks, release notes and handoff.
- Mark owner, version, date, status, implementation status, dependencies and
  supersession.
- Include setup, verification, rollback, limits, support and troubleshooting.
- Test examples, commands, schemas and links. Separate source facts, new design
  and external verification.

## 22. Deliverables

- `DEL-CONT-P10-01` — frontend code; versioned, owned, reviewed and linked.
- `DEL-CONT-P10-02` — typed client/state; versioned, owned, reviewed and linked.
- `DEL-CONT-P10-03` — component library; versioned, owned, reviewed and linked.
- `DEL-CONT-P10-04` — accessibility/tests; versioned, owned, reviewed and
  linked.
- `DEL-CONT-P10-05` — performance/deploy notes; versioned, owned, reviewed and
  linked.
- Updated risk, decision, assumption, evidence, traceability and change
  registers.
- Gate report and next-phase handoff.

## 23. Evidence and Traceability

| Evidence ID      | Claim                   | Requirement  | Type                     | Location       | Result       | Date           | Verified by    |
| ---------------- | ----------------------- | ------------ | ------------------------ | -------------- | ------------ | -------------- | -------------- |
| EVD-CONT-P10-001 | Replace with real claim | CONT-P10-R01 | file/log/report/approval | TO_BE_VERIFIED | NOT_EXECUTED | TO_BE_VERIFIED | TO_BE_VERIFIED |

Trace source → requirement → design → file → test → evidence → risk/exception →
gate → handoff. A plan is not evidence it ran.

## 24. Risks, Decisions, and Change Control

| ID               | Risk                                        | Severity | Impact               | Mitigation                              | Owner                         | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | --------------------------------------- | ----------------------------- | ------ |
| RISK-CONT-P10-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels  | Phase owner                   | OPEN   |
| RISK-CONT-P10-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible validated decision  | Product/Architecture/Security | OPEN   |
| RISK-CONT-P10-03 | External API/model/standard changes         | High     | Regression           | Pin versions, tests, owner, kill switch | Integration/AI                | OPEN   |
| RISK-CONT-P10-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable reports and baseline          | QA/Release                    | OPEN   |
| RISK-CONT-P10-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation/pause/rollback           | Migration                     | OPEN   |

Changes to approved scope, contract, permission, retention, provider/model,
deployment or gate need rationale, impact, reviewers, migration, tests, rollout
and rollback.

## 25. Execution Sequence

1. Validate handoff/entry.
2. Inspect and baseline repository/artifacts/environment.
3. Resolve blockers or stop; register only allowed reversible assumptions.
4. Finalize requirements, acceptance, workstreams and evidence plan.
5. Execute small reviewable changes.
6. Run representative validation.
7. Remediate and rerun regression.
8. Complete documentation/evidence/traceability.
9. Run independent self-audit and weighted gate.
10. Publish completion and approved handoff or block.

## 26. Definition of Ready

- [ ] Objective/scope/requirements/acceptance approved.
- [ ] Valid handoff and immutable repository/environment baseline.
- [ ] Critical sources/decisions available and blockers resolved.
- [ ] Owners/reviewers/approver/escalation named.
- [ ] Security/privacy/data/AI/operations classified.
- [ ] Test/evidence/rollback/docs plans exist.
- [ ] Access/datasets/credentials/safe environment available.

## 27. Definition of Done

- [ ] Requirements implemented or approved NOT_APPLICABLE.
- [ ] Critical tests/reviews pass in representative environments.
- [ ] Security/privacy/data/AI/accessibility/reliability/operations blockers
      closed.
- [ ] Deliverables versioned/owned/reviewed/linked.
- [ ] Evidence/traceability complete and reproducible.
- [ ] Rollback/recovery/support proven where applicable.
- [ ] No hidden manual step or critical dependency.
- [ ] Weighted gate approves progression.

## 28. Quality Gate

| Category                 | Weight |
| ------------------------ | ------ |
| Scope and acceptance     | 12     |
| Technical correctness    | 12     |
| Architecture/integration | 8      |
| Data quality/lifecycle   | 8      |
| Security/privacy         | 12     |
| Testing/validation       | 12     |
| Reliability/resilience   | 8      |
| Performance/capacity     | 6      |
| Evidence/traceability    | 8      |
| Documentation/handoff    | 6      |
| Operations/support       | 5      |
| Maintainability/cost     | 3      |

- **95–100:** `PHASE APPROVED — PROCEED` only with zero mandatory blockers.
- **88–94:** conditional for explicitly non-dependent planning; no
  production/dependent authorization.
- **Below 88:** failed and remediation required.
- Mandatory blockers override score. Exceptions require owner, controls,
  approvers, expiry, monitoring and prohibited downstream work.

## 29. Remediation Loop

1. Convert each failure/partial/missing item into a severity-rated finding.
2. Diagnose root cause; do not lower thresholds without approved change.
3. Create bounded remediation with acceptance, tests, rollback and due date.
4. Execute, capture evidence and rerun affected plus
   regression/security/isolation suites.
5. Update requirements, ADRs, risks, traceability and docs.
6. Re-score the entire gate. Repeat until approved, deferred or terminated;
   never fabricate a pass.

## 30. Completion Response Format

Return headings A–P: **Identity; Readiness; Sources; Requirements; Work
Completed; Code/Configuration; Deliverables; Test Results; Security/Privacy;
Performance/Reliability; Traceability; Risks/Decisions; Gaps; Gate Result;
Handoff; Final Statement.**

Final statement must be one of `PHASE APPROVED — PROCEED`,
`PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`,
`PHASE FAILED — REMEDIATION REQUIRED`, or
`PHASE BLOCKED — MISSING INPUT/ACCESS/DECISION`.

## 31. Next-Phase Handoff

Prepare for **Backend Service Evolution and Extraction**: approved
scope/requirements/decisions; commit/releases/environment;
deliverables/evidence; contracts/schemas/config;
test/security/privacy/performance/ops results; open risks/exceptions/blockers;
assumptions; rollback/recovery; next entry criteria and prohibited work. The
next phase must validate, not assume, this handoff.

## 32. Final Execution Command

```text
MODE=GENERATE_AND_EXECUTE_PHASE
TRACK=CONT
PHASE=10
PHASE_NAME=Frontend Coexistence and Progressive Migration
VALIDATE entry and sources. STOP on mandatory blockers. EXECUTE only with authorized tools. CAPTURE reproducible evidence. RUN gate. REMEDIATE or publish blocked/failed. NEVER claim work that did not run.
```

---
