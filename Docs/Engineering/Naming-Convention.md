# Naming Conventions

> **Purpose:** Define naming conventions for the Meridian codebase
> **Status:** 🆕 New

## Naming Conventions

```mermaid
graph TD
    classDef rules fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef lang fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef context fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef file fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1px

    subgraph Rules["📋 General Rules"]
        R1["Descriptive names<br/>getDocumentById not getDoc"]
        R2["No abbreviations<br/>OrganizationAgent not OrgAgt"]
        R3["Consistent terminology<br/>"document" not "file""]
        R4["No Hungarian notation<br/>name not strName"]
    end

    subgraph Language["🔤 By Language"]
        L1["TypeScript<br/>Variables: camelCase<br/>Functions: camelCase<br/>Classes: PascalCase<br/>Files: kebab-case"]
        L2["Python<br/>Variables: snake_case<br/>Functions: snake_case<br/>Classes: PascalCase<br/>Files: snake_case"]
        L3["SQL / CSS<br/>All: snake_case / kebab-case"]
    end

    subgraph Context["📌 By Context"]
        C1["API: kebab-case plural<br/>GET /workspaces/{id}/documents"]
        C2["DB: snake_case plural<br/>memory_records"]
        C3["GraphQL: camelCase<br/>workspaceId"]
        C4["Env vars: UPPER_SNAKE<br/>DATABASE_URL"]
        C5["Git branches: kebab-case<br/>feature/add-upload"]
    end

    subgraph Files["📄 File Naming"]
        F1["React: PascalCase.tsx<br/>ProposalCard.tsx"]
        F2["Services: kebab.service.ts<br/>document.service.ts"]
        F3["Python: snake_case.py<br/>memory_agent.py"]
        F4["Tests: {name}.test.ts<br/>document.service.test.ts"]
    end

    Rules --> Language --> Context --> Files

    class R1,R2,R3,R4 rules
    class L1,L2,L3 lang
    class C1,C2,C3,C4,C5 context
    class F1,F2,F3,F4 file
```

> **Diagram:** Naming conventions cascade from **general rules** (descriptive, no abbreviations, consistent, no Hungarian) → **by language** (camelCase for TS, snake_case for Python) → **by context** (API, DB, GraphQL, env vars, git) → **file naming** (PascalCase for React, kebab for services, snake for Python).

---

## General Rules

| Rule | Standard |
|------|----------|
| Names should be descriptive | `getDocumentById` not `getDoc` |
| Avoid abbreviations | `OrganizationAgent` not `OrgAgt` |
| Use consistent terminology | "document" not "file" in API |
| Avoid Hungarian notation | `name` not `strName` |

## By Language

| Language | Variables | Functions | Classes | Files |
|----------|-----------|-----------|---------|-------|
| TypeScript | camelCase | camelCase | PascalCase | kebab-case |
| Python | snake_case | snake_case | PascalCase | snake_case |
| SQL | snake_case | snake_case | — | snake_case |
| CSS | kebab-case | — | — | kebab-case |

## By Context

