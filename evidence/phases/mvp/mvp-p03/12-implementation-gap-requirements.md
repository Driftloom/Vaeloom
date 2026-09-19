# MVP-P03 — 12. Implementation Gap Requirements (zero-trust audit)

> **MVP-P03 upgrade 2026-08-16.** Baseline: repo `master` @ HEAD. This document
> maps gaps found during a zero-trust codebase audit to new requirements. Each
> gap was verified by reading actual source files — no reliance on prior reports
> or documentation claims.

## Audit methodology

1. Read every middleware file in `apps/api/src/api/middleware/`
2. Checked which middleware is actually mounted in `apps/api/src/api/main.py`
3. Verified RLS coverage against `apps/api/src/api/models/schema.py` (all
 tables)
4. Confirmed frontend page data sources (real API vs hardcoded mock)
5. Checked testing/ directories for actual files
6. Verified architecture references (apps/core-api, apps/ai-service,
 packages/contracts)
7. Checked Makefile for phantom package references
8. Verified SAML implementation completeness
9. Confirmed workload identity (ADR-025) implementation status
10. Counted tables with/without `tenant_id` column

## Gap-to-requirement mapping

### GAP-01: TenantMiddleware NOT mounted

- **Finding:** `apps/api/src/api/middleware/tenant.py:62` defines
 `TenantMiddleware` which reads `X-Tenant-ID`/`X-Workspace-ID` headers and
 calls `set_rls_session_vars()`. However, `apps/api/src/api/main.py` never
 imports or mounts this middleware. Zero references to `TenantMiddleware` in
 `main.py`.
- **Root cause:** Middleware was implemented but never added to the ASGI stack.
- **Impact:** No tenant context is set on any request. PostgreSQL RLS policies
 that depend on `current_setting('app.tenant_id')` will always see NULL. The
 `set_rls_session_vars()` function at `tenant.py:40-59` is dead code.
- **Requirement:** FR-71 (see `03-requirements.md` §8)
- **Acceptance:** `main.py` middleware stack includes `TenantMiddleware`; every
 request sets `app.tenant_id` GUC; isolation suite passes against PostgreSQL.
- **Priority:** P0 — security-critical for multi-tenancy.
- **Owner:** Security Architect.
- **Fix effort:** Small (add import + 1 line to middleware stack).

### GAP-02: IP Allowlist NOT mounted

- **Finding:** `apps/api/src/api/middleware/ip_filter.py:42` defines
 `IPAllowlistMiddleware` which parses CIDR allowlists and returns 403 on denied
 IPs. `main.py` never imports or mounts it.
- **Root cause:** Middleware implemented but never activated.
- **Impact:** No IP-based access control. If deployed, any IP can reach all
 endpoints.
- **Requirement:** FR-72
- **Acceptance:** `main.py` mounts `IPAllowlistMiddleware`; blocked IPs get 403;
 health/auth bypass paths work.
- **Priority:** P0 — defense-in-depth.
- **Owner:** Security Architect.
- **Fix effort:** Small (add import + 1 line).

### GAP-03: RLS on 4 of 13 tenant_id tables only

- **Finding:** `migrations/0005_rls.py` covers only `memories`, `events`,
 `usage_records`, `api_keys`. However, 13 tables have `tenant_id` columns
 (users, api_keys, connectors, memories, agents, agent_executions,
 approval_request, events, subscriptions, webhooks, usage_records,
 integrations, plugins). The other 9 tenant-scoped tables have no RLS policy.
- **Root cause:** RLS migration only covered a subset of tables.
- **Impact:** 9 tables rely solely on application-level filtering. A missed
 `WHERE tenant_id = ?` exposes cross-tenant data.
- **Requirement:** FR-73
- **Acceptance:** All 13 tables with `tenant_id` have RLS policies; coverage
 test counts match.
- **Priority:** P0 — data isolation.
- **Owner:** Security Architect / Data Architect.
- **Fix effort:** Medium (extend migration, verify each table).

### GAP-04: No SET app.tenant_id ever called

- **Finding:** `tenant.py:40-59` defines `set_rls_session_vars()` which executes
 `SET app.tenant_id = '{tenant_id}'`. This function is never called from any
 request path because `TenantMiddleware` is not mounted (GAP-01).
- **Root cause:** Depends on GAP-01 fix.
- **Impact:** Even if RLS policies exist, they receive NULL for
 `current_setting('app.tenant_id')` and will deny all rows.
- **Requirement:** FR-74
- **Acceptance:** `set_rls_session_vars()` called on every request; RLS policies
 receive correct tenant context.
- **Priority:** P0 — blocks RLS functionality.
- **Owner:** Security Architect.
- **Fix effort:** Small (resolved by fixing GAP-01).

### GAP-05: RBAC as DI helper, not middleware

