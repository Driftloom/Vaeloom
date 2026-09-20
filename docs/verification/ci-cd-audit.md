# CI/CD Workflows & Infrastructure Automation Forensic Audit

## 1. Executive Summary

Forensic inspection of `.github/workflows/` revealed **11 GitHub Actions
workflow files** orchestrating continuous integration, security auditing,
container builds, and deployments.

---

## 2. GitHub Actions Workflow Inventory

| Workflow File        | Triggers                        | Primary Jobs & Stages                      | Security & Quality Checks          |   Status   |
| :------------------- | :------------------------------ | :----------------------------------------- | :--------------------------------- | :--------: |
| `ci.yml`             | `push`, `pull_request`          | Monorepo linting, typechecking, full build | Nx affected, ESLint, Prettier      | **ACTIVE** |
| `ci-backend.yml`     | `push: [apps/api/**]`           | UV Python setup, Pytest execution          | Pytest suite, Python 3.12 pinning  | **ACTIVE** |
| `ci-frontend.yml`    | `push: [apps/web/**]`           | Node 20 setup, Next.js build, Jest         | Jest unit tests, Next.js typecheck | **ACTIVE** |
| `ci-integration.yml` | `pull_request`                  | Cross-package integration tests            | Integration test suite             | **ACTIVE** |
| `security-audit.yml` | `schedule`, `workflow_dispatch` | Dependency vulnerability scan              | `pip-audit`, `pnpm audit`, Bandit  | **ACTIVE** |
| `security-scan.yml`  | `push`, `pull_request`          | CodeQL static analysis                     | CodeQL AST security scanner        | **ACTIVE** |
| `a11y-audit.yml`     | `pull_request: [apps/web/**]`   | Web accessibility auditing                 | Playwright axe-core accessibility  | **ACTIVE** |
| `docs-validate.yml`  | `pull_request: [docs/**]`       | Markdown linting & link validation         | Markdownlint, broken link checker  | **ACTIVE** |
| `docker-build.yml`   | `push: [main]`                  | Multi-arch Docker container build          | Docker Buildx, GHCR push           | **ACTIVE** |
| `deploy-staging.yml` | `push: [develop]`               | Staging environment deployment             | Cloud Run / Kubernetes deploy      | **ACTIVE** |
| `deploy.yml`         | `push: [main]`                  | Production automated deployment            | Blue/Green deployment, migrations  | **ACTIVE** |

---

## 3. Container & Dockerization Forensics

1. **`Dockerfile.api`**:
   - Multi-stage build using `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`.
   - Compiles wheels, installs chromium for Playwright, runs as non-root user
     `vaeloom`.
2. **`Dockerfile.web`**:
   - Multi-stage build using `node:20-alpine`.
   - Utilizes Next.js `standalone` build output mode for minimal container
     footprint.
3. **`docker-compose.yml`**:
   - Orchestrates local dependencies: PostgreSQL 16 (pgvector enabled), Redis 7
     (alpine), Temporal Server, and Infisical.

---

## 4. Critical Gaps & CI/CD Technical Debt

1. **Pytest Parallelism Failure (`Finding 39`)**:
   - `ci-backend.yml` currently runs Pytest with `-n 4` which occasionally hangs
     on CI runners with low memory.
   - Recommended: Serial execution (`-o addopts=""`) or `--dist loadfile` in CI
     to prevent deadlocks.
2. **Missing Package Matrix**:
   - Workflows only check `apps/api` and `apps/web`. New packages in
     `packages/*` must be integrated into Nx/Turbo affected pipelines.
