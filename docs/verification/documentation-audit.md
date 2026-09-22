# Documentation Forensic Audit & Claim Reconciliation

## Executive Summary

This document audits all existing documentation in docs/, specs/, root READMEs,
and package manifests, comparing stated claims against the actual repository
code state.

### Total Documentation Inventory

- **Documentation files in docs/**: 329 files
- **ADRs in docs/adr/**: 45 Architecture Decision Records (ADR-001 through
  ADR-044 + index)
- **Phase contract specifications**: 179 files in specs/phase-contracts/ (3
  tracks x 22 phases = 66 phase contracts + supporting documents)
- **OpenAPI specs**: specs/api/openapi.yaml (v0.2.0, 243 paths / 296 operations)
  and docs/backend/openapi.yaml

---

## Forensic Audit of Major Claims vs Code Reality

| Claimed Feature / Structure         | Stated Location / Claim          | Actual Code Reality                                                                        | Verdict           | Severity  |
| :---------------------------------- | :------------------------------- | :----------------------------------------------------------------------------------------- | :---------------- | :-------- |
| **Agent Microservice Isolation**    | \'28 independent agents\'        | All 28 agents reside inside pps/api/src/api/agents/ as internal modules                    | **MISMATCH**      | P1        |
| **Agent Manifest Contracts**        | Declarative permissions & scopes | 0 out of 28 agents have gent.yaml manifests. Authorization hardcoded in Python             | **UNIMPLEMENTED** | P1        |
| **Connector Separation**            | packages/connectors/             | Connectors duplicated across connectors/, integrations/, and pps/api/src/api/integrations/ | **DUPLICATED**    | P1        |
| **Domain Services Separation**      | Isolated business core           | ATS scoring, resume compilation, salary estimation live inside pps/api/src/api/services/   | **MONOLITHIC**    | P1        |
| **Zero-Trust Identity**             | Strict workspace/user isolation  | context_loader.py:92 falls back to arbitrary user if user_id is None                       | **VULNERABLE**    | P0        |
| **Agent DB Isolation**              | Agents interact via services     | 3 memory agents directly import pi.database and sqlalchemy                                 | **VIOLATION**     | P0        |
| **42/42 RLS Enforcement**           | Full database RLS                | Confirmed: 42/42 tables have RLS policies in migrations and live tests pass                | **VERIFIED**      | COMPLIANT |
| **3,640 Backend Tests**             | Test suite completeness          | 3,640 tests collected; serial run passes; xdist hang under parallel load                   | **VERIFIED**      | COMPLIANT |
| **Messages API Runtime**            | Decoupled runtime                | Minimal worker in pps/api/src/api/worker/; lacking standalone daemon                       | **PARTIAL**       | P2        |
| **Temporal Long-Running Workflows** | Resilient agent state machines   | Lacking Temporal workflow definitions; uses internal database state                        | **UNIMPLEMENTED** | P2        |

---

## ADR Audit Summary

- **ADR-001 to ADR-010**: Core architectural foundations (JWT,
  SQLite/PostgreSQL, modular monolith).
- **ADR-011 to ADR-020**: Observability, OpenTelemetry, Redis caching, audit
  trails.
- **ADR-021 to ADR-030**: Agent framework, orchestrator loop, circuit breakers,
  fallback policies.
- **ADR-031 to ADR-036**: Zero-trust security, prompt fencing, resume document
  pipeline, browser tools, official MCP SDK integration.
- **ADR-037 to ADR-044**: Enterprise multi-tenancy, rate limiting, RLS session
  variable propagation, secrets rotation.

**Audit Finding**: ADRs represent high-quality architectural intent, but the
monolithic repository structure in pps/api outgrew the initial design, creating
coupling between agents, database, tools, and orchestration.
