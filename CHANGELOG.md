# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- API Gateway with JWT-based authentication and rate limiting
- IAM service with role-based access control (RBAC) and policy engine
- Auth service supporting OAuth2, OIDC, and SAML 2.0
- AI service with LLM orchestration, embedding pipelines, and RAG support
- Knowledge Graph service for persistent memory graph with community detection
- Memory Store service with vector and relational hybrid storage
- Agent Engine for autonomous agent execution and tool calling
- Search service with full-text, vector, and hybrid search
- Recommendation service with collaborative and content-based filtering
- Event Bus with pub/sub, event sourcing, and stream processing
- Document Ingestion pipeline with OCR, chunking, and indexing
- Notification service with email, push, and webhook delivery
- Billing service with usage metering, invoicing, and payment processing
- Connector service for third-party integrations (Slack, Notion, Google Drive, etc.)
- Integration service for low-code workflow automation
- Plugin service for hot-loadable extensions
- Job Scheduler for distributed task orchestration
- Audit service for immutable audit log with tamper detection
- Analytics service for event collection, aggregation, and dashboards
- Database schema with migrations for PostgreSQL, Redis, and Qdrant
- Monorepo scaffold with Nx, pnpm workspaces, and TypeScript strict mode
- Shared types, ESLint config, and UI Kit packages
- TypeScript, Python, and REST API SDKs
- Kubernetes deployment manifests and Terraform infrastructure modules
- CI/CD pipelines with GitHub Actions
- Docker Compose development environment
- Documentation suite with architecture, API references, and deployment guides

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

[unreleased]: https://github.com/vaeloom/vaeloom/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vaeloom/vaeloom/releases/tag/v0.1.0
