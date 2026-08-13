# MVP-P01 - 12. Success Metrics (DEL-MVP-P01-04)

> **Deliverable:** DEL-MVP-P01-04 - success metrics (formulas + owners) and
> explicit non-goals. **Status:** V1.0 - refreshed at the 2026-08-13 re-run at
> baseline `1def16d`. **Owner:** Product Manager / Platform / Privacy. **Prompt
> reference:** §1/§3/§5/§7/§9/§12/§19/§20. **Rule:** targets are `TO_BE_DECIDED`
> (with owner) unless the target is spec-derived (prompt §3 fixed decisions). No
> runtime measurement exists in DISCOVERY - all runtime metrics are
> `NOT_EXECUTED`; runtime ownership and instrumentation land in P05/P15/P17 as
> noted.

## 1. Metrics register

| #    | Metric                                  | Domain          | Definition + formula                                                                                                                                                                          | Owner                | Measurement method                                          | Target                                                           | Status       |
| ---- | --------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------ |
| M-01 | Task success rate                       | Outcome         | % of end-to-end user task flows (ingest a doc, tailor a resume, approve an action, set a reminder) completed without user correction or abandonment; `completed_flows / started_flows`        | Product              | Telemetry (P05+); cohort task protocol (RB-04)              | TO_BE_DECIDED (Product, at cohort launch)                        | NOT_EXECUTED |
| M-02 | Memory recall precision                 | Quality         | % of sampled recalled memory facts verified correct by the user or a labeled eval set; `verified_correct / sampled_recalls`                                                                   | AI Product Lead      | Eval set (P12); user verification telemetry (VB-02)         | TO_BE_DECIDED (>=90% candidate, pending eval set)                | NOT_EXECUTED |
| M-03 | Repeat-input reduction                  | Quality/outcome | Decline in duplicate entry events per user per week vs. adoption baseline; `(baseline_rate - post_rate) / baseline_rate`                                                                      | Product              | Telemetry (VB-02)                                           | TO_BE_DECIDED (>=30% decline candidate, H-01; feeds BQ-06b)      | NOT_EXECUTED |
| M-04 | Wrong-memory incidents                  | Trust/quality   | Count of user corrections of memory per week + incidents where wrong memory caused user-visible harm (missed deadline, wrong application content); `corrections/week` and `harmful_incidents` | AI Product Lead / UX | Correction telemetry + incident review (VB-02, RB-01)       | TO_BE_DECIDED (harmful incidents target 0 candidate)             | NOT_EXECUTED |
| M-05 | Approval-confusion rate                 | Trust           | % of approval prompts where the user mis-approves, seeks help, or abandons the flow; `confused_events / approval_prompts`                                                                     | Privacy / UX         | Moderated study + drop-off analysis (VB-03)                 | TO_BE_DECIDED (H-03; BQ-06a feeds churn link)                    | NOT_EXECUTED |
| M-06 | Gmail deadline-extraction accuracy (F1) | Quality         | F1 over a labeled Gmail deadline set: `2 * (precision * recall) / (precision + recall)`                                                                                                       | AI Product Lead      | Labeled eval set (P12; UNK-05)                              | TO_BE_DECIDED (agreed threshold; below threshold = BQ-06c PIVOT) | NOT_EXECUTED |
| M-07 | Reminder on-time rate                   | Outcome         | % of deadlines with first reminder at or before the user's lead-time preference; `on_time_reminders / extracted_deadlines`                                                                    | Product              | Telemetry (VB-01 extension, H-06)                           | TO_BE_DECIDED                                                    | NOT_EXECUTED |
| M-08 | Export/deletion completion              | Safety          | % of export/delete requests fully completed and verified across system-of-record + projections; `verified_purges / purge_requests`                                                            | Privacy              | Deletion lifecycle exercise (VB-05, P13)                    | 100% - spec-derived (spec §11: export/delete unconditional)      | NOT_EXECUTED |
| M-09 | Deletion RTO                            | Safety/ops      | Time from deletion request to verified purge across system-of-record + projections; `verified_purge_time`                                                                                     | Privacy / Platform   | Purge audit + verification job (VB-05, P13)                 | TO_BE_DECIDED (Platform/Privacy, at lifecycle design P13)        | NOT_EXECUTED |
| M-10 | Suggest-mode acceptance rate            | Outcome/trust   | % of agent proposals accepted without modification; `accepted_as_is / proposals_shown`                                                                                                        | Product              | Telemetry (P05+)                                            | TO_BE_DECIDED (>=80% candidate per H-03)                         | NOT_EXECUTED |
| M-11 | Gmail send count                        | Safety          | Number of outbound emails sent by the Gmail Agent; target = 0 (draft-only)                                                                                                                    | Security             | Draft-only enforcement tests + telemetry (P13)              | 0 - spec-derived (prompt §3: Gmail draft-only)                   | NOT_EXECUTED |
| M-12 | Unapproved consequential actions        | Safety          | Count of consequential actions executed without immutable payload-bound expiring approval + idempotency; target = 0                                                                           | Security             | Approval/idempotency contract tests + audit log (P13; H-08) | 0 - spec-derived (prompt §3)                                     | NOT_EXECUTED |
| M-13 | Unsupported automation violations       | Safety          | Count of scraping/anti-bot circumvention/credential replay/unapproved submission events; target = 0                                                                                           | Security             | Approved-integration gate + scope-lock tests (FB-05)        | 0 - spec-derived (prompt §3)                                     | NOT_EXECUTED |
| M-14 | p50/p95 request latency                 | Ops             | End-to-end API/task latency percentiles; sampled over 1 week                                                                                                                                  | Platform             | Distributed tracing + dashboards (P15)                      | TO_BE_DECIDED (Platform, at P15 SLO design)                      | NOT_EXECUTED |
| M-15 | Queue lag                               | Ops             | Max age of oldest pending job in async queues (BullMQ); `now - enqueued_at` max                                                                                                               | Platform             | Queue monitoring (P15)                                      | TO_BE_DECIDED (Platform, at P15)                                 | NOT_EXECUTED |
| M-16 | Error rate                              | Ops             | % of agent/tool/connector calls erroring; `errors / total_calls`                                                                                                                              | Platform             | Error tracking + metrics (P15)                              | TO_BE_DECIDED (Platform, at P15)                                 | NOT_EXECUTED |
| M-17 | Availability                            | Ops             | Uptime % per month; `uptime / month_duration`                                                                                                                                                 | Platform             | Availability monitoring (P17)                               | TO_BE_DECIDED (Platform, at P17 SLO)                             | NOT_EXECUTED |
| M-18 | Unit cost per active user               | Business        | Monthly cost per active workspace user (LLM, storage, infra); `total_monthly_cost / active_users`                                                                                             | Founder/Platform     | Cost telemetry (P04)                                        | TO_BE_DECIDED (budget TBD, BQ-05; revisit P04)                   | NOT_EXECUTED |

