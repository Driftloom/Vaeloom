# Agents Index (WS-E)

> **Verified:** 2026-09-15 · This dir is a thin inventory (2 files) — the 24
> routable/code agent dirs live in `apps/api/src/api/agents/`.

| Doc                               | Covers                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `mvp/agent-inventory.md`          | MVP-canonical 10 routable agents (concept→code mapping, v2.1 code-aligned 2026-09-15) + 12 enterprise-gated + QA/supervisor infra |
| `enterprise/enterprise-agents.md` | Enterprise agent set                                                                                                              |

- Code truth: `apps/api/src/api/agents/` (24 entries incl. `__pycache__`; ~23
  real: organization, memory, resume, ats, job_search, application, gmail,
  scheduler, planning, research, career, learning, github, coding, reminder,
  analytics, recommendation, reflection, security, connector, plugin, drive, qa,
  memory/).
- Router: `apps/api/src/api/orchestrator/router.py`.
- Prompts: `docs/ai/` (library/standards/specs) +
  `docs/prompts/agents|memory|rag/`.
- Tools: `docs/mcp/tools/agent-tool-registry.md` + MCP bridge
  (`mcp__Server__Tool`).
- Durability: `docs/temporal/catalog.md` (`DurableAgentRunWorkflow`).
