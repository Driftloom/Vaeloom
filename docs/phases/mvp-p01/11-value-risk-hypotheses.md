# MVP-P01 - 11. Value / Risk Hypotheses (DEL-MVP-P01-03)

> **Deliverable:** DEL-MVP-P01-03 - value/risk hypotheses; versioned, owned,
> reviewed and linked. **Status:** V2.0 - upgraded 2026-08-16 to reflect actual
> codebase reality: 22 memory types (not6), approval gate hardcoded OFF, QA gate
> exists. **Owner:** Product Manager / AI Product Lead / UX Researcher. **Prompt
> reference:** §1/§2/§3/§12/§18. **Rule:** hypotheses are falsifiable and tied
> to a validation-backlog experiment (`05-validation-backlog.md`, VB-01..08). No
> hypothesis has been executed - all experiments require the design-partner
> cohort (DEC-P01-07, RB-04) or runtime phases (P05+). Status is `NOT_EXECUTED`
> unless a threshold or cohort decision is needed, in which case it is
> `REQUIRES_STAKEHOLDER_DECISION` with owner.

## Hypothesis register

### H-01 - Memory quality: 22-memory-type recall removes repeat input (value)

- **Hypothesis:** IF the twenty-two memory types (person, organization, project,
  skill, achievement, education, experience, certification, publication, patent,
  award, meeting, task, goal, preference, constraint, insight, connection,
  location, event, document, conversation; `schemas/memory_types.py`) record and
  recall a user's career facts from ingested inputs, THEN the user re-enters the
  same fact <1x/week after adoption, BECAUSE memory replaces manual re-entry
  across features that share one spine (spec §7). CODEBASE GAP: the MemoryAgent
  (`memory_agent/handler.py:25-27`) currently reads/writes only `profile` and
  `document` types — 2 of22. The remaining20 types have extraction prompts and
  validation rules in the registry but are not wired into the extraction
  pipeline. This gap must be closed before H-01 can be meaningfully tested.
- **Why it matters:** memory is the product (spec §3); if it does not remove
  re-entry, the wedge fails (BQ-06b pivot, DEC-P01-05).
- **Falsification test:** repeat-input rate (duplicate entry events per user per
  week) does not decline >=30% vs. baseline within N weeks of adoption, or
  recall precision <90% on the eval set.
- **Experiment design:** VB-02 (repeat-input reduction trial; telemetry + user
  verification; Memory/Organization agents; P12 eval set).
- **Status:** REQUIRES_STAKEHOLDER_DECISION (cohort N + threshold, owner to
  confirm at cohort launch).
- **Owner:** Product.

### H-02 - Wrong memory is surfaced as fact and erodes trust (risk/negative)

- **Hypothesis:** IF wrong or superseded memory (stale resume, outdated skill,
  merged duplicate) is presented to the user without correction affordance, THEN
  the user corrects memory >1x/week and trust drops, BECAUSE wrong memory
  presented as fact is visible harm (PS-04).
- **Why it matters:** wrong memory is the most expensive trust failure scenario
  (prompt overlay item 1); extraction errors are unknown unknowns until they
  cause visible harm.
- **Falsification test (of the mitigation):** recall precision >= agreed
  threshold (eval set, P12) AND user correction events <= threshold; OR any
  wrong-memory incident causing a user-visible harm (missed deadline, wrong
  application content) within the cohort.
- **Experiment design:** VB-02 (precision + correction telemetry); VB-01
  (deadline harm linkage); trust-failure scenario tests RB-01.
- **Status:** NOT_EXECUTED.
- **Owner:** AI Product Lead / UX Researcher.

### H-03 - Trust/approval UX: users understand what they approve (value + risk)

- **Hypothesis:** IF approval requests are payload-bound, expiring, and state
  exactly what will happen in plain language, THEN users mis-approve or abandon
  approvals <5% of the time and accept >=80% of proposals, BECAUSE
  suggest-mode-first makes the agent's reach legible (spec §12, prompt §3).
  CODEBASE GAP: the approval gate described in spec §12 is not implemented in
  the core loop — `loop.py:83` hardcodes `has_approval=False` for
  ApplicationAgent. No approval infrastructure (payload binding, expiry,
  immutable confirmation) exists in the agent loop. The QA gate
  (`router.py:278-296`) validates agent outputs but does not enforce user
  approval before consequential actions. H-03 is unfalsifiable until approval
  infrastructure is built.
