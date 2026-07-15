# 08 — Specialist Agents (Enterprise upgrade)

## Read first
`mvp/08-specialist-agents.md`. This phase completes the roster from MVP's seven (eight counting Memory Agent from file 04) to the full twenty-eight described in `Meridian-Complete-Documentation.md` §5.

## Objective
Build the remaining ~20 agents, every one extending the same base agent contract from `mvp/05-agent-harness-orchestration.md` — no new agent pattern, just more agents using the established one.

## Agents to add (grouped by why they didn't make MVP)

**Deferred because MVP didn't need the breadth yet:**
- `learning_agent` — tracks courses, skills in progress, learning goals.
- `research_agent` — organizes papers, notes, citations.
- `coding_agent` / `github_agent` — deeper repo/coding-activity understanding beyond MVP's ingestion-time code summary.
- `calendar_agent` — dedicated calendar consistency, separate from Scheduler's deadline/conflict focus.
- `internship_agent` — specialized search variant of Job Search Agent for internships/fellowships specifically.
- `document_agent` / `pdf_agent` — general-purpose document Q&A and PDF form-filling, beyond MVP's basic in-app viewer.
- `planning_agent` — builds learning/project/application roadmaps from gap analyses (ATS Agent output, Learning Agent state).
- `reminder_agent` — full notify-only autonomy nudges, split out from Scheduler for cleaner scope.

**Deferred because they need infrastructure this folder's earlier files just built:**
- `analytics_agent` — reads the observability/eval data from `enterprise/12` and `enterprise/10`.
- `recommendation_agent` — reads Reflection Agent output from `enterprise/04`.
- `security_agent` — monitors audit logs and Permission Engine data for anomalies (needs `enterprise/12`'s anomaly detection).
- `plugin_agent` / `connector_agent` — manage the Marketplace/plugin lifecycle from `enterprise/07`.

**Already covered as harness-level concepts in `enterprise/05`, now formalized as agents:**
- `reflection_agent`, `self_improvement_agent`, `quality_assurance_agent` — see that file, no additional work needed here beyond confirming they're registered in the Orchestrator's routing table.

## Requirements
For each new agent: define mission/inputs/outputs/memory-scopes/default-autonomy exactly as MVP's agents did, add a golden dataset (extends `enterprise/10-evaluation-framework.md`), and register with the Orchestrator's routing logic — the actual mechanics of how 28 agents get routed among (two-stage classification, tenant-aware dispatch, disambiguation) live in `17-agent-orchestration-at-scale.md`, not here; this file's job is making sure each new agent is correctly registered as a valid routing target, not designing the router itself.

## Out of scope
Any agent not listed in the full 28-roster — resist the urge to invent new agents here; if a real gap appears, it belongs in a future roadmap discussion, not a silent addition during this build phase. The routing/dispatch mechanism itself — see `17-agent-orchestration-at-scale.md`.

## Acceptance criteria
- [ ] All ~20 new agents pass the same "extends base contract" structural test MVP's agents did.
- [ ] Each has a golden dataset and passes its eval baseline.
- [ ] Every new agent is a valid, correctly registered routing target for the Orchestrator built in `17-agent-orchestration-at-scale.md` — the disambiguation test between similar agents (e.g. Job Search vs. Internship Agent) is that file's acceptance criterion, not repeated here.
