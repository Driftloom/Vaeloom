# MVP-P04 — 07. Resource & Cost Scenarios (DEL-MVP-P04-05) — V2

> **Version:** 2.0 (supersedes `07-resource-cost-scenarios.md` dated 2026-08-15)
> **Owner:** FinOps Specialist · **Baseline:** master @ `dac2630` (P03 CLOSED
> 2026-08-14) · **Status:** APPROVED_BASELINE pending gate

**V2 improvements:** Added per-phase resource allocation, AI/provider spend
tracking templates, capacity test plans, and cost optimization strategies.

## 1. Fixed resource constraints

| Constraint       | Value                                                                 | Source                                                         |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Budget           | $0 — OSS + free tiers + volunteer time                                | DEC-P01-08 (USER 2026-08-07; re-affirmed P02/P03)              |
| Volunteer cohort | N≈10–20, India, 18+, no incentives                                    | DEC-P01-07 (USER 2026-08-07)                                   |
| Team             | Founder-led team + AI agents                                          | BQ-05 (P01 re-run 2026-08-13; carried P03)                     |
| Design load      | 100 concurrent target / 1,000 upper bound                             | BQ-P02-04 (USER confirmed 2026-08-13 at P02 gate; carried P03) |
| Paid resources   | No paid resource without FinOps approval                              | DEC-P01-08 overlay (Phase-Specific overlay; prompt §7)         |
| Budget figures   | No fabricated budget numbers — all numbers carry a source and a label | RISK-MVP-P02-01 honesty rule; this file                        |

Constraint context: all cost/capacity figures below are **ASSUMPTION** or
**NOT_EXECUTED** until measured (P15 load/measurement gates; P12 usage
reporting) — never presented as tested fact.

## 2. Capacity plan (load 100/1,000)

| Stack area                     | Free-tier / OER basis                                               | Capacity claim                                      | Label                                              | Verification Plan                                                      |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Stateless web (Next.js)        | PaaS free tier (Vercel hobby / Render free)                         | Adequate for 100 target; 1,000 upper bound unproven | ASSUMPTION — pending P15 load test                 | P15: `artillery quick --count 100 -n 10 http://localhost:3000`         |
| Backend (FastAPI) + PostgreSQL | Free-tier backend + Postgres (Neon/Supabase free)                   | Adequate for cohort scale (<100 users)              | ASSUMPTION — basis ASP-07, pending P15 measurement | P15: `locust -f load_test.py --host http://localhost:8000 --users 100` |
| Redis/BullMQ                   | Free-tier ceiling unknown (Upstash free tier limits unverified)     | Unknown — verify at P15                             | ASSUMPTION — NOT_EXECUTED, verify at P15           | P15: Redis benchmark + free-tier limit check                           |
| Object storage                 | Free-tier ceiling unknown (R2/Supabase free tier limits unverified) | Unknown — verify at P15                             | ASSUMPTION — NOT_EXECUTED, verify at P15           | P15: Storage benchmark + free-tier limit check                         |
| Vector/graph projections       | Rebuildable from relational system of record                        | Projection infra can be minimal (rebuild on demand) | ASSUMPTION — design choice, not a measured ceiling | P15: Rebuild time test                                                 |

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

| Item                                  | Budget                          | Basis                                                                          | Tracking                                                                                         | Verification                                                  |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| LLM provider spend                    | Capped at $0                    | Mock mode for dev (RISK-MVP-P02-12: Google OAuth mock/polling; mock-first LLM) | Per-call/provider usage tracked from P12 (prompt §19: report provider/model usage and unit cost) | P12: Usage dashboard in `docs/phases/mvp-p12/usage-report.md` |
| Any paid provider (LLM or other)      | Requires FinOps + USER approval | DEC-P01-08; no paid resource without approval                                  | FinOps review at each gate                                                                       | Gate review                                                   |
| Groq / other free-tier provider quota | Not verified; deferred          | Carried from P03 gaps                                                          | Verify at P12 (prompt §19 usage reporting)                                                       | P12: Quota verification                                       |

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

| Scenario     | Resource posture                                                              | Schedule posture                                                                                   | Cost ceiling                                | Gate dependency                                                                | Commitment                                         |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Best         | Cohort signs up early + OAuth verification smooth; free-tier resources hold   | Sequential effort sequencing; no compression                                                       | $0 holds                                    | OAuth mock/polling path (RISK-MVP-P02-12); free tiers adequate at P15          | No date committed                                  |
| Expected     | Cohort signs up mid-program; eval corpus + interviews unlock at M5/M6         | Normal dependency-driven path; milestone M5 (eval corpus) and M6 (interviews) become gating inputs | $0 holds                                    | Eval dataset (DEC-P02-03) and interview pipeline (DEC-P03-05) land on schedule | No date committed; M5/M6 as gate inputs, not dates |
| Conservative | Cohort + OAuth verification + Naukri partner gate remain blocked (UNK-P02-05) | Slip risk concentrated at M4 (alpha) and M7 (production)                                           | $0 still holds (no paid fallback committed) | UNK-P02-05 Naukri access; OAuth verification timeline (UNK-P02-03)             | Contingency = scope to P0+P1 only, defer P2/P3     |

