# CONT-P11 — 01 Backend Services — Domain Boundaries

**Deliverable:** `DEL-CONT-P11-01` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Backend Architect

## Monolith → Services (strangler `ADR-043` — no extraction yet, boundaries enforced)

| Domain | Routers | Services | State |
|--------|---------|----------|-------|
| **Identity/Policy** | `auth.py: login/signup/refresh/me/sso` + `iam.py` + `middleware/auth.py` `TenantMiddleware` `rbac.py` | `auth_service.py` `api_keys.py` | `JWT 32+` `validate_settings()` `config.py:181` + `42/42 RLS` `TenantMiddleware` sets `app.workspace_id/user_id` |
| **Memory/Knowledge** | `memory.py` `knowledge_graph.py` `resumes.py` | `memory_service.py` `document_service.py` `ingestion/parsers.py 17` | `parsers 17` F-40 additive, no schema break 6→22 memory types additive only |
| **Agents/Jobs/Events** | `agents.py` `chat.py` `events.py` `scheduler.py` `temporal.py` `connectors.py` `integrations.py` | `agent_service.py` `event_service.py` `connector_ext_service.py` `browser_service.py` | `Temporal 8 queues` `temporal/client.py` fail-closed `ZT-01` + `agent_circuit 3/30s` |
| **Admin/Audit/Rights** | `admin_console.py` `audit.py` `workspaces.py` `notifications.py` `billing.py` `gdpr` `consent` `approval` | `audit_service.py` `consent.py` `erasure_service.py` `approval.py` | `consent/gdpr 31` `approval gated` `admin gated enterprise_routes_enabled=false` `main.py:363` |

**Boundary rule:** `main.py:328` `_safe_include(router, prefix, tags)` — one misbehaving router never blocks boot (FINDING-024). All routers share `engine` + `async_session_factory` + `IdempotencyMiddleware` `BodySizeLimit 25MB` `RateLimit` — no per-domain DB yet (extraction `CONT-P11` design only, runtime stays monolith with logical modules).

## Version

- Services `v1.0` frozen this phase; extraction to `K8s Service` only per `ADR-043` strangler when `metric: p95>200ms` *and* owner `SRE` approves. No new `deploy.yml` job this phase.

---
_Version 1.0 2026-08-31 — `rg "_safe_include" apps/api/src/api/main.py 328`._
