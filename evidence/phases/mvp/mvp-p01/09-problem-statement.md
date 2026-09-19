# MVP-P01 - 09. Problem Statement (DEL-MVP-P01-01)

> **Deliverable:** DEL-MVP-P01-01 - problem statement; versioned, owned,
> reviewed and linked. **Status:** V2.0 - upgraded 2026-08-16 to reflect actual
> codebase reality: 22 memory types (not 6 from design docs), hardcoded-off
> approval gate, QA gate not in P01, telemetry gaps. **Owner:** Product Manager
> / UX Researcher. **Evidence labels:** SOURCE_DERIVED (spec/repo),
> EXTERNAL_VERIFIED (research brief `07-research-brief-2026-08-07.md`),
> STAKEHOLDER_DECISION (user 2026-08-13), UNKNOWN (no live-user research
> available - never fabricated). **Prompt reference:**
> `MVP-P01-discovery-and-problem-definition.md` —1/—2/—3/ —5/—9/—12/—16. **Phase
> rule:** validate the student/early-career wedge WITHOUT claiming
> product-market fit.

## 1. Falsifiable problem statements

Each problem statement is written so it can be rejected by evidence. The
falsification test for each is listed; none has been run (DISCOVERY phase,
`NOT_EXECUTED`).

### PS-01 - Career memory does not persist across job-search touchpoints

- **Statement:** Indian students and early-career professionals (18+, BQ-03/04)
 cannot keep a consistent memory of their own career facts across touchpoints
 (resumes, certificates, transcripts, emails, applications), so they re-enter
 the same facts and re-upload the same documents repeatedly instead of reusing
 a single structured record.
- **Evidence basis:** SOURCE_DERIVED - `docs/01-vaeloom-mvp-spec.md` —2 (resumes
 go stale, achievements get forgotten, files scattered with no single source of
 truth); —7 (memory types exist precisely because facts recur across features).
 CODEBASE_VERIFIED - `schemas/memory_types.py` defines 22 memory types (person,
 organization, project, skill, achievement, education, experience,
 certification, publication, patent, award, meeting, task, goal, preference,
 constraint, insight, connection, location, event, document, conversation);
 however `memory_agent/handler.py:25-27` scopes the MemoryAgent to read/write
 only `profile` and `document` types — a critical implementation gap. The
 `Memory` model (`models/schema.py:212`) stores `type` as a string field,
 meaning all 22 types are defined in the registry but only2 are actively used
 by the extraction pipeline. EXTERNAL_VERIFIED -
 `07-research-brief-2026-08-07.md` —1 (45M enrolled, ~25% NEET, youth
 unemployment 9.9-14.9%, high application volume per seeker; —3 250+ resumes
 per opening). STAKEHOLDER_DECISION - India launch, 18+, individual job seekers
 (2026-08-13).
- **Who suffers:** individual job seekers with high application volume; the
 single user of the workspace (single-user product, BQ-03).
- **Why now:** record cohort sizes (AISHE 2023-24) + double-digit youth
 unemployment make application volume the norm; generic AI chatbots have no
 persistent structured memory of one person's life (spec —2); connector
 technology (OAuth, Gmail API) makes read/draft ingestion feasible at low cost.
- **Current journey (as-is):** user creates/edits resume manually -> searches
 portals -> re-reads own certificates/transcripts to answer forms -> repeats
 per application; email attachments and drive copies create version sprawl
 (`Resume_v2_final_FINAL.pdf`, spec —4.3); no single record of
 applications/outcomes is maintained. CODEBASE gap: the MemoryAgent extracts
 entities into only2 of22 defined memory types (profile, document); the
 remaining20 types (skill, achievement, education, experience, project,
 certification, etc.) have extraction prompts and validation rules in the
 registry but are not wired into the extraction pipeline.
- **Pain points:** re-entry; stale resumes; forgotten achievements (hackathon in
 year 1 missing from year-3 resume, spec —2); no application-outcome history
 reused in future searches (spec —4.10).
- **JTBD link:** "When I apply for roles, I want to reuse what I already have
 and said before, so I do not repeat work." (JTBD detail in
 `10-persona-jtbd-evidence.md`.)
- **Unacceptable outcomes:** user re-enters the same fact more than ~1x/week
 after adoption (repeat-input no decline, VB-02); memory contains wrong or
 superseded facts presented as current (PS-04/H-02); data cannot be exported or
 deleted (safety constraint S-06).
