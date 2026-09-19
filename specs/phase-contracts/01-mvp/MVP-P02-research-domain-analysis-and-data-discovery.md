# Vaeloom MVP — Independent End-to-End Phase Prompt 02: Research, Domain Analysis, and Data Discovery

> **Prompt ID:** `MVP-P02` 
> **Artifact type:** Standalone generate + audit + execute + verify + gate + remediate + handoff prompt 
> **Generated:** 2026-08-04 
> **Truth status:** Phase executed and gated 2026-08-13 (88.20/100, CONDITIONAL). Codebase has 2335 pytest, 90+ endpoints, 38 DB models, 21 registered agents (8 MVP-canonical), 22 memory types. Runtime evidence exists; this prompt now reflects actual implementation state. 
> **Primary governing source:** `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md`

## How to Use This File

1. Attach or mount the complete Vaeloom source corpus, the exact repository revision, relevant environments, datasets, credentials through an approved secret mechanism, and the predecessor handoff.
2. Run the mandatory predecessor/current-state audit below **before** doing phase work.
3. Stop on blockers. Do not invent missing business, legal, security, data, scale, access or approval facts.
4. Execute only authorized changes. Preserve an exact action/evidence log and distinguish generated instructions from work actually run.
5. Run all applicable tests and independent reviews, calculate the gate score, remediate failures, and issue an explicit `GO`, `CONDITIONAL GO`, or `NO-GO`.
6. Generate the complete next-phase handoff only after approval.

## Track Mission and Non-Negotiable Context

**Mission:** Prove the memory-first ingest → organize → remember → assist loop with a tightly bounded 8 MVP-canonical agents (of 21 registered), 22 memory types, suggest-mode-first product before enterprise expansion.

- 8 MVP-canonical agents (Orchestrator, Organization, Memory, Resume, ATS, Job Search & Application, Gmail, Scheduler) locked via `frozenset` at `apps/api/src/api/orchestrator/router.py:178`; 13 additional agents registered but outside MVP scope.
- 22 memory types defined in `apps/api/src/api/schemas/memory_types.py:6-29` (Person, Organization, Project, Skill, Achievement, Education, Experience, Certification, Publication, Patent, Award, Meeting, Task, Goal, Preference, Constraint, Insight, Connection, Location, Event, Document, Conversation). MemoryAgent handler scoped to 2 of 22 (Person, Organization) — scope gap carried as RB-07.
- Single-user product experience, but every persisted artifact remains workspace-scoped and isolation-tested.
- Gmail is draft-only; job submission is allowed only through an approved official integration and payload-bound user approval.
- Enterprise SSO/SCIM, institution administration, billing, marketplace, multi-region tenant cells and cross-user memory are out of scope.
- MVP success is evidence of trust, memory quality, user value, safety and bounded operability—not documentation volume or fabricated runtime claims.

**Future boundary:** Future features remain hypotheses until the MVP evidence gates approve them; do not import enterprise complexity into the MVP merely because it is future-useful.

## Vaeloom Source Corpus That Must Be Inspected

Use the actual available versions and record hashes/versions. Do not rely only on summaries.

- `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` — governing execution, audit, evidence, gate, remediation and handoff contract.
- `vaeloom-mvp-e2e-enterprise-hardened.md` — authoritative MVP corrections and hardening decisions.
- `vaeloom-mvp-e2e.md` — MVP Phase 0–21 execution baseline.
- `vaeloom-enterprise-e2e.md` — enterprise Phase 0–21 execution baseline.
- `01-vaeloom-mvp-spec.md` — canonical MVP product scope; `05-vaeloom-mvp-spec.md` is superseded historical context.
- `06-vaeloom-enterprise-paper.md` — canonical enterprise vision; `vaeloom-enterprise-paper.md` is superseded historical context.
- `02-system-architecture.md`, `03-agent-workflow.md`, `04-memory-knowledge-graph.md` — architecture, workflow and memory intent.
- `vaeloom-complete-documentation.md`, `vaeloom-documentation-site.md`, `vaeloom-how-it-works-visual.md` — broader context and presentation views; resolve conflicts against canonical authority order.
- `00-gap-analysis-report.md`, `00-documentation-completion-report.md` — documentation maturity only, never runtime implementation evidence.
- Any attached repository, commit history, API/schema artifacts, environment configuration, tests, scans, deployment records, monitoring, incidents and approvals — these outrank design prose for actual implementation state.


## Current Authoritative Standards Overlay — verified 2026-08-04

The executing team must re-check the latest revision and applicability at phase start. These references supplement the Vaeloom source corpus; they do not silently replace approved product decisions.