- **Why it matters:** confusing approvals are a named trust failure (prompt
  overlay item 1) and the BQ-06a STOP trigger (DEC-P01-05).
- **Falsification test:** approval-confusion rate (mis-approval + help-seeking
  - abandonment) >= threshold in moderated study; trust events correlate with
    churn.
- **Experiment design:** VB-03 (trust/approval UX study; drop-off analysis; P13
  approval UX).
- **Status:** REQUIRES_STAKEHOLDER_DECISION (confusion-rate threshold).
- **Owner:** Privacy / UX Research.

### H-04 - Resume/ATS value: tailoring gets faster and better (value)

- **Hypothesis:** IF the Resume + ATS agents reuse memory and score against the
  JD (spec §4.5/§4.6), THEN per-application tailoring time falls >=30% and
  keyword coverage rises vs. manual baseline, BECAUSE JD-aware rewrites with
  diff review beat hand editing.
- **Why it matters:** ATS filtering is the measurable gate for fresh graduates
  (research brief §2); resume tools are table stakes - the memory reuse is the
  differentiator (research brief §5).
- **Falsification test:** no prep-time saving >=30% or no ATS coverage gain in
  before/after cohort measurement; or users reject the tailored diff more than
  half the time (diff must be shown, spec §4.6).
- **Experiment design:** VB-06 (resume value check); VB-04 (application-status
  completeness).
- **Status:** NOT_EXECUTED.
- **Owner:** Product.

### H-05 - Gmail deadline extraction: fewer missed deadlines (value + risk)

- **Hypothesis:** IF the Gmail Agent (draft-only) classifies mail and extracts
  deadlines with F1 >= agreed threshold, THEN the cohort's deadline-miss rate
  drops below baseline, BECAUSE extracted dates become scheduled reminders
  instead of buried emails (spec §8).
- **Why it matters:** missed deadlines are a named trust failure (prompt overlay
  item 1); accuracy below threshold is the BQ-06c PIVOT trigger (DEC-P01-05,
  UNK-05).
- **Falsification test:** extraction F1 below agreed threshold on the labeled
  eval set (P12); or deadline-miss rate unchanged vs. baseline (VB-01).
- **Experiment design:** VB-01 (deadline-miss reduction trial; Gmail connector
  approved; P12+ implementation).
- **Status:** REQUIRES_STAKEHOLDER_DECISION (accuracy threshold, UNK-05).
- **Owner:** AI Product Lead / Product.

### H-06 - Reminders arrive with useful lead time (value)

- **Hypothesis:** IF the Scheduler surfaces deadlines and reminders at
  user-tunable lead times with conflict detection (spec §4.9/§5), THEN on-time
  action rate >= agreed threshold and no deadline is missed because a reminder
  was too late, BECAUSE the scheduler separates what matters from what is merely
  new.
- **Why it matters:** reminders are the visible payoff of deadline extraction;
  late reminders are as bad as no reminders (PS-03).
- **Falsification test:** on-time action rate below threshold; reminder latency
  (deadline discovered -> first reminder) violates lead-time preference in >5%
  of cases.
- **Experiment design:** VB-01 (extends deadline-miss trial with reminder timing
  instrumentation).
- **Status:** NOT_EXECUTED.
- **Owner:** Product.

### H-07 - Export/deletion is complete and trusted (value + risk)

- **Hypothesis:** IF "export everything" and "delete everything" complete fully
  and observably within RTO (spec §11), THEN users rate deletion/export
  confidence >= agreed threshold and no purge is incomplete, BECAUSE the right
  to leave with or erase data is unconditional and verifiable.
- **Why it matters:** difficult deletion is a named trust failure (prompt
  overlay item 1); incomplete purge is a DPDP/privacy harm (S-06).
- **Falsification test:** any export/deletion request not verified complete
  across system-of-record + projections within RTO (VB-05); user confidence
  below threshold.
- **Experiment design:** VB-05 (delete-completeness exercise; deletion lifecycle
  P13).
- **Status:** NOT_EXECUTED.
- **Owner:** Privacy.

### H-08 - Bounded operations: no overreach, zero unapproved actions (risk)

- **Hypothesis:** IF consequential actions (job submission, sends, destructive
  file ops) require immutable payload-bound expiring approval + idempotency
  (prompt §3), THEN zero unauthorized consequential actions occur and users
  report no surprise actions, BECAUSE suggest-mode-first + approval binding
  bound the agent's reach by construction (spec §3/§12). CODEBASE GAP: approval
  gate not implemented — `loop.py:83` hardcodes `has_approval=False`. The
  ApplicationAgent runs without user confirmation. H-08 is unfalsifiable until
  approval infrastructure is built. The QA gate (`router.py:278-296`) is the
  only runtime quality gate but does not enforce user consent.