- **Finding:** `apps/api/src/api/middleware/rbac.py` exports `require_role()`
 and `require_permission()` as FastAPI `Depends` factories (lines 29, 42).
 These are opt-in per-route, not globally enforced. Routes without explicit
 `Depends` bypass authorization.
- **Root cause:** Design choice — opt-in RBAC vs. global middleware.
- **Impact:** Any route without `Depends(require_role(...))` is unprotected. New
 routes may forget to add the dependency.
- **Requirement:** FR-75
- **Acceptance:** All non-public routes enforce authorization; audit of all 26
 routers confirms no unprotected endpoints that should require auth.
- **Priority:** P0 — authorization consistency.
- **Owner:** Security Architect.
- **Fix effort:** Medium (audit all routes, potentially add middleware layer).

### GAP-06: Prometheus /metrics COMMENTED OUT

- **Finding:** `apps/api/src/api/main.py:135` has
 `# Instrumentator().instrument(app).expose(app, endpoint="/metrics")`
 commented out.
- **Root cause:** Disabled during development or CI.
- **Impact:** `/metrics` endpoint does not exist. No Prometheus scraping.
 Monitoring stack has no data source.
- **Requirement:** FR-76
- **Acceptance:** `/metrics` returns Prometheus-format metrics; Instrumentator
 active; scrape target works.
- **Priority:** P1 — observability.
- **Owner:** Platform / Observability.
- **Fix effort:** Small (uncomment + verify).

### GAP-07: OTel FastAPI auto-instrumentation COMMENTED OUT

- **Finding:** `apps/api/src/api/main.py:136` has `# instrumement_fastapi(app)`
 (note: typo in source) commented out.
- **Root cause:** Disabled during development.
- **Impact:** No OTel spans for FastAPI requests. Trace context not propagated.
 `packages/observability` is installed but not wired.
- **Requirement:** FR-77
- **Acceptance:** `instrument_fastapi(app)` active; OTel spans created per
 request; trace context propagated to external services.
- **Priority:** P1 — observability.
- **Owner:** Platform / Observability.
- **Fix effort:** Small (uncomment + verify).

### GAP-08: SAML — no signature validation

- **Finding:** `apps/api/src/api/services/saml.py` (98 lines) implements
 `SAMLProvider` that parses XML assertions (issuer, NotBefore/NotOnOrAfter,
 audience) but has no signature validation. Line 58:
 `# TODO: Add real SAML signature validation when library configured`. Also, no
 router wires this to any auth flow — effectively dead code.
- **Root cause:** Partial implementation; SSO is enterprise-scope (OUT_OF_SCOPE
 for MVP per AGENTS.md).
- **Impact:** SAML assertions could be forged. However, SSO is explicitly
 OUT_OF_SCOPE for MVP (NG-01).
- **Requirement:** FR-78
- **Acceptance:** SAML signature validation implemented; unsigned assertions
 rejected; wired to auth flow.
- **Priority:** P2 — enterprise scope, not MVP-critical.
- **Owner:** Security Architect.
- **Fix effort:** Medium (library integration + test).

### GAP-09: 3 frontend pages use hardcoded mock data

- **Finding:**
 - `apps/web/src/app/workspace/[workspaceId]/billing/page.tsx` — hardcoded
 `plans` and `invoices` arrays, no API calls.
 - `apps/web/src/app/workspace/[workspaceId]/admin/page.tsx` — hardcoded
 `mockUsers`, `mockServices`, `mockAuditLog`.
 - `apps/web/src/app/workspace/[workspaceId]/marketplace/page.tsx` — hardcoded
 `allPlugins` array.
- **Root cause:** Pages built before backend APIs were ready.
- **Impact:** These pages show fake data. Billing and admin are enterprise
 features (OUT_OF_SCOPE for MVP). Marketplace is OUT_OF_SCOPE.
- **Requirement:** FR-79
- **Acceptance:** Each mock-data page either connects to real API or is
 explicitly documented as T2/T3 scope with no runtime claim.
- **Priority:** P1 — honesty in documentation (billing/admin/marketplace are
 enterprise, so mock data is acceptable if documented).
- **Owner:** Frontend Lead / Product.
- **Fix effort:** Small (document scope; or wire to API if MVP-critical).

### GAP-10: 5 testing/ directories EMPTY

- **Finding:** `testing/smoke/`, `testing/security/`, `testing/chaos/`,
 `testing/fuzz/`, `testing/visual-regression/` have 0 files each.
- **Root cause:** Test infrastructure scaffolded but not populated.
- **Impact:** No smoke tests, no chaos tests, no fuzz tests, no visual
 regression tests. Security tests exist only in `apps/api/tests/security/`.
- **Requirement:** FR-80
- **Acceptance:** Each testing/ subdir has at least 1 test file; tests pass in
 CI.
- **Priority:** P1 — test maturity.
- **Owner:** QA Lead.
- **Fix effort:** Medium (write initial tests for each category).

### GAP-11: Workload identity = design-only

