# Finding: mTLS Between API and AI Service Is Fiction

| Metadata     | Value                                |
| ------------ | ------------------------------------ |
| **ID**       | FIND-DOC-003                         |
| **Severity** | P1-HIGH                              |
| **Status**   | OPEN                                 |
| **Source**   | Documentation Audit                  |
| **File**     | `docs/architecture/System-Design.md` |

## Description

`System-Design.md` describes "Internal RPC + mTLS between API and AI Service" as
an architecture layer. In reality, both the API and AI service run in the SAME
FastAPI process (`apps/api`). There is no inter-service communication, no TLS,
no mTLS. The "AI Gateway" is just a Python function call.

## Evidence

- `main.py` imports both API routers and AI modules
- `orchestrator/loop.py` calls agent methods directly (same process)
- No gRPC, no HTTP calls between services
- No mTLS configuration anywhere

## Impact

- Security architecture is overstated
- No actual transport encryption between components

## Remediation

Update docs to reflect monolithic reality. If microservice split is planned,
mark as `STATUS: FUTURE`.
