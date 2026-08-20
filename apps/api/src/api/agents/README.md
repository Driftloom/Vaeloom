# Agents

21 specialist agent modules built on the shared `BaseAgent` harness in
`../orchestrator/`.

## MVP Agents (8)

| Agent        | Directory             | Purpose                                         |
| ------------ | --------------------- | ----------------------------------------------- |
| Organization | `organization_agent/` | Workspace organization, tagging, categorization |
| Memory       | `memory_agent/`       | Memory extraction, retrieval, merge, versioning |
| Resume       | `resume_agent/`       | Resume generation and optimization              |
| ATS          | `ats_agent/`          | ATS score analysis and improvement suggestions  |
| Job Search   | `job_search_agent/`   | Job discovery and matching                      |
| Application  | `application_agent/`  | Job application submission (approval-gated)     |
| Gmail        | `gmail_agent/`        | Email monitoring and drafting (draft-only)      |
| Scheduler    | `scheduler_agent/`    | Calendar management and conflict resolution     |

## Enterprise Agents (13)

career, learning, research, github, coding, reminder, analytics, recommendation,
reflection, security, connector, plugin, drive.

Gated behind `settings.mvp_scope_enforced` — returns out-of-scope response when
enabled.

## Architecture

All agents extend `BaseAgent` from `../orchestrator/base.py` and implement
`handle(user_request) -> AgentResponse`. The orchestrator classifies intent,
selects the appropriate agent, and runs the Plan→Act→Observe→Reflect→Improve
loop with a QA gate (3 retries).

Approval gates are enforced in `../orchestrator/loop.py` via `lookup_approval()`
for consequential actions (job applications, email send, file modify, calendar
write).

## Sub-package: `memory/`

Meta-agents within the memory system:

- `planning_agent.py` — memory planning
- `reflection_agent.py` — memory reflection
- `self_improvement_agent.py` — self-improvement loops
- `document_agent.py` — document processing
