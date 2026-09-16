# API Reference

> **Purpose:** Complete endpoint reference for the Vaeloom API, generated from
> code truth **Status:** Complete **Owner:** Backend Team **Version:** 0.2.0
> **Last Updated:** 2026-09-15 **Canonical source:**
> [`./openapi.yaml`](./openapi.yaml) — **162 paths / 203 operations**,
> regenerated 2026-09-15 via `scripts/gen_openapi.py`

## Base URLs

| Environment           | Base URL                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| Local dev             | `http://localhost:8000`                                                  |
| API prefix            | `/api/v1` (all resource routers)                                         |
| Top-level (no prefix) | `/health`, `/health/ready`, `/health/startup`, `/metrics`, `/csrf-token` |

Full machine-readable spec: [`./openapi.yaml`](./openapi.yaml). Interactive docs
(local): `http://localhost:8000/docs` (Swagger UI).

## OpenAPI Sync Note

`openapi.yaml` is **generated, not hand-written**. After adding, removing, or
changing any route in `apps/api/src/api/routers/` or `apps/api/src/api/main.py`:

1. Regen: `python scripts/gen_openapi.py` (sets mock env vars internally; safe
   to run offline)
2. Verify: 162 paths expected — count `^  /` path keys in `openapi.yaml`
3. Update this file: add/remove the endpoint row in the matching router table
   below and bump the counts in the header

See [API-Overview.md](./API-Overview.md) and
[Local-Development.md](./Local-Development.md) for the full workflow.

## Authentication

All `/api/v1/*` endpoints require a Bearer JWT except the public paths below:

```http
Authorization: Bearer <access_token>
```

| Token                     | Lifetime                  | Notes                                             |
| ------------------------- | ------------------------- | ------------------------------------------------- |
| Access token (JWT, HS256) | 1h (`jwt_token_ttl=3600`) | `Authorization: Bearer` header or httpOnly cookie |
| Refresh token             | 30d                       | Rotated on each use                               |
| API key                   | Configurable              | `Authorization: Bearer <key>`, scoped             |

Public paths (no JWT): `/health`, `/health/ready`, `/health/startup`,
`/metrics`, `/csrf-token`, `/api/v1/auth/*`, `/api/v1/gmail/webhook`
(`middleware/auth.py` `PUBLIC_PATHS`, `middleware/csrf.py` `SKIP_PATHS` /
`SKIP_PREFIXES`).

## CSRF

Mutating requests (non-GET/HEAD/OPTIONS) require CSRF except under
`/api/v1/auth` and `/scim` (`SKIP_PREFIXES`) and the `SKIP_PATHS` list above.

1. `GET /csrf-token` → returns `{"csrf_token": ...}` + sets `csrf_token` cookie
   (`SameSite=Lax`, readable by the SPA for double-submit)
2. Send it back as `X-CSRF-Token` header on POST/PUT/PATCH/DELETE
3. Missing/invalid token → `403`

Frontend detail: `middleware.ts` + `next.config.js` `connect-src` must allow
`http://localhost:8000` in development or API calls are blocked client-side.

## Rate Limiting

Sliding-window limiter, per-endpoint decorator, `Retry-After` header on 429.
Local override: `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW`
(`RATE_LIMIT_REDIS_URL`, Redis DB 1 for distributed limits). See
[Rate-Limiting.md](./Rate-Limiting.md).

## Compile / Durability 503s (fail-closed, by design)

| Status                                                                          | When                                   | Fix                                                                       |
| ------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `503` from `POST .../compile`, `/compile-typst`, `/cover-letter`, `/cheatsheet` | Playwright Chromium not installed      | `uv run --project apps/api playwright install chromium` (one-time, local) |
| `503` from `/temporal/*` durable runs                                           | Temporal down but durability requested | Start Temporal or use the non-durable endpoint; never silently falls back |

## Health / Metrics / CSRF (top-level, no prefix)

| Method | Path                                 | Description               |
| ------ | ------------------------------------ | ------------------------- |
| GET    | `/health`                            | Liveness                  |
| GET    | `/health/ready`                      | Readiness (DB + deps)     |
| GET    | `/health/startup`                    | Startup probe             |
| GET    | `/metrics`                           | Prometheus metrics        |
| GET    | `/csrf-token`                        | Issue CSRF token + cookie |
| GET    | `/api/v1/security/encryption-status` | Encryption/key status     |

