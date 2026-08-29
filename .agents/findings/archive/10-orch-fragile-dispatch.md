# Finding: Agent Dispatch Uses Fragile String Class Names

| Metadata     | Value                                       |
| ------------ | ------------------------------------------- |
| **ID**       | FIND-ORCH-001                               |
| **Severity** | P1-HIGH                                     |
| **Status**   | PARTIAL                                     |
| **Source**   | Orchestrator Loop Audit                     |
| **File**     | `apps/api/src/api/orchestrator/loop.py:119` |

## Description

`act_phase()` compares against Python class names via `type(agent).__name__`
(e.g., `"OrganizationAgent"`, `"ApplicationAgent"`). If any agent class is
renamed, the branch silently falls through to `agent.fallback()` with no error
or log.

## Evidence

```python
agent_type = type(agent).__name__
if agent_type == "OrganizationAgent":  # fragile
    ...
if agent_type == "ApplicationAgent":  # fragile
    ...
```

Lines 163/167 use dual-string patterns (`"GmailAgent", "GmailAgentHandler"`)
suggesting historical inconsistency.

## Impact

- Silent misrouting of agent requests
- No error when agent class is renamed
- Maintenance hazard during refactoring

## Remediation

Use `isinstance(agent, ClassName)` or build a dispatch registry mapping agent
types to handler functions.