- **Falsification test:** cohort telemetry shows duplicate-entry events/user/
 week not declining vs. baseline after adoption (VB-02; H-01). If memory does
 not remove re-entry, this problem is not real for the wedge.
- **Status:** NOT_EXECUTED - REQUIRES_STAKEHOLDER_DECISION (cohort + threshold).

### PS-02 - Resume tailoring is manual, inconsistent, and ATS-blind

- **Statement:** individual job seekers tailor resumes manually and without ATS
 awareness, producing inconsistent, keyword-missing documents that are filtered
 before a human reads them.
- **Evidence basis:** EXTERNAL_VERIFIED - `07-research-brief-2026-08-07.md` —2
 (~75% of resumes filtered before human review; 80%+ of top 1,000 Indian firms
 run AI scan; 61% of freshers omit JD keywords; 34% ATS-breaking formatting;
 45% unaware of ATS). SOURCE_DERIVED - spec —4.6 (ATS templates + scoring +
 suggested rewrites, never silent rewrite); —4.5 (Resume Agent asks when a
 field is missing rather than guessing).
- **Who suffers:** freshers and early-career seekers whose documents never reach
 reviewers; the single workspace user (single-user product).
- **Why now:** ATS/AI screening is standard at scale in India (NASSCOM-derived
 data, research brief —2); tailoring every application manually is
 time-bounded; free point tools exist (Jobscan, Resume Worded) but are not
 memory-connected (research brief —3).
- **Current journey (as-is):** user reads JD -> hand-edits resume -> saves a new
 version -> uploads; keyword gaps and format breaks are discovered only after
 rejection, if at all; no per-role tailored variant is kept or reused.
- **Pain points:** hours per application; inconsistent versions; no gap list
 ("you are missing: Docker, 1 more DSA project", spec —4.7); no diff-based
 review before changes land (spec —4.6).
- **JTBD link:** "When I apply to a specific role, I want my career docs to fit
 that role, so my application gets read."
- **Unacceptable outcomes:** tailoring time does not fall >=30% (H-04/VB-06);
 resume rewrites are applied without showing the diff (violates spec —4.6 trust
 contract); unsupported automation fabricates application content (constraint
 S-03).
- **Falsification test:** before/after measure of prep time per application and
 ATS keyword coverage in a cohort (VB-06). No prep-time saving or no coverage
 gain rejects the value claim.
- **Status:** NOT_EXECUTED.

### PS-03 - Deadlines and opportunities slip because they are buried

- **Statement:** time-sensitive emails (interview calls, offer deadlines,
 application cutoff dates) get buried in the inbox and are missed or acted on
 late; a once-a-day check cannot catch same-day items.
- **Evidence basis:** SOURCE_DERIVED - spec —8 (scheduled 6 AM pass misses
 same-day items; lightweight push hook for high-priority classifiers); —4.9
 (extract dates/tasks, surface on Schedule); —2 (important emails get buried).
 STAKEHOLDER_DECISION - Gmail connector in scope (draft-only, BQ-03/P05).
- **Who suffers:** seekers juggling many applications with per-role deadlines;
 the single workspace user.
- **Why now:** high application volume (PS-01 evidence) multiplies the number of
 time-sensitive emails; push notification infrastructure is cheap and standard;
 deadline extraction by LLM is feasible but unproven at threshold accuracy
 (UNK-05).
- **Current journey (as-is):** user checks inbox manually at arbitrary times ->
 deadline seen late or missed -> interview/offer forfeited or rushed; no
 consolidated schedule of extracted dates exists.
- **Pain points:** missed interviews/offers; panic responses; no conflict
 detection between deadlines (Scheduler Agent, spec —5); no reminder lead time
 tuned to user preference.
- **JTBD link:** "When a deadline matters, I want it surfaced before it is
 urgent, so I act on time."
- **Unacceptable outcomes:** deadline-miss rate does not drop below baseline
 (VB-01/H-05); extraction accuracy below agreed threshold triggers BQ-06c pivot
 (DEC-P01-05); Gmail agent sends anything (constraint S-01, draft-only - sends
 are forbidden, target 0).
- **Falsification test:** Gmail deadline-extraction F1 below agreed threshold on
 a labeled eval set (UNK-05, P12) or cohort deadline-miss rate unchanged after
 reminders (VB-01).