## Auth (`/api/v1/auth`, CSRF-exempt)

| Method | Path                                   | Description                       |
| ------ | -------------------------------------- | --------------------------------- |
| POST   | `/api/v1/auth/signup`                  | Sign up (email/password)          |
| POST   | `/api/v1/auth/login`                   | Login, issue tokens               |
| POST   | `/api/v1/auth/refresh`                 | Rotate refresh → new access token |
| POST   | `/api/v1/auth/logout`                  | Invalidate session                |
| GET    | `/api/v1/auth/me`                      | Current user                      |
| GET    | `/api/v1/auth/sso/{provider}`          | SSO login redirect                |
| POST   | `/api/v1/auth/sso/{provider}`          | SSO token login                   |
| GET    | `/api/v1/auth/sso/{provider}/callback` | SSO callback                      |
| POST   | `/api/v1/auth/saml/callback`           | SAML callback                     |

## Workspaces (`/api/v1/workspaces`, 10 paths)

| Method               | Path                                                                      | Description                |
| -------------------- | ------------------------------------------------------------------------- | -------------------------- |
| GET / POST           | `/api/v1/workspaces`                                                      | List / create workspaces   |
| GET / PATCH / DELETE | `/api/v1/workspaces/{workspace_id}`                                       | Get / update / delete      |
| GET                  | `/api/v1/workspaces/{workspace_id}/agents`                                | Workspace agents           |
| GET                  | `/api/v1/workspaces/{workspace_id}/agent-actions`                         | Agent action audit         |
| GET                  | `/api/v1/workspaces/{workspace_id}/document-actions`                      | Document action audit      |
| GET                  | `/api/v1/workspaces/{workspace_id}/memories`                              | Workspace memories         |
| GET                  | `/api/v1/workspaces/{workspace_id}/connectors`                            | Workspace connectors       |
| GET / POST           | `/api/v1/workspaces/{workspace_id}/applications`                          | List / create applications |
| GET                  | `/api/v1/workspaces/{workspace_id}/applications/{application_id}`         | Get application            |
| PATCH                | `/api/v1/workspaces/{workspace_id}/applications/{application_id}/outcome` | Record outcome             |

## Memories (`/api/v1/memories`, 7 paths)

| Method             | Path                                   | Description           |
| ------------------ | -------------------------------------- | --------------------- |
| GET / POST         | `/api/v1/memories`                     | List / create         |
| GET                | `/api/v1/memories/feed`                | Activity feed         |
| POST               | `/api/v1/memories/search`              | Semantic search       |
| GET / PUT / DELETE | `/api/v1/memories/{memory_id}`         | Get / update / delete |
| GET                | `/api/v1/memories/{memory_id}/chunks`  | Chunks                |
| GET                | `/api/v1/memories/{memory_id}/history` | Version history       |
| GET                | `/api/v1/memories/{memory_id}/lineage` | Provenance lineage    |

## Agents (`/api/v1/agents`, 10 paths)

| Method             | Path                                          | Description                                                              |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------ |
| GET / POST         | `/api/v1/agents`                              | List / create agents                                                     |
| GET                | `/api/v1/agents/catalog`                      | Agent catalog                                                            |
| POST               | `/api/v1/agents/chat`                         | Chat (non-streaming)                                                     |
| POST               | `/api/v1/agents/chat/stream`                  | Chat (SSE stream; ReAct tool-calling opt-in via `AGENT_REACT_ENABLED=1`) |
| GET / PUT / DELETE | `/api/v1/agents/{agent_id}`                   | Get / update / delete                                                    |
| POST               | `/api/v1/agents/{agent_id}/execute`           | Execute (legacy)                                                         |
| POST               | `/api/v1/agents/{agent_id}/run`               | Run agent                                                                |
| GET                | `/api/v1/agents/{agent_id}/executions`        | Execution history                                                        |
| POST               | `/api/v1/agents/{agent_id}/schedule`          | Schedule agent                                                           |
| POST               | `/api/v1/agents/runs/{request_id}/cancel`     | Cancel run                                                               |
| POST               | `/api/v1/chat/workspaces/{workspace_id}/chat` | Workspace chat                                                           |
| GET                | `/api/v1/admin/agents/usage`                  | Usage report                                                             |
| GET / PUT / DELETE | `/api/v1/admin/agents/usage/budgets`          | Budget CRUD                                                              |
| GET                | `/api/v1/admin/agents/usage/costs`            | Cost report                                                              |

