# Vaeloom API Reference

Base URL: `https://api.vaeloom.dev` (production) or `http://localhost:8000`
(local)

Version: `0.2.0` — **284 paths / 351 operations** (live, 2026-10-03)

- **Machine-readable contract (SPEC):**
  [`specs/api/openapi.yaml`](../specs/api/openapi.yaml) (regen via
  `scripts/gen_openapi.py`)
- **Authoritative endpoint specification:**
  [`specs/api/API-Reference.md`](../specs/api/API-Reference.md)
- **REST standards & error envelopes:**
  [`specs/api/REST-Standards.md`](../specs/api/REST-Standards.md),
  [`specs/api/Error-Standards.md`](../specs/api/Error-Standards.md)

> 10 enterprise-gated routers are excluded from this reference unless
> `enterprise_routes_enabled` — by design, not missing coverage.

## Authentication

All API endpoints require authentication **except** the public paths `/health`,
`/health/ready`, `/health/startup`, `/metrics`, `/csrf-token`, and
`/api/v1/auth/signup`, `/api/v1/auth/login`.

### Bearer Token (JWT)

```
Authorization: Bearer <access_token>
```

Obtain a token via `POST /api/v1/auth/signup` or `POST /api/v1/auth/login`.

**Token format**: JSON Web Token (JWT) with claims:

- `sub` — user UUID
- `email` — user email
- `tenant_id` — tenant UUID (null for personal accounts)
- `iat` — issued at timestamp
- `exp` — expiry timestamp (1 hour for access tokens, 30 days for refresh
  tokens)

### API Key

```
Authorization: Bearer <api_key>
```

API keys can be created in the dashboard for programmatic access.

### SSO Token

```json
POST /api/v1/auth/sso/{provider}
{ "token": "<id_token_from_provider>" }
```

## API Versioning

The API is versioned via URL prefix: `/api/v1/`. Breaking changes will increment
the version (`/api/v2/`). Non-breaking additions (new fields, new endpoints) may
be added to the current version.

Current version: **v1**

## Endpoint Groups

### Health

| Method | Path              | Description                                |
| ------ | ----------------- | ------------------------------------------ |
| GET    | `/health`         | Liveness probe — returns `{"status":"ok"}` |
| GET    | `/health/ready`   | Readiness — checks DB + Redis connectivity |
| GET    | `/health/startup` | Startup — checks DB + Redis + Infisical    |
| GET    | `/metrics`        | Prometheus metrics                         |

### Auth

| Method | Path                                   | Description                             |
| ------ | -------------------------------------- | --------------------------------------- |
| POST   | `/api/v1/auth/signup`                  | Register with email + password          |
| POST   | `/api/v1/auth/login`                   | Log in, returns access + refresh tokens |
| GET    | `/api/v1/auth/me`                      | Get current user + workspaces           |
| POST   | `/api/v1/auth/refresh`                 | Refresh access token                    |
| POST   | `/api/v1/auth/sso/{provider}`          | SSO token login (google, microsoft)     |
| GET    | `/api/v1/auth/sso/{provider}`          | Get SSO authorization URL               |
| GET    | `/api/v1/auth/sso/{provider}/callback` | SSO OAuth callback                      |

### Workspaces

Workspaces are the top-level organizational unit. All resources (agents,
memories, documents, connectors) belong to a workspace.

| Method | Path                                 | Description                  |
| ------ | ------------------------------------ | ---------------------------- |
| POST   | `/api/v1/workspaces`                 | Create workspace             |
| GET    | `/api/v1/workspaces`                 | List user's workspaces       |
| GET    | `/api/v1/workspaces/{id}`            | Get workspace details        |
| PATCH  | `/api/v1/workspaces/{id}`            | Update workspace             |
| DELETE | `/api/v1/workspaces/{id}`            | Delete workspace             |
| GET    | `/api/v1/workspaces/{id}/agents`     | List agents in workspace     |
| GET    | `/api/v1/workspaces/{id}/memories`   | List memories in workspace   |
| GET    | `/api/v1/workspaces/{id}/connectors` | List connectors in workspace |

### Agents

Agents are AI workers with specific capabilities. Each agent has a system
prompt, tool list, and execution history.