| Standard / source | Verified snapshot | Required use |
|---|---|---|
| Model Context Protocol specification | 2026-07-28 | Version-pinned MCP profile, authorization, tasks/extensions, compatibility and deprecation testing |
| OWASP Top 10 for Agentic Applications | 2026 edition | Agent goal hijack, tool misuse, identity/privilege abuse, supply chain, unexpected execution, memory/context poisoning, inter-agent and cascading risks |
| OWASP GenAI/LLM security guidance | Current official project | Prompt injection, unsafe output handling, sensitive disclosure, excessive agency and model/tool supply-chain controls |
| NIST AI RMF 1.0 + Generative AI Profile | Official NIST profile | Govern/Map/Measure/Manage, evaluation, documentation, human oversight and residual-risk ownership |
| WCAG 2.2 | W3C Recommendation | Level AA complete-process accessibility target; automated and manual evidence |
| OAuth 2.0 Security BCP | RFC 9700 / BCP 240 | Exact redirect matching, PKCE, replay resistance, constrained tokens, least privilege and secure refresh-token handling |
| OpenAPI Specification | 3.2.0 current at snapshot | Machine-readable HTTP contracts; pin the chosen supported minor version and compatibility tests |
| Arazzo Specification | 1.1.0 current at snapshot | Optional machine-readable multi-call workflows and dependencies where useful |
| OpenTelemetry | Verify latest official spec at execution | Trace/metric/log context, semantic conventions and privacy-aware telemetry |
| SLSA | 1.2 current at snapshot | Build/source provenance, artifact integrity and verifiable supply-chain evidence |
| NIST SSDF | SP 800-218 v1.1 | Secure software-development practices and evidence |
| EU AI Act official guidance | Transparency obligations applicable from 2026-08-02; other timelines must be re-verified | AI disclosure, use-case classification, documentation, oversight and professional legal review |
| India DPDP Act 2023 + final DPDP Rules 2025 | Staged commencement; verify provisions in force | Notice/consent, rights, children’s data, security and breach duties for India scope |
| FERPA official guidance | Current | Institution-controlled education-record roles and contracts where applicable |
| COPPA revised rule and FTC guidance | Current | Under-13 exclusion or separately reviewed child-directed design; age and parental-consent controls |
| Gmail and GitHub official integration docs | Verify current API versions/scopes | Push-watch renewal/reconciliation, app permissions, quotas and least-privilege connectors |

Record each selected standard, exact version/date, applicability, decision owner, control mapping and verification evidence in the phase source register.


## Mandatory Previous-Phase Forensic Audit and Entry Decision

Do **not** assume `MVP-P01` passed because a document says “complete.” Re-audit its actual artifacts and evidence before executing this phase.

### Predecessor identity
- **Previous phase:** `MVP-P01 — Discovery and Problem Definition`
- **Current phase:** `MVP-P02 — Research, Domain Analysis, and Data Discovery`
- **Required predecessor decision:** approved gate, immutable handoff, exact repository revision/environment and no expired exception.

### Expected predecessor outputs to audit

## 22. Deliverables
- `DEL-MVP-P01-01` — problem statement; versioned, owned, reviewed and linked. **Actual:** `docs/phases/mvp-p01/09-problem-statement.md` (V2.0, upgraded 2026-08-16)
- `DEL-MVP-P01-02` — persona/JTBD evidence; versioned, owned, reviewed and linked. **Actual:** `docs/phases/mvp-p01/10-persona-jtbd-evidence.md` (V2.0, upgraded 2026-08-16)
- `DEL-MVP-P01-03` — value/risk hypotheses; versioned, owned, reviewed and linked. **Actual:** `docs/phases/mvp-p01/11-value-risk-hypotheses.md` (V2.0, H-01 through H-09)
- `DEL-MVP-P01-04` — success metrics; versioned, owned, reviewed and linked. **Actual:** `docs/phases/mvp-p01/12-success-metrics.md` (V2.0, M-01 through M-19)
- `DEL-MVP-P01-05` — non-goals/research backlog; versioned, owned, reviewed and linked. **Actual:** `docs/phases/mvp-p01/13-non-goals-research-backlog.md` (V2.0, RB-01 through RB-07)
- Updated risk, decision, assumption, evidence, traceability and change registers. **Actual:** `docs/phases/mvp-p01/04-risk-decision-assumption-register.md`
- Gate report and next-phase handoff. **Actual:** `docs/phases/mvp-p01/14-gate-2026-08-13.md` (74.89/100, CONDITIONAL) + `docs/phases/mvp-p01/08-handoff-to-p02.md`

### Expected predecessor Definition of Done to audit

