# Vaeloom Enterprise Commit Plan

**~280 atomic commits | Conventional Commits | Organized by domain**

---

## Phase 0: Housekeeping (4 commits)

| # | Commit Type | Scope | Message | Files |
|---|-------------|-------|---------|-------|
| 0.1 | chore | gitignore | `chore(gitignore): add husky internal hooks, qoder artifacts, and python build patterns` | .gitignore |
| 0.2 | chore | repo | `chore(repo): add editorconfig, gitattributes, dockerignore, and prettier config` | .editorconfig, .gitattributes, .dockerignore, .prettierrc, .prettierignore |
| 0.3 | chore | repo | `chore(repo): add npmrc, nvmrc, and environment example` | .npmrc, .nvmrc, .env.example |
| 0.4 | chore | repo | `chore(repo): add community health files (code-of-conduct, contributing, license)` | CODE_OF_CONDUCT.md, CONTRIBUTING.md, LICENSE, SECURITY.md, MAINTAINERS.md |

---

## Phase 1: Documentation — Already Tracked (30 commits)

Grouped by doc domain, EXECUTED LAST to avoid merge conflicts when prior phases land.

### 1.1 Root Docs (4 commits)

| # | Type | Message |
|---|------|---------|
| 1.1.1 | docs | `docs: add documentation completion report and master README` |
| 1.1.2 | docs | `docs: add MVP specification and system architecture documents` |
| 1.1.3 | docs | `docs: add agent workflow and memory knowledge graph specs` |
| 1.1.4 | docs | `docs: add enterprise paper, template, and integration guide` |

### 1.2 AI Documentation (8 commits)

| # | Message |
|---|---------|
| 1.2.1 | `docs(ai): add AI architecture overview, model routing, and LLM architecture` |
| 1.2.2 | `docs(ai): add agent documentation (agents, agentic-rag, tool-calling)` |
| 1.2.3 | `docs(ai): add embeddings, inference pipeline, and evaluation` |
| 1.2.4 | `docs(ai): add guardrails, safety, and prompt engineering standards` |
| 1.2.5 | `docs(ai): add knowledge graph, memory, and RAG documentation` |
| 1.2.6 | `docs(ai): add MCP protocol docs` |
| 1.2.7 | `docs(ai): add prompt library and README` |
| 1.2.8 | `docs(ai): add reasoning and model routing docs` |

### 1.3 Architecture Docs (6 commits)

| # | Message |
|---|---------|
| 1.3.1 | `docs(arch): add architecture decision records, C4 diagrams, and high-level design` |
| 1.3.2 | `docs(arch): add low-level design, system design, and microservices architecture` |
| 1.3.3 | `docs(arch): add data flow, event architecture, and event flow` |
| 1.3.4 | `docs(arch): add caching, queue, search, and storage architecture` |
| 1.3.5 | `docs(arch): add scalability, performance, and disaster recovery` |
| 1.3.6 | `docs(arch): add infrastructure architecture and README` |

### 1.4 Backend Docs (5 commits)

| # | Message |
|---|---------|
| 1.4.1 | `docs(backend): add API architecture, reference, versioning, and REST standards` |
| 1.4.2 | `docs(backend): add authentication, authorization, RBAC, and ABAC` |
| 1.4.3 | `docs(backend): add backend architecture, business logic, and service contracts` |
| 1.4.4 | `docs(backend): add connectors, cron-jobs, workers, and queue` |
| 1.4.5 | `docs(backend): add GraphQL, rate-limiting, validation, and event catalog` |

### 1.5 Database Docs (3 commits)

| # | Message |
|---|---------|
| 1.5.1 | `docs(db): add database design, schema, and ER diagram` |
| 1.5.2 | `docs(db): add indexes, migrations, and partitioning` |
| 1.5.3 | `docs(db): add backups, replication, and optimization` |

### 1.6 Frontend Docs (1 commit)

| # | Message |
|---|---------|
| 1.6.1 | `docs(frontend): add UI architecture, design system, theme, and a11y docs` |

(Remaining frontend preview HTML files will be committed separately)

### 1.7 DevOps & Infrastructure (2 commits)

| # | Message |
|---|---------|
| 1.7.1 | `docs(devops): add devops docs (ci-cd, deployment, docker, kubernetes, terraform)` |
| 1.7.2 | `docs(devops): add monitoring, logging, tracing, alerting, configuration management` |

