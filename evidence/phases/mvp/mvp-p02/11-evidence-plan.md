# MVP-P02 - 11. Evidence Plan (DEL-MVP-P02-01, WS-02.6)

> **MVP-P02 re-run 2026-08-13.** Baseline: repo `master` @ `4aa6c71` (pushed,
> 0/0; P01 CLOSED - ACCEPTED BY USER 2026-08-13, DEC-P01-09; entry = CONDITIONAL
> GO - NON-DEPENDENT WORK ONLY, see `10-predecessor-audit.md`). Phase type:
> RESEARCH - docs/research/planning ONLY, no code, no production/dependent
> authorization. Supersedes the prior P02 run gated 2026-08-07 (CONDITIONAL GO
> 88/100, `07-gate-2026-08-07.md`) - historical record preserved via date
> renames (Q&A-2, plan `mvp-p02-rerun-2026-08-13.md`). This file is
> DEL-MVP-P02-01 (research plan/repository): research questions tied to
> decisions, workstream plan, evidence register, design-partner protocol,
> validation backlog carry-forward and stopping criteria. All claims require
> sources; nothing is asserted as fact without a citation or an approved
> stakeholder decision.

## 1. Evidence strategy (prompt section 18)

1. **Source identity first** - every claim records the official source, its
 version/date, URL and access date; official docs outrank summaries; no
 unofficial tutorials for critical API/legal behavior.
2. **Triangulate user evidence** - a user claim is validated only when at least
 two independent channels agree (interview synthesis + exercise record +
 telemetry); a single-channel anecdote is a note, not evidence.