## Documents (`/api/v1/documents`, 7 paths)

| Method     | Path                                         | Description      |
| ---------- | -------------------------------------------- | ---------------- |
| GET / POST | `/api/v1/documents`                          | List / upload    |
| PATCH      | `/api/v1/documents/{document_id}`            | Update metadata  |
| GET        | `/api/v1/documents/{document_id}/content`    | Download content |
| GET        | `/api/v1/documents/{document_id}/actions`    | Action history   |
| POST       | `/api/v1/documents/actions/{action_id}/undo` | Undo action      |
| POST       | `/api/v1/documents/{document_id}/archive`    | Archive          |
| POST       | `/api/v1/documents/{document_id}/restore`    | Restore          |

## Resumes (`/api/v1/resumes`, 13 paths)

| Method    | Path                                               | Description                                                         |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| GET       | `/api/v1/resumes`                                  | List resumes                                                        |
| GET       | `/api/v1/resumes/master`                           | Master resume                                                       |
| GET       | `/api/v1/resumes/templates`                        | 5 industry templates (`resume_templates.py`)                        |
| POST      | `/api/v1/resumes/{resume_id}/generate`             | Generate resume                                                     |
| POST      | `/api/v1/resumes/{resume_id}/tailor`               | AI-tailor to job description                                        |
| GET / PUT | `/api/v1/resumes/{resume_id}/source`               | Get / update source JSON                                            |
| POST      | `/api/v1/resumes/{resume_id}/compile`              | Compile PDF/DOCX/HTML (`document_builder.py`; 503 without Chromium) |
| POST      | `/api/v1/resumes/{resume_id}/compile-typst`        | Compile via Typst                                                   |
| POST      | `/api/v1/resumes/{resume_id}/cover-letter`         | Generate cover letter                                               |
| POST      | `/api/v1/resumes/{resume_id}/cheatsheet`           | Interview cheatsheet                                                |
| POST      | `/api/v1/resumes/{resume_id}/ai/inline`            | Inline AI edit                                                      |
| GET       | `/api/v1/resumes/{resume_id}/artifacts`            | List compiled artifacts (`resume_artifacts`, migration 0023)        |
| GET       | `/api/v1/resumes/artifacts/{artifact_id}/download` | Download artifact bytes                                             |

## Connectors (`/api/v1/connectors`, 9 paths incl. 4 MCP)

| Method             | Path                                                  | Description                                                                              |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET / POST         | `/api/v1/connectors`                                  | List / register (incl. `mcp`-type servers)                                               |
| GET / PUT / DELETE | `/api/v1/connectors/{connector_id}`                   | Get / update / disconnect                                                                |
| POST               | `/api/v1/connectors/{connector_id}/sync`              | Trigger sync                                                                             |
| GET                | `/api/v1/connectors/{connector_id}/sync/status`       | Sync status                                                                              |
| POST               | `/api/v1/connectors/{connector_id}/test`              | Test connection (mock-safe)                                                              |
| GET                | `/api/v1/connectors/{connector_id}/mcp/tools`         | List bridged tools (`mcp__<Server>__<Tool>`, 300s discovery TTL)                         |
| POST               | `/api/v1/connectors/{connector_id}/mcp/tools/refresh` | Force re-discovery                                                                       |
| POST               | `/api/v1/connectors/{connector_id}/mcp/sync`          | Re-sync tool bridge                                                                      |
| POST               | `/api/v1/connectors/{connector_id}/mcp/call`          | Call MCP tool (scope `connector.mcp.execute`, 30s timeout; non-readOnly → approval gate) |
| GET / POST         | `/api/v1/integrations`                                | List / create (legacy)                                                                   |
| PUT / DELETE       | `/api/v1/integrations/{integration_id}`               | Update / delete                                                                          |
| POST               | `/api/v1/integrations/{integration_id}/sync`          | Sync (legacy)                                                                            |