### 1.8 Security & Testing (1 commit)

| # | Message |
|---|---------|
| 1.8.1 | `docs(security): add security architecture, threat model, encryption, IAM, privacy` |

---

## Phase 2: Build Infrastructure (8 commits)

| # | Type | Message | Files |
|---|------|---------|-------|
| 2.1 | chore | `chore: add pnpm workspace root config and nx monorepo configuration` | package.json, pnpm-workspace.yaml, pnpm-lock.yaml, nx.json |
| 2.2 | build | `build: add TypeScript base configuration and jest root config` | tsconfig.base.json, jest.config.ts |
| 2.3 | chore | `chore(ci): add dependabot, issue templates, PR template, and code-of-conduct` | .github/dependabot.yml, .github/ISSUE_TEMPLATE/, .github/PULL_REQUEST_TEMPLATE/, .github/CODE_OF_CONDUCT.md |
| 2.4 | ci | `ci: add CI workflow for lint, typecheck, and test` | .github/workflows/ci.yml |
| 2.5 | ci | `ci: add deploy workflow for staging and production` | .github/workflows/deploy.yml |
| 2.6 | ci | `ci: add security scanning workflow (snyk, trivy, gitleaks)` | .github/workflows/security-scan.yml |
| 2.7 | chore | `chore(devcontainer): add dev container configuration` | .devcontainer/devcontainer.json |
| 2.8 | chore | `chore(hooks): add husky pre-commit and commit-msg hooks` | .husky/pre-commit, .husky/commit-msg |

---

## Phase 3: Shared Packages (20 commits)

### 3.1 @vaeloom/tsconfig (2 commits)

| # | Message | Files |
|---|---------|-------|
| 3.1.1 | `feat(packages): add base tsconfig and nextjs tsconfig` | packages/tsconfig/base.json, packages/tsconfig/nextjs.json |
| 3.1.2 | `feat(packages): add node and nestjs tsconfig variants` | packages/tsconfig/node.json, packages/tsconfig/nestjs.json, packages/tsconfig/package.json |

### 3.2 @vaeloom/shared-types (6 commits)

| # | Message | Files |
|---|---------|-------|
| 3.2.1 | `feat(shared-types): add domain primitives, pagination, and API types` | packages/shared-types/src/types/domain.ts, api.ts |
| 3.2.2 | `feat(shared-types): add authentication types and DTOs` | packages/shared-types/src/types/auth.ts, auth-dto.ts |
| 3.2.3 | `feat(shared-types): add workspace and tenant types` | packages/shared-types/src/types/workspace.ts, tenant.ts |
| 3.2.4 | `feat(shared-types): add memory, knowledge graph, and search types` | packages/shared-types/src/types/memory.ts |
| 3.2.5 | `feat(shared-types): add agent and execution types` | packages/shared-types/src/types/agent.ts |
| 3.2.6 | `feat(shared-types): add connector types, event types, and barrel export` | packages/shared-types/src/types/connector.ts, event.ts, index.ts |

### 3.3 @vaeloom/ui-kit (4 commits)

| # | Message | Files |
|---|---------|-------|
| 3.3.1 | `feat(ui-kit): scaffold ui-kit package with React peer dependency` | packages/ui-kit/package.json, packages/ui-kit/tsconfig.json |
| 3.3.2 | `feat(ui-kit): add Button component with dark ink theme` | packages/ui-kit/src/components/Button.tsx |
| 3.3.3 | `feat(ui-kit): add Card, Input, and Modal components` | packages/ui-kit/src/components/Card.tsx, Input.tsx, Modal.tsx |
| 3.3.4 | `feat(ui-kit): add Spinner component and barrel exports` | packages/ui-kit/src/components/Spinner.tsx, packages/ui-kit/src/index.ts |

### 3.4 Other Packages (8 commits)