3. **Label everything** - `SOURCE_DERIVED` (approved spec corpus + P01 outputs
 - BQ decisions), `EXTERNAL_VERIFIED` (official sources re-checked
 2026-08-13), `NEW_DESIGN` (this phase's plans), `STAKEHOLDER_DECISION`
 (user-approved), `REQUIRES_STAKEHOLDER_DECISION` (absent owner input, held
 honestly), `UNKNOWN` (no source), `NOT_EXECUTED` (planned, not run),
 `IN_PROGRESS` (parallel workstream not yet landed).
4. **A plan is not evidence it ran** - research findings are claims with sources
 and dates; the phase gate consumes them only when the owning deliverable file
 exists and links the row.

Evidence rows follow prompt section 23: claim -> requirement (R01-R08) -> type
-> location -> result -> date -> verified by.

## 2. Research questions (RQ-02-01..10) tied to decisions

Refresh of the 2026-08-07 set (RQ-02-01..07) plus new questions per P01 handoff
sec 2 (India recruitment/ATS mechanics, design-partner protocol, journey
mapping). Each question feeds a named decision; unresolved questions surface as
UNKNOWN or REQUIRES_STAKEHOLDER_DECISION at the gate.

| RQ | Question | Source of truth | Decision served | Owner WS |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| RQ-02-01 | What are the current India recruitment/ATS mechanics (ATS adoption, filtering behavior, portal reality) for the 18+ job-seeker segment? | MoSPI PLFS, AISHE, official platform/industry reports (verified 2026-08-13) | BQ-P02-01 (value prop), BQ-P02-02 (primary persona), PS-02/PS-03 falsification context | WS-02.1 |
| RQ-02-02 | What are the current Gmail API rules for push watch, renewal, quotas, and draft creation (draft-only contract)? | Official Google Gmail API docs (re-verified 2026-08-13) | DEC-P01-03 (draft-only), BQ-P02-03 (deadline-extraction threshold), ASP-05, connector P08 | WS-02.2 |
| RQ-02-03 | Which official job-platform partner programs/APIs exist for individual job seekers (Naukri/LinkedIn/Indeed/other), what do they allow and prohibit? | Official partner/developer docs of each platform (re-verified 2026-08-13) | DEC-P01-04 (approved-integration-only, S-03), DEC-P02-05 tiers (re-confirm at gate) | WS-02.2 |
| RQ-02-04 | Are there lawful, sanctioned ways to track applications (email parsing, manual entry, platform-native trackers)? | Platform docs + product policies | VB-04 (application-status completeness), S-03 | WS-02.2 |
| RQ-02-05 | What open/consented, $0 datasets exist for the eval set - memory quality (6 types), deadline extraction, ATS matching - without PII? | Official dataset sources + license checks | BQ-P02-03 (memory/deadline thresholds), UNK-05 (accuracy threshold), H-01/H-02/H-04/H-05, M-02/M-03/M-06 | WS-02.3 |
| RQ-02-06 | Which data fields/artifacts must Vaeloom store, classify and retain per DPDP + workspace scope, and how do retention/deletion apply? | DPDP Act 2023, DPDP Rules 2025 (in-force status verified 2026-08-13), INT-05 | R06 (data lineage/lifecycle), S-08 (minimize data), VB-05 (deletion completeness) | WS-02.3 |
| RQ-02-07 | Is resume/ATS assist high-risk under the EU AI Act for the India launch, and do FERPA/COPPA analogies apply? | EU AI Act official guidance; professional review required for any claim | R03, CF-P01-02 (NOT_APPLICABLE re-verify), P13 legal gate, RB-01 | WS-02.4 |
| RQ-02-08 | What DPDP duties (notice/consent/rights/breach) are in force for India 18+ job seekers at launch? | DPDP Act 2023 + final DPDP Rules 2025 (verified 2026-08-13) | R03, design-partner consent protocol (sec 5), P13 legal gate - no compliance self-claim | WS-02.4 |
| RQ-02-09 | Which $0 components (OSS + official free tiers) cover eval, retrieval, storage and orchestration, and what are exit/portability costs? | Official vendor docs (re-verified 2026-08-13) | DEC-P01-08 ($0 budget), DEC-P02-05 feasibility, ASP-07 (free-tier scale) | WS-02.5 |
| RQ-02-10 | What does the current-state journey look like for PA-01..03, and how does the design-partner cohort (N~10-20, consent-first) validate it? | P01 personas/PS-01..04 (SOURCE_DERIVED) + cohort interviews (UNKNOWN until activation) | DEC-P01-07 (cohort), RB-04 protocol, VB-07/08, journey mapping | WS-02.1 |

## 3. Workstream plan (prompt §11 + §2 roles)

| WS | Workstream | Owner role (prompt §2) | Key tasks | Output (this run) | Status |
| ------- | -------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| WS-02.1 | User/domain research | User Researcher | RQ-01, RQ-10: domain deep-dive, competitor landscape, journey mapping from P01 proxy evidence; design-partner protocol activation (blocked until USER supplies cohort) | `12-domain-competitor-analysis.md` | ✅ LANDED (proxy + plan; interviews REQUIRES_STAKEHOLDER_DECISION - VB-07) |
| WS-02.2 | Platform/standards research | Security Architect | RQ-02..04: Gmail push/quota/draft re-verified 2026-08-13; job-platform lawful surface; MCP connector rules; external-dependency radar | `13-platform-research.md` | ✅ LANDED |
| WS-02.3 | Data/source feasibility | Data Architect | RQ-05, RQ-06: data inventory/classification/retention/deletion; eval-set plan (22 memory types, deadline extraction, ATS matching) from public/official sources, license-checked, no PII | `14-data-feasibility.md` | ✅ LANDED |
| WS-02.4 | Legal/privacy/AI-risk analysis | Compliance Reviewer | RQ-07, RQ-08: DPDP in-force status, EU AI Act classification, student privacy, ATS/AI limits; no compliance self-claims; professional-review gate recorded | `15-regulatory-analysis.md` | ✅ LANDED |
| WS-02.5 | Build-buy evidence | AI/ML Engineer | RQ-09: $0 build-vs-buy matrix (eval, retrieval, storage, orchestration, search); exit/portability + unit-economics note | `16-build-buy.md` | ✅ LANDED |
| WS-02.6 | Research plan/repository + evidence register | Domain Specialist (accountable; owns gate) | RQ->WS->EVD map (this file); evidence register; register rows as workstreams land | `11-evidence-plan.md` | ✅ LANDED (register CLOSED at gate) |
| WS-02.7 | Decision implications | Domain Specialist + AI/ML Engineer | BQ-P02-01..04 proposals with evidence basis; DEC-P02-05 automation tiers (prior approval 2026-08-07) re-confirmation requested at gate; decision->implication matrix | `17-decision-implications.md` | ✅ LANDED (BQ rows pending USER) |
| — | Registers refresh | Phase owner | Risks/decisions/assumptions/BQ/UNK refreshed (incl. re-affirmed DEC-P01-* and new DEC-P02-*) | `18-registers.md` | ✅ LANDED |
| — | Gate + completion + handoff | Phase owner | §28 weighted gate with line-by-line math; §30 completion response; P03 handoff | `19-gate-2026-08-13.md`, `20-…`, `21-…` | ✅ LANDED (88.20/100; verdict = USER) |

## 4. Evidence register (prompt §23)

Result column is honest: rows owned by parallel workstreams were
`IN_PROGRESS (see <file>)` until the file landed and linked the row; rows for
this plan are `SOURCE_DERIVED`; cohort rows stay `REQUIRES_STAKEHOLDER_DECISION`
/ `UNKNOWN` (no fabrication, Q&A-1). **Register closed at the gate 2026-08-13**
— all workstream rows landed and linked; pending rows are USER-decision rows
(BQ) or BLOCKED rows (VB), not open work. Date 2026-08-13 throughout.

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- | ------------------------ |
| EVD-MVP-P02-001 | P01 predecessor forensic audit at baseline `4aa6c71`; entry decision CONDITIONAL GO - NON-DEPENDENT WORK ONLY (USER acceptance, DEC-P01-09) | R02, R07 | report | `10-predecessor-audit.md` | SOURCE_DERIVED (audit complete; arithmetic re-verified) | 2026-08-13 | Phase owner |
| EVD-MVP-P02-002 | Research plan DEL-MVP-P02-01: RQs tied to decisions, WS plan, EVD register, design-partner protocol, stopping criteria | R01, R07 | file | `11-evidence-plan.md` (this file) | SOURCE_DERIVED (plan; register CLOSED at gate 2026-08-13) | 2026-08-13 | Phase owner |
| EVD-MVP-P02-003 | India recruitment/ATS mechanics + competitive landscape + journey map for PA-01..03 (proxy evidence from P01 brief + official stats) | R01, R02 | report | `12-domain-competitor-analysis.md` | LANDED - EXTERNAL_VERIFIED/SOURCE_DERIVED (13-product landscape; live validation = EVD-016) | 2026-08-13 | User Researcher |
| EVD-MVP-P02-004 | Gmail API push watch/renewal/quota/draft-only rules re-verified at phase start (2026-08-13) | R01, R04 | official docs | `13-platform-research.md` §1 | LANDED - EXTERNAL_VERIFIED (URLs + access date; 15k units/min; watch expiry 7 days) | 2026-08-13 | Security Architect |
| EVD-MVP-P02-005 | Job-platform partner-program surface (Naukri/LinkedIn/Indeed/other) for individual job seekers - allowed vs prohibited | R01, R03 | official docs | `13-platform-research.md` §2 | LANDED - EXTERNAL_VERIFIED (Naukri B2B-only; LinkedIn partner-only; Indeed Publisher Program) | 2026-08-13 | Security Architect |
| EVD-MVP-P02-006 | MCP connector rules + external-dependency radar (terms/quotas/advisories/regulatory milestones) | R01, R03 | official docs | `13-platform-research.md` §4 | LANDED - EXTERNAL_VERIFIED (rules + radar rows) | 2026-08-13 | Security Architect |
| EVD-MVP-P02-007 | Data/source feasibility: inventory, classification, retention/deletion; eval-set plan (22 memory types, deadline extraction, ATS matching) licensed/no-PII | R06 | report | `14-data-feasibility.md` | LANDED - SOURCE_DERIVED/EXTERNAL_VERIFIED (9-dataset plan; no PII; contamination controls) | 2026-08-13 | Data Architect |
| EVD-MVP-P02-008 | DPDP Act 2023 + DPDP Rules 2025 in-force status and duties mapped for India 18+ launch (no compliance self-claim; legal review gate P13) | R03 | official text | `15-regulatory-analysis.md` §1 | LANDED - EXTERNAL_VERIFIED (3-phase commencement; no self-claims) | 2026-08-13 | Compliance Reviewer |
| EVD-MVP-P02-009 | EU AI Act classification of resume/ATS assist + student privacy (FERPA/COPPA analogies) applicability for India launch | R03 | official text + review | `15-regulatory-analysis.md` §2–§3 | LANDED - EXTERNAL_VERIFIED (transparency from 2026-08-02; applicability mapped) | 2026-08-13 | Compliance Reviewer |
| EVD-MVP-P02-010 | $0 build-vs-buy evidence (OSS + free tiers) for eval/retrieval/storage/orchestration; exit/portability costs | R01, R05 | vendor docs | `16-build-buy.md` | LANDED - EXTERNAL_VERIFIED (free-tier limits + exit costs; Groq conflict → verify P12) | 2026-08-13 | AI/ML Engineer |
| EVD-MVP-P02-011 | BQ-P02-01..04 proposals with evidence basis (value prop, primary persona, memory/deadline thresholds, design load) | R01, R08 | report | `17-decision-implications.md` §1 | LANDED - RESOLVED (USER confirmed all four at gate 2026-08-13, DEC-P02-06) | 2026-08-13 | Domain Specialist |
| EVD-MVP-P02-012 | DEC-P02-05 automation tiers (T1/T2/T3) - prior user approval 2026-08-07; USER verdict at P02 gate | R08 | user decision | `17-decision-implications.md` §2 + historical `09-automation-blueprint-2026-08-07.md` | RESOLVED 2026-08-13 - USER kept T2/T3 as PROPOSALS ONLY; T1 = MVP core (DEC-P02-05/06) | 2026-08-13 | USER / Domain Specialist |
| EVD-MVP-P02-013 | Registers refreshed: risks (incl. RISK-MVP-P01-01..08 + prior RISK-P02-01..09), decisions, assumptions, BQ, UNK | R07 | file | `18-registers.md` | LANDED - SOURCE_DERIVED (15 risks/12 decisions/11 assumptions/10 BQ/10 UNK) | 2026-08-13 | Phase owner |
| EVD-MVP-P02-014 | §28 weighted gate + §30 completion response + P03 handoff (>=88 recommendation; verdict = USER) | R08 | report | `19-gate-2026-08-13.md`, `20-completion-response.md`, `21-handoff-to-p03.md` | LANDED - SOURCE_DERIVED (88.20/100; verdict pending USER) | 2026-08-13 | Phase owner |
| EVD-MVP-P02-015 | Design-partner protocol defined: consent-first, DPDP notice, N~10-20 volunteers via founder network, no incentives, no PII in synthesis | R02, R03 | plan | this file sec 5 | REQUIRES_STAKEHOLDER_DECISION (no cohort yet - Q&A-1 2026-08-13) | 2026-08-13 | UX Researcher |
| EVD-MVP-P02-016 | Live user research (interviews/walkthroughs validating PA-01..03, PS-01..04; journey mapping from evidence) | R02, R04 | interview synthesis | VB-07 (signup), VB-08 (consent + synthetic resumes) | UNKNOWN (proxy evidence stands; live interviews NOT_EXECUTED) | 2026-08-13 | UX Researcher |

## 5. Design-partner protocol (WS-02.1 - consent-first, RB-04)

**Status: `REQUIRES_STAKEHOLDER_DECISION` - no cohort yet.** Plan Q&A-1
(2026-08-13): WS-02.1 stays proxy + plan; interviews governed as UNKNOWN /
REQUIRES_STAKEHOLDER_DECISION; do NOT fabricate or self-recruit.

1. **Cohort (DEC-P01-07/08):** closed invite-only volunteers via founder's
 network, N~10-20, zero-budget, no incentives, workspace-scoped, no cross-user
 data. Members of the target segment (India, 18+, individual job seeker,
 BQ-03) spread across the segmentation axes (age band, region, institution
 relationship, data sensitivity - sampling frame = P01 `10` sec 2, VB-08).
2. **Consent and notice (India DPDP Act 2023 + DPDP Rules 2025):**
 pre-enrollment plain-language notice (what data, purpose = product
 validation, retention, deletion rights, right to withdraw; English with
 regional-language option for tier-2/peri-urban participants); explicit
 granular consent per data class before any collection; no dark patterns;
 cohort data never cross-used; export/delete exercise available to every
 participant (VB-05). Professional legal review before any compliance claim.
3. **No PII in synthesis:** synthesis/notes contain no participant-identifying
 data; raw notes stay workspace-scoped under the retention policy; segment
 metadata minimal and consent-approved (VB-08).
4. **Measurement protocol (anti-anecdote guard, P01 `03` sec 4.4):**
 pre-registered outcomes with metrics/formulas/thresholds before collection;
 measured > anecdotal (anecdote = qualitative note only); dual-channel minimum
 (telemetry + exercise record + interview synthesis); N >= 10 per segment for
 qualitative saturation, quantitative claims state N and threshold
 pre-commitment; below-guidance N reported as REQUIRES_STAKEHOLDER_DECISION,
 never padded.
5. **Live interviews:** UNKNOWN until cohort activation (VB-07, user action).
 Proxy evidence (P01 research brief `07-research-brief-2026-08-07.md`,
 official statistics) stands in the interim, labeled EXTERNAL_VERIFIED where
 sourced.

## 6. Validation backlog carry-forward (P01 `05-validation-backlog.md` VB-01..08)

Both P02-relevant cohort items are **BLOCKED on user action** (carried from P01
run and prior P02 run `01-evidence-plan-2026-08-07.md` sec 4):

| ID | Item | Needs | Status | Owner |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------- | ------------------------ |
| VB-07 | Interview session signup (founder network) | USER supplies cohort access | BLOCKED - REQUIRES_STAKEHOLDER_DECISION | UX Researcher |
| VB-08 | Eval-set consent + synthetic-resume generation | USER decision + consent | BLOCKED - REQUIRES_STAKEHOLDER_DECISION | Data Architect / Privacy |
| VB-01..06 | Deadline-miss, repeat-input, trust/approval, application status, delete-completeness, resume value | Runtime phases P12/P13 + cohort | NOT_EXECUTED (owned P12/P13) | Product / Privacy |

## 7. Stopping criteria for research

Research (and the P02 gate) closes or halts per these criteria; none are
satisfied by placeholder prose:

1. **Source failure:** any RQ whose official-source verification is impossible
 within the phase window is recorded as UNKNOWN with owner and decision
 impact - never invented (prompt §8 rule).
2. **Contradiction:** any 2026-08-07 finding contradicted by 2026-08-13
 re-verification (e.g., DPDP in-force status, Proxycurl precedent date, Gmail
 quota numbers) is recorded as a conflict (CF-*) with resolution and owner;
 stale facts are never silently carried.
3. **Cohort failure:** if cohort activation is absent at phase end,
 design-partner protocol + VB-07/08 stay REQUIRES_STAKEHOLDER_DECISION and
 pass to P03; proxy evidence stands; no fabricated interviews or persona
 validation claims.
4. **Decision failure:** if BQ-P02-01..04 remain unconfirmed at the gate, the
 gate records them as pending-decision rows and the P03 handoff marks
 dependent scope blocked on USER.
5. **Automation decision:** DEC-P02-05 tiers carry as prior-approved
 (2026-08-07) only as proposals; without USER re-confirmation at the gate no
 new runtime dependency or automation claim is made (T2/T3 remain flag-gated,
 not runtime).
6. **Positive close:** all RQs statused (VERIFIED / UNKNOWN /
 REQUIRES_STAKEHOLDER_DECISION), every EVD row linked to a landed file,
 deliverables 12-17 linked from README, gate run with line-by-line math
 (recommendation >=88 conditional band), verdict presented to USER (Q&A-4: P03
 starts only on user command).

## 8. Scope guard (prompt §5/§13/§16, re-affirmed Q&A-3)

- India launch, min age 18, individual job seekers, single-user,
 workspace-scoped; $0 budget (DEC-P01-08).
- Gmail draft-only; job submission only via approved official integration with
 payload-bound user approval (S-02/S-03).
- Out of scope: enterprise SSO/SCIM, institution admin, billing, marketplace,
 multi-region cells, cross-user memory, unsupported job-platform automation.
- No compliance/security/accessibility/scale self-claims; professional legal
 review required (P13).
- No product-market-fit claim; research outputs are plans/hypotheses with
 sources, not runtime proof.
