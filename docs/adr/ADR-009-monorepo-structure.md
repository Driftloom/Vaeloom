# ADR-009: Monorepo with pnpm Workspaces

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom encompasses 25 packages across frontend (Next.js), backend (FastAPI/Python), integrations (calendar, email, github, google-drive, notion, slack), connectors (graphql, mcp, rest), plugins, SDK, and shared libraries. These packages share TypeScript types, ESLint config, and UI components. The project requires consistent tooling, shared dependency management, and efficient CI caching.

Options considered: pnpm workspaces, npm workspaces, Yarn workspaces, Turborepo, Nx standalone, Bazel.

## Decision

Use **pnpm workspaces** with **Nx** for task orchestration in a monorepo structure.

Structure:
```
vaeloom/
  apps/
    web/          # Next.js 15 frontend
    backend/      # FastAPI Python backend (separate toolchain)
  packages/
    ui-kit/       # Shared React components (shadcn/ui)
    shared-types/ # TypeScript type definitions
    eslint-config/# Shared ESLint configuration
    tsconfig/     # Shared TypeScript configuration
    observability/# OpenTelemetry instrumentation
    service-auth/ # Auth middleware library
    queue/        # Job queue abstraction
    plugin-sdk/   # Plugin development SDK
  integrations/
    calendar/     # Google Calendar integration
    email/        # Gmail integration
    github/       # GitHub integration
    google-drive/
    notion/
    slack/
  connectors/
    graphql/
    mcp/          # MCP protocol connector
    rest/
  plugins/
    tag-generator/
    word-count/
    sentiment/
    summarizer/
    translator/
  sdk/
    typescript/   # Public TypeScript SDK
  infra/
    ci/           # CI/CD configuration
    database/     # Database migrations & schema
    docker/       # Docker compose & Dockerfiles
    events/       # Event bus configuration
    logging/      # Centralized logging config
    migrations/   # Alembic/DB migration scripts
    monitoring/   # Prometheus/Grafana config
    ops/          # Operations runbooks
    security/     # Security policies & IAM
    telemetry/    # OpenTelemetry config
  scripts/        # Shell scripts & tooling
  testing/
    accessibility/# aXe-based audit scripts
    e2e/          # Playwright E2E tests
    integration/  # Integration test containers
    performance/  # k6 load test scripts
    unit/         # Unit test setup & config
  docs/
    adr/          # Architecture Decision Records (20 ADRs)
    ai/           # AI/LLM architecture docs
    api/          # API reference
    architecture/ # System design docs
    backend/      # Backend module specs
    build-prompts/# Build prompt templates
    contributing/ # Contributing guidelines
    database/     # DB schema & design
    developer-experience/ # DX guides
    devops/       # CI/CD & deployment
    engineering/  # Coding standards & conventions
    enterprise/   # Enterprise features
    frontend/     # Frontend architecture
    guides/       # General guides
    operations/   # Operations runbooks
    product/      # Product specs & PRD
    project/      # Project management
    security/     # Security & compliance
    testing/      # Testing strategy
```

## Consequences

**Positive:**
- pnpm's strict dependency resolution prevents phantom dependencies and ensures reproducible builds
- Nx computation caching speeds up CI by only rebuilding changed packages
- Shared ESLint/TypeScript config ensures consistent code quality across 25 packages
- Single `pnpm-lock.yaml` for deterministic installs across all environments
- `.npmrc` with `auto-install-peers=true` and `strict-peer-dependencies=false` prevents install blockers

**Negative:**
- pnpm's strict node_modules structure can confuse tools that expect flat node_modules
- Task orchestration requires explicit Nx target definitions per package (25 packages × multiple targets)
- Cross-package TypeScript references require project references or path aliases in tsconfig
- Backend Python code lives outside the pnpm dependency graph — separate toolchain with its own `pyproject.toml`