- **Finding:** ADR-025 status is "PROPOSED — design-only, GAP". No
 `service_token`, `service-token`, or `X-Service-*` headers in the codebase.
 Zero grep hits.
- **Root cause:** Not yet implemented; design documented in ADR-025.
- **Impact:** Workers and service-to-service calls have no machine identity.
 Currently using shared secrets or user creds (NFR-16 violation).
- **Requirement:** FR-81
- **Acceptance:** Workers carry service tokens; no user creds in service
 context; HMAC or bearer verified.
- **Priority:** P1 — security architecture.
- **Owner:** Security Architect.
- **Fix effort:** High (new auth infrastructure).

### GAP-12: 23 tables missing tenant_id

- **Finding:** 13 of 36 tables have `tenant_id`. 23 tables lack it, including
 critical ones: `workspaces`, `workspace_users`, `documents`, `memory_records`,
 `entities`, `relationships`, `embeddings`, `resumes`, `applications`,
 `schedule_events`.
- **Root cause:** Multi-tenancy added incrementally; not all tables migrated.
- **Impact:** Tables without `tenant_id` cannot use RLS or app-level filtering.
 Cross-tenant data exposure risk.
- **Requirement:** FR-82
- **Acceptance:** All tables storing user/workspace data have `tenant_id` or
 documented exemption with alternative isolation.
- **Priority:** P0 — data isolation completeness.
- **Owner:** Data Architect / Security Architect.
- **Fix effort:** High (schema migration + data backfill + query updates).

### GAP-13: packages/contracts doesn't exist

- **Finding:** No `packages/contracts` directory. Shared types live at
 `packages/shared-types/src/types/` (10 files: agent.ts, api.ts, auth-dto.ts,
 auth.ts, connector.ts, domain.ts, event.ts, memory.ts, tenant.ts,
 workspace.ts).
- **Root cause:** Different naming convention than prompt references.
- **Impact:** Minimal — shared types exist, just not at the expected path. The
 prompt's `packages/contracts` reference is a documentation artifact.
- **Requirement:** FR-83
- **Acceptance:** Typed API contracts available to frontend and backend;
 `packages/shared-types` or equivalent provides the contract.
- **Priority:** P0 — already IMPLEMENTED (types exist), but UNVERIFIED that
 frontend actually imports from shared-types.
- **Owner:** Architecture.
- **Fix effort:** Small (verify import paths).

### GAP-14: ui-kit has only 5 components

- **Finding:** `packages/ui-kit/src/components/` contains 5 components:
 `Button.tsx`, `Card.tsx`, `Input.tsx`, `Modal.tsx`, `Spinner.tsx`.
- **Root cause:** Minimal component library; most UI built with raw Tailwind.
- **Impact:** No standardized tables, forms, navigation, data display
 components. Each page reinvents patterns.
- **Requirement:** FR-84
- **Acceptance:** ui-kit covers all MVP page needs; components used consistently
 across pages.
- **Priority:** P1 — design consistency.
- **Owner:** Frontend Lead / UX.
- **Fix effort:** Medium (design system expansion).

### GAP-15: Makefile references phantom microservices

- **Finding:** Makefile targets reference packages that don't exist:
 `@vaeloom/memory-store`, `@vaeloom/auth-service`, `@vaeloom/agent-engine`,
 `@vaeloom/notification-service`, `@vaeloom/search-service`,
 `@vaeloom/recommendation-service`, `@vaeloom/event-bus`,
 `@vaeloom/rbac-service`, `@vaeloom/document-ingestion`,
 `@vaeloom/audit-service`.
- **Root cause:** Makefile written for planned microservices architecture that
 was never built; unified FastAPI monolith was built instead.
- **Impact:** `make` commands referencing these packages will fail. Developers
 following Makefile instructions get errors.
- **Requirement:** FR-85
- **Acceptance:** All `make` targets reference existing packages; no phantom
 references; `make` commands work.
- **Priority:** P0 — developer experience broken.
- **Owner:** Platform.
- **Fix effort:** Small (update Makefile targets).

## Summary

| Priority | Count | Requirements |
| ---------------- | ----- | ----------------------------------------------- |
| P0 | 7 | FR-71, FR-72, FR-73, FR-74, FR-75, FR-82, FR-85 |
| P1 | 6 | FR-76, FR-77, FR-79, FR-80, FR-81, FR-84 |
| P2 | 1 | FR-78 |
| P0 (implemented) | 1 | FR-83 (shared-types exist, unverified import) |

## Risk implications

These gaps mean the previous P03 gate score of 89.7/100 was based on
requirements that assumed design-only status. With honest implementation status:

- **7 P0 requirements are NOT_IMPLEMENTED or PARTIAL** — these block MVP release
 if not fixed.
- **Tenant isolation (NFR-15)** is the most critical gap — without mounted
 TenantMiddleware + full RLS, the system has NO database-level tenant
 isolation.
- **The gate score should be recalculated** (see `09-gate-*.md` upgrade).