| Method | Path                             | Description                            |
| ------ | -------------------------------- | -------------------------------------- |
| POST   | `/api/v1/agents`                 | Register a new agent                   |
| GET    | `/api/v1/agents`                 | List agents                            |
| GET    | `/api/v1/agents/{id}`            | Get agent details                      |
| PUT    | `/api/v1/agents/{id}`            | Update agent configuration             |
| DELETE | `/api/v1/agents/{id}`            | Deactivate agent                       |
| POST   | `/api/v1/agents/chat`            | Chat message (auto-routed to agent)    |
| POST   | `/api/v1/agents/{id}/execute`    | Execute agent (supports SSE streaming) |
| POST   | `/api/v1/agents/{id}/run`        | Quick-run with input                   |
| GET    | `/api/v1/agents/{id}/executions` | List execution history                 |
| POST   | `/api/v1/agents/{id}/schedule`   | Schedule recurring execution           |

**Streaming**: Set `?stream=true` on `POST /execute` to receive Server-Sent
Events (SSE). Each chunk is a JSON object with fields `content`, `tool_calls`,
`status`.

### Capabilities

Capabilities are the workspace's sovereign registry of skills, tools,
connectors, MCP servers, plugins, and agents. The skills subset is a
prompt-injection system: a skill is a markdown document that is fenced and
injected into a run's prompt layer when the workspace row is enabled, its
`required_scope` was granted, and the turn activates it. A skill is never
executable code.

| Method | Path                                        | Description                                                              |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/v1/capabilities`                      | List workspace capabilities (`category`, `include_catalog` query params) |
| POST   | `/api/v1/capabilities`                      | Create a persistent capability (201)                                     |
| GET    | `/api/v1/capabilities/catalog`              | Bundled skills catalog (`category=skill` by default)                     |
| GET    | `/api/v1/capabilities/tools/definitions`    | Canonical tool definitions and their authorized `required_scope` values   |
| POST   | `/api/v1/capabilities/validate`             | Validate an unsaved draft; executes and persists nothing                  |
| GET    | `/api/v1/capabilities/{id}`                 | Get one capability                                                        |
| PATCH  | `/api/v1/capabilities/{id}`                 | Enable/disable or update a capability                                     |
| DELETE | `/api/v1/capabilities/{id}`                 | Delete a capability (204)                                                 |
| POST   | `/api/v1/capabilities/{id}/test`            | Real diagnostic; skill message-probes are dry runs                        |
| POST   | `/api/v1/capabilities/sync-github`          | Validate a remote library of `SKILL.md` files; never persists             |

`GET /api/v1/capabilities?include_catalog=true&category=skill` also returns
every bundled catalog skill the workspace has not installed, marked
`installed: false`, `enabled: false`, and with no `id`. The workspace row set
is capped at 500 rows; when the cap truncates the response the
`X-Capabilities-Truncated: true` and `X-Capabilities-Limit: 500` headers say
so explicitly. The catalog merge then operates on the returned (possibly
truncated) rows.

The literal routes `/catalog` and `/tools/definitions` are declared before
`/{cap_id}` so those names can never be resolved as capability IDs.

#### Skill author contract

`POST /api/v1/capabilities` takes the create envelope below. Category names
are singular in the API — `skill`, `tool`, `connector`, `mcp`, `plugin`,
`agent` — even though the UI labels the section "Skills".

```json
{
  "name": "weekly-review",
  "category": "skill",
  "description": "Summarize a week of career activity.",
  "version": "1.0.0",
  "author": "Workspace Member",
  "type": "custom",
  "runtime": "system",
  "config": {
    "markdown_doc": "## Mission\n...\n## Operating Rules\n1. ...\n## Triggers\nUse when ...\n## Output Contract\nReturn ...",
    "tags": ["career", "review"],
    "required_scope": "memory.read",
    "triggers": ["weekly review", "review my week"],
    "autonomy": "suggest",
    "trust_class": "community"
  }
}
```

Envelope fields:

| Field         | Required | Notes                                                                                          |
| ------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `name`        | yes      | The skill slug. Must match `^[a-zA-Z0-9_\-\. ]{1,255}$`; a duplicate in the same category is 409. Use lowercase and hyphens if the skill should be pinnable. |
| `category`    | yes      | `skill` for this contract. Unknown categories are 400.                                          |
| `description` | no       | Max 2000 characters. Defaults to `""`.                                                          |
| `version`     | no       | Max 50 characters. Defaults to `1.0.0`.                                                         |
| `author`      | no       | Max 255 characters. Defaults to `Workspace Member` (or the caller's name/email when available). |
| `type`        | no       | Max 50 characters. Defaults to `custom`.                                                        |
| `runtime`     | no       | Max 50 characters. Defaults to `system`.                                                        |
| `config`      | no       | Skill-specific fields below.                                                                     |

`config` fields:

| Field            | Notes                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `markdown_doc`   | The instruction document. Max 262,144 characters (256 KiB). A document beyond the cap is 400.                                       |
| `tags`           | Non-empty list of strings. Empty tags are a hard document-rule failure.                                                              |
| `required_scope` | One exact scope from `GET /api/v1/capabilities/tools/definitions`. A comma-separated list is not a granted scope and will not inject. Unknown scopes are 400. |
| `triggers`       | List of activation phrases. Empty means the skill is always eligible.                                                                 |
| `autonomy`       | One of `suggest`, `autonomous`, `approval_required`. Unknown values are 400.                                                         |
| `trust_class`    | One of `core_trusted`, `community`. Unknown values are 400. It is a label and ranking signal, not an injection gate.                 |
| `version`        | Optional per-skill override; falls back to the envelope `version`, then the catalog version.                                          |

Create validates size, scope membership, autonomy, and trust class, but
deliberately does not lint the skill document: `skill_injection` quarantines
and fences whatever text it receives, and a malformed document must remain
creatable so it can be diagnosed. Use `POST /api/v1/capabilities/validate` or
`POST /api/v1/capabilities/{id}/test` to catch document-rule failures before
relying on the skill.

##### Remote `SKILL.md` frontmatter

`POST /api/v1/capabilities/sync-github` parses remote `SKILL.md` files with
YAML frontmatter and returns a validated summary. The body after the second
`---` is the `markdown_doc`.

```yaml
---
name: weekly-review
description: Summarize a week of career activity.
tags: [career, review]
required_scope: memory.read
autonomy: suggest
trust_class: community
triggers:
  - weekly review
  - review my week
