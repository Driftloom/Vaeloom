# Agents

28 specialist agent modules (8 MVP, 13 Enterprise, 7 Meta/Core handlers — see
canonical index in
[`specs/ai/REGISTRY_INDEX.md`](../../../../specs/ai/REGISTRY_INDEX.md)) built on
the shared `BaseAgent` harness in `../orchestrator/`.

## MVP Agents (8)

| Agent        | Directory             | Purpose                                         |
| ------------ | --------------------- | ----------------------------------------------- |
| Organization | `organization_agent/` | Workspace organization, tagging, categorization |
| Memory       | `memory_agent/`       | Memory extraction, merge, versioning            |
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

## Where memory retrieval actually lives

`memory_agent/retrieval.py` was **removed** (2026-10-07). It was never imported
by any production module — only by three test files — so it was a second,
divergent copy of retrieval logic with its own hardcoded relevance score.

The live retrieval path is `MemoryService.search_memories` in
`../services/memory_service.py`, reached from:

- `../routers/memory.py` (`GET /memories/search`)
- `../orchestrator/loop.py` (`_assemble_rag_context`)

It does vector search via `../infrastructure/vector_store.py` (pgvector, HNSW
via migration 0011) with keyword fallback and RRF fusion. Changes to retrieval
behavior belong there, not in the agent package.

## Sub-package: `memory/`

Meta-agents within the memory system:

- `planning_agent.py` — memory planning
- `reflection_agent.py` — memory reflection
- `self_improvement_agent.py` — self-improvement loops
- `document_agent.py` — document processing