### H-09 - QA gate reduces bad outputs before delivery (value)

- **Hypothesis:** IF the QA gate (`router.py:278-296`) validates every agent
  output and retries up to3x before delivering with a
  `best_effort_after_retries` flag, THEN bad outputs delivered to the user
  decline vs. no QA gate, BECAUSE the QA agent catches formatting errors,
  missing fields, and policy violations before delivery. CODEBASE_VERIFIED:
  QAAgent is instantiated in `router.py:279` and runs in a loop up to3x
  (`max_qa_retries = 3`). This is the only runtime quality gate currently
  implemented. Experiment design: measure QA rejection rate and
  `best_effort_after_retries` flag frequency in cohort telemetry. Status:
  NOT_EXECUTED. Owner: AI Product Lead.
- **Why it matters:** overreach is the hardest trust failure (prompt overlay
  item 1); unapproved action is a hard block (prompt §16).
- **Falsification test:** any unapproved consequential action in cohort or
  automated tests (approval expiry, payload tamper, replay, idempotency replay);
  user-reported surprise-action events >0.
- **Experiment design:** VB-03 (approval flows incl. expiry/replay cases); P13
  approval + idempotency contract tests (RISK-MVP-P01-02).
- **Status:** NOT_EXECUTED.
- **Owner:** Security / AI.

## Summary

| ID   | Type          | Domain                                       | Status                        | Owner                | Linked experiment   | Codebase note                        |
| ---- | ------------- | -------------------------------------------- | ----------------------------- | -------------------- | ------------------- | ------------------------------------ |
| H-01 | Value         | Memory quality (recall)                      | REQUIRES_STAKEHOLDER_DECISION | Product              | VB-02               | MemoryAgent scoped to2 of22 types    |
| H-02 | Risk/negative | Wrong memory                                 | NOT_EXECUTED                  | AI Product Lead / UX | VB-01, VB-02, RB-01 | —                                    |
| H-03 | Value + risk  | Trust/approval UX (confusing approvals)      | REQUIRES_STAKEHOLDER_DECISION | Privacy / UX         | VB-03               | Approval gate hardcoded OFF          |
| H-04 | Value         | Resume/ATS value                             | NOT_EXECUTED                  | Product              | VB-04, VB-06        | —                                    |
| H-05 | Value + risk  | Gmail deadline extraction (missed deadlines) | REQUIRES_STAKEHOLDER_DECISION | AI Product Lead      | VB-01               | —                                    |
| H-06 | Value         | Reminders                                    | NOT_EXECUTED                  | Product              | VB-01               | —                                    |
| H-07 | Value + risk  | Export/deletion (difficult deletion)         | NOT_EXECUTED                  | Privacy              | VB-05               | —                                    |
| H-08 | Risk/negative | Bounded ops (overreach)                      | NOT_EXECUTED                  | Security / AI        | VB-03, P13 tests    | Approval gate hardcoded OFF          |
| H-09 | Value         | QA gate reduces bad outputs                  | NOT_EXECUTED                  | AI Product Lead      | Telemetry-based     | QA gate exists (`router.py:278-296`) |

Negative/risk hypotheses explicitly covered: wrong memory (H-02), overreach
(H-08), missed deadlines (H-05), confusing approvals (H-03), difficult deletion
(H-07) - per the prompt trust-failure-scenarios overlay. H-09 added to reflect
the QA gate that was not in prior P01 deliverables.

## References

- `docs/phases/mvp-p01/05-validation-backlog.md` (VB-01..08)
- `docs/phases/mvp-p01/09-problem-statement.md` (PS-01..04)
- `docs/phases/mvp-p01/12-success-metrics.md` (measurement methods)
- `docs/phases/mvp-p01/13-non-goals-research-backlog.md` (RB-01..05)
- `docs/phases/mvp-p00/12-future-readiness-backlog.md` (FB-01..05)
- `apps/api/src/backend/schemas/memory_types.py` (22 memory types)
- `apps/api/src/backend/agents/memory_agent/handler.py` (MemoryAgent scope)
- `apps/api/src/backend/orchestrator/loop.py:83` (approval gate OFF)
- `apps/api/src/backend/orchestrator/router.py:278-296` (QA gate)