version: 1.0.0
author: Vaeloom Core Team
---
## Mission
...
## Operating Rules
1. ...
## Triggers
Use when ...
## Output Contract
Return ...
```

`name` is normalized to a lowercase slug with underscores replaced by
hyphens. The sweep rejects prohibited external domains, scopes outside the
tool vocabulary, and document-rule failures. It is validation-only:
`GitHubSkillSyncResult.persisted` is always `false`, and a candidate is
installed by POSTing it to `/api/v1/capabilities`. The endpoint is
owner-only, rate-limited to 5 requests/minute, walks at most 200 files per
sweep, and takes an optional `X-GitHub-Token` header for private
repositories. Unknown body fields are rejected with 422 rather than dropped.

##### Document rules

`validate_skill_document` evaluates these rules. `status` is `error` when any
hard rule fails, `warning` when only soft rules fail, and `success` only when
nothing failed. Catalog entries also run their declared self-check
(`numbered-operating-rules`, `triggers-echoed`, or `scope-cited`), which
reports soft violations.

| Rule                          | Severity | Requirement                                                        |
| ----------------------------- | -------- | ------------------------------------------------------------------ |
| `SKILL-DOC-PRESENT`           | hard     | `markdown_doc` is non-empty after trimming.                        |
| `SKILL-DOC-MISSION`           | hard     | Document has a `## Mission` section.                               |
| `SKILL-DOC-OPERATING-RULES`   | hard     | Document has a `## Operating Rules` section.                       |
| `SKILL-DOC-TRIGGERS`          | soft     | Document has a `## Triggers` section.                              |
| `SKILL-DOC-OUTPUT-CONTRACT`   | soft     | Document has a `## Output Contract` section.                       |
| `SKILL-TAGS-PRESENT`          | hard     | `tags` is non-empty.                                               |
| `SKILL-SCOPE-VOCABULARY`      | hard     | `required_scope` is in the live tool-scope vocabulary.             |
| `SKILL-PLACEHOLDER`           | hard     | No unresolved placeholder markers remain in the document.          |

