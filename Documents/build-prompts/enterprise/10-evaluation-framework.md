# 10 — Evaluation Framework (Enterprise upgrade)

## Read first
`mvp/10-evaluation-framework.md`.

## Objective
Grow from MVP's per-agent golden datasets and basic CI gating into a full benchmark suite with rotating human evaluation and per-tenant segmentation.

## Requirements
- **Benchmark suite:** expand each agent's golden dataset (MVP: 15–30 examples) into a larger, versioned benchmark (100+ examples where feasible), covering edge cases surfaced by real production usage since MVP launch — this is the payoff of MVP's human-eval sampling hook; those labeled samples become benchmark candidates.
- **Formal safety/policy-compliance benchmark:** MVP tracked a safety/policy-compliance *rate* as one metric among several; this upgrade makes it a dedicated adversarial benchmark suite in its own right — expanded prompt-injection patterns, tenant-policy-violation attempts, PII-handling edge cases — versioned and segmented by tenant like every other benchmark here, not folded quietly into the general accuracy score.
- **Workflow-level scenarios, expanded:** MVP's single end-to-end scenario grows into a full set of versioned, multi-agent workflow benchmarks covering the major user journeys (organize → resume → job search → application; Gmail deadline → schedule → conflict resolution), scored and regression-gated exactly like the per-agent benchmarks.
- **Human evaluation rotation:** formalize MVP's ad hoc sampling script into a scheduled process — a rotating set of real (anonymized, consented) production outputs reviewed by a human on a defined cadence, feeding both the benchmark suite and the Self-Improvement Agent (`enterprise/05`).
- **Per-tenant eval segmentation:** track agent quality metrics segmented by tenant, since a tenant's specific data patterns (e.g. a university with unusual document formats) may reveal quality issues invisible in the aggregate.
- **Continuous regression dashboard:** move from MVP's CI-gate-only checking to a continuously updated dashboard tracking every agent's quality/latency/cost/safety trend over time, not just pass/fail at merge time.

## Out of scope
Changing the fundamental scoring approach (exact/fuzzy match + LLM-as-judge) from MVP — this upgrade is about coverage and process maturity, not a new scoring paradigm.

## Acceptance criteria
- [ ] Each agent's benchmark has grown to at least 100 examples where real usage data supports it, with clear versioning so a benchmark change is itself reviewable.
- [ ] The formal safety benchmark catches a deliberately-seeded adversarial pattern that the general accuracy benchmark alone would miss.
- [ ] At least three full multi-agent workflow benchmarks exist, versioned, and are regression-gated the same way per-agent benchmarks are.
- [ ] The human-eval rotation runs on schedule and produces labeled data that measurably feeds back into benchmark growth within one cycle.
- [ ] Per-tenant quality metrics correctly surface a deliberately-seeded tenant-specific quality issue that the aggregate metric alone would miss.
- [ ] The regression dashboard shows historical trend data, not just current-state pass/fail.
