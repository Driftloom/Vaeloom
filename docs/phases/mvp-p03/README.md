# MVP-P03 — Requirements Engineering

> **Prompt:** `MVP-P03` (66-prompt pack, validated) — governing execution
> contract **Governing sources:** INT-02 (SHA-256 `2FA8966F…69640` verified
> 2026-08-07) · INT-05 · INT-07/08/09 · gatekeeper compendiums ·
> **Predecessor:** MVP-P02 ✅ **ACCEPTED BY USER 2026-08-13** (DEC-P02-06;
> re-run gate **88.20/100** `19-gate-2026-08-13.md`; handoff
> `21-handoff-to-p03.md`) — entry decision
> **`CONDITIONAL GO — NON-DEPENDENT WORK ONLY`** (`02-predecessor-audit.md`; P03
> is requirements/docs = non-dependent; dependent/production work prohibited)
> **Phase type:** REQUIREMENTS ENGINEERING (docs-only; no production/dependent
> authorization) **Status:** ✅ COMPLETE — docs 01–12 written/updated; gate
> **83.9/100** CONDITIONAL GO (band 88–94, zero mandatory blockers, 7 P0 gaps
> release-blocking per DEC-P03-07); verdict = USER (sole gate authority, BQ-01);
> P04 starts only on user command. Supersedes the 2026-08-07 run (gate 88/100
> CONDITIONAL GO); prior files preserved untouched via date renames
> (`*-2026-08-07.md`). **Upgraded 2026-08-16:** zero-trust codebase audit → 15
> gaps → FR-71..FR-85 → gate re-scored 89.7→83.9.

## Entry criteria

- [x] P02 gate accepted by USER (sole gate authority, BQ-01): DEC-P02-06
      2026-08-13 — BQ-P02-01..04 confirmed, DEC-P02-05 T2/T3 proposals-only;
      handoff `../mvp-p02/21-handoff-to-p03.md` live
- [x] Canonical sources + repo revision identified (`master` @ `23cc0b4`, pushed
      0/0; commits since `4aa6c71` docs-only — PA-MVP-P03-012)
- [x] Access: docs-only; no production changes; $0 budget (DEC-P01-08);
      India/18+/individuals (BQ-03/04); Gmail draft-only (DEC-P01-03)
- [x] Owners named: user = sole approver (BQ-01); reviewers =
      Security/Privacy/Data/ Accessibility/Operations veto on mandatory blockers
      (prompt §2)
- [x] Requirements traceable; no critical blocker makes work unsafe; coverage
      delta + stale EVD counts carried for reconciliation (RISK-MVP-P02-10/11)

## Blocking questions (prompt §8) — resolved

| ID        | Question               | Decision                                                                                                     |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| BQ-01     | Approver               | User = sole approver (BQ-01); backup = none (solo) — RESOLVED 2026-08-13                                     |
| BQ-02     | Baseline               | `master` @ `23cc0b4` (2026-08-14, verified 0/0); env = repo; no production access                            |
| BQ-03/04  | Entities/region/age    | India, 18+, individual job seekers, single-user, workspace-scoped                                            |
| BQ-05     | Team/budget/cohort     | Founder-led team, $0, closed invite-only cohort N≈10–20; **ship window TBD → P04** (ASP-02)                  |
| BQ-06     | Release-blocking owner | User; change via approved change control (§7)                                                                |
| BQ-P02-01 | Value prop             | ✅ CONFIRMED by USER 2026-08-13 (DEC-P02-06) — memory-first personal job-search assistant                    |
| BQ-P02-02 | Primary persona        | ✅ CONFIRMED — P1 "The Fresher" (India 18–24, first job search; P2 "Urban Switcher" secondary)               |
| BQ-P02-03 | Memory bar             | ✅ CONFIRMED — ≥80% retrieval hit-rate; ≥90% deadline extraction; zero data-loss; 100% deletion completeness |
| BQ-P02-04 | Load                   | ✅ CONFIRMED — target 100 concurrent; upper bound 1,000 concurrent                                           |

## Register index

| #   | Document                                | Purpose                                                                                | Status |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| 01  | `01-source-register.md`                 | Phase sources + standards re-verified 2026-08-14 + conflict log CF-P03-01..04          | ✅     |
| 02  | `02-predecessor-audit.md`               | P02 forensic audit PA-MVP-P03-001..013; entry CONDITIONAL GO — NON-DEPENDENT WORK ONLY | ✅     |
| 03  | `03-requirements.md`                    | **DEL-MVP-P03-01** — atomic FR/NFR set incl. hardened FR-52–FR-70, NFR-15–NFR-22       | ✅     |
| 04  | `04-stories-acceptance.md`              | **DEL-MVP-P03-02** — stories + acceptance                                              | ✅     |
| 05  | `05-traceability-matrix.md`             | **DEL-MVP-P03-03** — source→req→design→test→evidence (incl. coverage delta reconcile)  | ✅     |
| 06  | `06-priority-release-baseline.md`       | **DEL-MVP-P03-04** — MoSCoW + release baseline                                         | ✅     |
| 07  | `07-change-control.md`                  | **DEL-MVP-P03-05** — change-control rules                                              | ✅     |
| 08  | `08-registers.md`                       | Risks/decisions/assumptions (incl. RISK-MVP-P02-10/11 closure)                         | ✅     |
| 09  | `09-gate-2026-08-14.md`                 | End-of-phase gate (83.9/100, re-scored 2026-08-16; 7 P0 gaps release-blocking)         | ✅     |
| 10  | `10-handoff-to-p04.md`                  | Next-phase handoff                                                                     | ✅     |
| 11  | `11-completion-response-2026-08-14.md`  | §30 completion response (A–P)                                                          | ✅     |
| 12  | `12-implementation-gap-requirements.md` | **NEW 2026-08-16** — zero-trust audit: 15 gaps → FR-71..FR-85                          | ✅     |