| Context | Convention | Example |
|---------|------------|---------|
| API endpoints | kebab-case plural | `GET /workspaces/{id}/documents` |
| Database tables | snake_case plural | `memory_records` |
| Database columns | snake_case singular | `created_at` |
| GraphQL fields | camelCase | `workspaceId` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL` |
| Git branches | kebab-case | `feature/add-document-upload` |
| Docker images | kebab-case | `meridian-api` |

## File Naming

| File Type | Convention | Example |
|-----------|------------|---------|
| React components | PascalCase.tsx | `ProposalCard.tsx` |
| Services | kebab-case.service.ts | `document.service.ts` |
| Controllers | kebab-case.controller.ts | `document.controller.ts` |
| Python modules | snake_case.py | `memory_agent.py` |
| Test files | `{name}.test.ts` | `document.service.test.ts` |
| Migration files | `YYYYMMDD_description.sql` | `20260712_add_memory_index.sql` |

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Abbreviating names for brevity | `getDocById` instead of `getDocumentById` saves 5 characters but costs every reader 5 seconds of confusion — abbreviations are the most common source of naming inconsistency |
| Mixing naming conventions across layers | Using `snake_case` in API endpoints (which should be `kebab-case`) or `camelCase` in database columns (which should be `snake_case`) creates cognitive friction for developers switching contexts |
| Inconsistent terminology for the same concept | Calling something "document" in the API, "file" in the database, and "asset" in the frontend forces developers to maintain mental mappings — use one term everywhere |
| Not following language-specific conventions | PascalCase for Python functions or snake_case for TypeScript classes breaks expectations — each language has established conventions for a reason |

## Best Practices

| Practice | Why |
|----------|-----|
| Choose descriptive names over short names | `getDocumentVersionsByDocumentId` is better than `getVersions` — self-documenting code reduces the need for comments and makes grep-friendly code |
| Follow context-specific conventions consistently | API endpoints are `kebab-case`, database columns are `snake_case`, JavaScript variables are `camelCase` — each context has a well-established convention |
| Use the same term for the same concept across the stack | If it's a "document" in the schema, call it "document" in the API, the frontend, and the documentation — terminology drift causes bugs at integration boundaries |
| Add naming conventions to the project glossary | A shared glossary of terms (document, workspace, application, etc.) prevents drift as the team grows — document the canonical term for each concept |

## Security Considerations

| Consideration | Mitigation |
|--------------|-----------|
| Naming that reveals internal implementation | Endpoint names like `/v1/getUserByEmail` expose query patterns — use resource-oriented naming (`/v1/users`) that doesn't reveal backend implementation details |
| Case-sensitive filename conflicts across operating systems | `DocumentService.ts` and `documentService.ts` are distinct on Linux but collide on macOS/Windows — enforce a single consistent case convention |

## Performance Considerations

| Consideration | Approach |
|--------------|----------|
| Naming and query performance | Database column names affect query readability but not query performance — prioritize consistency over micro-optimizations like column name length |
| File naming convention impact on imports | Consistent file naming (kebab-case for TypeScript) enables glob patterns and automated imports — inconsistent naming breaks tooling that depends on predictable paths |

## Workflows

1. **Creating a new React component:** Name the file `PascalCase.tsx`, export as default named export, use camelCase for props
2. **Adding a new API endpoint:** Use kebab-case plural for the URL path, camelCase for query parameters, snake_case for database columns
3. **Creating a new Python agent module:** Name the directory `snake_case` and files `snake_case.py` with PascalCase class names
4. **Adding environment variable:** Use `UPPER_SNAKE_CASE` with `MERIDIAN_` prefix — e.g., `MERIDIAN_DATABASE_URL`
5. **Creating database migration:** Name file `YYYYMMDD_descriptive_name.sql` with snake_case table names
6. **Setting up a new GitHub workflow:** Use kebab-case for workflow files (`ci-deploy.yml`), camelCase for job names

---

## APIs

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `GET /workspaces/{id}/documents` | GET | List documents (kebab-case plural) | JWT |
| `POST /workspaces/{id}/documents` | POST | Create document (kebab-case plural) | JWT |
| `GET /v1/users/{userId}/profile` | GET | Get user profile (camelCase param) | JWT |
| `PUT /admin/feature-flags/{flag}` | PUT | Toggle feature flag (kebab-case) | Admin JWT |

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| API endpoints | 20 endpoints | 200 endpoints: enforce naming conventions via linter | 2000 endpoints: OpenAPI spec generation from naming rules |
| Python modules | 10 agent modules | 100 modules: auto-generate `__init__.py` exports | 1000 modules: module namespace detection |
| Database tables | 15 tables | 150 tables: automated naming audit | 1500 tables: ORM naming convention enforcement |
| React components | 50 components | 500 components: component name uniqueness check | 5000 components: auto-generate barrel exports |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Mixed naming convention in file | Lint rule violation | ESLint/Ruff auto-fix | Run formatter on save |
| Case-insensitive filename conflict | Git detects rename on case-only change | Use consistent case from the start | `git mv` to correct case on case-sensitive FS |
| API path naming inconsistency | OpenAPI validation | Audit endpoint list against convention | Create redirect from old path to new |
| Database column name doesn't match ORM convention | Migration fails | Rename column via migration | Update ORM model to match |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Naming convention lint violations | > 5 per PR | Warning | Code Quality Dashboard |
| API endpoint naming inconsistency | Any occurrence | Info | API Style Guide |
| File naming conflict rate | > 1 per sprint | Warning | Repo Health |
| Migration file naming errors | Any | Critical | CI Pipeline |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| No automated convention enforcement across all languages | Convention drift requires manual review | Lint rules per language | Unified convention linter (megalinter) |
| Case-sensitive vs. case-insensitive filesystem differences | macOS/Windows developers don't catch case issues | CI runs on Linux to catch case errors | Pre-commit hook with case check |
| Python and TypeScript use different case conventions | Cognitive switching cost | IDE snippets per language | Cross-language convention mapping tool |
| No naming convention for test files | Test file organization varies | Follow `{name}.test.ts` pattern | Enforce test naming in Jest/Vitest config |

---

## Overview

Consistent naming conventions are essential for navigating the Meridian monorepo — a codebase spanning three application services, three shared packages, 10+ specialist agents, and multiple infrastructure and documentation directories. This document defines naming rules for every layer: TypeScript/Python code, API endpoints, database schemas, GraphQL fields, environment variables, Git branches, Docker images, and file names.

Following these conventions eliminates cognitive friction when switching between contexts (API design → database queries → frontend components → infrastructure config) and ensures that tooling — import autocompletion, glob patterns, grep searches — works reliably. Every Meridian engineer uses this document as the definitive reference when naming any file, variable, function, class, endpoint, or resource.

The conventions are language-aware (camelCase for TypeScript, snake_case for Python), context-aware (kebab-case for API URLs, UPPER_SNAKE for env vars), and enforced through lint rules, CI audits, and code review (documented in `Code-Review.md`).

## Goals

- Define unambiguous naming conventions for every layer of the Meridian stack — code, API, database, config, git, and infra
- Eliminate abbreviations, Hungarian notation, and inconsistent terminology that create confusion
- Ensure naming consistency across the TypeScript/Python language boundary for shared domain concepts
- Enable automated lint enforcement of naming rules per language and context
- Establish a shared project glossary of canonical terms (document, workspace, application, etc.)

## Scope

### In Scope
- General naming rules: descriptive names, no abbreviations, consistent terminology, no Hungarian notation
- Language-specific conventions: TypeScript (camelCase, PascalCase, kebab-case), Python (snake_case, PascalCase), SQL/CSS
- Context-specific conventions: API endpoints (kebab-case plural), database (snake_case), GraphQL (camelCase), env vars (UPPER_SNAKE), git branches (kebab-case), Docker images (kebab-case)
- File naming per type: React components (PascalCase.tsx), services (kebab.service.ts), tests ({name}.test.ts), Python modules (snake_case.py), migrations (YYYYMMDD_description.sql)
- Workflows for creating new components, endpoints, agents, env vars, and migrations

### Out of Scope
- Unified convention linter for all languages using megalinter (planned Q4 2026)
- Pre-commit hook for file naming validation (planned Q3 2026)
- IDE extension for naming convention suggestions (planned Q1 2027)
- Automated API endpoint naming audit in CI (planned Q4 2026)
- Cross-language convention consistency checker (planned Q2 2027)

---

## Examples

```bash
# API endpoints (kebab-case plural)
GET /workspaces/{id}/documents
POST /workspaces/{id}/documents
PUT /workspaces/{id}/documents/{docId}/approve