## 27. Definition of Done
- [x] Requirements implemented or approved NOT_APPLICABLE.
- [x] Critical tests/reviews pass in representative environments.
- [x] Security/privacy/data/AI/accessibility/reliability/operations blockers closed.
- [x] Deliverables versioned/owned/reviewed/linked.
- [x] Evidence/traceability complete and reproducible.
- [x] Rollback/recovery/support proven where applicable.
- [x] No hidden manual step or critical dependency.
- [x] Weighted gate approves progression. **Score: 74.89/100, ACCEPTED BY USER with restrictions (DEC-P01-09).**

### Forensic audit procedure
1. Verify handoff identity, approver, timestamp, repository commit/release, environment, dataset/model/config versions and artifact hashes.
2. Reconcile predecessor requirements → design → code/config → tests → evidence → risks/exceptions → gate. Sample critical evidence directly; do not accept screenshots or summaries alone when reproducible evidence should exist.
3. Re-run or independently verify critical tests relevant to this phase, including negative, isolation, security/privacy, data integrity, rollback/recovery and failure-path checks.
4. Confirm all mandatory deliverables exist, open correctly, are current, owned, reviewed and match the committed implementation.
5. Inspect unresolved findings, waivers and assumptions for severity, controls, approver, expiry, monitoring and prohibited downstream work.
6. Check regression from later changes since predecessor approval; invalidate stale evidence.
7. Record every discrepancy as `FAILED`, `PARTIAL`, `MISSING`, `CONTRADICTORY`, `STALE`, `UNVERIFIED`, or `PASS`.

### Predecessor completion scorecard
| Category | Weight | Pass condition |
|---|---:|---|
| Deliverables and acceptance completeness | 20 | All mandatory artifacts satisfy approved acceptance |
| Test and verification evidence | 20 | Critical tests reproducible and passing in representative environment |
| Security, privacy, data and AI controls | 15 | No critical/high blocker; required reviews current |
| Technical correctness and integration | 15 | Implementation matches contracts and dependency assumptions |
| Reliability, rollback, migration and operations | 10 | Recovery/rollback/support evidence exists where applicable |
| Traceability and evidence integrity | 10 | Complete chain with immutable locations and exact versions |
| Documentation and handoff quality | 5 | Current, unambiguous and usable by this phase |
| Residual risk and exception governance | 5 | Owned, time-bounded, monitored and non-blocking |

### Entry decision algorithm
- **`GO`**: score **≥95/100**, every mandatory predecessor requirement is `PASS`, no critical/high blocker, no expired waiver and no stale baseline.
- **`CONDITIONAL GO — NON-DEPENDENT WORK ONLY`**: score **88–94**, zero mandatory blocker, and the accountable approver explicitly lists permitted work, prohibited work, controls and expiry. It may not authorize dependent implementation, migration or release.
- **`NO-GO — PREDECESSOR REMEDIATION REQUIRED`**: score below 88, missing/reproducibility failure, unresolved critical/high issue, invalid handoff, isolation/privacy/security failure, unproven rollback, or contradictory source/implementation.

On `NO-GO`, switch to `AUDIT_COMPLETED_PHASE` then `REMEDIATE_FAILED_PHASE` for `MVP-P01`. Re-run its full gate and generate a new handoff before resuming this file.

### Audit evidence table
| Audit ID | Predecessor requirement/deliverable | Artifact/evidence | Independent check | Status | Finding/impact | Owner | Remediation/expiry |
|---|---|---|---|---|---|---|---|
| PA-MVP-P02-001 | P01 gate report | `docs/phases/mvp-p01/14-gate-2026-08-13.md` | Score 74.89/100, CONDITIONAL | PASS | User accepted with restrictions (DEC-P01-09) | Phase owner | CLOSED |
| PA-MVP-P02-002 | P01 handoff | `docs/phases/mvp-p01/08-handoff-to-p02.md` | 5 DEL files, registers, evidence | PASS | P02 starts on user command only (Q&A-4) | Phase owner | CLOSED |
| PA-MVP-P02-003 | P01 problem statement (DEL-01) | `docs/phases/mvp-p01/09-problem-statement.md` V2.0 | 4 problem statements, 9 constraints | PASS | Upgraded 2026-08-16 with codebase evidence | Phase owner | CLOSED |
| PA-MVP-P02-004 | P01 persona/JTBD (DEL-02) | `docs/phases/mvp-p01/10-persona-jtbd-evidence.md` V2.0 | 3 personas, JTBD framework | PASS | Updated with MemoryAgent scope gap note | Phase owner | CLOSED |
| PA-MVP-P02-005 | P01 hypotheses (DEL-03) | `docs/phases/mvp-p01/11-value-risk-hypotheses.md` V2.0 | H-01 through H-09 | PASS | H-03/H-08 marked unfalsifiable (approval gate OFF) | Phase owner | CLOSED |
| PA-MVP-P02-006 | P01 metrics (DEL-04) | `docs/phases/mvp-p01/12-success-metrics.md` V2.0 | M-01 through M-19 | PASS | M-05 BLOCKED (approval gate OFF) | Phase owner | CLOSED |
| PA-MVP-P02-007 | P01 non-goals (DEL-05) | `docs/phases/mvp-p01/13-non-goals-research-backlog.md` V2.0 | RB-01 through RB-07 | PASS | RB-06/RB-07 added for approval gate + memory expansion | Phase owner | CLOSED |
| PA-MVP-P02-008 | Runtime evidence baseline | `apps/api/` (2335 pytest, 90+ endpoints) | Verified via deep audit 2026-08-16 | PASS | Code exists; P02 deliverables can reference actual implementation | Phase owner | CLOSED |


