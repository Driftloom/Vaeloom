# Finding 06 — Consolidated Summary & Open Questions

**Date:** 2026-08-16

## Complete Risk Table

| #   | Finding                                      | Severity    | File:Line                         | Impact                                         |
| --- | -------------------------------------------- | ----------- | --------------------------------- | ---------------------------------------------- |
| 1   | TenantMiddleware not mounted                 | P0-CRITICAL | `main.py` (not imported)          | No automatic tenant context extraction         |
| 2   | IP Allowlist not mounted                     | P0-CRITICAL | `main.py` (not imported)          | No IP filtering despite middleware existing    |
| 3   | RLS on 4/30 tables only                      | P0-CRITICAL | `0005_rls.py:16`                  | 87% of tables unprotected                      |
| 4   | Middleware bug: no `set_rls_session_vars()`  | P0-CRITICAL | `tenant.py:72`                    | Even if mounted, RLS would not work            |
| 5   | Frontend sends no tenant headers             | P0-CRITICAL | `api-client.ts`                   | Middleware would get empty tenant_id           |
| 6   | RBAC is DI helper, not middleware            | P1-HIGH     | `rbac.py`                         | No automatic role checking on routes           |
| 7   | SAML SSOProvider is stub                     | P1-HIGH     | `sso.py:137-145`                  | SAML SSO completely non-functional             |
| 8   | SAML signature validation skipped            | P1-HIGH     | `saml.py:58-63`                   | SAML assertions not cryptographically verified |
| 9   | 7 frontend pages use hardcoded mock data     | P1-HIGH     | See `03-frontend-mock-vs-real.md` | Enterprise features not wired to API           |
| 10  | Makefile references 18 phantom packages      | P1-HIGH     | `Makefile:94-105`                 | `services-dev/lint/typecheck/test` will fail   |
| 11  | Makefile references Prisma (actual: Alembic) | P1-HIGH     | `Makefile:70-80`                  | `db-migrate/studio/seed/reset` will fail       |
| 12  | Prometheus/OTel commented out                | P2-MEDIUM   | `main.py:135-136`                 | No `/metrics` endpoint, no distributed tracing |
| 13  | 8 tables with tenant_id but no RLS           | P2-MEDIUM   | `schema.py` vs `0005_rls.py`      | Partial tenant isolation                       |
| 14  | Frontend `dev` script hangs                  | P2-MEDIUM   | `Makefile:11`                     | `pnpm dev` hangs (see AGENTS.md)               |

## What's Actually Working

### Backend (FastAPI)

- ✓ 29 routers mounted (24 always + 5 enterprise-gated)
- ✓ 11 middleware active (auth, CSRF, rate limit, CORS, security headers, etc.)
- ✓ SQLAlchemy async with PostgreSQL
- ✓ Alembic migrations (7 files, 0002-0007)
- ✓ JWT auth with refresh tokens
- ✓ Google + Microsoft SSO (OAuth2)
- ✓ Prompt injection detection
- ✓ Idempotency middleware
- ✓ API versioning
- ✓ Correlation IDs
- ✓ Request logging
- ✓ Config validation (fails fast on defaults)
- ✓ Plugin sandbox (subprocess isolation)
- ✓ Circuit breaker for agents

### Frontend (Next.js 15)

- ✓ 12 pages with real API calls
- ✓ SWR caching
- ✓ Typed API client with snake_case→camelCase transform
- ✓ Error states, loading states, empty states
- ✓ Dark/light mode
- ✓ Keyboard shortcuts
- ✓ 3 dynamic components (chat, memory graph, resume builder)

### Infrastructure

- ✓ Docker Compose (dev + prod)
- ✓ PostgreSQL with connection pooling (PgBouncer)
- ✓ Redis
- ✓ MinIO (S3-compatible)
- ✓ Terraform modules (EKS, RDS, ElastiCache, etc.)
- ✓ Kubernetes manifests
- ✓ Monitoring (Prometheus + Grafana dashboards)
- ✓ Load testing scripts (k6)

## Open Questions

### 1. TenantMiddleware Bug

The middleware exists but has a bug (doesn't call `set_rls_session_vars()`).
Should I:

- **A)** Fix the bug and mount it
- **B)** Leave as-is until you decide on the isolation architecture
- **C)** Remove the broken middleware entirely

### 2. Makefile Cleanup

Should I:

- **A)** Fix the Makefile (Alembic instead of Prisma, remove phantom packages)
- **B)** Remove broken targets entirely
- **C)** Leave as-is (aspirational reference)

### 3. Frontend Mock Pages

7 pages use hardcoded mock data. Should I:

- **A)** Flag these as P0 gaps requiring immediate API wiring
- **B)** Leave as intentional MVP placeholders
- **C)** Delete the mock pages

### 4. SAML Implementation

The XML parser is real but the SSOProvider is a stub. Should I:

- **A)** Implement the SAMLSSOProvider methods (using the existing parser)
- **B)** Leave as-is (enterprise feature, not MVP)
- **C)** Delete the stub to avoid confusion

### 5. RBAC

Currently just DI helpers, not middleware. Should I:

- **A)** Convert to proper middleware
- **B)** Leave as DI helpers (sufficient for current auth model)
- **C)** Remove if not used by any routes
