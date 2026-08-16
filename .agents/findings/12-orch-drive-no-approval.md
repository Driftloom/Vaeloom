# Finding: DriveAgent Ingests Files Without Approval Gate

| Metadata     | Value                                           |
| ------------ | ----------------------------------------------- |
| **ID**       | FIND-ORCH-003                                   |
| **Severity** | P2-MEDIUM                                       |
| **Status**   | OPEN                                            |
| **Source**   | Orchestrator Loop Audit                         |
| **File**     | `apps/api/src/api/orchestrator/loop.py:167-168` |

## Description

The `DriveAgent.process()` path silently downloads and ingests files from Google
Drive into the knowledge base without any approval gate. For an enterprise
system, silently ingesting arbitrary external documents is a data integrity
risk.

## Evidence

```python
if agent_type in ("DriveAgent", "DriveAgentHandler"):
    return await agent.process(request)  # no approval check
```

Only `ApplicationAgent` has `default_autonomy = "approval_gated"`.

## Impact

- External documents are ingested without user review
- Potential for malicious or sensitive content to enter knowledge base
- Violates suggest-mode-first principle for write operations

## Remediation

Add approval gate for DriveAgent write operations, or document why suggest-mode
is sufficient.
