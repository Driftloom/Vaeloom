# Finding: WebSocket Not Implemented

| Metadata     | Value                                |
| ------------ | ------------------------------------ |
| **ID**       | FIND-DOC-004                         |
| **Severity** | P1-HIGH                              |
| **Status**   | OPEN                                 |
| **Source**   | Documentation Audit                  |
| **File**     | `docs/architecture/System-Design.md` |

## Description

Architecture diagrams show WebSocket push notifications for real-time agent
progress. No WebSocket endpoint exists in the codebase. `websockets` is in
`uv.lock` but no WebSocket endpoint is defined.

## Impact

- No real-time features
- Users must poll for agent status updates

## Remediation

Implement WebSocket endpoint or mark as `STATUS: PLANNED`.
