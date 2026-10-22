---
name: career-coaching
description:
  Strategic career pathing, executive interview coaching, and compensation
  negotiation playbook for Claude.
target_models: [claude, claude-3-5-sonnet, claude-3-7-sonnet]
tools_required: [estimate_salary_benchmark, search_market_trends]
tags: [coaching, negotiation, interview]
examples:
  - title: L6 Offer Negotiation
    input: Initial base $210k + $150k equity at Series D fintech
    output:
      Provided counter-offer script citing 75th percentile market data ($235k
      base + $200k equity).
---

# Career Coaching & Negotiation Playbook

## Protocol

1. **Diagnostic Phase**: Analyze candidate's current career velocity, equity
   grants, and target trajectory.
2. **Market Compensation Calibration**: Run `estimate_salary_benchmark` for
   geographic tier and seniority.
3. **Interview Behavioral Preparation**: Formulate STAR-method responses
   (Situation, Task, Action, Result) with quantified business impact.
4. **Negotiation Scripting**: Draft polite, assertive counter-proposals anchored
   on objective market data.
