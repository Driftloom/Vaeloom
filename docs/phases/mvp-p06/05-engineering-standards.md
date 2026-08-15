# MVP-P06 — 05. Engineering Standards (DEL-MVP-P06-03) — Re-Run 2026-08-15

> DEL-MVP-P06-03. Repository layout, linting, testing, CI, commit, branch, PR,
> documentation, and observability standards for the Vaeloom MVP. Baseline: repo
> `master` @ `e48f547`.

## 1. Repository Layout

```
vaeloom/
├── apps/
│   ├── backend/          # FastAPI (Python 3.12+; pyproject.toml + uv.lock)
│   └── web/              # Next.js 15 (pnpm workspace; package.json)
├── packages/
│   ├── eslint-config/    # Shared ESLint configs (base.js, nextjs.js)
│   ├── observability/    # NestJS OTel + pino (NOT used by web)
│   ├── plugin-sdk/       # Plugin development SDK
│   ├── python-common/    # Shared Python models/config/logging
│   ├── queue/            # BullMQ TS wrapper (NOT deployed)
│   ├── service-auth/     # NestJS service-to-service auth (NOT deployed)
│   ├── shared-types/     # Shared TS types (hand-written, not OpenAPI-generated)
│   ├── tsconfig/         # Shared TS configs (base, nextjs, nestjs)
│   └── ui-kit/           # 5 hand-written Tailwind components (Button, Card, Input, Modal, Spinner)
├── connectors/           # MCP, GraphQL, REST connector packages
├── integrations/         # Calendar, email, github, google-drive, notion, slack
├── plugins/              # Community + official plugins
├── sdk/typescript/       # External SDK (axios-based; NOT used by web)
├── infra/                # Terraform, k8s, docker, monitoring (enterprise; out-of-MVP)
├── docs/                 # Documentation (22 dirs)
├── testing/              # Accessibility + E2E configs
└── .github/workflows/    # 11 CI workflows
```

## 2. Linting & Formatting

