# MVP-P04 — 07. Resource & Cost Scenarios (DEL-MVP-P04-05)

> Owner: FinOps Specialist · Budget: **$0 hard cap** (DEC-P01-07, BQ-05/06).
> Values are planned scenarios, not commitments.

## 1. Team

| Role | Count | Source | Cost |
| ------------------------------------- | --------- | ------------------- | ------------------------------------ |
| Founder (user) | 1 | — | $0 |
| AI agents (executor/reviewers) | multiple | Current platform | $0 (subscription) |
| Volunteer cohort | N≈10–20 | Open signup (VB) | $0 (no incentives, ASP-05) |
| Professional reviews (legal/security) | as needed | Deferred to P13/P19 | $0 until funded — flagged UNK-P03-01 |

## 2. Cost scenarios ($0 constraint)

| Stack area | Free tier basis | Scenario A (minimal) | Scenario B (comfort) | Scenario C (over budget — NOT approved) |
| -------------- | ---------------------------------------------------- | ---------------------------- | ------------------------- | --------------------------------------- |
| Hosting (PaaS) | Render/Railway free, Fly 3-shared, Vercel hobby | Render/Fly shared | Vercel hobby + Fly shared | Paid tiers |
| Database | Neon free 0.5GB / Supabase free | Neon free | Supabase free | Paid Postgres |
| Redis/BullMQ | Upstash free / self-host local | Upstash free | Upstash free | Paid |
| Vector/search | pgvector (in Postgres) — $0 | pgvector | pgvector | Separate vector DB |
| Object storage | Supabase/R2 free tier | R2 10GB free | R2 | Paid |
| LLM | Mock + free-tier provider (mock_llm exists in tests) | Mock-first, free LLM later | Free-tier provider | Paid LLM |
| Observability | OTel self-host / free tier | OTel + Prometheus (repo has) | + free Grafana | Paid APM |
| CI/CD | GitHub Actions (repo has) | Actions | Actions | Paid runners |
| Gmail API | Free (quota-based) | — | — | — |

**Guardrail:** any scenario exceeding $0 requires an approved change
(DEC-P01-07). Spend log entry per paid resource decision; FinOps reviews at each
gate (RISK-P04-02).

## 3. Capacity scenarios (BQ-P02-04)

| Scenario | Concurrent users | Basis | Limits met by |
| -------------- | ---------------- | --------- | -------------------------------------------------------- |
| Target | 100 | BQ-P02-04 | Free tiers + Gmail quota (15,000 units/min/user) |
| Upper bound | 1,000 | BQ-P02-04 | Verified only in P15 load tests; not a launch commitment |
| Launch reality | ≤ cohort (~20) | BQ-05 | Trivially within free tiers |

## 4. Schedule scenarios

| Scenario | Constraint | Profile |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A — steady | No deadline; gate-per-phase | Design phases (P05–P09) ≤ ~5 sessions; implementation (P10–P12) largest share; harden/QA (P13–P15); ship P19–P21 |
| B — burst | User availability limited | Batch gates; parallelize P09/P16 prep; longer calendar, same path |
| C — blocked | Cohort/credentials absent | Gate at P19/P20 — release authority still gated (UNK-02/03) |

No date commitments (BQ-05 "no deadline"); roadmap is dependency-driven, not
date-driven.

## 5. Reserves

Capacity reserved for remediation, accessibility, security, data quality and
documentation inside each phase (prompt §future overlay) — not only feature
work. Estimate: 15–20% of phase effort reserved for remediation loops.