| # | Message | Files |
|---|---------|-------|
| 3.4.1 | `feat(packages): add eslint config with TypeScript and React rules` | packages/eslint-config/ |
| 3.4.2 | `feat(observability): add MetricsModule with prom-client integration` | packages/observability/src/metrics/ |
| 3.4.3 | `feat(observability): add TracingModule with OpenTelemetry` | packages/observability/src/tracing/ |
| 3.4.4 | `feat(observability): add LoggingModule with pino structured logging` | packages/observability/src/logging/ |
| 3.4.5 | `feat(observability): add MetricsInterceptor and barrel exports` | packages/observability/src/interceptors/, packages/observability/src/index.ts |
| 3.4.6 | `feat(plugin-sdk): add plugin SDK with interface definitions` | packages/plugin-sdk/ |
| 3.4.7 | `feat(python-common): add shared Python utilities for ai-service` | packages/python-common/ |
| 3.4.8 | `build(packages): add package.json scripts, tsconfigs, and jest configs for all packages` | packages/*/package.json, jest.config.js |

---

## Phase 4: Application Layer (40 commits)

### 4.1 apps/web (18 commits)

| # | Message | Files |
|---|---------|-------|
| 4.1.1 | `feat(web): scaffold Next.js app with Tailwind and font configuration` | apps/web/package.json, apps/web/tailwind.config.ts, apps/web/postcss.config.js, apps/web/next.config.js |
| 4.1.2 | `feat(web): add tsconfig, manifest, robots, and global styles` | apps/web/tsconfig.json, apps/web/public/manifest.json, apps/web/public/robots.txt, apps/web/src/styles/globals.css |
| 4.1.3 | `feat(web): add API client with token management and 401 refresh flow` | apps/web/src/lib/api.ts |
| 4.1.4 | `feat(web): add middleware with auth guards and CSP security headers` | apps/web/src/middleware.ts |
| 4.1.5 | `feat(web): add auth hooks (useAuth) with login/signup/logout` | apps/web/src/hooks/useAuth.ts |
| 4.1.6 | `feat(web): add data hooks (useApi, useWorkspace, SWR fetchers)` | apps/web/src/hooks/useApi.ts, useWorkspace.ts |
| 4.1.7 | `feat(web): add root layout with Space Grotesk + IBM Plex Mono fonts` | apps/web/src/app/layout.tsx |
| 4.1.8 | `feat(web): add root page with workspace-first redirect` | apps/web/src/app/page.tsx |
| 4.1.9 | `feat(web): add login and signup pages with validation` | apps/web/src/app/(auth)/login/page.tsx, apps/web/src/app/(auth)/signup/page.tsx |
| 4.1.10 | `feat(web): add workspace layout with sidebar, topnav, and auth guard` | apps/web/src/app/workspace/[workspaceId]/layout.tsx |
| 4.1.11 | `feat(web): add workspace dashboard with stats and recent activity` | apps/web/src/app/workspace/[workspaceId]/page.tsx |
| 4.1.12 | `feat(web): add sidebar navigation and topbar with logout` | apps/web/src/components/layout/Sidebar.tsx, TopNav.tsx |
| 4.1.13 | `feat(web): add shared UI components (ErrorBoundary, LoadingSpinner, EmptyState)` | apps/web/src/components/common/, components/shared/ |
| 4.1.14 | `feat(web): add memory graph visualization page` | apps/web/src/app/workspace/[workspaceId]/memory/page.tsx |
| 4.1.15 | `feat(web): add files page with upload modal and agent proposals` | apps/web/src/app/workspace/[workspaceId]/files/page.tsx |
| 4.1.16 | `feat(web): add resume editor, jobs, and applications pages` | apps/web/src/app/workspace/[workspaceId]/resume/page.tsx, jobs/page.tsx, applications/page.tsx |
| 4.1.17 | `feat(web): add connectors page with connect/sync flows` | apps/web/src/app/workspace/[workspaceId]/connectors/page.tsx |
| 4.1.18 | `feat(web): add chat, schedule, history, and settings pages` | apps/web/src/app/workspace/[workspaceId]/chat/page.tsx, schedule/page.tsx, history/page.tsx, settings/page.tsx |

### 4.2 apps/api (14 commits)

| # | Message | Files |
|---|---------|-------|
| 4.2.1 | `feat(api): scaffold NestJS API with Prisma and Swagger` | apps/api/src/main.ts, apps/api/src/app.module.ts |
| 4.2.2 | `feat(api): add global exception filter, response interceptor, and guards` | apps/api/src/common/filters/, interceptors/, guards/ |
| 4.2.3 | `feat(api): add auth module (login, signup, JWT, refresh token)` | apps/api/src/auth/ |
| 4.2.4 | `feat(api): add workspace module (CRUD, members)` | apps/api/src/workspaces/ |
| 4.2.5 | `feat(api): add memory module with CRUD and search` | apps/api/src/memory/ |
| 4.2.6 | `feat(api): add agents module with execute and execution history` | apps/api/src/agents/ |
| 4.2.7 | `feat(api): add events module with subscriptions` | apps/api/src/events/ |
| 4.2.8 | `feat(api): add search, billing, and integrations modules` | apps/api/src/search/, billing/, integrations/ |
| 4.2.9 | `feat(api): add documents, resumes, and applications modules` | apps/api/src/documents/, resumes/, applications/ |
| 4.2.10 | `feat(api): add chat module for workspace conversations` | apps/api/src/chat/ |
| 4.2.11 | `feat(api): add health check, cache, rate-limiting modules` | apps/api/src/health.controller.ts, cache/, rate-limiting/ |
| 4.2.12 | `feat(api): add observability setup (metrics, tracing, logging)` | apps/api/src/observability/ |
| 4.2.13 | `feat(api): add Prisma schema and generated client` | apps/api/src/prisma/, apps/api/src/generated/ |
| 4.2.14 | `feat(api): add config module, Dockerfile, tests` | apps/api/src/config/, Dockerfile, jest.config.js |

### 4.3 apps/ai-service (8 commits)

| # | Message | Files |
|---|---------|-------|
| 4.3.1 | `feat(ai): scaffold FastAPI ai-service with SQLAlchemy async` | apps/ai-service/src/main.py, core/ |
| 4.3.2 | `feat(ai): add LLM provider abstraction (Anthropic + OpenAI)` | apps/ai-service/src/providers/ |
| 4.3.3 | `feat(ai): add embeddings router with pgvector support` | apps/ai-service/src/routers/embeddings.py |
| 4.3.4 | `feat(ai): add memory service for knowledge graph and vector store` | apps/ai-service/src/app/memory/ |
| 4.3.5 | `feat(ai): add agent orchestration service` | apps/ai-service/src/app/orchestrator/ |
| 4.3.6 | `feat(ai): add all specialist agents (resume, job-search, gmail, etc)` | apps/ai-service/src/app/agents/ |
| 4.3.7 | `feat(ai): add auth middleware, rate-limiting, and /metrics endpoint` | apps/ai-service/src/middleware/, src/metrics/ |
| 4.3.8 | `build(ai): add Dockerfile, requirements, and config` | apps/ai-service/Dockerfile, requirements.txt, alembic/ |

---

## Phase 5: Microservices (62 commits)

### 5.1 Core Services (10 commits)

| # | Message | Scope |
|---|---------|-------|
| 5.1.1 | `feat(service): add auth-service with JWT and refresh token rotation` | services/auth-service/ |
| 5.1.2 | `feat(service): add memory-store with pgvector CRUD` | services/memory-store/ |
| 5.1.3 | `feat(service): add knowledge-graph service with entity resolution` | services/knowledge-graph/ |
| 5.1.4 | `feat(service): add event-bus with publish/subscribe pattern` | services/event-bus/ |
| 5.1.5 | `feat(service): add search-service with hybrid vector + keyword` | services/search-service/ |
| 5.1.6 | `feat(service): add agent-engine for agent lifecycle management` | services/agent-engine/ |
| 5.1.7 | `feat(service): add iam-service for identity and access management` | services/iam-service/ |
| 5.1.8 | `feat(service): add rbac-service for role-based access control` | services/rbac-service/ |
| 5.1.9 | `feat(service): add notification-service (in-app, email, webhook)` | services/notification-service/ |
| 5.1.10 | `feat(service): add billing-service with Stripe integration` | services/billing-service/ |

### 5.2 Data Processing Services (10 commits)

| # | Message | Scope |
|---|---------|-------|
| 5.2.1 | `feat(service): add document-ingestion service with OCR pipeline` | services/document-ingestion/ |
| 5.2.2 | `feat(service): add connector-service for external API abstraction` | services/connector-service/ |
| 5.2.3 | `feat(service): add integration-service for 3rd party apps` | services/integration-service/ |
| 5.2.4 | `feat(service): add plugin-service for plugin registry` | services/plugin-service/ |
| 5.2.5 | `feat(service): add job-scheduler for cron and delayed tasks` | services/job-scheduler/ |
| 5.2.6 | `feat(service): add analytics-service for usage metrics` | services/analytics-service/ |
| 5.2.7 | `feat(service): add audit-service for immutable audit log` | services/audit-service/ |
| 5.2.8 | `feat(service): add recommendation-service for content suggestions` | services/recommendation-service/ |
| 5.2.9 | `feat(service): add analytics dashboards and reporting` | services/analytics-service/ |
| 5.2.10 | `feat(service): add integration catalog with provider definitions` | services/integration-service/ |

Each service commit is REPEATED per service with:
- Full NestJS scaffold (main.ts, module, controller, service, DTO, entity)
- Database config (Prisma schema or typeorm)
- Dockerfile + jest config
- Unit tests + e2e tests
- Prometheus metrics + pino logging

---

## Phase 6: Connectors (12 commits)

| # | Message | Files |
|---|---------|-------|
| 6.1 | `feat(connectors): add REST connector with auth, pagination, rate-limiter` | connectors/rest/ |
| 6.2 | `feat(connectors): add GraphQL connector with introspection and query builder` | connectors/graphql/ |
| 6.3 | `feat(connectors): add MCP connector with JSON-RPC 2.0 protocol` | connectors/mcp/ |
| 6.4 | `test(connectors): add unit and integration tests for REST connector` | connectors/rest/tests |
| 6.5 | `test(connectors): add unit and integration tests for GraphQL connector` | connectors/graphql/tests |
| 6.6 | `test(connectors): add unit tests for MCP connector (stdio + SSE)` | connectors/mcp/tests |
| 6.7 | `chore(connectors): add package.json, tsconfig, and README for REST connector` | connectors/rest/package.json etc |
| 6.8 | `chore(connectors): add package.json, tsconfig, and README for GraphQL connector` | connectors/graphql/ |
| 6.9 | `chore(connectors): add package.json, tsconfig, and README for MCP connector` | connectors/mcp/ |
| 6.10 | `build(connectors): add Dockerfiles and jest configs` | connectors/*/Dockerfile, jest.config.ts |
| 6.11 | `docs(connectors): add connector architecture and usage guide` | connectors/README.md |
| 6.12 | `refactor(connectors): align error handling and retry logic across connectors` | connectors/*/src |

---

## Phase 7: Integrations (15 commits)

| # | Message | Scope |
|---|---------|-------|
| 7.1 | `feat(integrations): add Slack integration with OAuth and message sync` | integrations/slack/ |
| 7.2 | `feat(integrations): add GitHub integration with repo and issue sync` | integrations/github/ |
| 7.3 | `feat(integrations): add Notion integration with page and DB sync` | integrations/notion/ |
| 7.4 | `feat(integrations): add Google Drive connector with file sync` | integrations/google-drive/ |
| 7.5 | `feat(integrations): add email integration with IMAP/SMTP` | integrations/email/ |
| 7.6 | `feat(integrations): add calendar integration (Google Calendar, Outlook)` | integrations/calendar/ |
| 7.7 | `security(integrations): add AES-256-GCM token encryption` | integrations/*/src/crypto/ |
| 7.8 | `feat(integrations): add webhook verification for all integrations` | integrations/*/src/webhook/ |
| 7.9 | `test(integrations): add unit tests for Slack integration` | integrations/slack/tests |
| 7.10 | `test(integrations): add unit tests for GitHub and Notion integrations` | integrations/github/tests, notion/tests |
| 7.11 | `test(integrations): add unit tests for Drive, Email, Calendar` | integrations/google-drive/tests, email/tests, calendar/tests |
| 7.12 | `docs(integrations): add integration setup guide with OAuth flow` | integrations/*/README.md |
| 7.13 | `build(integrations): add Dockerfiles and jest configs` | integrations/*/Dockerfile |
| 7.14 | `chore(integrations): add package.json, tsconfig for all integrations` | integrations/*/package.json |
| 7.15 | `refactor(integrations): standardize sync engine across all providers` | integrations/*/src/sync/ |

---

## Phase 8: Plugins & SDK (12 commits)

### 8.1 Plugins (8 commits)

| # | Message | Scope |
|---|---------|-------|
| 8.1.1 | `feat(plugins): add official summarizer plugin` | plugins/official/summarizer/ |
| 8.1.2 | `feat(plugins): add official translator plugin` | plugins/official/translator/ |
| 8.1.3 | `feat(plugins): add official sentiment analysis plugin` | plugins/official/sentiment/ |
| 8.1.4 | `feat(plugins): add community word-count plugin` | plugins/community/word-count/ |
| 8.1.5 | `feat(plugins): add community tag-generator plugin` | plugins/community/tag-generator/ |
| 8.1.6 | `test(plugins): add plugin tests (summarizer, translator, sentiment)` | plugins/official/*/tests |
| 8.1.7 | `test(plugins): add plugin tests (word-count, tag-generator)` | plugins/community/*/tests |
| 8.1.8 | `build(plugins): add plugin package.json, tsconfig, Dockerfiles` | plugins/*/package.json |

