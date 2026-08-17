# Finding: Permission Engine Is a Local Check

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **ID**       | FIND-DOC-008                     |
| **Severity** | P1-HIGH                          |
| **Status**   | OPEN                             |
| **Source**   | Documentation Audit              |
| **File**     | `docs/02-system-architecture.md` |

## Description

Architecture docs describe "Permission Engine (Per-connector, per-agent scopes)"
as a storage layer component. The actual code at `tools/executor.py:50` says "In
production this calls the Permission Engine; here it's a local check." It's a
local scope check function, not a dedicated engine.

## Evidence

```python
# tools/executor.py:50
# In production this calls the Permission Engine; here it's a local check.
def _check_scope(agent, tool):
    return tool.required_scope in agent.allowed_scopes
```

## Impact

- Permission enforcement is minimal
- No runtime policy evaluation
- No audit trail for permission decisions

## Remediation

Either:

1. Implement a real permission engine with policy evaluation
2. Mark as `STATUS: SIMPLIFIED` in docs