`POST /api/v1/capabilities/validate` is the pre-create counterpart: it takes
the same draft fields, executes nothing, persists nothing, and returns
`executed: false` by type. `status: not_validated` is returned for a real
category that has no category validator rather than claiming a pass.

##### Activation and gates

At act time the server evaluates every workspace skill row through one pure
gate evaluator. The gates run in this order and are hard exclusions:

| Gate                      | Skip reason                 | What it means                                                                 |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `enabled`                 | `disabled`                  | The row's `enabled` flag is false.                                            |
| domain policy             | `domain_policy_exclusion`   | The skill name is excluded by platform domain policy.                         |
| scope declared            | `no_required_scope`         | The skill declares no `required_scope`.                                       |
| scope granted             | `scope_not_granted`         | The declared scope was not granted to this run.                               |
| document present          | `no_markdown_doc`           | The resolved document is empty.                                               |
| trigger or pin            | `trigger_not_matched`       | No trigger matched and the skill was not pinned.                              |
| token budget              | `token_budget_exceeded`     | The whole-skill block did not fit the 4000-token directive budget.            |
| pin target                | `pinned_unknown`            | A `/skill:` pin named no workspace skill; reported, never silently dropped.    |

A pinned skill bypasses the trigger gate only; every other gate still
applies, and a pinned skill wins a contested budget before anything else.
The budget is whole-skill: a skill that would exceed it is dropped entirely
and named in `skipped` rather than being truncated mid-document.

Trigger matching is case-insensitive token-set containment: every word token
of a trigger phrase must appear somewhere in the user's message, in any
order. Multiple triggers are OR-ed. A skill with no triggers is always
eligible; a skill with triggers and no user message is not matched and says
so. `trust_class` controls ordering (`core_trusted` first) and the label in
the rendered block; it is not currently a hard gate.

##### `/skill:<slug>` pin syntax

A user can pin one skill for one turn by opening the message with
`/skill:<slug>`. The parser is frozen:

```text
/skill:resume-tailor please tighten this
  -> residual "please tighten this", pinned "resume-tailor"

/skill:resume-tailor
  -> residual "", pinned "resume-tailor"
```

The slug must match `^[a-z0-9][a-z0-9._-]{0,63}$` with no `..`. A pin must
open the message. Mid-message pins, doubled slashes, case variants, and
empty, uppercase, over-long, or `..` slugs are malformed: the message passes
through byte-identically, unpinned. A message with no `/skill:` token also
passes through byte-identically. The pin is stripped at the API seam before
the classifier, retrieval, or any LLM sees the message; the slug travels
separately as `pinned_skill`.

**Non-goal (D1): skills apply on the ReAct act-path only.** The static
fallback (used only when ReAct fails or is disabled) has no shared
prompt-assembly seam and does not inject skills. A static-fallback result
carries `result.provenance.skill_directive = "not_applied"` and emits no
SKILL_INJECTION record. `agent_react_enabled` defaults to `true`.

##### Install paths

| Path                  | Surface                                                                                      | Notes                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| In-app catalog        | `/workspace/{workspaceId}/capabilities/skills`                                                | Installs via `POST /api/v1/capabilities` with `category: "skill"`.     |
| Direct API            | `POST /api/v1/capabilities`                                                                   | The create envelope above.                                            |
| Remote library sweep  | `POST /api/v1/capabilities/sync-github`                                                       | Validation only; install each accepted candidate with the create call. |
| Offline seed fallback | `apps/web/src/lib/capabilities-data.ts`                                                       | UI fallback when the API catalog is unreachable; not a catalog mirror. |

##### Quickstart

