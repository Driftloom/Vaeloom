# Finding: Consolidation/Compression Is Dead Code

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **ID**       | FIND-DOC-007                     |
| **Severity** | P1-HIGH                          |
| **Status**   | OPEN                             |
| **Source**   | Documentation Audit              |
| **File**     | `docs/02-system-architecture.md` |

## Description

Architecture docs describe "Consolidation (Compresses & archives stale memory)"
as a memory system component. The reflection agent has a
`consolidate_memories()` method, but it's dead code — no periodic trigger, no
cron, no event-driven invocation.

## Evidence

- `reflection_agent.py`: `consolidate_memories()` exists
- No cron job, no scheduler, no event trigger
- No BullMQ consumer for consolidation

## Impact

- Memory grows unbounded
- Stale memories never compressed or archived

## Remediation

Implement a trigger (cron, event, or queue consumer) or mark as
`STATUS: DEAD_CODE`.