- **Status:** NOT_EXECUTED - REQUIRES_STAKEHOLDER_DECISION (accuracy threshold,
 UNK-05).

### PS-04 - Trust barriers block adoption of a memory-first assistant

- **Statement:** job seekers will not let an agent hold a lifetime memory and
 act on it unless they trust what it remembers and what it may do; visible
 wrong memory or surprise actions destroy that trust faster than features build
 it.
- **Evidence basis:** SOURCE_DERIVED - spec —3 (passive by default, active on
 request; never destructive; earn autonomy; suggest-mode everywhere); —11
 (least privilege, no deletion, export/delete controls unconditional); —12
 (suggest-mode-first is the single biggest trust risk). EXTERNAL_VERIFIED -
 `07-research-brief-2026-08-07.md` —3 (auto-apply tools trust-negative:
 LazyApply ~52% 1-star; recruiters reject sloppy AI auto-filled applications).
 PROMPT —3 - consequential actions require immutable payload-bound expiring
 approval + idempotency; Gmail draft-only; no scraping/anti-bot
 circumvention/credential replay/unapproved submission.
- **Who suffers:** the user who must approve actions without understanding them;
 the user whose memory is wrong or leaky.
- **Why now:** AI assistant products are flooding the market, but the
 memory-first "second brain" claim (spec —2) is exactly where misuse fears
 concentrate; regulation (EU AI Act resume-screening high-risk note, DPDP
 duties) raises the cost of getting trust wrong (research brief —4).
- **Current journey (as-is):** no product to point at yet - the trust risk is
 prospective; users of auto-apply tools experience spam-application and
 account-flagging harms (research brief —3). CODEBASE gap: the approval gate
 described in spec —12 (suggest-mode-first, user confirms before action) is not
 implemented in the core loop — `loop.py:83` hardcodes `has_approval=False` for
 ApplicationAgent, and no approval infrastructure exists in the agent loop
 itself. The QA gate (`router.py:278-296`) validates agent outputs but does not
 enforce user approval before consequential actions.
- **Pain points:** unclear approval prompts; hard deletion fears; wrong memory
 presented as fact; inability to leave with data (spec —11 export/delete).
- **JTBD link:** "When I let an agent act for me, I want to know exactly what it
 will do and that I can undo or erase everything, so I stay in control."
- **Unacceptable outcomes:** approval-confusion rate above threshold (H-03);
 trust events drive churn without fix within 2 releases -> BQ-06a STOP
 (DEC-P01-05); any unapproved consequential action (S-02); purge incomplete on
 deletion (VB-05); cross-user memory exposure (non-goal).
- **Falsification test:** moderated trust/approval UX study (VB-03): users
 mis-approve or abandon approval flows above threshold, or deletion cannot be
 verified complete (VB-05).
- **Status:** NOT_EXECUTED - REQUIRES_STAKEHOLDER_DECISION (thresholds).

## 2. Problem/outcome framing - what success looks like for the wedge

**Wedge (from evidence, not vibes):** a memory-first assistant for individual
Indian job seekers (18+) that (a) reuses22-type structured memory (person,
skill, achievement, education, experience, project, etc.) so users never
re-enter data (PS-01; CODEBASE gap: MemoryAgent currently scoped to2 types), (b)
keeps career documents current and role-tailored against ATS reality (PS-02),
(c) extracts deadlines from Gmail and tracks applications (PS-03), and (d) stays
suggest-mode-first with draft-only Gmail and approved-integration-only
submission (PS-04 trust; CODEBASE gap: approval gate hardcoded OFF). The QA gate
(`router.py:278-296`) validates every agent output before delivery. Resume
optimization is table stakes (research brief —2/—5), not the wedge.

**Success for P01 (no product-market-fit claim):** the wedge is VALIDATED when
the falsifiable hypotheses in `11-value-risk-hypotheses.md` are tested against
the metrics in `12-success-metrics.md` with a design-partner cohort (RB-04),
specifically:

1. Memory demonstrably removes repeat input (H-01, PS-01).
2. Resume/ATS flow cuts tailoring effort and improves coverage (H-04, PS-02).
3. Deadline extraction and reminders reduce missed deadlines (H-05/H-06, PS-03).
4. Approval, export, and deletion flows are understood, complete, and trusted
 (H-03/H-07/H-08, PS-04).
