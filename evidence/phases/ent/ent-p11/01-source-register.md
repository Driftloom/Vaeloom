# ENT-P11 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P11` (Backend Implementation)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead Backend Architect & Systems Standards Custodian  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | Backend Implementation Constraints Extracted                                                               |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust backend requirements, and test suites.    |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records baseline backend service routing and async job processing evolution.                               |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and institutional backend capabilities.               |
| **INT-05** | `apps/api`                                                      | Backend Engineering          | FastAPI Python 3.12 codebase (pinned 3.12.13), Uvicorn async server, and Pydantic v2 schemas.              |
| **INT-06** | `DEL-ENT-P07-03`                                                | Database Architecture Team   | 42/42 Table `FORCE ROW LEVEL SECURITY` policy matrix and session GUC variable rules.                       |
| **INT-07** | `DEL-ENT-P08-01`                                                | API Architecture Team        | OpenAPI 3.2.0 contract covering 241 paths and 294 operations across 8 domain routers.                      |
| **INT-08** | `DEL-ENT-P08-03`                                                | AI Platform Team             | Model Context Protocol (MCP) v2 client adapters and sandboxed tool execution engine.                       |
| **INT-09** | `DEL-ENT-P08-04`                                                | AppSec Team                  | Multi-tenant authentication, SCIM v2.0 endpoints, RBAC matrix, and sliding-window rate limits.             |
| **INT-10** | `apps/api/tests/security`                                       | AppSec QA                    | 404 passing security regression tests covering CSRF, RBAC, input sanitization, and no-auth denials.        |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority          |   Verified Snapshot    | Required Backend Implementation Controls                                                   |
| :--------- | :---------------------------- | :--------------------: | :----------------------------------------------------------------------------------------- |
| **EXT-01** | FastAPI Framework             | Official Documentation | Async route handlers, dependency injection RBAC, automatic OpenAPI 3.2.0 generation.       |
| **EXT-02** | Pydantic v2 Serialization     |     Pydantic Team      | Strict input validation, JSON Schema generation, memory-efficient C-based parsing.         |
| **EXT-03** | SQLAlchemy 2.0 Async ORM      |   SQLAlchemy Authors   | Async sessions, NullPool test isolation, declarative model mapping, parameterized queries. |
| **EXT-04** | PostgreSQL 16 Official Manual |  PostgreSQL Core Team  | Session GUC configuration (`set_config`), transactional DDL, JSONB indexing.               |
| **EXT-05** | Redis 7.2 Specification       |       Redis Ltd        | Sliding-window rate limit counters, sorted sets, BullMQ message transport.                 |
| **EXT-06** | OpenTelemetry Python SDK      |     CNCF Standard      | FastAPI automatic instrumentation, DB span tagging, W3C trace context propagation.         |
| **EXT-07** | Model Context Protocol (MCP)  |  2026-07-28 Snapshot   | Client connection pooling over stdio and HTTP/SSE streams, tool schema reflection.         |
| **EXT-08** | OWASP API Security Top 10     |      2023 Edition      | Protection against Broken Object Level Authorization (BOLA) via database RLS.              |
| **EXT-09** | RFC 7644 (SCIM v2.0 Protocol) |     IETF Standard      | Implementation of `/scim/v2/Users` and `/scim/v2/Groups` directory endpoints.              |
| **EXT-10** | RFC 7807 (Problem Details)    |     IETF Standard      | Standardized error payload formatting across all 4xx/5xx HTTP exception handlers.          |

_Signed: Lead Backend Architect & Systems Standards Custodian — 2026-09-29_