| Tool             | Scope              | Config                                                               | Enforcement                                  |
| ---------------- | ------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| **Prettier**     | TS/JS/JSON/MD/YAML | `.prettierrc` (semi, singleQuote, trailingComma:all, printWidth:100) | Pre-commit + CI `format:check`               |
| **ESLint**       | TS/JS              | `packages/eslint-config/{base,nextjs}.js`                            | Pre-commit + CI `lint`                       |
| **Ruff**         | Python (all)       | `[tool.ruff]` in `apps/backend/pyproject.toml` (NEW: Q&A-2)          | CI `ci-backend.yml` (FIXING dead path)       |
| **mypy**         | Python (all)       | `[tool.mypy]` in `apps/backend/pyproject.toml` (NEW: Q&A-2)          | CI `ci-backend.yml` (FIXING dead path)       |
| **markdownlint** | Markdown           | `.markdownlint.json`                                                 | CI `docs-validate.yml` (FIXING Docs/** path) |
| **Vale**         | Prose              | `.vale.ini` (Vaeloom custom + write-good)                            | CI `docs-validate.yml`                       |
| **cspell**       | Spelling           | `.cspell.json` (custom `meridian` dict)                              | IDE + CI                                     |

## 3. Pre-Commit & Commit Standards

| Hook         | Tool                              | Action                          | Scope                                |
| ------------ | --------------------------------- | ------------------------------- | ------------------------------------ |
| `pre-commit` | lint-staged + prettier            | `prettier --write`              | `*.{ts,tsx,js,jsx,json,md,yaml,yml}` |
| `commit-msg` | commitlint                        | Conventional commits validation | All commits                          |
| Scope rules  | `@commitlint/config-conventional` | No custom scopes                | —                                    |

**Commit format:** `<type>(<scope>): <description>` — feat, fix, docs, chore,
refactor, test, ci, perf, build.

## 4. Branching & PR

| Rule             | Standard                                     |
| ---------------- | -------------------------------------------- |
| Base branch      | `main`                                       |
| Feature branches | `feat/<name>`, `fix/<name>`, `docs/<name>`   |
| PR requirement   | All changes via PR; no direct push to `main` |
| Review           | At least 1 approval; maintainer merge        |
| CI gate          | lint + typecheck + test + build must pass    |

## 5. Testing Standards

| Layer         | Tool                    | Config                                 | Coverage Target     |
| ------------- | ----------------------- | -------------------------------------- | ------------------- |
| Unit (Python) | pytest + pytest-asyncio | `pyproject.toml [tool.pytest]`         | 90%+ (current: 97%) |
| Unit (TS/JS)  | Jest + @testing-library | `apps/web/jest.config.js`              | 80%+                |
| Integration   | pytest + testcontainers | `tests/integration/`                   | Critical paths      |
| E2E           | Playwright              | `testing/e2e/playwright.config.ts`     | Auth, core flows    |
| Accessibility | @axe-core/playwright    | `testing/accessibility/audit-pages.ts` | WCAG 2.2 AA         |

**Test rules:**

- `mock_llm` and `mock_connector_test` are autouse fixtures (tests never hit
  real APIs)
- SQLite with PG→SQLite monkeypatch for dev/test
- Coverage threshold: 90% (Python), 80% (TS/JS)
- Security tests: rate_limit, sql_injection, xss, noauth_private, ip_filter,
  prompt_injection

## 6. Error Taxonomy

| Code Range       | Meaning                                       | Retry                     |
| ---------------- | --------------------------------------------- | ------------------------- |
| 2xx              | Success                                       | —                         |
| 4xx Client Error | Invalid request (auth, validation, not found) | No                        |
| 401 Unauthorized | Token expired/missing                         | Refresh token once        |
| 403 Forbidden    | Insufficient permissions                      | No                        |
| 404 Not Found    | Resource doesn't exist                        | No                        |
| 409 Conflict     | Idempotency or state conflict                 | No                        |
| 429 Rate Limited | Too many requests                             | Yes (Retry-After header)  |
| 5xx Server Error | Internal failure                              | Yes (exponential backoff) |

## 7. API Standards

| Rule             | Standard                                                             |
| ---------------- | -------------------------------------------------------------------- |
| API versioning   | URL prefix `/api/v1/` (APIVersionMiddleware)                         |
| Naming           | RESTful; snake_case (backend serializes)                             |
| Client transform | `transformKeys()` in `api.ts` + `api-client.ts` (snake→camel)        |
| Pagination       | `{items, total, page, page_size}` (snake_case backend)               |
| CORS             | Restricted origins via `ALLOWED_ORIGINS` env                         |
| CSRF             | `SKIP_PREFIXES = frozenset({"/api/v1/auth"})` + auth in PUBLIC_PATHS |

## 8. Security Headers

| Header                    | Value                                                                   | Evidence                  |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| X-Frame-Options           | DENY                                                                    | `apps/web/next.config.js` |
| X-Content-Type-Options    | nosniff                                                                 | `apps/web/next.config.js` |
| Referrer-Policy           | strict-origin-when-cross-origin                                         | `apps/web/next.config.js` |
| Permissions-Policy        | camera=(), microphone=(), geolocation=(), interest-cohort=()            | `apps/web/next.config.js` |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload                            | `apps/web/next.config.js` |
| CSP                       | default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ... | `apps/web/next.config.js` |

## 9. Observability Standards

| Signal      | Tool                                          | Endpoint            | Notes                                                         |
| ----------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| Traces      | OpenTelemetry SDK                             | OTLP exporter       | `infrastructure/opentelemetry.py` (OTEL_SDK_DISABLED for dev) |
| Metrics     | prometheus-fastapi-instrumentator             | `/metrics` (public) | Currently COMMENTED OUT in `main.py:135` — GAP                |
| Logs        | structlog                                     | stdout              | JSON in prod, pretty in dev                                   |
| Correlation | CorrelationIDMiddleware                       | X-Correlation-ID    | Propagated to all responses                                   |
| Health      | `/health`, `/health/ready`, `/health/startup` | `routers/health.py` | PUBLIC path                                                   |

## 10. Snake↔Camel Transform

| Layer                      | Convention     | Transform                          |
| -------------------------- | -------------- | ---------------------------------- |
| Backend (Pydantic)         | snake_case     | Default serialization              |
| Frontend (`api.ts`)        | camelCase      | `transformKeys()` on all responses |
| Frontend (`api-client.ts`) | camelCase      | `transformKeys()` on all responses |
| Shared types               | camelCase (TS) | Hand-written, not generated        |

## 11. Gaps (Q&A-2 minimal config)

| Gap                                            | Fix                                                                 | Phase | Status       |
| ---------------------------------------------- | ------------------------------------------------------------------- | ----- | ------------ |
| No `[tool.ruff]` in backend pyproject          | ADD ruff config (line-length=100, select E,F,I,N,W,UP,B,SIM,ARG,C4) | P06   | IMPLEMENTING |
| No `[tool.mypy]` in backend pyproject          | ADD mypy strict config                                              | P06   | IMPLEMENTING |
| No `[tool.coverage]` in backend pyproject      | ADD coverage config                                                 | P06   | IMPLEMENTING |
| No `.python-version`                           | ADD `.python-version` with `3.12`                                   | P06   | IMPLEMENTING |
| CI ruff targets nonexistent `apps/ai-service`  | FIX to target `apps/backend`                                        | P06   | IMPLEMENTING |
| CI mypy targets nonexistent `apps/ai-service`  | FIX to target `apps/backend`                                        | P06   | IMPLEMENTING |
| No eslint flat config (ESLint 8 legacy)        | DEFER to P16; document in standards                                 | P16   | DEFERRED     |
| No `eslint-plugin-security`                    | DEFER to P16                                                        | P16   | DEFERRED     |
| Pre-commit runs only prettier (no eslint/ruff) | Consider adding; DEFER to P16                                       | P16   | DEFERRED     |
| `/metrics` instrumentator COMMENTED OUT        | Document as gap; verify at P17                                      | P17   | DEFERRED     |

## 12. Evidence (EVD)

| ID              | Claim                              | Requirement | Type          | Location                         | Result | Date       | Verified by |
| --------------- | ---------------------------------- | ----------- | ------------- | -------------------------------- | ------ | ---------- | ----------- |
| EVD-MVP-P06-008 | Lint/format/test tooling inventory | MVP-P06-R04 | REPO_VERIFIED | root configs + pyproject.toml    | PASS   | 2026-08-15 | Agent D     |
| EVD-MVP-P06-009 | Security headers configured        | MVP-P06-R04 | REPO_VERIFIED | `apps/web/next.config.js`        | PASS   | 2026-08-15 | Agent D     |
| EVD-MVP-P06-010 | Error taxonomy documented          | MVP-P06-R04 | DESIGN        | `05-engineering-standards.md` §6 | PASS   | 2026-08-15 | Agent D     |
