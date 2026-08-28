# MVP-P01 - 13. Non-Goals and Research Backlog (DEL-MVP-P01-05)

> **Deliverable:** DEL-MVP-P01-05 - explicit non-goals (standalone register with
> rationale) + research backlog from the prompt overlay, each entry carrying
> problem/evidence, target users, dependencies, security/privacy/data impact,
> cost, compatibility/migration, validation experiment, adoption trigger, owner
> and sunset/rejection condition. **Status:** V2.0 - upgraded 2026-08-16 to add
> research backlog items for approval gate (RB-06) and memory type expansion
> (RB-07). Approval gate hardcoded OFF (`loop.py:83`); MemoryAgent scoped to2
> of22 types (`memory_agent/handler.py:25-27`). **Prompt reference:**
> `MVP-P01-discovery-and-problem-definition.md` —3/—5/—7/—9/—12/—16 +
> Phase-Specific Future-Readiness and Missing-Idea Overlay. **Rule:** no backlog
> entry expands MVP scope by itself; entries move into phase scope only via
> change control (prompt —24).

## 1. Non-goals register (standalone)

Rationale and owner for the non-goals listed in `12-success-metrics.md` —2.
Re-assessment phase is the earliest point at which the item may be revisited;
revisiting requires an approved scope change, not silent expansion.

| NG | Non-goal | Rationale | Owner | Re-assessed at |
| ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| NG-01 | Enterprise SSO/SCIM | Single-user product, single workspace; institution identity adds cost and surface with zero wedge value | Product | Post-MVP enterprise track decision |
| NG-02 | Institution administration | No institution relationships in scope (individual job seekers, BQ-03); FERPA-adjacent roles not applicable to India 18+ launch | Product | Post-MVP enterprise track decision |
| NG-03 | Billing / marketplace | No monetization decision made (budget TBD, BQ-05); marketplace needs plugin sandboxing infra out of MVP (spec —6/—14) | Founder/Product | Separate enterprise decision (P04 budget review) |
| NG-04 | Multi-region tenant cells | Single region (India, BQ-04); multi-region adds operational complexity before wedge is validated | Platform | Post-launch scale evidence |
| NG-05 | Cross-user memory sharing | Workspace-scoped single-user by construction; cross-user memory requires explicit privacy review + legal before any design (prompt —16) | Privacy/Legal | Explicit privacy review + legal |
| NG-06 | Unsupported job-platform automation | ToS/anti-bot risk, account flagging, trust damage (research brief —3); prohibited by S-03, never promoted | Security | Never (prohibited) |
| NG-07 | Production deployment in P01 | DISCOVERY phase - docs/research only; no production changes without authority/rollback/approver (prompt —5) | Phase owner | P19 (ASP-04) |
| NG-08 | Product-market-fit claim in P01 | Phase rule: validate the wedge without claiming PMF (prompt —3); cohort evidence is validation, not PMF | Product | P02/P03 cohort validation |
| NG-09 | Compliance/accessibility/scale claims without evidence | No self-claimed compliance (prompt —16); WCAG 2.2 AA and DPDP duties require measured evidence + professional review | Legal/Privacy/QA | After professional review + measured evidence |

## 2. Research backlog (prompt overlay)

### RB-01 - Trust failure scenario testing (not only happy-path value)

| Field | Value |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | Prompt overlay item 1; PS-04; H-02/H-03/H-07/H-08 - wrong memory, overreach, missed deadlines, confusing approvals, difficult deletion are the expensive failure modes, yet happy-path value dominates validation plans |
| Target users | Design-partner cohort; security/privacy reviewers (P13) |
| Dependencies | Cohort live (DEC-P01-07, RB-04); approval/deletion flows implemented (P13) |
| Security/privacy/data impact | Consent-first; no PII in synthesis; scenarios simulate harm without real-world impact (sandboxed, draft-only) |
| Cost | $0 (DEC-P01-08); moderator time from UX Research |
| Compatibility/migration | None; shapes approval/deletion UX before release |
| Validation experiment | Scenario battery: wrong-memory correction, approval expiry/tamper, missed-deadline playback, deletion verification - measure confusion/correction/harm events (VB-03, VB-05) |
| Adoption trigger | First cohort wave or P13 flow freeze |
| Owner | UX Research + Security |
| Sunset/rejection condition | Reject if no scenario reproduces a trust event in 2 cohort waves (over-fit); keep the battery as regression suite regardless |

### RB-02 - Stop/pivot leading indicators (BQ-06)

