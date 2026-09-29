# ENT-P06 — 03 Engineering & Repository Standards Baseline

> **Phase:** `ENT-P06` (Technology Stack and Engineering Standards)  
> **Deliverable:** `DEL-ENT-P06-03` (v1.0)  
> **Owner:** Principal Engineering Standards Lead & Core Maintainer  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Monorepo Organization & Boundary Enforcement

The Vaeloom monorepo is governed via an Nx-managed workspace maintaining strict
architectural encapsulation across frontend, backend, shared design systems, and
contracts:

```
c:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom\
├── apps/
│   ├── api/                 # FastAPI microservice (Python 3.12.13, Pydantic v2)
│   └── web/                 # Next.js 15 App Router web client (React 19, TypeScript)
├── packages/
│   ├── ui-kit/              # Reusable Accessible Design System Primitives (@vaeloom/ui-kit)
│   ├── contracts/           # Shared TypeScript/JSON Schema API and Event Contracts
│   └── policy/              # Cedar/Rego authorization policies and RBAC definitions
├── specs/
│   ├── api/openapi.yaml     # Generated OpenAPI 3.2.0 contract
│   └── phase-contracts/     # 66 governing phase prompts across MVP, CONT, and ENT tracks
├── evidence/
│   └── phases/              # Immutable verification registers, gate reports, and handoffs
└── infra/                   # Terraform IaC, Dockerfiles, and Helm charts for regional cells
```

### Boundary Invariants:

1. **Zero Circular Dependencies:** Packages in `packages/` must never import
   from `apps/`.
2. **Contract-First Communication:** Frontend and backend communicate
   exclusively via contracts defined in `specs/api/openapi.yaml` and typed SDKs.
   Direct cross-app file imports are strictly forbidden.
3. **Workspace Isolation:** Frontend builds must run independently via
   `pnpm dev:web` without triggering unnecessary backend tasks.

---

## 2. Language & Typing Standards

### A. TypeScript / Next.js Guidelines

- **Strict Mode Enforced:** `tsconfig.json` mandates `strict: true`,
  `noImplicitAny: true`, `strictNullChecks: true`, and
  `noUncheckedIndexedAccess: true`.
- **Typing Over Assertions:** Explicit TypeScript interfaces/types are required
  for all function arguments and return types. The use of `any` is
  release-blocking; `unknown` with type narrowing is required for dynamic
  payloads.
- **Client vs Server Components:** React Server Components (RSC) are default.
  Directives (`"use client"`) must be scoped strictly to interactive leaf
  components.

### B. Python / FastAPI Guidelines

- **Type Annotations Mandated:** 100% of function signatures, class methods, and
  module constants must carry Python 3.12 type hints, validated in CI via
  `mypy --strict`.
- **Pydantic Validation:** All incoming HTTP request payloads, external API
  responses, and database model representations must use Pydantic v2 models
  (`BaseModel`) with runtime validation.
- **Docstrings & Clean Code:** Google-style docstrings with explicit parameter
  descriptions, return types, and exception listings required for all public
  service methods.

---

## 3. Linting, Formatting & Code Style Automation

All code is automatically formatted and linted prior to commit via pre-commit
hooks:

| Language / Domain         | Tool           | Configuration File           | Enforced Rules & Style                                                           |
| :------------------------ | :------------- | :--------------------------- | :------------------------------------------------------------------------------- |
| **TypeScript / JS / CSS** | Biome / ESLint | `biome.json`, `.eslintrc.js` | 2-space indentation, single quotes, trailing commas, no unused variables.        |
| **Python**                | Ruff           | `apps/api/pyproject.toml`    | Flake8, isort, pycodestyle, pydocstyle; 88-char line length; sorted imports.     |
| **Markdown / Docs**       | Markdownlint   | `.markdownlint.json`         | Proper heading hierarchy, no consecutive empty lines, fenced code language tags. |
| **SQL Migrations**        | SQLFluff       | `.sqlfluff`                  | Postgres dialect, uppercase keywords, explicit column aliasing.                  |

---

## 4. Git Branching, Pull Requests & Review Governance

1. **Trunk-Based Development:**
   - Main branch (`main`) is protected, production-ready, and continuously
     deployable.
   - Short-lived feature branches: `feat/<ticket>-<description>`,
     `fix/<ticket>-<description>`, `chore/<ticket>-<description>`.
   - Maximum branch lifespan: 48 hours before merging into trunk.
2. **Conventional Commits:**
   - Commit messages must follow the format: `<type>(<scope>): <short summary>`
     (e.g. `feat(api): implement SCIM v2.0 user provisioning endpoint`).
   - Breaking changes must include `BREAKING CHANGE:` in the commit footer.
3. **Pull Request Quality Gates:**
   - Minimum 2 peer approvals required.
   - Changes touching authentication, consent, or database migrations require
     explicit sign-off from an Application Security Engineer or DBA.
   - Zero open lint warnings and 100% pass on all 731 automated tests.
   - Code coverage delta must not decrease repo coverage below the **90%**
     threshold.

_Signed: Principal Engineering Standards Lead & Core Maintainer — 2026-09-29_