Historical: prior run (2026-08-07, gate 88/100 CONDITIONAL GO) preserved
untouched as `01-source-register-2026-08-07.md`,
`02-predecessor-audit- 2026-08-07.md`, `03-requirements-2026-08-07.md`,
`04-stories-acceptance- 2026-08-07.md`, `05-traceability-matrix-2026-08-07.md`,
`06-priority-release-baseline-2026-08-07.md`,
`07-change-control- 2026-08-07.md`, `08-registers-2026-08-07.md`,
`09-gate-2026-08-07.md`, `10-handoff-to-p04-2026-08-07.md`,
`README-2026-08-07.md` — superseded by this re-run.

Legend: ✅ done this run · planned · historical (2026-08-07 run, preserved
untouched)

## Workstreams (prompt §11)

| WS      | Workstream                            | Owner role (prompt §2) | Output                    | Status |
| ------- | ------------------------------------- | ---------------------- | ------------------------- | ------ |
| WS-03.1 | Functional/journey requirements       | Product Manager/BA     | `03-requirements.md` §1   | ✅     |
| WS-03.2 | Quality attributes/SLOs               | Solution Architect     | `03-requirements.md` §2   | ✅     |
| WS-03.3 | Data/AI/security/privacy requirements | Security/Privacy       | `03-requirements.md` §3–4 | ✅     |
| WS-03.4 | Acceptance/traceability               | QA Lead                | `04/05`                   | ✅     |
| WS-03.5 | Prioritization/change control         | Product Manager        | `06/07`                   | ✅     |
| —       | Registers / gate / handoff            | Phase owner            | `08`–`11`                 | ✅     |
| —       | Implementation gap audit (NEW)        | Phase owner            | `12`                      | ✅     |

## Scope note (CF-P03-01, updated per P02 gate)

P03 §3 lists "unsupported job-platform automation" as out of scope; **DEC-P02-05
resolved at the P02 gate (USER 2026-08-13)**: Tier-1 lawful automation (Gmail
watch/polling, deadline extraction, auto-track, auto-drafts, reminders, URL
ingest, prep assembler) = **MVP requirements baseline**; **T2/T3 = PROPOSALS
ONLY** — flag-gated (AUTO-02/03), legal-review gate P13, never default-ON, no
amendment to DEC-P01-02/04. Conflict resolution: `01-source-register.md`
CF-P03-01 (also CF-P03-02 repo truth Next.js+FastAPI, CF-P03-03 review-first
default, CF-P03-04 coverage delta resolution path).

## Hard rules carried into P03

- $0 budget (DEC-P01-08); volunteer invite-only cohort N≈10–20, no incentives
  (DEC-P01-07); user is sole approver (BQ-01).
- Gmail draft-only (DEC-P01-03); approved-integration-only submissions
  (DEC-P01-04, T2 proposal-only per DEC-P02-05); no unsupported scraping,
  anti-bot circumvention, credential replay (S-02/S-03).
- Stop/pivot criteria active (DEC-P01-05/BQ-06): stop on trust-driven churn;
  pivot on no memory value or deadline-accuracy miss.
- No compliance/security/a11y/scale self-claims; professional legal review
  before any claim (DEC-P02-04, P13 gate); no product-market-fit claim.
- No code/config/runtime implementation (owned P05+); no dependent work,
  release, or production changes without a user command; P04+ start only on user
  command.
- Enterprise features (SSO/SCIM, admin, billing, marketplace, multi-region,
  cross-user memory) stay disabled/unimplemented (NG-01..09).
- Coverage 94% of record (RISK-MVP-P02-10) + stale EVD counts (RISK-MVP-P02-11)
  reconciled in `03/05/08` before the gate.
- Interviews/cohort evidence stay UNKNOWN until USER supplies VB-07/08 access
  (design-partner protocol, `../mvp-p02/11-evidence-plan.md` §5) — no
  fabrication.
- **P0 gap requirements (FR-71..75, FR-82, FR-85) are release-blocking
  (DEC-P03-07)** — must be fixed before any MVP release claim. Full gap details
  in `12-implementation-gap-requirements.md`.