```bash
API=http://localhost:8000
TOKEN="<access-token>"
WS="<workspace-id>"

# 1. Pick a real scope from the live tool registry.
curl -sS "$API/api/v1/capabilities/tools/definitions" \
  -H "Authorization: Bearer $TOKEN"

# 2. Validate the draft before creating it.
curl -sS -X POST "$API/api/v1/capabilities/validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "weekly-review",
        "category": "skill",
        "config": {
          "markdown_doc": "## Mission\nTrack the week.\n## Operating Rules\n1. Collect.\n2. Summarize.\n3. Next steps.\n",
          "tags": ["career"],
          "required_scope": "memory.read",
          "triggers": ["weekly review"]
        }
      }'

# 3. Create the capability (201), then probe it as a dry run.
CAP=$(curl -sS -X POST "$API/api/v1/capabilities" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "weekly-review",
        "category": "skill",
        "config": {
          "markdown_doc": "## Mission\nTrack the week.\n## Operating Rules\n1. Collect.\n2. Summarize.\n3. Next steps.\n",
          "tags": ["career"],
          "required_scope": "memory.read",
          "triggers": ["weekly review"]
        }
      }')
CAP_ID=$(printf '%s' "$CAP" | python -c 'import json,sys; print(json.load(sys.stdin)["id"])')

curl -sS -X POST "$API/api/v1/capabilities/$CAP_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS" \
  -H "Content-Type: application/json" \
  -d '{"input": {"message": "please do my weekly review", "pin": "weekly-review"}}'

# 4. Use it in chat: the pin is stripped, the slug travels as pinned_skill.
curl -sS -X POST "$API/api/v1/agents/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WS" \
  -H "Content-Type: application/json" \
  -d '{"message": "/skill:weekly-review summarize this week"}'
```

The skill probe is a dry run: it reports per-gate verdicts, trigger match
evidence, estimated tokens against the 4000-token budget, a directive
preview, and `recorded_usage: false`. It is available to workspace members.
`POST /api/v1/capabilities/{id}/test` requires workspace owner only for
`category: "tool"`, because tool probes dispatch real code in the API
process.

##### Adding a catalog skill (#29)

The bundled catalog is `SKILL_CATALOG` in
`apps/api/src/api/services/skill_catalog_service.py` and currently holds 28
entries. To add the next one:

1. Append one frozen `SkillCatalogEntry` to `SKILL_CATALOG`. `author` must be
   `Vaeloom Core Team`, `bundled` stays `true`, and the slug must be unique.
2. Write the inline `markdown_doc` with the hard sections (`## Mission`,
   `## Operating Rules`) and the soft sections (`## Triggers`,
   `## Output Contract`). Avoid unresolved placeholders.
3. Set `required_scope` to one exact value from
   `GET /api/v1/capabilities/tools/definitions`; catalog entries may not use a
   comma-separated list.
4. Set `trust_class` to `core_trusted` or `community` and `autonomy` to
   `suggest`, `autonomous`, or `approval_required`. Declare a self-check
   (`numbered-operating-rules`, `triggers-echoed`, or `scope-cited`) that the
   document actually satisfies.
5. If you also ship a `skills/<slug>/SKILL.md` mirror on disk, it must have a
   catalog entry: `test_on_disk_skills_are_all_in_the_catalog` rejects
   orphans.
6. The size pin in `apps/api/tests/test_skill_catalog.py` (currently 28) is
   deliberate. Update it only when the intended catalog size changes, never
   to make a failing run green.
7. Run the catalog and capabilities suites before committing:
   `uv run --project apps/api python -m pytest apps/api/tests/test_skill_catalog.py apps/api/tests/test_capabilities_e2e.py -q -o addopts=""`.
   `GET /api/v1/capabilities/catalog` will list the new entry; no migration
   or OpenAPI regeneration is needed because the catalog is runtime data.

### Memory

The persistent memory system. Memories are vector-indexed and searchable by
semantic similarity.

| Method | Path                      | Description                   |
| ------ | ------------------------- | ----------------------------- |
| POST   | `/api/v1/memories`        | Create memory entry           |
| GET    | `/api/v1/memories`        | List memories (paginated)     |
| GET    | `/api/v1/memories/{id}`   | Get memory by ID              |
| PUT    | `/api/v1/memories/{id}`   | Update memory                 |
| DELETE | `/api/v1/memories/{id}`   | Delete memory                 |
| POST   | `/api/v1/memories/search` | Semantic search over memories |

### Knowledge Graph

Entity-relationship graph for structured knowledge. Supports traversal and
shortest-path queries.

