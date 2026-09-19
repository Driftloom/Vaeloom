# Agent Execution Matrix

> Source: Agentic-AI-Zero-Trust-E2E-Audit.md section 16 (canonical). 22 agents,
> 50 tools, limits 30rpm/5conc/120s.

See main audit section 16 for full 22-row table.

22 agents: organization, memory, resume, ats, job_search, application, gmail,
scheduler, planning, research, career, learning, github, coding, reminder,
analytics, recommendation, reflection, security, connector, plugin, drive +
supervisor + qa gate.

Quick extract:

- Per-agent: mission, model via ModelRouter, memory_scopes, tools (<=12
  offered), scope, max steps 3x3, tokens ~400-1200 in per call, timeout 120s,
  retry 3/30s circuit, concurrency 30rpm/5, cost tracked via model_router +
  agent_costs, telemetry AgentMetric + audit, failure via fallback or approval
  gate.
- Reproduce: GET /api/v1/agents/catalog

See audit section 16 full table.