| Field | Value |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | BQ-06/DEC-P01-05 (re-affirmed 2026-08-13) - stop on trust-driven churn, pivot on no memory value or deadline-accuracy miss; indicators exist as draft candidates in `05-validation-backlog.md` but are not yet operationalized with thresholds |
| Target users | User (gate authority, BQ-01); phase owners P02-P05 |
| Dependencies | Cohort telemetry (M-03, M-04, M-05, M-06); runtime instrumentation P05/P15 |
| Security/privacy/data impact | Aggregate metrics only; no per-user PII outside consent |
| Cost | Low (dashboard + threshold review) |
| Compatibility/migration | None; operationalizes DEC-P01-05 |
| Validation experiment | Monitor M-03/M-04/M-05/M-06 against thresholds over cohort; confirm each trigger fires only on real signal (no threshold gaming) |
| Adoption trigger | Cohort launch (P02/P03) |
| Owner | Product (thresholds) + User (approval of final criteria) |
| Sunset/rejection condition | Reject indicators that never fire and add none that fire on noise; criteria remain user-owned |

### RB-03 - Segmentation by age/region/institution/data sensitivity

| Field | Value |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | Prompt overlay item 3; RISK-MVP-P01-08 - one generic "student" persona conflates 18-24 students vs. 25+ early-career, city vs. tier-2/3, institution-affiliated vs. independent, high- vs. low-sensitivity data |
| Target users | Persona/JTBD owners (DEL-MVP-P01-02); design-partner recruitment (RB-04) |
| Dependencies | `10-persona-jtbd-evidence.md` segments (spec-derived); cohort signup data (consented) |
| Security/privacy/data impact | Segmentation fields limited to consent-approved attributes; no sensitive-category data collected without basis |
| Cost | $0; analysis time |
| Compatibility/migration | None; ensures recruitment and metrics are not averaged across segments |
| Validation experiment | Split cohort outcomes (M-01..M-10) by segment; identify any segment with materially different recall/approval/deadline behavior |
| Adoption trigger | First cohort wave; revisit whenever a segment is over/under-represented |
| Owner | UX Research |
| Sunset/rejection condition | Collapse segments if no measured difference across 2 waves (simpler model wins) |

### RB-04 - Design-partner evidence protocol

| Field | Value |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | Prompt overlay item 4; RISK-MVP-P01-06 - no live-user research available at the 2026-08-13 re-run; anecdotal feedback must not override measured outcomes; prior plan: volunteer invite-only cohort N~10-20, $0 budget (DEC-P01-07/08) |
| Target users | Design-partner cohort; phase owners P02-P05 |
| Dependencies | USER decision to launch the cohort (REQUIRES_STAKEHOLDER_DECISION, UNK-04/06); consent protocol |
| Security/privacy/data impact | Consent-first, workspace-scoped, no PII in synthesis (RISK-MVP-P01-07); cohort data retained per retention policy |
| Cost | $0 (DEC-P01-08) |
| Compatibility/migration | None; protocol gates every qualitative finding behind measured evidence |
| Validation experiment | Weight qualitative findings by measured baseline (M-01..M-13): any claim must be reproducible by >=2 design partners or rejected; document per-claim evidence status |
| Adoption trigger | USER approves cohort launch; else findings stay `UNKNOWN` (never fabricated) |
| Owner | UX Researcher |
| Sunset/rejection condition | Reject anecdote-only findings at every gate; protocol ends when cohort closes and measured findings are archived |

### RB-05 - Future-readiness ideas (reference FB-01..05, no duplication)

| Field | Value |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem/evidence | P00 overlay deferred five future-readiness items; they remain governed backlog, not MVP scope: FB-01 machine-readable source-of-truth manifest, FB-02 initial SBOM/AI-BOM, FB-03 evidence retention/immutability/hash policy, FB-04 conflict-resolution protocol, FB-05 scope protection (enterprise-only runtime disabled). Full entries live in `docs/phases/mvp-p00/12-future-readiness-backlog.md` |
| Target users | As per each FB entry (agents, QA, security, phase gates) |
| Dependencies | Adoption triggers and owners per FB-01..05 (e.g., FB-05 continuous, enforced at every gate) |
| Security/privacy/data impact | Per FB entry (e.g., FB-02 public identifiers only; FB-03 hash-only integrity) |
| Cost | Per FB entry (all Low; FB-05 none beyond gate discipline) |
| Compatibility/migration | Per FB entry (all non-breaking; FB-05 rejects enterprise promotion without approved change record) |
| Validation experiment | Per FB entry (e.g., FB-01 manifest diff; FB-03 retrospective policy application) |
| Adoption trigger | Per FB entry (e.g., FB-01 at P05; FB-04 before P18 cleanup; FB-05 continuous) |
| Owner | Per FB entry (Enterprise Architect, Security, QA/Release, Phase owner, Product) |
| Sunset/rejection condition | Per FB entry (FB-03 reject if volumes stay <25 artifacts/phase; FB-04 merge into 01 after 3 stable phases) |

### RB-06 - Approval gate implementation (CODEBASE GAP)