| Method | Path                                       | Description                                      |
| ------ | ------------------------------------------ | ------------------------------------------------ |
| POST   | `/api/v1/knowledge-graph/nodes`            | Create a node                                    |
| GET    | `/api/v1/knowledge-graph/nodes`            | List nodes (paginated, filterable)               |
| GET    | `/api/v1/knowledge-graph/nodes/{id}`       | Get node                                         |
| PUT    | `/api/v1/knowledge-graph/nodes/{id}`       | Update node                                      |
| DELETE | `/api/v1/knowledge-graph/nodes/{id}`       | Delete node                                      |
| POST   | `/api/v1/knowledge-graph/nodes/{id}/edges` | Create edge from node                            |
| GET    | `/api/v1/knowledge-graph/nodes/{id}/edges` | List edges from node                             |
| GET    | `/api/v1/knowledge-graph/edges`            | List all edges                                   |
| DELETE | `/api/v1/knowledge-graph/edges/{id}`       | Delete edge                                      |
| POST   | `/api/v1/knowledge-graph/traverse`         | Traverse graph (BFS/DFS, max depth configurable) |
| GET    | `/api/v1/knowledge-graph/path`             | Find shortest path between two nodes             |

### Search

| Method | Path             | Description                      |
| ------ | ---------------- | -------------------------------- |
| POST   | `/api/v1/search` | Hybrid search across all sources |

Supports: full-text keyword search, vector similarity search, knowledge graph
traversal. Returns ranked results with relevance scores.

### Documents

| Method | Path                | Description                      |
| ------ | ------------------- | -------------------------------- |
| POST   | `/api/v1/documents` | Upload document (multipart form) |
| GET    | `/api/v1/documents` | List documents in workspace      |

Supported formats: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, images (OCR).

### Resumes

| Method | Path                            | Description             |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/api/v1/resumes`               | List resumes            |
| GET    | `/api/v1/resumes/master`        | Get master resume       |
| POST   | `/api/v1/resumes/{id}/generate` | Generate resume variant |

### Applications

| Method | Path                                                 | Description        |
| ------ | ---------------------------------------------------- | ------------------ |
| GET    | `/api/v1/workspaces/{wid}/applications`              | List applications  |
| POST   | `/api/v1/workspaces/{wid}/applications`              | Create application |
| GET    | `/api/v1/workspaces/{wid}/applications/{id}`         | Get application    |
| PATCH  | `/api/v1/workspaces/{wid}/applications/{id}/outcome` | Update outcome     |

### Integrations

External service integrations (Gmail, Google Calendar, GitHub, etc.).

| Method | Path                             | Description            |
| ------ | -------------------------------- | ---------------------- |
| POST   | `/api/v1/integrations`           | Create integration     |
| GET    | `/api/v1/integrations`           | List user integrations |
| PUT    | `/api/v1/integrations/{id}`      | Update integration     |
| DELETE | `/api/v1/integrations/{id}`      | Delete integration     |
| POST   | `/api/v1/integrations/{id}/sync` | Trigger full sync      |

### Connectors

MCP-compatible connectors for external data sources.

| Method | Path                                  | Description           |
| ------ | ------------------------------------- | --------------------- |
| POST   | `/api/v1/connectors`                  | Create connector      |
| GET    | `/api/v1/connectors`                  | List connectors       |
| GET    | `/api/v1/connectors/{id}`             | Get connector details |
| PUT    | `/api/v1/connectors/{id}`             | Update connector      |
| DELETE | `/api/v1/connectors/{id}`             | Delete connector      |
| POST   | `/api/v1/connectors/{id}/sync`        | Trigger sync          |
| GET    | `/api/v1/connectors/{id}/sync/status` | Get sync status       |
| POST   | `/api/v1/connectors/{id}/test`        | Test connection       |

### Scheduler

CRON-based job scheduling for recurring agent executions.

| Method | Path                                     | Description                 |
| ------ | ---------------------------------------- | --------------------------- |
| POST   | `/api/v1/scheduler/jobs`                 | Create scheduled job        |
| GET    | `/api/v1/scheduler/jobs`                 | List jobs                   |
| GET    | `/api/v1/scheduler/jobs/{id}`            | Get job details             |
| PATCH  | `/api/v1/scheduler/jobs/{id}`            | Update job                  |
| DELETE | `/api/v1/scheduler/jobs/{id}`            | Delete job                  |
| POST   | `/api/v1/scheduler/jobs/{id}/pause`      | Pause job                   |
| POST   | `/api/v1/scheduler/jobs/{id}/resume`     | Resume job                  |
| POST   | `/api/v1/scheduler/jobs/{id}/trigger`    | Trigger immediate execution |
| GET    | `/api/v1/scheduler/jobs/{id}/executions` | List executions             |

### Notifications

| Method | Path                              | Description          |
| ------ | --------------------------------- | -------------------- |
| POST   | `/api/v1/notifications/send`      | Send notification    |
| GET    | `/api/v1/notifications`           | List notifications   |
| GET    | `/api/v1/notifications/{id}`      | Get notification     |
| POST   | `/api/v1/notifications/templates` | Create template      |
| GET    | `/api/v1/notifications/templates` | List templates       |
| POST   | `/api/v1/notifications/subscribe` | Subscribe to channel |

### Events

Event publishing and subscription for internal event-driven communication.

| Method | Path                           | Description         |
| ------ | ------------------------------ | ------------------- |
| POST   | `/api/v1/events`               | Publish event       |
| GET    | `/api/v1/events`               | List events         |
| POST   | `/api/v1/events/subscriptions` | Create subscription |
| GET    | `/api/v1/events/subscriptions` | List subscriptions  |

### Billing

| Method | Path                           | Description                |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/api/v1/billing/usage`        | Get usage records          |
| GET    | `/api/v1/billing/subscription` | Get current subscription   |
| POST   | `/api/v1/billing/subscription` | Create/update subscription |