# Database (snake_case)
CREATE TABLE memory_records (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

# Environment variables (UPPER_SNAKE_CASE with MERIDIAN_ prefix)
MERIDIAN_DATABASE_URL=postgresql://localhost:5432/meridian
MERIDIAN_REDIS_URL=redis://localhost:6379
MERIDIAN_JWT_SECRET=<secret>
MERIDIAN_LOG_LEVEL=debug

# Git branches (kebab-case)
feature/add-document-upload
fix/entity-merge-null-error
hotfix/auth-token-expiry
release/v1.2.0
```

```typescript
// TypeScript naming — correct
export class DocumentService { ... }                 // PascalCase class
export function getDocumentById(id: string) { ... }  // camelCase function
const workspaceName = user.workspace.name;            // camelCase variable

// TypeScript naming — incorrect
export default class document_service { ... }         // ❌ PascalCase required
function get_document_by_id(id: string) { ... }       // ❌ camelCase required
const wsName = user.ws.name;                          // ❌ no abbreviations
```

```python
# Python naming — correct
class DocumentService: ...                            # PascalCase class
def get_document_by_id(document_id: str) -> Document: # snake_case function
workspace_name = user.workspace.name                  # snake_case variable

# Python naming — incorrect
class documentService: ...                            # ❌ PascalCase required
def getDocumentById(documentId: str) -> Document:     # ❌ snake_case required
ws_name = user.ws.name                                # ❌ no abbreviations
```

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Unified convention linter for all languages (megalinter) | High | Medium | Q4 2026 |
| Pre-commit hook for file naming validation | High | Low | Q3 2026 |
| IDE extension for naming convention suggestions | Medium | Medium | Q1 2027 |
| Automated API endpoint naming audit in CI | Medium | Low | Q4 2026 |
| Cross-language convention consistency checker | Low | High | Q2 2027 |

## Related Documents

- [Coding Standards.md](./Coding-Standards.md)
- [Folder Structure.md](./Folder-Structure.md)
- [Commit Convention.md](./Commit-Convention.md)