## 2. Non-goals (explicit, from prompt §3/§5/§7)

These are NOT goals of the MVP and NOT measured as success for P01. They are
re-assessed only at their listed phase via change control (prompt §24); the
standalone register with rationale/owner is `13-non-goals-research-backlog.md`.

| NG    | Non-goal                                                                                 | Source                         | Re-assessed at                                     |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| NG-01 | Enterprise SSO/SCIM                                                                      | Prompt §3/§5                   | Post-MVP enterprise track decision                 |
| NG-02 | Institution administration                                                               | Prompt §3/§5                   | Post-MVP enterprise track decision                 |
| NG-03 | Billing / marketplace                                                                    | Prompt §3/§5; spec §10/§14     | Separate enterprise decision                       |
| NG-04 | Multi-region tenant cells                                                                | Prompt §3/§5                   | Post-launch scale evidence                         |
| NG-05 | Cross-user memory sharing                                                                | Prompt §3/§5; spec §7.5        | Explicit privacy review + legal                    |
| NG-06 | Unsupported job-platform automation (scraping, auto-fill against ToS, credential replay) | Prompt §3; spec §9             | Never - prohibited by S-03                         |
| NG-07 | Production deployment in P01                                                             | Prompt §5 (out of scope); plan | P19 (ASP-04)                                       |
| NG-08 | Product-market-fit claim in P01                                                          | Prompt §3 phase rule           | Wedge validation only, P02/P03 cohort              |
| NG-09 | Compliance/accessibility/scale claims without evidence                                   | Prompt §5; prompt §16          | Only after professional review + measured evidence |

## 3. References

- `docs/phases/mvp-p01/09-problem-statement.md` (PS-01..04, constraints
  S-01..09)
- `docs/phases/mvp-p01/11-value-risk-hypotheses.md` (H-01..H-08)
- `docs/phases/mvp-p01/05-validation-backlog.md` (VB-01..06)
- `docs/phases/mvp-p01/13-non-goals-research-backlog.md` (non-goals rationale +
  RB)
- `docs/phases/mvp-p00/12-future-readiness-backlog.md` (FB-01..05)