### Analytics

| Method | Path                          | Description                 |
| ------ | ----------------------------- | --------------------------- |
| GET    | `/api/v1/analytics`           | Dashboard with KPIs + usage |
| GET    | `/api/v1/analytics/usage`     | Usage time series           |
| GET    | `/api/v1/analytics/metrics`   | KPI summary                 |
| POST   | `/api/v1/analytics/events`    | Track event                 |
| POST   | `/api/v1/analytics/aggregate` | Trigger aggregation         |

### Audit

Immutable audit log for compliance. Every agent action and user operation is
recorded.

| Method | Path                              | Description                |
| ------ | --------------------------------- | -------------------------- |
| POST   | `/api/v1/audit/events`            | Record audit event         |
| GET    | `/api/v1/audit/events`            | Query events (filterable)  |
| GET    | `/api/v1/audit/events/{id}`       | Get event                  |
| POST   | `/api/v1/audit/export`            | Export events (JSON/CSV)   |
| GET    | `/api/v1/audit/compliance/report` | Generate compliance report |

### IAM

Identity and Access Management for enterprise multi-tenant deployments.

| Method | Path                                 | Description                |
| ------ | ------------------------------------ | -------------------------- |
| POST   | `/api/v1/iam/users`                  | Create user                |
| GET    | `/api/v1/iam/users`                  | List users (tenant-scoped) |
| GET    | `/api/v1/iam/users/{id}`             | Get user                   |
| PUT    | `/api/v1/iam/users/{id}`             | Update user                |
| DELETE | `/api/v1/iam/users/{id}`             | Deactivate user            |
| POST   | `/api/v1/iam/users/{id}/roles`       | Assign roles               |
| DELETE | `/api/v1/iam/users/{id}/roles/{rid}` | Remove role                |
| GET    | `/api/v1/iam/users/{id}/permissions` | Get effective permissions  |

### Plugins

Third-party plugin management with sandboxed execution.

| Method | Path                               | Description        |
| ------ | ---------------------------------- | ------------------ |
| POST   | `/api/v1/plugins`                  | Register plugin    |
| GET    | `/api/v1/plugins`                  | List plugins       |
| GET    | `/api/v1/plugins/{id}`             | Get plugin details |
| PUT    | `/api/v1/plugins/{id}`             | Update plugin      |
| DELETE | `/api/v1/plugins/{id}`             | Delete plugin      |
| POST   | `/api/v1/plugins/{id}/execute`     | Execute plugin     |
| GET    | `/api/v1/plugins/{id}/permissions` | Get permissions    |
| GET    | `/api/v1/plugins/{id}/executions`  | List executions    |