### 8.2 SDK & Agents (4 commits)

| # | Message | Scope |
|---|---------|-------|
| 8.2.1 | `feat(sdk): add TypeScript SDK with client, auth, and type definitions` | sdk/typescript/ |
| 8.2.2 | `feat(sdk): add Python SDK with httpx-based client and model classes` | sdk/python/ |
| 8.2.3 | `docs(sdk): add SDK documentation, examples, and migration guide` | sdk/README.md, SDK-Documentation.md |
| 8.2.4 | `docs(agents): add agent documentation for all 28 enterprise agents` | agents/ |

---

## Phase 9: Infrastructure & Platform (28 commits)

### 9.1 Docker & Compose (4 commits)

| # | Message | Scope |
|---|---------|-------|
| 9.1.1 | `infra(docker): add Docker Compose with all 26 services` | docker-compose.yml |
| 9.1.2 | `infra(docker): add Dockerfiles for API gateway and web app` | apps/api/Dockerfile, apps/web/Dockerfile |
| 9.1.3 | `infra(docker): add Dockerfiles for all microservices` | services/*/Dockerfile |
| 9.1.4 | `infra(docker): add Dockerfiles for connectors and integrations` | connectors/*/Dockerfile, integrations/*/Dockerfile |

### 9.2 Kubernetes (8 commits)

| # | Message | Scope |
|---|---------|-------|
| 9.2.1 | `infra(k8s): add base kustomization with all 21 apps` | infra/kubernetes/base/kustomization.yaml |
| 9.2.2 | `infra(k8s): add service, deployment, configmap for auth service` | infra/kubernetes/base/auth/ |
| 9.2.3 | `infra(k8s): add k8s manifests for core services` | infra/kubernetes/base/*-service/ |
| 9.2.4 | `infra(k8s): add k8s manifests for data processing services` | infra/kubernetes/base/document-ingestion, connector, integration, plugin |
| 9.2.5 | `infra(k8s): add k8s manifests for frontend and API gateway` | infra/kubernetes/base/web, api, ai-service |
| 9.2.6 | `infra(k8s): add dev overlay with dev-optimized resources` | infra/kubernetes/overlays/dev/ |
| 9.2.7 | `infra(k8s): add staging overlay with staging DNS and TLS` | infra/kubernetes/overlays/staging/ |
| 9.2.8 | `infra(k8s): add prod overlay with HPA, PDB, and pod-topology-spread` | infra/kubernetes/overlays/prod/ |

### 9.3 Terraform (10 commits)

| # | Message | Scope |
|---|---------|-------|
| 9.3.1 | `infra(terraform): add VPC, subnets, and networking module` | infra/terraform/modules/vpc/ |
| 9.3.2 | `infra(terraform): add EKS cluster, node groups, and OIDC` | infra/terraform/modules/eks/ |
| 9.3.3 | `infra(terraform): add RDS PostgreSQL 16 with replication` | infra/terraform/modules/rds/ |
| 9.3.4 | `infra(terraform): add ElastiCache Redis 7 cluster` | infra/terraform/modules/elasticache/ |
| 9.3.5 | `infra(terraform): add S3, CloudFront, and Route53 modules` | infra/terraform/modules/s3/, cloudfront/, route53/ |
| 9.3.6 | `infra(terraform): add ECR, KMS, WAF, and IAM modules` | infra/terraform/modules/ecr/, kms/, waf/, iam/ |
| 9.3.7 | `infra(terraform): add monitoring module (CloudWatch, SNS alarms)` | infra/terraform/modules/monitoring/ |
| 9.3.8 | `infra(terraform): add dev environment with t3a instances` | infra/terraform/environments/dev/ |
| 9.3.9 | `infra(terraform): add staging environment` | infra/terraform/environments/staging/ |
| 9.3.10 | `infra(terraform): add production environment with HA config` | infra/terraform/environments/prod/ |

### 9.4 Platform Scripts & Config (6 commits)

| # | Message | Scope |
|---|---------|-------|
| 9.4.1 | `chore(scripts): add deployment scripts and git hooks` | scripts/deploy/, scripts/git-hooks/ |
| 9.4.2 | `chore(scripts): add utility scripts (docs validation, encoding, mermaid fix)` | scripts/docs_*.py, fix_*.py |
| 9.4.3 | `infra(makefile): add Makefile with core, services, and helper targets` | Makefile |
| 9.4.4 | `chore(db): add database schema extensions and seed scripts` | database/ |
| 9.4.5 | `infra(monitoring): add Prometheus rules, health checks, dashboard configs` | monitoring/ |
| 9.4.6 | `infra(logging|telemetry|security): add structured logging, otel, and access policies` | logging/, telemetry/, security/ |

---

## Phase 10: Platform Infrastructure (10 commits)

| # | Message | Scope |
|---|---------|-------|
| 10.1 | `feat(events): add event schema definitions for domain events` | events/ |
| 10.2 | `feat(mcp): add MCP tool definitions and MCP server config` | mcp/ |
| 10.3 | `feat(prompts): add system prompts for agents, memory, and RAG` | prompts/ |
| 10.4 | `chore(tools): add lint-staged, check-env, and cleanup scripts` | tools/ |
| 10.5 | `test(config): add Jest config, Playwright setup, and k6 load test scripts` | testing/ |
| 10.6 | `chore(scripts): add utility scripts (find_secrets, update_taglines)` | find_secrets.py, update_taglines.py, fix_encoding.py, fix_mermaid.py |
| 10.7 | `docs: add CHANGELOG, implementation checklist, and usage guide` | CHANGELOG.md, IMPLEMENTATION-CHECKLIST.md |
| 10.8 | `docs: add documentation map and API documentation` | Docs/DOCUMENTATION-MAP.md, Docs/API/ |
| 10.9 | `docs: add contributing guide and usage guide` | Docs/Contributing/, Docs/Guides/, Docs/USAGE-GUIDE.md |
| 10.10 | `chore: add .qoder gitignore and repo cleanup scripts` | (gitignore already updated) |

---

## Execution Order

```
Phase 0  →  Phase 2  →  Phase 3  →  Phase 4  →  Phase 5  →  Phase 6
  → Phase 7  →  Phase 8  →  Phase 9  →  Phase 10  →  Phase 1 (LAST)
```

**Why Phase 1 (Docs) last:** The 260 already-tracked doc files are modified. If we commit Phase 1 first, every subsequent commit will need to merge against those modified docs. By staging and committing all code first, then docs last, we avoid 260+ merge conflicts and redundant tree operations.

### Commit Strategy

```bash
# Per-phase execution pattern (not git add .)
git add <phase-specific-files>
git commit -m "type(scope): message"

# Example for Phase 4.1.1
git add apps/web/package.json apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/next.config.js
git commit -m "feat(web): scaffold Next.js app with Tailwind and font configuration"
```

### File count verification

| Directory | Files | Commits |
|-----------|-------|---------|
| Docs/ | 260 (modified) | 30 |
| packages/ | 198 | 20 |
| apps/ | 848 | 40 |
| services/ | 1365 | 62 |
| connectors/ | 79 | 12 |
| integrations/ | 88 | 15 |
| plugins/ | 30 | 8 |
| sdk/ | 39 | 4 |
| infra/ | 107 | 28 |
| Root config | 15 | 12 |
| Other | ~50 | 20 |
| **Total** | **~3,079** | **~280** |

---

## Validation Steps

1. After each phase: `pnpm install` to ensure dependency graph integrity
2. After Phase 4: `pnpm --filter @vaeloom/web build` (Next.js build)
3. After Phase 5: `pnpm --filter @vaeloom/api build` (NestJS build)
4. After Phase 9: `pnpm exec nx run-many -t test` (all tests)
5. Final: `git log --oneline | wc -l` should show ~280 commits