5. No evidence of cross-user memory, unsupported automation, or unauthorized
 consequential action (safety non-negotiable).

Falsification: if any of the above fails its measurable test, the wedge is
reworked (BQ-06 stop/pivot criteria, DEC-P01-05) - P01 claims the problems are
plausible and measurable, NOT that the market exists or that users will pay.

## 3. Trust / safety / business constraints (prompt —3 fixed decisions + —16)

Non-negotiable constraints that bound every problem statement above. These are
fixed decisions (STAKEHOLDER_DECISION / prompt —3), not aspirational:

| ID | Constraint | Source | Enforcement evidence plan |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Gmail is draft-only; the agent never sends mail on its own; send rate target = 0 | Prompt —3; spec —8 | Draft-only enforcement tests P13; RISK-MVP-P01-02 |
| S-02 | Consequential actions require immutable, payload-bound, expiring user approval plus idempotency; no action without it | Prompt —3 | CODEBASE GAP: approval gate not implemented in core loop (`loop.py:83` hardcodes `has_approval=False`); QA gate exists (`router.py:278-296`) but validates output, not user approval. Approval contract verification P05/P13 (VB-03) requires building approval infrastructure first. |
| S-03 | No unsupported scraping, anti-bot circumvention, credential replay, or unapproved job submission; official integrations only | Prompt —3; spec —9 | Approved-integration gate; scope-lock tests (FB-05) |
| S-04 | Every persisted artifact is workspace-scoped; single-user product; cross-user memory impossible by construction | Prompt —3; spec —11 | Isolation tests in full suite (P00 evidence); FB-05 |
| S-05 | Relational data is authoritative; graph/vector/search/cache are provenance-carrying, rebuildable projections | Prompt —3 | Projection-rebuild + reconciliation tests (P10+) |
| S-06 | Under-13 excluded; min age 18 for launch (BQ-03/04); DPDP notice/consent/rights duties apply to India scope; no compliance self-claim without professional legal review | Prompt —3; BQ-03/04; prompt —16 | Legal review before any claim (RISK-MVP-P01-03); age gate at signup |
| S-07 | WCAG 2.2 AA is the accessibility target for the complete process | Prompt —3 | Automated + manual accessibility evidence (P07+); no claim without evidence |
| S-08 | Minimize data, permissions, retention, egress, blast radius; prompts/documents/emails/webpages/tools are untrusted data unable to change policy | Prompt —16 | Least-privilege connectors (read-only by default); threat modeling at design phases |
| S-09 | Enterprise SSO/SCIM, institution admin, billing, marketplace, multi-region cells, cross-user memory are OUT of scope | Prompt —3/—5 | Non-goals in `12-success-metrics.md` + `13-non-goals-research-backlog.md` |
| S-10 | QA gate (`router.py:278-296`) validates every agent output before delivery; rejected outputs retry up to3x then deliver with `best_effort_after_retries` flag | CODEBASE_VERIFIED | QA gate is operational but not mentioned in prior P01 deliverables; it is the only runtime quality gate currently implemented. |

## 4. References

- `docs/01-vaeloom-mvp-spec.md`, `docs/02-system-architecture.md`,
 `docs/03-agent-workflow.md`, `docs/04-memory-knowledge-graph.md`
- `docs/phases/mvp-p01/07-research-brief-2026-08-07.md`
- `docs/phases/mvp-p01/05-validation-backlog.md` (VB-01..08)
- `docs/phases/mvp-p01/10-persona-jtbd-evidence.md` (JTBD detail)
- `docs/phases/mvp-p01/11-value-risk-hypotheses.md` (H-01..H-08)
- `docs/phases/mvp-p01/12-success-metrics.md` (metrics + non-goals)
- `apps/api/src/backend/schemas/memory_types.py` (22 memory types registry)
- `apps/api/src/backend/agents/memory_agent/handler.py` (MemoryAgent scope: only
 reads/writes2 of22 types)
- `apps/api/src/backend/models/schema.py:212` (Memory model with `type` string
 field, `graph_node_id`, `vector_id`)
- `apps/api/src/backend/orchestrator/loop.py:83` (approval gate hardcoded OFF)
- `apps/api/src/backend/orchestrator/router.py:278-296` (QA gate)