See [Connectors.md](./Connectors.md) for the MCP-bridge section and
`docs/mcp/servers/seed-configs.md` for seed server configs.

## Provider Keys (`/api/v1/provider-keys`, 4 paths)

| Method         | Path                                      | Description                       |
| -------------- | ----------------------------------------- | --------------------------------- |
| GET / POST     | `/api/v1/provider-keys`                   | List / store BYOK key (encrypted) |
| GET            | `/api/v1/provider-keys/effective`         | Effective key resolution          |
| PATCH / DELETE | `/api/v1/provider-keys/{key_id}`          | Update / delete                   |
| POST           | `/api/v1/provider-keys/{key_id}/validate` | Validate key                      |

## Temporal (`/api/v1/temporal`, 6 paths)

| Method | Path                                                            | Description                   |
| ------ | --------------------------------------------------------------- | ----------------------------- |
| POST   | `/api/v1/temporal/workflows/ingest`                             | Start ingest workflow         |
| POST   | `/api/v1/temporal/workflows/connector-sync`                     | Start connector-sync workflow |
| POST   | `/api/v1/temporal/workflows/durable-agent`                      | Start durable agent run       |
| GET    | `/api/v1/temporal/workflows/{workflow_id}`                      | Workflow status               |
| POST   | `/api/v1/temporal/workflows/{workflow_id}/cancel`               | Cancel workflow               |
| POST   | `/api/v1/temporal/workflows/{workflow_id}/signal/{signal_name}` | Signal workflow               |

Disabled locally by default (`TEMPORAL_ENABLED=false`).

## Sovereignty (`/api/v1/sovereignty`, 8 paths)

| Method | Path                                               | Description                 |
| ------ | -------------------------------------------------- | --------------------------- |
| GET    | `/api/v1/sovereignty/identity`                     | Sovereign identity          |
| GET    | `/api/v1/sovereignty/credentials`                  | List credentials            |
| GET    | `/api/v1/sovereignty/credentials/{credential_id}`  | Get credential              |
| POST   | `/api/v1/sovereignty/credentials/issue/capability` | Issue capability credential |
| POST   | `/api/v1/sovereignty/credentials/issue/audit`      | Issue audit credential      |
| POST   | `/api/v1/sovereignty/credentials/verify`           | Verify credential           |
| GET    | `/api/v1/sovereignty/sync/pull`                    | Pull CRDT deltas            |
| POST   | `/api/v1/sovereignty/sync/push`                    | Push CRDT deltas            |

## Cognition (`/api/v1/cognition`, 6 paths)

| Method       | Path                                      | Description               |
| ------------ | ----------------------------------------- | ------------------------- |
| GET          | `/api/v1/cognition/briefing/today`        | Morning briefing          |
| POST         | `/api/v1/cognition/overnight/run`         | Trigger overnight cycle   |
| GET          | `/api/v1/cognition/reality-gap`           | Reality-gap report        |
| GET / POST   | `/api/v1/cognition/scale/nodes`           | List / create scale nodes |
| GET / DELETE | `/api/v1/cognition/scale/nodes/{node_id}` | Get / delete scale node   |
| POST         | `/api/v1/cognition/scale/rollup`          | Execute rollup            |

## Council (`/api/v1/council`, 3 paths)

| Method | Path                                   | Description        |
| ------ | -------------------------------------- | ------------------ |
| POST   | `/api/v1/council/triage`               | Triage artifact    |
| POST   | `/api/v1/council/review`               | Review artifact    |
| POST   | `/api/v1/council/evaluate-and-certify` | Evaluate + certify |

## Anticipation (`/api/v1/anticipation`, 4 paths)

| Method | Path                                                   | Description               |
| ------ | ------------------------------------------------------ | ------------------------- |
| POST   | `/api/v1/anticipation/scan`                            | Scan + generate proposals |
| GET    | `/api/v1/anticipation/proposals`                       | List proposals            |
| POST   | `/api/v1/anticipation/proposals/{proposal_id}/accept`  | Accept                    |
| POST   | `/api/v1/anticipation/proposals/{proposal_id}/dismiss` | Dismiss                   |

