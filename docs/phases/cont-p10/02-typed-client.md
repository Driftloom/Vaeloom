# CONT-P10 — 02 Typed Client & State

**Deliverable:** `DEL-CONT-P10-02` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Frontend Architect

## Contracts

| Artifact | File | Check |
|----------|------|-------|
| `shared-types` | `packages/shared-types/src/*` | `Workspace Memory Agent Event Connector KnowledgeGraphNode` etc single truth |
| `api.ts` `api-client.ts` | `apps/web/src/lib/api.ts:18` `API_BASE` `API_PREFIX /api/v1` + `transformKeys snake→camel` `api.ts:27` + `ApiError` `api.ts:60` | `pnpm --filter web typecheck` 0 errors |
| `auth` | `api.ts:60` `ApiError 401` refreshQueue `api.ts:73` | `POST /auth/refresh` `api.ts:94` + CSRF `getCsrfToken()` `csrf.ts:22` |
| `consent/gdpr/approval` | `api-client.ts:1152` `consentApi.grant/revoke/me/scopes` + `gdprApi` `approvalApi` `api-client.ts:1202` | `POST /consent/grant {scope}` `GET /consent/me` `GET /approvals` |

## State / Query

- `useSWR` for all workspace reads (`admin/page.tsx:84` `iamApi.listUsers` etc) with `revalidateOnFocus false` + fallback mock when `enterprise_routes_enabled=false`.
- `request()` `api.ts:113` injects `Authorization Bearer` + `X-Request-ID uuid` `api.ts:118` + `X-CSRF-Token` on mutating `isMutatingMethod` `csrf.ts:8`.

## Drift Guard

- `scripts/docs_audit_phase10.py` regenerates `openapi.yaml` `110 paths` from routers; `shared-types` + `api-client` must match `openapi.yaml:5` `openapi:3.1.0` `version:0.2.0`. CI fails on drift (migration control plane future).

---
_Version 1.0 2026-08-31 — `rg "transformKeys" apps/web/src/lib/api.ts 27`._