Scenario notes:

- No calendar date is committed in any scenario (BQ-05 "no deadline"; roadmap is
  dependency-driven, not date-driven).
- The conservative scenario triggers an explicit scope contingency: if cohort,
  OAuth verification, or the Naukri partner gate remain blocked, scope narrows
  to P0+P1 features only, deferring P2/P3 — no schedule extension is promised.

## 5. Per-phase resource allocation

| Phase | Primary Resource  | Backup Resource     | Effort Estimate | Cost |
| ----- | ----------------- | ------------------- | --------------- | ---- |
| P05   | Architecture Lead | Engineering Manager | Design phase    | $0   |
| P06   | Engineering Lead  | Architecture Lead   | Design phase    | $0   |
| P07   | Data Lead         | Backend Lead        | Design phase    | $0   |
| P08   | API Lead          | Backend Lead        | Design phase    | $0   |
| P09   | UX Lead           | Frontend Lead       | Design phase    | $0   |
| P10   | Frontend Lead     | UX Lead             | Implement phase | $0   |
| P11   | Backend Lead      | API Lead            | Implement phase | $0   |
| P12   | AI Lead           | Backend Lead        | Implement phase | $0   |
| P13   | Security Lead     | Risk Owner          | Harden phase    | $0   |
| P14   | QA Lead           | Backend Lead        | Quality phase   | $0   |
| P15   | Platform Lead     | DevOps Lead         | Quality phase   | $0   |
| P16   | DevOps Lead       | Platform Lead       | Ops phase       | $0   |
| P17   | SRE Lead          | DevOps Lead         | Ops phase       | $0   |
| P18   | Program Lead      | All leads           | Ops phase       | $0   |
| P19   | Release Lead      | DevOps Lead         | Release phase   | $0   |
| P20   | Program Lead      | All leads           | Release phase   | $0   |
| P21   | Program Lead      | All leads           | Ops phase       | $0   |

## 6. FinOps guardrails

| Guardrail                               | Detail                                                                                                                                                                                                                                 | Owner                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| AI/provider spend budget with owner     | LLM/provider spend budget = $0 (mock mode); owner = FinOps Specialist; tracked per call/provider from P12                                                                                                                              | FinOps Specialist              |
| No paid resource without approval       | Any paid resource (infra, LLM, storage, tooling) requires FinOps + USER approval (DEC-P01-08)                                                                                                                                          | FinOps Specialist + USER       |
| Staffing resilience / ownership backups | Single-founder team: every role has an AI-agent backup (BQ-05); USER is sole approver and has NO backup — documented, accepted risk                                                                                                    | FinOps Specialist (documented) |
| Capacity reserved for non-feature work  | Capacity reserved for remediation, accessibility, security, data quality, and documentation inside each phase (prompt Phase-Specific overlay) — not only feature work. Estimate: 15–20% of phase effort reserved for remediation loops | Phase owner                    |

## 7. Cost optimization strategies

| Strategy                 | Description                                                         | Expected Savings           | Implementation Phase |
| ------------------------ | ------------------------------------------------------------------- | -------------------------- | -------------------- |
| Mock-first LLM           | Use mock LLM responses for development; real provider only for eval | 100% LLM cost during dev   | P12                  |
| Free-tier infrastructure | Use Vercel/Render/Neon/Supabase free tiers for dev/staging          | 100% infra cost during dev | P05+                 |
| Volunteer cohort         | Use volunteer testers instead of paid beta testers                  | 100% testing cost          | P20                  |
| Open-source tooling      | Use OSS alternatives for all tooling                                | 100% tooling cost          | P05+                 |
| Lazy evaluation          | Only evaluate when needed, not on every change                      | Variable                   | P14                  |

## 8. Evidence

| ID              | Claim                                              | Requirement | Type           | Location     | Result                         | Date       | Verified by       |
| --------------- | -------------------------------------------------- | ----------- | -------------- | ------------ | ------------------------------ | ---------- | ----------------- |
| EVD-MVP-P04-051 | Fixed resource constraints documented with sources | MVP-P04-R01 | SOURCE_DERIVED | this file §1 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-052 | Capacity plan with verification plans for P15      | MVP-P04-R04 | NEW_DESIGN     | this file §2 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-053 | AI/provider spend budgets with tracking templates  | MVP-P04-R06 | NEW_DESIGN     | this file §3 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-054 | Scenario table with no committed dates             | MVP-P04-R02 | SOURCE_DERIVED | this file §4 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-055 | Per-phase resource allocation defined              | MVP-P04-R01 | NEW_DESIGN     | this file §5 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
| EVD-MVP-P04-056 | Cost optimization strategies identified            | MVP-P04-R06 | NEW_DESIGN     | this file §7 | APPROVED_BASELINE pending gate | 2026-08-15 | FinOps Specialist |