| Field | Value |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem/evidence | H-03/H-08 assume an approval gate exists for consequential actions (spec —12, prompt —3). CODEBASE_VERIFIED: `loop.py:83` hardcodes `has_approval=False` for ApplicationAgent. No approval infrastructure (payload binding, expiry, immutable confirmation) exists in the agent loop. The QA gate (`router.py:278-296`) validates outputs but does not enforce user consent. M-05 (approval-confusion rate) and M-12 (unapproved actions) are unmeasurable without this. |
| Target users | All users who trigger consequential actions (job submission, file operations); security/privacy reviewers (P13) |
| Dependencies | Core loop approval infrastructure must be built before H-03/H-08 can be tested; VB-03 (trust/approval UX study) depends on this |
| Security/privacy/data impact | Approval gate is a safety-critical component; failure = unapproved consequential action (S-02) |
| Cost | Medium — requires core loop modification, approval state management, expiry mechanism |
| Compatibility/migration | Breaking change to agent loop interface; must not break existing agent flows |
| Validation experiment | Build approval infrastructure ? run VB-03 (trust/approval UX study) ? measure M-05 (approval-confusion rate) and M-12 (unapproved actions) |
| Adoption trigger | Must be built before P05 (runtime) or P13 (contract tests); cannot be deferred beyond P13 |
| Owner | Security / AI Product Lead |
| Sunset/rejection condition | Reject if approval infrastructure cannot be built before P13; escalate to stakeholder decision (DEC-P01-05) for scope adjustment |

### RB-07 - Memory type expansion (2 ? 22 types) (CODEBASE GAP)

| Field | Value |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | H-01 assumes all memory types are used. CODEBASE_VERIFIED: `schemas/memory_types.py` defines 22 memory types with extraction prompts, validation rules, TTLs, and search weights. However, `memory_agent/handler.py:25-27` scopes the MemoryAgent to read/write only `profile` and `document` types (2 of22). The `Memory` model stores `type` as a string field, so the schema supports all22, but the extraction pipeline only processes2. M-01 (task success), M-03 (repeat-input) depend on full memory coverage. |
| Target users | All users who upload documents; persona PA-01 (final-year student) needs skill/achievement/education types; PA-03 (career-transitioner) needs experience/project/certification types |
| Dependencies | MemoryAgent extraction pipeline must be expanded to handle all22 types; extraction prompts exist in the registry but are not wired into the agent |
| Security/privacy/data impact | Expanding memory types increases the surface for wrong-memory incidents (H-02); validation rules per type provide some guardrails |
| Cost | Low-Medium — extraction prompts already exist in registry; need to wire them into the agent and test extraction quality per type |
| Compatibility/migration | Non-breaking — new types are additive; existing profile/document flows unchanged |
| Validation experiment | Expand MemoryAgent to all22 types ? run VB-02 (repeat-input reduction trial) ? measure M-01 (task success) and M-03 (repeat-input reduction) per type |
| Adoption trigger | Should be built before P05 (runtime) to enable full memory value testing; can be staged (expand to high-priority types first: skill, achievement, education, experience) |
| Owner | AI Product Lead |
| Sunset/rejection condition | Reject if extraction quality for specific types falls below threshold on eval set (P12); keep those types in registry but disabled in agent |

## 3. Governance

1. Research backlog entries move into phase scope only when the adoption trigger
 fires AND the owning phase owner records the move in that phase's register
 (change control, prompt —24).
2. No backlog entry expands MVP scope by itself (prompt overlay: "Do not expand
 current scope silently").
3. Non-goals are re-assessed only at their listed phase with an approved scope
 change; NG-06 has no re-assessment path.
4. All research findings carry an evidence label (`SOURCE_DERIVED` /
 `EXTERNAL_VERIFIED` / `STAKEHOLDER_DECISION` / `NOT_EXECUTED` / `UNKNOWN`);
 no finding is fabricated.

## 4. References

- `docs/phases/mvp-p01/12-success-metrics.md` (metrics + non-goals summary)
- `docs/phases/mvp-p01/05-validation-backlog.md` (VB-01..08, leading-indicator
 candidates)
- `docs/phases/mvp-p01/04-risk-decision-assumption-register.md`
 (RISK-MVP-P01-06..08, DEC-P01-05/07/08, UNK-04/05/06)
- `docs/phases/mvp-p00/12-future-readiness-backlog.md` (FB-01..05)
- `docs/phases/mvp-p01/10-persona-jtbd-evidence.md` (segments for RB-03)
- `apps/api/src/backend/orchestrator/loop.py:83` (approval gate OFF)
- `apps/api/src/backend/orchestrator/router.py:278-296` (QA gate)
- `apps/api/src/backend/schemas/memory_types.py` (22 memory types)
- `apps/api/src/backend/agents/memory_agent/handler.py:25-27` (MemoryAgent
 scope:2 of22 types)
