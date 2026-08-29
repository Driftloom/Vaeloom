# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- (New features will appear here)

## [0.2.0] - 2026-08-22

### Added

- **AI/Agent System:** AI service with LLM orchestration, embedding pipelines,
  and RAG support
- **AI/Agent System:** Knowledge Graph service for persistent memory graph with
  community detection
- **AI/Agent System:** Memory Store service with vector and relational hybrid
  storage
- **AI/Agent System:** Agent Engine for autonomous agent execution and tool
  calling
- **AI/Agent System:** Prompt library, evaluation framework, model benchmarking,
  and versioning
- **AI/Agent System:** Semantic ATS scoring, browser scraping tools, resume
  document pipeline
- **AI/Agent System:** Injection classifier for prompt safety
- **AI/Agent System:** MCP (Model Context Protocol) native integration
- **AI/Agent System:** LangGraph durable execution with Temporal integration
- **Auth/Security:** IAM service with role-based access control (RBAC) and
  policy engine
- **Auth/Security:** Auth service supporting OAuth2, OIDC, and SAML 2.0
- **Auth/Security:** API Gateway with JWT-based authentication and rate limiting
- **Auth/Security:** 42/42 Row-Level Security policies (fail-closed)
- **Auth/Security:** CSRF Redis backend, IP allowlist middleware, security
  headers
- **Auth/Security:** DPIA v1.2 All Regions, GDPR 31-table coverage, data
  retention
- **Backend:** Search service with full-text, vector, and hybrid search
- **Backend:** Recommendation service with collaborative and content-based
  filtering
- **Backend:** Event Bus with pub/sub, event sourcing, and stream processing
  (BullMQ)
- **Backend:** Document Ingestion pipeline with OCR, chunking, and indexing
- **Backend:** Notification service with email, push, and webhook delivery
- **Backend:** Billing service with usage metering, invoicing, and payment
  processing
- **Backend:** Connector service for third-party integrations (Slack, Notion,
  Google Drive, etc.)
- **Backend:** Integration service for low-code workflow automation
- **Backend:** Plugin service for hot-loadable extensions
- **Backend:** Job Scheduler for distributed task orchestration (Redis/BullMQ)
- **Backend:** Audit service for immutable audit log with tamper detection
- **Backend:** Analytics service for event collection, aggregation, and
  dashboards
- **Backend:** Circuit breaker, fallback policies, per-agent rate limits
- **Database:** Schema with migrations for PostgreSQL (23+ Alembic migrations)
- **Database:** Vector store with pgvector embeddings
- **Database:** Resume artifacts table, retention runs, tenant workspace
  isolation
- **Frontend:** Next.js 15 web application with 18+ wired pages
- **Frontend:** Resume builder with template picker, live preview, PDF+DOCX
  download
- **Frontend:** Dark/light mode, keyboard shortcuts, responsive design
- **Frontend:** SWR caching, route prefetching, image optimization
- **DevOps:** CI/CD pipelines with GitHub Actions (11 workflows)
- **DevOps:** Docker multi-stage builds (API + Web)
- **DevOps:** Kubernetes manifests (63+ YAML files)
- **DevOps:** Terraform infrastructure modules (12 modules)
- **DevOps:** Prometheus metrics, Grafana dashboards (3 dashboards, 23 panels)
- **DevOps:** SBOM/SLSA L2 supply chain security
- **Monitoring:** OpenTelemetry tracing, structured logging with correlation IDs
- **Monitoring:** 9 alert rules, SLO 99.9%, synthetic health probes
- **Operations:** Incident response runbooks (3 runbooks)
- **Operations:** Rollback strategy, disaster recovery plan
- **Documentation:** 39 Architecture Decision Records (ADR-001 through ADR-039)
- **Documentation:** 793+ documentation files across 22 categories
- **Documentation:** 66 phase prompts (3 tracks x 22 phases)
- **Documentation:** OpenAPI spec with 110 paths (7199 lines)
- **Testing:** 2731 pytest tests (94% coverage)
- **Testing:** 34 Jest tests, 60 E2E tests (24 gating + 36 visual)
- **Testing:** Smoke test infrastructure
- **Monorepo:** Nx build system with pnpm workspaces
- **Monorepo:** Shared types, ESLint config, and UI Kit packages
- **Monorepo:** TypeScript, Python, and REST API SDKs
- **Infrastructure:** Monolith-with-modules architecture (FastAPI + Next.js)

## [0.1.0] - 2026-07-17

### Added

- Initial MVP monorepo scaffold with Nx build system and pnpm workspaces
- Core package architecture (`packages/`) — shared types, ESLint config, UI Kit
- API Gateway (`apps/api/`) with authentication middleware
- Web application (`apps/web/`) with Next.js frontend
- AI service (`apps/ai-service/`) with LLM integration
- 18 microservices (`services/`) covering the full platform feature set
- Database schema and migration tooling (`database/`)
- Kubernetes deployment configurations (`infra/kubernetes/`)
- Terraform infrastructure-as-code (`infra/terraform/`)
- Docker Compose environment for local development
- GitHub Actions CI/CD workflows
- TypeScript, Python, and REST API SDKs (`sdk/`)
- Documentation framework with architecture overview and API docs
- Security tooling (Dependabot, CodeQL, Semgrep, Trivy)

[unreleased]: https://github.com/vaeloom/vaeloom/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/vaeloom/vaeloom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vaeloom/vaeloom/releases/tag/v0.1.0
