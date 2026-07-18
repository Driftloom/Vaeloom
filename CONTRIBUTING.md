# Contributing to Vaeloom

Thank you for your interest in contributing to Vaeloom! We welcome
contributions from everyone. By participating in this project, you agree to
abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation Requirements](#documentation-requirements)
- [Review Process](#review-process)

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0 (use the version pinned in `.nvmrc`)
- **pnpm** >= 9.0.0
- **Docker** & **Docker Compose** — required for local services (PostgreSQL, Redis, Qdrant, etc.)
- **Python** >= 3.12 — required for the Python SDK and AI service
- **Nx CLI** — installed via pnpm (`pnpm add -g nx` or use `pnpm nx`)

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/vaeloom/vaeloom.git
   cd vaeloom
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start infrastructure services**

   ```bash
   docker compose up -d
   ```

5. **Build all packages**

   ```bash
   pnpm build
   ```

6. **Run the development environment**

   ```bash
   pnpm dev
   ```

7. **Verify the setup**

   ```bash
   pnpm test
   pnpm lint
   ```

## Project Structure

```
vaeloom/
├── apps/                   # Application entrypoints
│   ├── api/               # API Gateway (NestJS)
│   ├── web/               # Web application (Next.js)
│   └── ai-service/        # AI service (Python FastAPI)
├── services/              # Microservices (18 services)
│   ├── auth-service/
│   ├── iam-service/
│   ├── knowledge-graph/
│   ├── memory-store/
│   └── ...                # Other microservices
├── packages/              # Shared libraries
│   ├── shared-types/      # TypeScript type definitions
│   ├── ui-kit/            # React component library
│   ├── eslint-config/     # Shared ESLint configuration
│   ├── tsconfig/          # Shared TypeScript configuration
│   ├── python-common/     # Common Python utilities
│   └── plugin-sdk/        # Plugin development kit
├── sdk/                   # Client SDKs
│   ├── typescript/        # TypeScript SDK
│   ├── python/            # Python SDK
│   └── rest-api/          # REST API specification (OpenAPI)
├── infra/                 # Infrastructure
│   ├── kubernetes/        # K8s manifests
│   ├── terraform/         # Terraform modules
│   ├── docker/            # Dockerfiles
│   └── scripts/           # Utility scripts
├── database/              # Schema migrations and seeds
├── connectors/            # Third-party connector adapters
├── integrations/          # Low-code integration templates
├── plugins/               # Official plugins
├── .github/               # GitHub Actions and templates
└── docs/                  # Documentation
```

## Coding Standards

### TypeScript / NestJS

- **Strict mode** is enabled in `tsconfig.base.json`. Avoid using `any` — prefer
  `unknown` with proper type narrowing.
- Follow the [NestJS](https://docs.nestjs.com/) conventions for services,
  controllers, modules, and DTOs.
- Use dependency injection and decorators consistently.
- All public APIs must be fully typed with explicit return types.

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/) with a 100-character line limit.
- Use type hints for all function signatures and public methods.
- Use Pydantic models for data validation and serialization.

### Linting & Formatting

- **ESLint** with the project's shared config (`@vaeloom/eslint-config`)
- **Prettier** for automatic code formatting (run `pnpm format` before committing)
- **Husky** pre-commit hooks run lint-staged automatically

Run the linter on your changes:

```bash
pnpm lint
pnpm format:check
```

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Usage                                         |
| ---------- | --------------------------------------------- |
| `feat`     | A new feature                                 |
| `fix`      | A bug fix                                     |
| `chore`    | Build process, tooling, or dependency changes |
| `docs`     | Documentation only changes                    |
| `test`     | Adding or updating tests                      |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style`    | Formatting, missing semicolons, etc. (no production change) |
| `perf`     | Performance improvement                       |
| `ci`       | CI/CD configuration changes                   |
| `security` | Security fix or improvement                   |

### Scope

Use the package/service name as the scope:

- `feat(auth): add MFA TOTP support`
- `fix(knowledge-graph): resolve community detection O(n²) issue`
- `docs(api): update WebSocket endpoint reference`

### Examples

```
feat(iam): add role hierarchy with permission inheritance

Implement role-based inheritance so that roles can extend parent roles.
Includes cascade permission resolution and cycle detection.

Closes #452
```

```
fix(auth): handle token refresh race condition
```

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`.

2. **Branch naming convention:**

   ```
   <type>/<short-description>
   ```

   Examples: `feat/rbac-policy-engine`, `fix/auth-refresh-race`, `docs/api-websocket`

3. **Before submitting**, ensure:

   - All tests pass (`pnpm test`)
   - Linting and formatting checks pass (`pnpm lint && pnpm format:check`)
   - TypeScript type checks pass (`pnpm typecheck`)
   - New code includes unit tests (minimum 80% coverage for new files)
   - Commit messages follow conventional commit format

4. **Pull request description template:**

   ```markdown
   ## Summary
   <!-- Brief description of the change -->

   ## Related Issues
   <!-- Closes #123, Implements #456 -->

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   <!-- Describe tests you added or updated -->

   ## Checklist
   - [ ] I have read the CONTRIBUTING document
   - [ ] My code follows the project's coding standards
   - [ ] I have added tests that prove my fix/feature works
   - [ ] All new and existing tests pass
   - [ ] I have updated the documentation accordingly
   ```

5. **PR Requirements:**

   - All checks must pass (CI, lint, test, typecheck)
   - At least one code owner approval required
   - No merge conflicts with `main`
   - Squash merge preferred — the commit message should match the PR title

## Testing Requirements

- **Unit tests** are **required** for all new code. We use Jest for TypeScript and
  pytest for Python.
- **Integration tests** are required for all services and API endpoints. Tests
  should spin up the service with its dependencies (in Docker) and exercise
  real HTTP/gRPC flows.
- **E2E tests** are strongly encouraged for cross-service functionality.
- Aim for **80%+ line coverage** on new code. Coverage gates are enforced in CI.

Run tests:

```bash
# All tests
pnpm test

# Single service
pnpm nx test auth-service

# With coverage
pnpm nx test auth-service --coverage
```

## Documentation Requirements

- All new features and APIs must include corresponding documentation updates.
- Public API endpoints must have OpenAPI annotations.
- Architecture decisions should be recorded as ADRs in `docs/adr/`.
- Use clear, concise language. Follow the [Vale](https://vale.sh/) linter rules
  defined in `.vale.ini`.
- Run the documentation linter: `vale sync && vale docs/`

## Review Process

1. **Author** submits a pull request with a completed description.
2. **Automated checks** run (lint, test, build, typecheck, security scan).
3. **Code owners** are automatically assigned based on the `CODEOWNERS` file.
4. **Reviewers** provide feedback within 2 business days.
5. **Author** addresses feedback and updates the PR.
6. **Approval** — at least one code owner must approve.
7. **Merge** — a maintainer performs a squash merge to `main`.

### Review Guidelines for Reviewers

- Be respectful and constructive. Focus on the code, not the person.
- Explain the reasoning behind suggestions.
- Distinguish between blockers (must fix) and nits (nice to have).
- Approve only when you are satisfied that the change is correct, well-tested,
  and appropriately documented.

Thank you for helping make Vaeloom better!