## Federation (`/api/v1/federation`, 1 path)

| Method | Path                          | Description            |
| ------ | ----------------------------- | ---------------------- |
| POST   | `/api/v1/federation/dispatch` | Dispatch federated run |

## Profile (`/api/v1/profile`, 15 paths)

| Method       | Path                                  | Description                |
| ------------ | ------------------------------------- | -------------------------- |
| GET / PUT    | `/api/v1/profile`                     | Get / update own profile   |
| GET          | `/api/v1/profile/activity`            | Activity                   |
| GET          | `/api/v1/profile/completeness`        | Completeness score         |
| GET          | `/api/v1/profile/ats-readiness`       | ATS readiness              |
| POST         | `/api/v1/profile/auto-populate`       | Auto-populate from sources |
| POST         | `/api/v1/profile/avatar`              | Upload avatar (5MB max)    |
| GET          | `/api/v1/profile/avatar/{user_id}`    | Get avatar                 |
| POST         | `/api/v1/profile/career`              | Add career entry           |
| PUT / DELETE | `/api/v1/profile/career/{company}`    | Update / delete entry      |
| PUT          | `/api/v1/profile/preferences`         | Update preferences         |
| GET          | `/api/v1/profile/public/{user_id}`    | Public profile             |
| GET          | `/api/v1/profile/recommendations`     | Recommendations            |
| POST         | `/api/v1/profile/skills`              | Add skill                  |
| POST         | `/api/v1/profile/skills/confirm`      | Confirm skill              |
| DELETE       | `/api/v1/profile/skills/{skill_name}` | Remove skill               |

## Opportunities (`/api/v1/opportunities`, 2 paths)

| Method | Path                          | Description              |
| ------ | ----------------------------- | ------------------------ |
| POST   | `/api/v1/opportunities/match` | Match single opportunity |
| POST   | `/api/v1/opportunities/rank`  | Rank opportunities       |

## Gmail (`/api/v1/gmail`, 3 paths; webhook is CSRF-exempt + public)

| Method              | Path                    | Description                        |
| ------------------- | ----------------------- | ---------------------------------- |
| GET / POST          | `/api/v1/gmail/drafts`  | List / create drafts               |
| GET / POST / DELETE | `/api/v1/gmail/watch`   | Get / start / stop watch           |
| POST                | `/api/v1/gmail/webhook` | Push webhook (public, CSRF-exempt) |

## Consent + GDPR (`/api/v1/consent` 4 paths, `/api/v1/gdpr` 2 paths)

| Method | Path                             | Description      |
| ------ | -------------------------------- | ---------------- |
| GET    | `/api/v1/consent/scopes`         | List scopes      |
| POST   | `/api/v1/consent/grant`          | Grant consent    |
| GET    | `/api/v1/consent/me`             | My consents      |
| POST   | `/api/v1/consent/revoke/{scope}` | Revoke consent   |
| GET    | `/api/v1/gdpr/export`            | Export user data |
| POST   | `/api/v1/gdpr/delete`            | Delete user data |

## Scheduler (`/api/v1/scheduler`, 7 paths)

| Method               | Path                                         | Description                   |
| -------------------- | -------------------------------------------- | ----------------------------- |
| GET / POST           | `/api/v1/scheduler/events`                   | List / create schedule events |
| GET / POST           | `/api/v1/scheduler/jobs`                     | List / create jobs            |
| GET / PATCH / DELETE | `/api/v1/scheduler/jobs/{job_id}`            | Get / update / delete job     |
| GET                  | `/api/v1/scheduler/jobs/{job_id}/executions` | Execution history             |
| POST                 | `/api/v1/scheduler/jobs/{job_id}/pause`      | Pause                         |
| POST                 | `/api/v1/scheduler/jobs/{job_id}/resume`     | Resume                        |
| POST                 | `/api/v1/scheduler/jobs/{job_id}/trigger`    | Trigger now                   |

## Knowledge Graph (`/api/v1/knowledge-graph`, 7 paths)

