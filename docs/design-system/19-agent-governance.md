# 19. Agent Governance & Transparency

## 1. Agent Governance Hierarchy

Enterprise deployment of autonomous agents demands absolute visibility and
control:

- **State Visibility**: Agents must declare their exact state (`idle`,
  `running`, `waiting_approval`, `error`, `paused`).
- **Tool Invocation Registry**: Every tool execution must list input parameters,
  execution duration, and output preview before side-effects occur.
- **Cost & Token Telemetry**: Every agent run displays token consumption,
  estimated API cost, and model identifier (`gpt-4o`, `claude-3-5-sonnet`,
  `gemini-1.5-pro`).

## 2. Agent Governance Components

- `<AgentStatus>`: Live status pill displaying execution state and duration.
- `<AgentRun>`: Detailed chronological trace showing inputs, tool calls, and
  results.
- `<AgentProposal>`: Structured action proposal requiring human sign-off.
- `<AgentPermission>`: Granular permission scope badge (e.g. `read:calendar`,
  `write:email`, `execute:mcp`).
