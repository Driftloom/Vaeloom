# Backend

> **Purpose:** API architecture, authentication, authorization, validation, business logic, service contracts, event catalog, workers, connectors, and queue infrastructure
> **Status:** ✅ Upgraded to enterprise quality
> **Owner:** Backend Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16

## Overview

Vaeloom's backend is split into two primary services — `apps/api` (NestJS, TypeScript) handling auth, CRUD, permissions, and tenant management, and `apps/ai-service` (FastAPI, Python) handling agents, memory, RAG, and inference. These services communicate over an internal RPC contract, with event-driven coordination through a shared message bus. The backend documentation covers the full stack: API architecture and standards, authentication and authorization (ABAC + RBAC), input validation, business logic layering, connector integration patterns, background workers, queue infrastructure, cron jobs, error standards, and the complete event catalog.

All public APIs follow RESTful conventions documented via OpenAPI 3.1, with GraphQL evaluated for specific high-complexity query use cases. Rate limiting, API versioning, and service contracts between the two backend services are formally defined to ensure backward compatibility and independent deployability.

## What's here

| Document | Location | Status |
|----------|----------|--------|
| Backend Architecture | [`./Backend-Architecture.md`](./Backend-Architecture.md) | ✅ Excellent |
| REST Standards | [`./REST-Standards.md`](./REST-Standards.md) | ✅ Excellent |
| API Architecture | [`./API-Architecture.md`](./API-Architecture.md) | ✅ Excellent |
| API Reference | [`./API-Reference.md`](./API-Reference.md) | ✅ Complete |
| Authentication | [`./Authentication.md`](./Authentication.md) | ✅ Complete |
| Authorization | [`./Authorization.md`](./Authorization.md) | ✅ Complete |
| Connectors | [`./Connectors.md`](./Connectors.md) | ✅ Good |
| Rate Limiting | [`./Rate-Limiting.md`](./Rate-Limiting.md) | ✅ Good |
| ABAC | [`./ABAC.md`](./ABAC.md) | 🆕 New |
| API Versioning | [`./API-Versioning.md`](./API-Versioning.md) | 🆕 New |
| Business Logic | [`./Business-Logic.md`](./Business-Logic.md) | 🆕 New |
| Cron Jobs | [`./Cron-Jobs.md`](./Cron-Jobs.md) | 🆕 New |
| Error Standards | [`./Error-Standards.md`](./Error-Standards.md) | 🆕 New |
| Event Catalog | [`./Event-Catalog.md`](./Event-Catalog.md) | 🆕 New |
| GraphQL | [`./GraphQL.md`](./GraphQL.md) | 🆕 New |
| Module Specifications | [`./Module-Specs.md`](./Module-Specs.md) | 🆕 New |
| Queue | [`./Queue.md`](./Queue.md) | 🆕 New |
| RBAC | [`./RBAC.md`](./RBAC.md) | 🆕 New |
| Service Contracts | [`./Service-Contracts.md`](./Service-Contracts.md) | 🆕 New |
| Validation | [`./Validation.md`](./Validation.md) | 🆕 New |
| Workers | [`./Workers.md`](./Workers.md) | 🆕 New |

## Goals

- Provide a centralized entry point to all backend documentation
- Define API architecture, design standards, and versioning strategy
- Document authentication (email/password, OAuth, SAML/OIDC SSO) and authorization models (ABAC + RBAC)
- Specify service contracts between NestJS and FastAPI services
- Catalog every event in the event-driven system with payload schema, producers, consumers, versioning, and retention
- Define connector architecture for external service integration
- Document worker, queue, and cron infrastructure

---

## Scope

### In Scope

- NestJS (`apps/api`) backend architecture and module specifications
- FastAPI (`apps/ai-service`) backend architecture and module specifications
- REST API standards, OpenAPI reference, and versioning
- Authentication and authorization (ABAC, RBAC, permission engine)
- Service contract between backend services (RPC protocol, shared schema)
- Event catalog — every event in the system
- Connector architecture — OAuth token lifecycle, sync scheduling, rate limiting
- Background workers, queue patterns, and cron jobs
- Input validation standards and error handling

### Out of Scope

- Frontend architecture and client-side logic
- AI agent internals, memory models, and RAG pipelines (see `../AI/`)
- Infrastructure deployment, container orchestration, and CI/CD pipelines (see `../Operations/`)
- Database schema and migrations (covered in individual module specs)

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Implement service contract validation in CI | High | Medium | Q3 2026 |
| Auto-generate API Reference from OpenAPI spec | Medium | Low | Q3 2026 |
| Complete event catalog with all producer/consumer mappings | High | High | Q4 2026 |
| Add contract testing suite for NestJS/FastAPI boundary | Medium | Medium | Q4 2026 |
| Flesh out Module Specifications with interface definitions | High | Medium | Q4 2026 |

## Related Documents

- [Service Architecture](../Architecture/Service-Architecture.md)
- [IAM](../Security/IAM.md)
- [Encryption](../Security/Encryption.md)
- [Integration Testing](../Testing/Integration-Testing.md)
- [Documentation Home](../README.md)
