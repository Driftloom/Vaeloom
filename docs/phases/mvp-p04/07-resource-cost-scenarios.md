# MVP-P04 — 07. Resource & Cost Scenarios (DEL-MVP-P04-05)

> Owner: FinOps Specialist · Baseline: master @ dac2630 (P03 CLOSED 2026-08-14)
> · Status: APPROVED_BASELINE pending gate.

## 1. Fixed resource constraints

| Constraint | Value | Source |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Budget | $0 — OSS + free tiers + volunteer time | DEC-P01-08 (USER 2026-08-07; re-affirmed P02/P03) |
| Volunteer cohort | N≈10–20, India, 18+, no incentives | DEC-P01-07 (USER 2026-08-07) |
| Team | Founder-led team + AI agents | BQ-05 (P01 re-run 2026-08-13; carried P03) |
| Design load | 100 concurrent target / 1,000 upper bound | BQ-P02-04 (USER confirmed 2026-08-13 at P02 gate; carried P03) |
| Paid resources | No paid resource without FinOps approval | DEC-P01-08 overlay (Phase-Specific overlay; prompt §7) |
| Budget figures | No fabricated budget numbers — all numbers carry a source and a label | RISK-MVP-P02-01 honesty rule; this file |

Constraint context: all cost/capacity figures below are **ASSUMPTION** or
**NOT_EXECUTED** until measured (P15 load/measurement gates; P12 usage
reporting) — never presented as tested fact.

## 2. Capacity plan (load 100/1,000)

| Stack area | Free-tier / OER basis | Capacity claim | Label |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Stateless web (Next.js) | PaaS free tier (Vercel hobby / Render free) | Adequate for 100 target; 1,000 upper bound unproven | ASSUMPTION — pending P15 load test |
| Backend (FastAPI) + PostgreSQL | Free-tier backend + Postgres (Neon/Supabase free) | Adequate for cohort scale (<100 users) | ASSUMPTION — basis ASP-07, pending P15 measurement |
| Redis/BullMQ | Free-tier ceiling unknown (Upstash free tier limits unverified) | Unknown — verify at P15 | ASSUMPTION — NOT_EXECUTED, verify at P15 |
| Object storage | Free-tier ceiling unknown (R2/Supabase free tier limits unverified) | Unknown — verify at P15 | ASSUMPTION — NOT_EXECUTED, verify at P15 |
| Vector/graph projections | Rebuildable from relational system of record | Projection infra can be minimal (rebuild on demand) | ASSUMPTION — design choice, not a measured ceiling |

Capacity plan notes:

- Stateless web + FastAPI + PostgreSQL on free tiers are the only capacity
 claims grounded in a prior assumption (ASP-07: "Free-tier APIs cover cohort
 scale (<100 users)"). Even this is an assumption pending P15 measurement — the
 cohort is well under 100 concurrent users, so this is low risk, but it is NOT
 a tested fact.
- Redis/BullMQ and object storage free-tier ceilings are UNKNOWN. Flagged as
 ASSUMPTION pending verification at P15. No ceiling numbers are stated for them
 — any figure would be fabricated.
- Vector/graph projections are derived, rebuildable artifacts; relational data
 is the system of record. Projection infrastructure can therefore be minimal
 (recompute on demand) without a paid tier.
- Every capacity claim above is an ASSUMPTION pending P15 measurement, never a
 tested fact (RISK-MVP-P02-01 honesty rule).

## 3. AI/provider spend budgets

| Item | Budget | Basis | Tracking |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| LLM provider spend | Capped at $0 | Mock mode for dev (RISK-MVP-P02-12: Google OAuth mock/polling; mock-first LLM) | Per-call/provider usage tracked from P12 (prompt §19: report provider/model usage and unit cost) |
| Any paid provider (LLM or other) | Requires FinOps + USER approval | DEC-P01-08; no paid resource without approval | FinOps review at each gate |
| Groq / other free-tier provider quota | Not verified; deferred | Carried from P03 gaps | Verify at P12 (prompt §19 usage reporting) |

AI/provider spend notes:

- LLM spend is $0 by design: development runs on mock mode; any real provider
 integration must stay within free-tier quotas or require explicit FinOps +
 USER approval (which would constitute a budget change under DEC-P01-08).
- From P12 onward (prompt §19), provider/model usage and unit cost are reported
 per call/provider. This is a NOT_EXECUTED plan until P12 instrumentation lands
 — no usage numbers are stated here.
- Groq and other free-tier provider quota verification is deferred to P12
 (carried from P03 gaps). No quota figures are claimed.

## 4. Scenario table

Source: USER Q&A-4 2026-08-15 — scenario-based, NO fabricated date.

| Scenario | Resource posture | Schedule posture | Cost ceiling | Gate dependency | Commitment |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Best | Cohort signs up early + OAuth verification smooth; free-tier resources hold | Sequential effort sequencing; no compression | $0 holds | OAuth mock/polling path (RISK-MVP-P02-12); free tiers adequate at P15 | No date committed |
| Expected | Cohort signs up mid-program; eval corpus + interviews unlock at M5/M6 | Normal dependency-driven path; milestone M5 (eval corpus) and M6 (interviews) become gating inputs | $0 holds | Eval dataset (DEC-P02-03) and interview pipeline (DEC-P03-05) land on schedule | No date committed; M5/M6 as gate inputs, not dates |
| Conservative | Cohort + OAuth verification + Naukri partner gate remain blocked (UNK-P02-05) | Slip risk concentrated at M4 (alpha) and M7 (production) | $0 still holds (no paid fallback committed) | UNK-P02-05 Naukri access; OAuth verification timeline (UNK-P02-03) | Contingency = scope to P0+P1 only, defer P2/P3 |

Scenario notes:

- No calendar date is committed in any scenario (BQ-05 "no deadline"; roadmap is
 dependency-driven, not date-driven).
- The conservative scenario triggers an explicit scope contingency: if cohort,
 OAuth verification, or the Naukri partner gate remain blocked, scope narrows
 to P0+P1 features only, deferring P2/P3 — no schedule extension is promised.

## 5. FinOps guardrails

| Guardrail | Detail | Owner |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| AI/provider spend budget with owner | LLM/provider spend budget = $0 (mock mode); owner = FinOps Specialist; tracked per call/provider from P12 | FinOps Specialist |
| No paid resource without approval | Any paid resource (infra, LLM, storage, tooling) requires FinOps + USER approval (DEC-P01-08) | FinOps Specialist + USER |
| Staffing resilience / ownership backups | Single-founder team: every role has an AI-agent backup (BQ-05); USER is sole approver and has NO backup — documented, accepted risk | FinOps Specialist (documented) |
| Capacity reserved for non-feature work | Capacity reserved for remediation, accessibility, security, data quality, and documentation inside each phase (prompt Phase-Specific overlay) — not only feature work. Estimate: 15–20% of phase effort reserved for remediation loops | Phase owner |

## 6. Phase-specific overlay compliance

- Prompt Phase-Specific overlay requirements are reflected in §5 guardrails:
 AI/provider spend budget with owner (owner = FinOps Specialist); no paid
 resource without approval; staffing resilience and ownership backups noted
 (single-founder: every role has AI-agent backup; USER as sole approver backup
 = none, documented); capacity reserved for remediation/a11y/security/
 data-quality/docs, not only features.
- This file supersedes the prior run `07-resource-cost-scenarios-2026-08-07.md`
 (refreshed to baseline dac2630, P03 registers, and USER Q&A-4 2026-08-15).
 Valid prior content (free-tier basis, reserves, $0 guardrail) is retained;
 facts refreshed.

## 7. Evidence

| ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------- | -------------------- | ------------------------------ | ---------- | ----------------- |
| EVD-MVP-P04-051 | $0 budget constraint (DEC-P01-08) is the fixed ceiling for all resources; no paid resource without FinOps + USER approval | MVP-P04-R05 (cost/budget) | SOURCE_DERIVED | This file §1, §3, §5 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-052 | Capacity plan for 100/1,000 load with free-tier/OER assumptions; Redis/BullMQ + object storage ceilings flagged UNKNOWN pending P15; all capacity figures labeled ASSUMPTION | MVP-P04-R02 (capacity plan) | ASSUMPTION | This file §2 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-053 | AI/provider spend budgets: LLM capped at $0 (mock mode), usage tracked from P12, Groq/quota verification deferred to P12 — no usage/quota numbers stated (NOT_EXECUTED) | MVP-P04-R06 (AI/provider spend) | NEW_DESIGN | This file §3 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-054 | Three resource/schedule scenarios (best/expected/conservative) per USER Q&A-4 2026-08-15; no fabricated date; conservative contingency = P0+P1 scope, defer P2/P3 | MVP-P04-R05/R06 (cost + schedule posture) | NEW_DESIGN | This file §4 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |

Evidence labels: capacity and spend figures are explicitly labeled ASSUMPTION or
NOT_EXECUTED throughout — never presented as measured (per RISK-MVP-P02-01
honesty rule). Measured values land at P12 (usage reporting) and P15
(load/measurement gates).