| Method             | Path                                            | Description                |
| ------------------ | ----------------------------------------------- | -------------------------- |
| GET / POST         | `/api/v1/knowledge-graph/nodes`                 | List / create nodes        |
| GET / PUT / DELETE | `/api/v1/knowledge-graph/nodes/{node_id}`       | Get / update / delete node |
| GET / POST         | `/api/v1/knowledge-graph/nodes/{node_id}/edges` | List / create edges        |
| GET                | `/api/v1/knowledge-graph/edges`                 | List edges                 |
| DELETE             | `/api/v1/knowledge-graph/edges/{edge_id}`       | Delete edge                |
| GET                | `/api/v1/knowledge-graph/path`                  | Path query                 |
| POST               | `/api/v1/knowledge-graph/traverse`              | Traverse                   |

## Search / Events / Notifications / Approvals

| Method     | Path                                               | Description                 |
| ---------- | -------------------------------------------------- | --------------------------- |
| POST       | `/api/v1/search`                                   | Unified search              |
| GET / POST | `/api/v1/events`                                   | List / publish events       |
| GET / POST | `/api/v1/events/subscriptions`                     | List / create subscriptions |
| GET        | `/api/v1/notifications`                            | List notifications          |
| GET        | `/api/v1/notifications/{notification_id}`          | Get notification            |
| POST       | `/api/v1/notifications/send`                       | Send                        |
| POST       | `/api/v1/notifications/subscribe`                  | Subscribe                   |
| GET / POST | `/api/v1/notifications/templates`                  | List / create templates     |
| POST       | `/api/v1/notifications/webhooks/{notification_id}` | Webhook delivery            |
| GET / POST | `/api/v1/approvals`                                | List / request approval     |
| GET        | `/api/v1/approvals/{approval_id}`                  | Get approval                |
| POST       | `/api/v1/approvals/{approval_id}/approve`          | Approve                     |
| POST       | `/api/v1/approvals/{approval_id}/reject`           | Reject                      |

## Enterprise-Gated Routers (excluded by design)

Mounted only when `enterprise_routes_enabled=true` (default off in MVP builds,
`main.py`). Not in `openapi.yaml`:

| Router          | Prefix                    |
| --------------- | ------------------------- |
| billing         | `/api/v1/billing`         |
| plugins         | `/api/v1/plugins`         |
| analytics       | `/api/v1/analytics`       |
| audit           | `/api/v1/audit`           |
| iam             | `/api/v1/iam`             |
| recommendations | `/api/v1/recommendations` |
| webhooks        | `/api/v1/webhooks`        |
| admin_console   | (root, `/admin/*`)        |
| scim            | `/scim`                   |
| feature_flags   | `/api/v1/feature-flags`   |

## Errors

| Status | Code                            | Meaning                                   |
| ------ | ------------------------------- | ----------------------------------------- |
| 400    | `validation_error`              | Pydantic validation failed                |
| 401    | `unauthorized`                  | Missing/invalid/expired JWT               |
| 403    | `forbidden` / CSRF failure      | No scope, or missing `X-CSRF-Token`       |
| 404    | `not_found`                     | Unknown id / path                         |
| 409    | `conflict`                      | Duplicate / state conflict                |
| 422    | `unprocessable_entity`          | Business-rule violation                   |
| 429    | `rate_limit_exceeded`           | Slow down; honor `Retry-After`            |
| 503    | Chromium / Temporal unavailable | See Compile 503s above                    |
| 500    | `internal_error`                | Unexpected failure (`request_id` in body) |

All errors carry a `request_id` / `X-Request-ID` for log correlation.

## Related Documents

- [API Overview](./API-Overview.md) — index + sync workflow
- [API Architecture](./API-Architecture.md) — design principles
- [Authentication](./Authentication.md) — JWT/CSRF details
- [Rate Limiting](./Rate-Limiting.md) — limits
- [Connectors](./Connectors.md) — connector + MCP-bridge details
- [Local Development](./Local-Development.md) — running the API locally

> _Last verified: 2026-09-15 — 162 paths / 203 ops from `openapi.yaml` (regen
> `scripts/gen_openapi.py`)._