### Chat

| Method | Path                                 | Description       |
| ------ | ------------------------------------ | ----------------- |
| POST   | `/api/v1/chat/workspaces/{wid}/chat` | Send chat message |

#### Conversations (server-side chat history)

Added 2026-10-01 by migration `0063` (`conversations` + `chat_messages`, both
RLS `ENABLE` + `FORCE` + workspace-scoped policies). Before this, chat history
existed only in browser `localStorage`; the browser key now survives only as a
bounded write-behind outbox plus a one-time migration of pre-existing history.

| Method               | Path                                                                         | Description                        |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| GET / POST           | `/api/v1/workspaces/{workspace_id}/conversations`                            | List / create conversations        |
| GET / PATCH / DELETE | `/api/v1/workspaces/{workspace_id}/conversations/{conversation_id}`          | Get / rename / delete conversation |
| POST / DELETE        | `/api/v1/workspaces/{workspace_id}/conversations/{conversation_id}/messages` | Append / delete a message          |

3 paths / 7 operations (measured from live `app.openapi()` 2026-10-03).

### Recommendations

AI-powered recommendations for jobs, skills, and actions.

| Method | Path                                | Description              |
| ------ | ----------------------------------- | ------------------------ |
| POST   | `/api/v1/recommendations`           | Generate recommendations |
| GET    | `/api/v1/recommendations/{user_id}` | Get user recommendations |
| POST   | `/api/v1/recommendations/feedback`  | Record feedback          |
| GET    | `/api/v1/recommendations/trending`  | Get trending items       |
| POST   | `/api/v1/recommendations/index`     | Rebuild index            |

## Error Format

All errors return a consistent JSON structure:

```json
{
  "detail": "Human-readable error message",
  "status_code": 400
}
```

For validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    }
  ],
  "status_code": 422
}
```

### HTTP Status Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 200  | Success                                 |
| 201  | Created                                 |
| 204  | No content (successful delete)          |
| 400  | Bad request (validation error)          |
| 401  | Unauthenticated (missing/invalid token) |
| 403  | Forbidden (insufficient permissions)    |
| 404  | Resource not found                      |
| 409  | Conflict (duplicate resource)           |
| 422  | Validation error                        |
| 429  | Rate limit exceeded                     |
| 500  | Internal server error                   |

## Rate Limiting

- **Default**: 100 requests per 60 seconds per client IP
- **Burst**: Up to 10 requests above the limit before 429 is returned
- **Headers**:
- `X-RateLimit-Limit`: maximum requests per window
- `X-RateLimit-Remaining`: remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets
- **429 Response**: Includes `Retry-After` header (seconds until retry)
- **Per-agent rate limits**: Separate counters for agent execution endpoints

## Pagination

List endpoints support cursor or offset-based pagination:

| Parameter   | Type    | Default | Description              |
| ----------- | ------- | ------- | ------------------------ |
| `page`      | integer | 1       | Page number (1-indexed)  |
| `page_size` | integer | 20      | Items per page (max 100) |

Response format:

```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "page_size": 20
}
```

Some endpoints use `"memories"`, `"agents"`, `"plugins"` instead of `"items"` as
the key — check the specific endpoint schema.

## Common Request Headers

| Header             | Required             | Description                                               |
| ------------------ | -------------------- | --------------------------------------------------------- |
| `Authorization`    | For protected routes | `Bearer <token>`                                          |
| `Content-Type`     | For POST/PUT/PATCH   | `application/json` (or `multipart/form-data` for uploads) |
| `X-Request-ID`     | Optional             | Idempotency key for safe retries                          |
| `X-Correlation-ID` | Optional             | Client-generated trace ID                                 |

## Common Response Headers

| Header             | Description                              |
| ------------------ | ---------------------------------------- |
| `X-Request-ID`     | Echoed from request, or server-generated |
| `X-Correlation-ID` | Echoed from request, or server-generated |
| `X-RateLimit-*`    | Rate limiting status                     |
| `X-Response-Time`  | Server processing time in milliseconds   |

## WebSocket Endpoints

WebSocket support is available for real-time agent streaming (future). Current
streaming uses SSE over HTTP: `POST /api/v1/agents/{id}/execute?stream=true`.
