# CONT-P08 — 01 OpenAPI

**Deliverable:** `DEL-CONT-P08-01` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Commit:** `e255d63`+`cont-p08` | **Owners:** API Architect

## Resources & Operations

| Resource                   | Operations                                          | Schema                          | Pagination           | Concurrency        | Example                                                                |
| -------------------------- | --------------------------------------------------- | ------------------------------- | -------------------- | ------------------ | ---------------------------------------------------------------------- |
| `/workspaces/{id}`         | `GET, POST, PATCH`                                  | `Workspace` `name min_length 1` | `page, page_size 25` | `If-Match`         | `GET /workspaces/{id}` → `200 {id, name, tenant_id}`                   |
| `/memories`                | `POST /memories/search` `GET /memories/{id}`        | `Memory` `type 6→22` additive   | `limit 20`           | —                  | `POST /memories/search {query, workspace_id}` → `200 [{id, memory}]`   |
| `/temporal/workflows/{id}` | `GET status` `POST cancel` `POST signal/{decision}` | `TemporalWorkflowStatus`        | —                    | `REJECT_DUPLICATE` | `POST /temporal/workflows/durable-agent` → `202 {workflow_id, run_id}` |

**Source of truth:** `docs/backend/openapi.yaml` `openapi:3.1.0` `version:0.2.0`
`110 paths` generated from `api/routers 27` via `scripts/docs_audit_phase10.py`,
`transformKeys` `snake↔camel` `api-client.ts`.

## Errors & Idempotency

- Errors `RFC 7807` `problem+json` `400/401/403/404/409/422/500` with
  `code, message, traceId`.
- Pagination `Link` header + `page, page_size` + `X-Total-Count`.
- Concurrency `If-Match` `ETag` on `PATCH /workspaces/{id}`.
- Idempotency `Idempotency-Key: sha256(ws:req:tool:params)`
  `UNIQUE(workspace_id,idempotency_key)` `models/schema.py:648` — `409` on
  duplicate.

---

_Version 1.0 2026-08-29 — `rg "^  /" openapi.yaml 110`._