## Phase-Specific Future-Readiness and Missing-Idea Overlay

These are additional enterprise-quality considerations. They become required when relevant to the phase scope or risk; otherwise record them as a governed future backlog with adoption triggers and owner.

- Maintain a living external-dependency radar for connector terms, API quotas, model changes, security advisories and regulatory milestones.
- Benchmark build-versus-buy choices with portability, exit cost, privacy, reliability and unit economics—not feature count alone.
- Create representative licensed/synthetic datasets and contamination controls for retrieval and agent evaluation.
- Track emerging interoperability standards and preserve adapters so no vendor or protocol becomes an irreversible dependency.
- Protect scope: future-ready interfaces may be designed, but enterprise-only runtime capabilities must remain disabled and unimplemented unless formally moved into MVP scope.

For each deferred idea, record: problem/evidence, target users, dependencies, security/privacy/data implications, cost, compatibility/migration impact, validation experiment, adoption trigger, owner and sunset/rejection condition. Do not expand current scope silently.

---

## Copy-Ready Governing Execution Prompt

The content below is the complete phase execution prompt. The executing agent/team must follow the added standalone audit and standards overlays above as mandatory extensions.

# Enterprise Execution Prompt — MVP Phase 02: Research, Domain Analysis, and Data Discovery

> **Mode:** `GENERATE_AND_EXECUTE_PHASE` when authorized access exists; otherwise preserve runtime work as `NOT_EXECUTED`.
> **Track status:** CODE EXISTS — 2335 pytest, 90+ endpoints, 21 agents registered, 22 memory types; P02 previously gated at 88.20/100 on 2026-08-13
> **Phase type:** `RESEARCH`
> **Phase ID:** `MVP-P02`

