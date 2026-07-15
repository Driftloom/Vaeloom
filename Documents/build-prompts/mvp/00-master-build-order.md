# 00 — Master Build Order (MVP)
### Read this first. This file is the entry point for Claude Code / Cursor.

```mermaid
graph TD
    classDef primary fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef secondary fill:#e8f5e9,stroke:#2e7d32,color:#000

    A["00: Master Build Order"]:::primary --> B["01: Foundation & CI"]:::secondary
    B --> C["02: Database Schema"]:::secondary
    C --> D["03: Ingestion Pipeline"]:::secondary
    D --> E["04: Memory System"]:::secondary
    E --> F["05: Agent Harness & Orchestration"]:::secondary
    F --> G["06: RAG Retrieval"]:::secondary
    G --> H["07: MCP Tool Ecosystem"]:::secondary
    H --> I["08: Specialist Agents"]:::secondary
    I --> J["09: AI Gateway & Model Routing"]:::secondary
    J --> K["10: Evaluation Framework"]:::secondary
    K --> L["11: Guardrails & Safety"]:::secondary
    L --> M["12: Observability & Tracing"]:::secondary
    M --> N["13: API Backend"]:::secondary
    N --> O["14: Frontend Workspace"]:::secondary
    O --> P["15: Security & Compliance"]:::secondary
    P --> Q["16: Deployment Infrastructure"]:::secondary

    subgraph Legend["Build Phases"]
        R["Foundation"]:::primary
        S["Implementation"]:::secondary
    end
```

## What you're building
Meridian: a second brain for a person's education and career. It ingests documents, code, and communications; builds a continuously updated, structured memory of who the person is and what they've done; and runs specialized, permission-scoped agents on top of that memory to organize files, maintain a resume, search for and apply to jobs, and track deadlines. Full product context lives in the companion docs `Meridian-Complete-Documentation.md` and `01-Meridian-MVP-Spec.md` — read those for the "why," this file and the ones after it are the "how, in order."

## Non-negotiable architectural decisions (already made — do not re-litigate)
- **Agent contract:** every agent shares one structure — fixed mission, declared tool list, explicit memory read/write permissions, a stated default autonomy level (suggest-mode unless stated otherwise), and a required fallback (ask, never guess).
- **Agentic loop:** Plan → Act → Observe → Reflect → Improve, implemented once in the shared harness (file 05), not reimplemented per agent.
- **Memory before features:** every agent action that teaches the system something new is a memory write; every feature is a memory read. If a feature can't be expressed as a read/write against memory, question whether it belongs.
- **MCP-shaped tools everywhere:** every connector and internal tool is defined with the same shape (name, input schema, output schema, required scope) from day one, even before real MCP transport is wired up.
- **Suggest-mode by default:** no agent takes a consequential, irreversible action without approval in MVP. Earned autonomy is a v1.5+ concern, not MVP.
- **Two-service backend split:** `apps/api` (NestJS, TypeScript) owns auth/CRUD/permissions; `apps/ai-service` (FastAPI, Python) owns agents/memory/retrieval. They talk over an internal RPC boundary.

## Build order
Run these prompts in order. Each depends on the ones before it. Do not skip ahead — a later file assumes the earlier ones' schemas/interfaces exist.

| # | File | Builds | Depends on |
|---|---|---|---|
| 01 | `01-foundation-infra.md` | Repo scaffold, CI, auth, empty services | — |
| 02 | `02-database-schema.md` | Postgres schema, migrations | 01 |
| 03 | `03-ingestion-pipeline.md` | File parsing, OCR, extraction, queue | 01, 02 |
| 04 | `04-memory-system.md` | Memory Agent, knowledge graph, vector store | 02, 03 |
| 05 | `05-agent-harness-orchestration.md` | Shared agent runtime, Orchestrator, agentic loop | 04 |
| 06 | `06-rag-retrieval.md` | Agentic RAG hybrid retrieval | 04, 05 |
| 07 | `07-mcp-tool-ecosystem.md` | MCP-shaped connectors (Gmail, GitHub, Drive) | 01, 05 |
| 08 | `08-specialist-agents.md` | Organization, Resume, ATS, Job Search, Application, Gmail, Scheduler agents | 05, 06, 07 |
| 09 | `09-ai-gateway-model-routing.md` | Model router, fallback, prompt caching | 05 |
| 10 | `10-evaluation-framework.md` | Golden datasets, eval runner, CI gating | 08 |
| 11 | `11-guardrails-safety.md` | Input validation, injection defense, QA gate | 05, 08 |
| 12 | `12-observability-tracing.md` | Tracing, structured logs, audit log | 05 |
| 13 | `13-api-backend.md` | Core REST API, permission engine | 02, 08 |
| 14 | `14-frontend-workspace.md` | Next.js frontend, all MVP screens | 13 |
| 15 | `15-security-compliance.md` | Encryption, secrets, export/delete | all above |
| 16 | `16-deployment-infrastructure.md` | Containers, CI/CD, staging/prod | all above |

## Global conventions (apply in every file below)
- **Languages:** TypeScript (strict mode) for `apps/web` and `apps/api`; Python 3.11+ with full type hints for `apps/ai-service`.
- **Testing:** every phase ships with tests before being marked done — unit tests minimum, integration tests where a real external dependency (DB, queue) is involved. No phase is "complete" without a green test suite.
- **Local dev:** every service must run locally via `docker-compose up` with a documented `.env.example` — never require a cloud account to develop against. Secrets in local dev come from `.env` (gitignored); production secrets come from a secrets manager (file 15).
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`), one logical change per commit.
- **No silent scope creep:** if a prompt file's "Out of scope" section excludes something, do not build it "while you're in there" — flag it as a note instead.

## Definition of "MVP done"
A new user can sign up, connect at least one source, upload a resume, see it organized and reflected in an always-current master resume, search for and (with approval) apply to a role, and see relevant deadlines surfaced automatically — with zero manual intervention from the engineering team. This is the acceptance bar for file 16.

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Re-ordering prompts or skipping ahead | Downstream files reference schemas/interfaces that don't exist yet |
| Second-guessing the build order | Wastes time rebuilding modules that would have been correct if done in order |
| Silently changing architectural decisions (e.g., merging api+ai-service) | Violates the two-service split, causing permission/auth coupling issues |

## Best Practices

| Practice | Why |
|----------|-----|
| Read the companion docs first (spec + complete documentation) | Ensures you understand the "why" before implementing the "how" |
| Run each prompt's test suite before moving to the next | Catches regressions immediately against known-correct baselines |
| Commit after each phase completes (not mid-phase) | Keeps the audit trail clean and rollbacks simple |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Two-service backend introduces a broader attack surface | Enforce the internal RPC boundary strictly — never allow direct service-to-database cross-talk |
| Suggest-mode agents could still leak context if untested | Always run guardrail checks before any agent output is returned to a user |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Sequential build order creates a linear dependency chain | Parallelize where possible (e.g., api + ai-service schemas can be validated independently) |
| Redis-based state persistence may become a bottleneck at scale | Plan for enterprise-phase migration to Kafka or similar event-streaming platform |