```yaml
request:
  mode: GENERATE_AND_EXECUTE_PHASE
  current_phase_id: MVP-P02
  current_phase_name: Research, Domain Analysis, and Data Discovery
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
Acquire authoritative user, domain, platform, legal, data and technical evidence tied to decisions.

Track objective: Prove ingest → organize → remember → assist, trust/approval UX, memory quality, resume/ATS value, lawful opportunity assistance, Gmail deadline extraction, reminders, export/deletion and bounded operational viability.

Separate generated instructions, design, actual changes, tests actually run and work that could not be executed. Never convert documentation completeness into runtime success.

## 2. Activated Enterprise Roles
Domain Specialist; User Researcher; Data Architect; Security Architect; Compliance Reviewer; AI/ML Engineer.

The accountable role owns the gate. Security, privacy, data, accessibility, reliability and operations reviewers retain veto on mandatory blockers.

## 3. Verified Project Context
- **Context:** Single-user personal intelligence platform for students and early-career professionals; memory-first; 8 MVP-canonical agents (of 21 registered); 22 memory types; suggest-mode-first; approved connectors only.
- **Architecture:** Next.js 15 (`apps/web`), FastAPI/Python (`apps/api`), PostgreSQL + pgvector (SQLAlchemy + Alembic), Redis (caching/rate-limiting), MinIO (object storage); PaaS-first; every artifact workspace-scoped.
- **In scope:** Prove ingest → organize → remember → assist, trust/approval UX, memory quality, resume/ATS value, lawful opportunity assistance, Gmail deadline extraction, reminders, export/deletion and bounded operational viability.
- **Out of scope:** Enterprise SSO/SCIM, institution admin, billing, marketplace, multi-region cells, cross-user memory and unsupported job-platform automation.
- **Phase-specific rule:** Research connector rules, job-platform access, student privacy and ATS/AI limits.
- **Truth rule:** inspect a real repository/environment before claiming implementation.

Track-wide fixed decisions:
- 8 MVP-canonical agents: Orchestrator, Organization, Memory, Resume, ATS, Job Search & Application, Gmail, Scheduler (of 21 registered in `router.py:38-60`).
- Consequential actions require immutable payload-bound expiring approval plus idempotency; Gmail is draft-only.
- No unsupported scraping, anti-bot circumvention, credential replay or unapproved job submission.
- Relational data is authoritative; graph/vector/search/cache are provenance-carrying rebuildable projections.
- WCAG 2.2 AA; under-13 excluded unless a separately reviewed child-directed service is approved.
- Model, prompt, tool, retrieval, chunking, embedding and policy versions are recorded.

## 4. Source Register
| ID | Source | Owner/authority | Use | Location |
|---|---|---|---|---|
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md | Vaeloom source team | Governing 32-section prompt, evidence, DoR/DoD, gate and remediation | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` |
| INT-02 | vaeloom-mvp-e2e-enterprise-hardened.md | Vaeloom source team | Authoritative MVP corrections and release evidence | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` |
| INT-03 | vaeloom-mvp-e2e.md | Vaeloom source team | MVP 0–21 execution baseline | `docs/vaeloom-mvp-e2e.md` |
| INT-04 | vaeloom-enterprise-e2e.md | Vaeloom source team | Enterprise 0–21 execution baseline | `docs/vaeloom-enterprise-e2e.md` |
| INT-05 | 01-vaeloom-mvp-spec.md | Vaeloom source team | Canonical MVP product scope | `docs/01-vaeloom-mvp-spec.md` |
| INT-06 | 06-vaeloom-enterprise-paper.md | Vaeloom source team | Canonical enterprise vision | `docs/06-vaeloom-enterprise-paper.md` |
| INT-07 | 02-system-architecture.md | Vaeloom source team | Memory-first architecture | `docs/02-system-architecture.md` |
| INT-08 | 03-agent-workflow.md | Vaeloom source team | Agent and approval flow | `docs/03-agent-workflow.md` |
| INT-09 | 04-memory-knowledge-graph.md | Vaeloom source team | MVP memory and RAG | `docs/04-memory-knowledge-graph.md` |
| INT-10 | gap/completion reports | Vaeloom source team | Documentation maturity; not runtime evidence | `docs/00-gap-analysis-report.md`, `docs/00-documentation-completion-report.md` |
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

Verify version/date/applicability at phase start. Record conflicts and approved resolution; secondary sources are contextual only.

## 5. Phase Scope
### In scope
- User/domain research
- Platform/standards research
- Data/source feasibility
- Legal/privacy/AI-risk analysis
- Build-buy evidence

### Out of scope
- Track exclusions: Enterprise SSO/SCIM, institution admin, billing, marketplace, multi-region cells, cross-user memory and unsupported job-platform automation.
- Later-phase work unless needed to remove a critical dependency.
- Production changes without authority, backup, rollback, monitoring and named approver.
- Claims of secure/compliant/accessible/scalable/tested/production-ready without evidence.

## 6. Entry Criteria
- [ ] Previous phase has approved gate and valid handoff, or this is Phase 0.
- [ ] Canonical sources, repository revision and environment are identified.
- [ ] Required access exists or is BLOCKING_ACCESS_UNKNOWN.
- [ ] Owners, reviewers, approver and change authority are named.
- [ ] Requirements/dependencies are traceable and no critical blocker makes work unsafe.
- [ ] Test, evidence, rollback and documentation plans exist.

## 7. Input Readiness Matrix
| Input | Status | Required evidence | Owner | Impact |
|---|---|---|---|---|
| Requirements | TO_BE_VERIFIED | Approved IDs/sources/acceptance | Product/BA | Blocks implementation |
| Previous handoff | TO_BE_VERIFIED | Gate/artifacts/risks/evidence/commit | Previous owner | Blocks execution |
| Repository | TO_BE_VERIFIED | Access/branch/commit/owners | Engineering | Blocks changes |
| Environment | TO_BE_VERIFIED | Reproducible representative setup | Platform/QA | Blocks runtime validation |
| Data | TO_BE_VERIFIED | Classified/licensed/representative | Data/Privacy | Blocks data/AI tests |
| Security/privacy | TO_BE_VERIFIED | Threat/classification/retention/consent | Security/Privacy | Blocks high-risk work |
| Contracts/design | TO_BE_VERIFIED | Approved version/compatibility | Architecture/API/UX | Blocks dependent work |
| Operations/release | TO_BE_VERIFIED | SLO/on-call/rollback/authority | SRE/Release | Blocks release work |

## 8. Blocking Questions
| ID | Question | Decision | Expected answer | Owner | Effect |
|---|---|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | Approval and exceptions | Name, role, scope | Program/Product | Gate blocks |
| BQ-02 | What repository version, environment and evidence baseline apply? | Prevents stale/imaginary execution | Commit/release/environment/evidence | Engineering | Execution blocks |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Privacy/student/employment/AI duties | Entity→region→use case→age policy | Legal/Privacy/Product | Release blocks |
| BQ-04 | What launch region and minimum age are approved? | Notice/consent/residency/child controls | Region; age; arrangement | Product/Legal | Phase 13/19 blocks |
| BQ-05 | What team, budget, cohort and ship window are authorized? | Realistic planning/release | Roles; budget; cohort; date range | Founder/Program | Commitment blocks |
| BQ-06 | Which decisions require primary user evidence? | Material boundary/acceptance | Structured decision with owner/date | Accountable owner | Blocks where unresolved |

Use `UNKNOWN`, `TO_BE_VERIFIED`, `REQUIRES_STAKEHOLDER_DECISION` or `REQUIRES_PROFESSIONAL_REVIEW`; never invent values.

## 9. Requirements and Acceptance Criteria
| ID | Domain | Requirement | Acceptance |
|---|---|---|---|
| MVP-P02-R01 | Scope | Acquire authoritative user, domain, platform, legal, data and technical evidence tied to decisions. | Approved objective/scope/owners/authority |
| MVP-P02-R02 | Evidence | Every material claim links to authoritative source or reproducible evidence. | No unsupported completion/security/compliance/scale claim |
| MVP-P02-R03 | Security/Privacy | Applicable security, privacy, abuse, rights and AI risks are designed, tested and owned. | No unresolved critical finding or expired waiver |
| MVP-P02-R04 | Quality | Validation covers normal, negative, boundary, failure and recovery. | Critical tests pass in representative environment |
| MVP-P02-R05 | Operations | Ownership, telemetry, support, rollback and lifecycle are included. | Runbook/rollback/telemetry evidence exists |
| MVP-P02-R06 | Data/AI | Data lineage, scope, quality, retention and AI lineage are explicit. | Source/version/owner/lifecycle reconstructable |
| MVP-P02-R07 | Traceability | Requirements map to design, artifacts, tests, evidence, risks and handoff. | No unexplained critical gap |
| MVP-P02-R08 | Gate | Progression is blocked until DoD and weighted gate pass. | Score ≥95 and zero mandatory blockers |

Add discovered requirements only with source, owner, priority, acceptance, test and evidence location.

## 10. Enterprise Completeness Requirements
Assess business/product, architecture, data, security, privacy, compliance, UX/accessibility, quality, performance, reliability, operations, DevOps, documentation, cost, sustainability, localization, responsible AI, migration and change. Mark each `APPLICABLE`, `NOT_APPLICABLE` with reason, or `BLOCKED`.

## 11. Workstreams
1. **WS-02.1: User/domain research.** Assign owner, inputs, dependencies, acceptance, tests, evidence, risks and handoff.
2. **WS-02.2: Platform/standards research.** Assign owner, inputs, dependencies, acceptance, tests, evidence, risks and handoff.
3. **WS-02.3: Data/source feasibility.** Assign owner, inputs, dependencies, acceptance, tests, evidence, risks and handoff.
4. **WS-02.4: Legal/privacy/AI-risk analysis.** Assign owner, inputs, dependencies, acceptance, tests, evidence, risks and handoff.
5. **WS-02.5: Build-buy evidence.** Assign owner, inputs, dependencies, acceptance, tests, evidence, risks and handoff.

## 12. Detailed Tasks and Subtasks
1. Create research questions tied to decisions and stopping criteria.
2. Conduct consented user/domain research with sampling and limitations.
3. Inspect official API terms, quotas, auth, webhooks, retention and access basis.
4. Assess data sensitivity, ownership, licenses, quality, volume and deletion.
5. Map regional privacy/student/employment/AI/accessibility/security obligations.
6. Research connector rules, job-platform access, student privacy and ATS/AI limits.
7. Keep scope bounded and defer enterprise-only work unless needed to avoid irreversible design debt.

Status every task as `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED_UNVERIFIED`, `VERIFIED` or `NOT_APPLICABLE`. Unverified work cannot pass.

## 13. Technical and Implementation Requirements
- Preserve approved architecture: Next.js 15 (`apps/web`), FastAPI/Python (`apps/api`), PostgreSQL + pgvector (SQLAlchemy + Alembic), Redis (caching/rate-limiting), MinIO (object storage); PaaS-first; every artifact workspace-scoped.
- Apply phase rule: Research connector rules, job-platform access, student privacy and ATS/AI limits.
- Use typed contracts, least privilege, idempotency, concurrency control, immutable audit and reversible changes.
- Separate proposal/action, user/workload identity, source-of-truth/projection and business/transport status.
- Risky behavior needs scoped feature flag/kill switch with owner, default, expiry, audit and removal.
- Define error, timeout, retry, cancel, backpressure, partial failure, stale/duplicate/out-of-order/provider-outage and rollback behavior.
- Do not weaken constraints or tests to create a pass.

## 14. Repository and Artifact Inspection
Inspect: `apps/web`, `apps/api`, `packages/ui-kit`, `packages/shared-types`, `integrations/*`, `connectors/*`, `plugins/*`, `sdk/*`, `infra`, `docs`, `apps/api/tests`, `testing/e2e/tests`, `.github/workflows`.

```powershell
git status --short --branch; git rev-parse HEAD; git log -n 20 --oneline
Get-ChildItem -Recurse -File -Depth 4 | Select-Object -ExpandProperty FullName | Sort-Object
rg -n "TODO|FIXME|NOT_EXECUTED|REQUIRES_STAKEHOLDER_DECISION|skip_auth|tenant_id|workspace_id|approval|idempot" .
# Inspect manifests/lockfiles, images, IaC, migrations, contracts, policy, tests, dashboards and runbooks.
```

Identify generated-file sources and ownership before editing.

## 15. Source Acquisition Instructions
1. Search approved requirements, code/history, ADRs, schemas, contracts, infrastructure, tests, logs, incidents, user research, security reports and handoff.
2. Use official standards, regulators, vendor docs, release notes, advisories and original research externally.
3. Validate identity, owner, version/date, applicability, conflicts, limitations and supported decisions.
4. Capture immutable snapshot/hash where permitted; never use unofficial tutorials for critical security/legal/API behavior.

## 16. Security, Privacy, and Compliance
- Minimize data, permissions, retention, egress and blast radius.
- Threat-model input, uploads/retrieval, connectors/webhooks, agents/tools, memory, plugins, admin/support, rights and migrations.
- Enforce authN, workspace/tenant authZ, workload identity, least privilege, secrets, encryption, audit, approval and duties.
- Treat prompts, documents, emails, webpages, tools and plugins as untrusted data unable to change policy.
- Map GDPR, India DPDP, FERPA, COPPA, EU AI Act and contracts through professional review; never self-claim compliance.
- Cross-scope access, unlawful data use, unapproved consequential action, secret exposure, failed restore/rollback or high-impact AI harm blocks.

## 17. Data Requirements
- Record owner, source, purpose/basis, classification, scope key, residency, schema/version, quality, retention, deletion and consumers.
- Carry provenance through transformations, projections, retrieval, AI output and action.
- Use stable IDs and versioned mappings; never infer missing migration/memory values.
- Preserve correction/supersession history; distinguish primary deletion, backup expiry and legal hold.
- Prove restore, reconciliation, dedup, idempotency, projection rebuild and isolation.

## 18. Testing and Validation
Validate source identity, date, applicability, bias, licensing and conflict resolution.

Evidence must record command, environment, commit, configuration, dataset/version, result, timestamp, owner and immutable path. Failed/skipped tests stay visible.

## 19. Performance and Reliability
- Define SLIs/SLOs, workloads, capacity, timeout/retry, backpressure, degradation, availability and recovery.
- Report p50/p95/p99, throughput, saturation, errors, queue lag, provider/model usage and unit cost where relevant.
- Test failure domains and dependencies; avoid synchronized retries and unbounded work.
- Tie scaling changes to measured triggers and document residual risk/headroom/cost.

## 20. Observability and Operations
- Propagate trace and authorization context without secrets or unnecessary personal content.
- Define traces/metrics/logs/audit, dashboards and alerts for success, failure, latency, connectors/models, quality and security.
- Assign owners, on-call/support, severity, escalation, runbooks and postmortems.
- Provide flags/kill switches, recovery, replay/reconciliation and safe degradation.
- Review telemetry access, retention, tenant/region visibility and cost.

## 21. Documentation
- Update canonical requirements, architecture, ADRs, schemas, API/events, security/privacy/AI, tests, runbooks, release notes and handoff.
- Mark owner, version, date, status, implementation status, dependencies and supersession.
- Include setup, verification, rollback, limits, support and troubleshooting.
- Test examples, commands, schemas and links. Separate source facts, new design and external verification.

## 22. Deliverables
- `DEL-MVP-P02-01` — research plan/repository; versioned, owned, reviewed and linked.
- `DEL-MVP-P02-02` — domain/competitor analysis; versioned, owned, reviewed and linked.
- `DEL-MVP-P02-03` — data/source feasibility; versioned, owned, reviewed and linked.
- `DEL-MVP-P02-04` — regulatory applicability; versioned, owned, reviewed and linked.
- `DEL-MVP-P02-05` — decision implications; versioned, owned, reviewed and linked.
- Updated risk, decision, assumption, evidence, traceability and change registers.
- Gate report and next-phase handoff.

## 23. Evidence and Traceability
| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
|---|---|---|---|---|---|---|---|
| EVD-MVP-P02-001 | Replace with real claim | MVP-P02-R01 | file/log/report/approval | TO_BE_VERIFIED | NOT_EXECUTED | TO_BE_VERIFIED | TO_BE_VERIFIED |

Trace source → requirement → design → file → test → evidence → risk/exception → gate → handoff. A plan is not evidence it ran.

## 24. Risks, Decisions, and Change Control
| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-MVP-P02-01 | Docs mistaken for runtime completion | Critical | False readiness | Require runtime evidence/status labels | Phase owner | OPEN |
| RISK-MVP-P02-02 | Scope/permission/data/compatibility assumed | High | Leak/loss/rework | Block or reversible validated decision | Product/Architecture/Security | OPEN |
| RISK-MVP-P02-03 | External API/model/standard changes | High | Regression | Pin versions, tests, owner, kill switch | Integration/AI | OPEN |
| RISK-MVP-P02-04 | Evidence incomplete | High | Untrustworthy gate | Immutable reports and baseline | QA/Release | OPEN |
| RISK-MVP-P02-05 | MVP scope expansion | High | Delay/complexity | Strict scope gate | Product | OPEN |

Changes to approved scope, contract, permission, retention, provider/model, deployment or gate need rationale, impact, reviewers, migration, tests, rollout and rollback.

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
- [ ] Security/privacy/data/AI/accessibility/reliability/operations blockers closed.
- [ ] Deliverables versioned/owned/reviewed/linked.
- [ ] Evidence/traceability complete and reproducible.
- [ ] Rollback/recovery/support proven where applicable.
- [ ] No hidden manual step or critical dependency.
- [ ] Weighted gate approves progression.

## 28. Quality Gate
| Category | Weight |
|---|---|
| Scope and acceptance | 12 |
| Technical correctness | 12 |
| Architecture/integration | 8 |
| Data quality/lifecycle | 8 |
| Security/privacy | 12 |
| Testing/validation | 12 |
| Reliability/resilience | 8 |
| Performance/capacity | 6 |
| Evidence/traceability | 8 |
| Documentation/handoff | 6 |
| Operations/support | 5 |
| Maintainability/cost | 3 |

- **95–100:** `PHASE APPROVED — PROCEED` only with zero mandatory blockers.
- **88–94:** conditional for explicitly non-dependent planning; no production/dependent authorization.
- **Below 88:** failed and remediation required.
- Mandatory blockers override score. Exceptions require owner, controls, approvers, expiry, monitoring and prohibited downstream work.

## 29. Remediation Loop
1. Convert each failure/partial/missing item into a severity-rated finding.
2. Diagnose root cause; do not lower thresholds without approved change.
3. Create bounded remediation with acceptance, tests, rollback and due date.
4. Execute, capture evidence and rerun affected plus regression/security/isolation suites.
5. Update requirements, ADRs, risks, traceability and docs.
6. Re-score the entire gate. Repeat until approved, deferred or terminated; never fabricate a pass.

## 30. Completion Response Format
Return headings A–P: **Identity; Readiness; Sources; Requirements; Work Completed; Code/Configuration; Deliverables; Test Results; Security/Privacy; Performance/Reliability; Traceability; Risks/Decisions; Gaps; Gate Result; Handoff; Final Statement.**

Final statement must be one of `PHASE APPROVED — PROCEED`, `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`, `PHASE FAILED — REMEDIATION REQUIRED`, or `PHASE BLOCKED — MISSING INPUT/ACCESS/DECISION`.

## 31. Next-Phase Handoff
Prepare for **Requirements Engineering**: approved scope/requirements/decisions; commit/releases/environment; deliverables/evidence; contracts/schemas/config; test/security/privacy/performance/ops results; open risks/exceptions/blockers; assumptions; rollback/recovery; next entry criteria and prohibited work. The next phase must validate, not assume, this handoff.

## 32. Final Execution Command
```text
MODE=GENERATE_AND_EXECUTE_PHASE
TRACK=MVP
PHASE=02
PHASE_NAME=Research, Domain Analysis, and Data Discovery
VALIDATE entry and sources. STOP on mandatory blockers. EXECUTE only with authorized tools. CAPTURE reproducible evidence. RUN gate. REMEDIATE or publish blocked/failed. NEVER claim work that did not run.
```


---
