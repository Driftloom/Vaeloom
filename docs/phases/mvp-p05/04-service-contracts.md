# MVP-P05 — 04. Service Contracts (DEL-MVP-P05-02) — 2026-08-15

> Design-only (ARCHITECTURE). Grounded in live inspection of `master` @
> `6e8a7b4` per `01-source-register.md` §4. Honesty labels: SOURCE_DERIVED
> (design intent from INT-02/spec) / REPO_VERIFIED (`path:line`) / NEW_DESIGN /
> STAKEHOLDER_DECISION / NOT_EXECUTED. Unverified = UNVERIFIED. Covers WS-05.2
> (identity/authorization) and WS-05.3 (data/event/agent flows). MVP scope only.

## 1. API surface — routers registered in `apps/api/src/backend/main.py`

FastAPI unified service; **30 `include_router`** found (REPO_VERIFIED
main.py:139-173). 22 unconditional (MVP) + 8 enterprise-gated
(`settings.enterprise_routes_enabled`, default off → out of MVP scope). Status =
REPO_VERIFIED(main.py:line).

| #   | Prefix                                           | Router                                         | Status                                                |
| --- | ------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| 1   | `/api/v1` (security)                             | encryption_router                              | main.py:139                                           |
| 2   | `/health`                                        | health                                         | main.py:140                                           |
| 3   | `/api/v1/auth`                                   | auth (signup/login/me/refresh/sso_token_login) | main.py:141; refresh routers/auth.py:60               |
| 4   | `/api/v1/workspaces`                             | workspaces                                     | main.py:142                                           |
| 5   | `/api/v1/memories`                               | memory                                         | main.py:143                                           |
| 6   | `/api/v1/agents`                                 | agents                                         | main.py:144                                           |
| 7   | `/api/v1/events`                                 | events                                         | main.py:145                                           |
| 8   | `/api/v1/search`                                 | search                                         | main.py:146                                           |
| 9   | `/api/v1/integrations`                           | integrations                                   | main.py:147                                           |
| 10  | `/api/v1/documents`                              | documents                                      | main.py:148                                           |
| 11  | `/api/v1/resumes`                                | resumes                                        | main.py:149                                           |
| 12  | `/api/v1/workspaces/{workspace_id}/applications` | applications                                   | main.py:150                                           |
| 13  | `/api/v1/notifications`                          | notifications                                  | main.py:151                                           |
| 14  | `/api/v1/connectors`                             | connectors (CRUD + `/{id}/sync`)               | main.py:152; routers/connectors.py                    |
| 15  | `/api/v1/scheduler`                              | scheduler                                      | main.py:153                                           |
| 16  | `/api/v1/chat`                                   | chat                                           | main.py:154                                           |
| 17  | `/api/v1/knowledge-graph`                        | knowledge_graph                                | main.py:155                                           |
| 18  | `/api/v1` (gdpr)                                 | gdpr_router (flat prefix)                      | main.py:156                                           |
| 19  | `/api/v1` (consent)                              | consent_router (flat prefix)                   | main.py:157                                           |
| 20  | `/api/v1` (approvals)                            | approval_router (flat prefix)                  | main.py:158; POST /approvals services/approval.py:194 |
| 21  | `/api/v1` (agent-costs)                          | agent_costs_router (flat prefix)               | main.py:159                                           |
| 22  | `/api/v1` (gmail)                                | gmail.router (flat prefix)                     | main.py:160                                           |
| 23  | `/api/v1/billing`                                | billing (GATED)                                | main.py:166                                           |
| 24  | `/api/v1/plugins`                                | plugins (GATED)                                | main.py:167                                           |
| 25  | `/api/v1/analytics`                              | analytics (GATED)                              | main.py:168                                           |
| 26  | `/api/v1/audit`                                  | audit (GATED)                                  | main.py:169                                           |
| 27  | `/api/v1/iam`                                    | iam (GATED)                                    | main.py:170                                           |
| 28  | `/api/v1/recommendations`                        | recommendations (GATED)                        | main.py:171                                           |
| 29  | `/api/v1/webhooks`                               | webhooks (GATED)                               | main.py:172                                           |
| 30  | `` (admin)                                       | admin_console (GATED)                          | main.py:173                                           |

**Payload transform:** backend Pydantic serializes snake_case; web client
converts to camelCase via `transformKeys` in BOTH
`apps/web/src/lib/api.ts:25,102,166` and
`apps/web/src/lib/api-client.ts:39,144,161` (REPO_VERIFIED) — carried CF-P04-02.
Any new API client MUST reuse `transformKeys` (see AGENTS.md #3).
`packages/contracts/` is empty → contract centralization deferred to P08
(SOURCE_DERIVED register §4).

## 2. Approval contract (FR-50/51)

REPO_VERIFIED: `services/approval.py` + `schemas/approval.py` +
`agent_approvals` (schema.py:497-519) + POST /approvals router. Contract:
**proposal** (`request_approval` inserts PENDING with
workspace_id/agent_name/action_type/payload/reason, services/approval.py:21-57)
→ **expiring** (`expires_at = now + expires_in_minutes or 60`; `_expire_stale`
marks EXPIRED when `status='PENDING' AND expires_at < now`, approval.py:180-196)
→ **immutable decision** (`decide` raises 409 unless status=PENDING → one-shot,
approval.py:150-179) → **idempotent action** via `Idempotency-Key` middleware +
`idempotency_records` (middleware/idempotency.py:26,49-107; schema.py:479).

Completeness:

- **Payload-hash binding: UNVERIFIED/ABSENT.** `agent_approvals` has raw JSON
  `payload` column only — no `payload_hash` column (schema.py:497-519), no hash
  verification in `decide` (approval.py:150). Decision on drifted payload is NOT
  detected → NEW_DESIGN gap (carry to P07).
- **Expiry: REPO_VERIFIED** (expires_at + _expire_stale). **Replay safety:
  REPO_VERIFIED (idempotency middleware), UNVERIFIED breadth** (which
  consequential endpoints are covered).
- **Gmail:** draft-only until per-user T3 enablement (STAKEHOLDER_DECISION
  DEC-P02-05; DEC-P01-03) — approvals must NOT unlock send in MVP.

## 3. Identity / authorization contract (WS-05.2)

- **JWT access + rotating refresh** — `AuthMiddleware` decodes JWT with
  `settings.jwt_secret`/`jwt_algorithm` (middleware/auth.py:47-53); `/refresh`
  issues rotating refresh (routers/auth.py:60-63; ADR-007 SOURCE_DERIVED).
  `PUBLIC_PATHS` includes `/api/v1/auth/refresh` (auth.py:20).
- **Tenant/workspace scoping** — `TenantMiddleware` reads `X-Tenant-ID` header
  (middleware/tenant.py:40-65); `get_current_tenant` 400s when missing
  (tenant.py:63-65); `require_workspace_access` (tenant.py:82). Data isolation
  via `TenantAwareBase(RowLevelSecurityMixin)` + `0005_rls.py` (REPO_VERIFIED
  register §4; ADR-023 SOURCE_DERIVED) — app-level filter AND RLS.
- **RBAC** — role hierarchy + permission checks in middleware/rbac.py:5-47
  (REPO_VERIFIED). **CSRF** — `SKIP_PREFIXES = frozenset({"/api/v1/auth"})`
  (middleware/csrf.py:15) (REPO_VERIFIED; AGENTS.md #4).
- **OAuth RFC 9700 BCP + PKCE** — NFR-16, deferred to P08 (SOURCE_DERIVED
  EXT-06/07).
- **Workload identity (ADR-025): GAP / design-only.** No service-token or HMAC
  mechanism found in backend (register §4 gap; middleware/ set has none) →
  **NOT_EXECUTED / NEW_DESIGN**; carry to P07/P11. MVP uses user JWTs only.

## 4. Event / queue contract (WS-05.3 — data plane)

- **Queue:** `packages/queue` (TS BullMQ lib) + Python `workers/queue_worker.py`
  `BullMQWorker` reads the SAME Redis queues BullMQ writes
  (queue_worker.py:2-4,24-27). Unhandled/failed jobs → `:failed` set +
  failedReason (queue_worker.py:123-140); `DeadLetterEvent`/`dead_letter_events`
  (schema.py:581) = durable DLQ row.
- **Idempotency:** `Idempotency-Key` + `Idempotency-Replayed` header contract
  (middleware/idempotency.py:26-27,83-107) with `idempotency_records` table.
- **Webhooks:** `services/webhook_service.py` — create/list/get/update/delete +
  `dispatch` with HMAC `_compute_signature` (webhook_service.py:67);
  `webhooks` + `webhook_deliveries` tables (schema.py:611,627). GATED enterprise
  in MVP (main.py:172).
- **Audit:** `routers/audit.py` (record/query/export/compliance_report) +
  `services/audit_service.py` — exists but enterprise-gated (main.py:169); MVP
  audit baseline = `events`/`event_subscriptions` (schema.py:542,569) + log
  correlation (SOURCE_DERIVED register §4; verify coverage P07).

## 5. Projection contract

- **Relational = system of record (ADR-024 SOURCE_DERIVED; REPO_VERIFIED
  schema.py 36 tables).** All projections rebuildable from it with provenance:
- **Embeddings** — `embeddings` table with pgvector `Vector(1536)` +
  `model_version` default `text-embedding-3-small` (schema.py:324-337; ADR-003)
  → model pin REPO_VERIFIED.
- **Graph** — `entities`/`relationships` (schema.py:279,302); knowledge-graph
  router (main.py:155).
- **Search** — `SearchIndex` ABC + `MeilisearchIndex` + `PostgresFallbackIndex`
  (infrastructure/search.py:11-70) (REPO_VERIFIED).
- **Version pins** — model/prompt/tool/retrieval/chunking/embedding/policy per
  INT-02 §5 (SOURCE_DERIVED); embedding `model_version` verified, others
  UNVERIFIED → carry to P07.

## 6. Connector contract

- **Gmail: draft-only, no send.** `clients/gmail_client.py` exposes
  `fetch_emails`, `create_draft`, `list_drafts`, `start_watch`, `stop_watch`,
  `check_health` — **no send** (REPO_VERIFIED gmail_client.py:108-...). Watcher
  added (`0007_gmail_watch.py`, `gmail_watches` schema.py:760) — reconcile with
  polling-first DEC-P02-01.
- **Approved-integration-only job submission** — DEC-P01-04
  (STAKEHOLDER_DECISION); connectors CRUD + `/sync` (routers/connectors.py)
  drive `connector_ext_service`.
- **No scraping / anti-bot** — S-02/S-03 (SOURCE_DERIVED register §4).
- **Registry** — `connectors` table (schema.py:138) + `integrations/` package +
  MCP (EXT-01); sandboxed plugin execution for agent tools (DEC-P01-04 carried).

## 7. Data / event / agent flows (WS-05.3 — agent plane)

8-agent canonical roster maps to repo (REPO_VERIFIED orchestrator/router.py):
`OrganizationAgent`, `MemoryAgentHandler`, `ResumeAgent`, `ATSAgent`,
`JobSearchAgent`, `ApplicationAgent`, `GmailAgent`, `SchedulerAgent` —
orchestrator module `orchestrator/{base,loop,router,state}.py` wires them + QA
gate. Extra handlers exist (22 dirs total: career, research, security, etc.) —
out of MVP roster. Registry is DB-backed (`services/agent_service.py:16`
register_agent; `agents` table schema.py:407).

- **6-memory taxonomy (ADR-022 SOURCE_DERIVED)** —
  `Profile/Document/Career/Episodic/ Preference/Working` as typed rows:
  `memories` + `memory_records` (schema.py:205,256), `0004_memory_taxonomy.py`
  (`domain` facet + `supersedes_id`), `schemas/memory_types.py` MemoryType enum
  (REPO_VERIFIED). **Supersession** — `services/memory_versioning.py`
  `create_version/get_history/diff` (memory_versioning.py:30-70) REPO_VERIFIED;
  6-type completeness UNVERIFIED (register §4 → P07/P12).
- **Kill switches AUTO-01..03** — DEC-P02-05 (STAKEHOLDER_DECISION): operator
  stop for agent/approval/Gmail paths; no runtime switch mechanism found in
  backend → carry to P07.
- **Data flow:** relational writes → events (events router/event_service) →
  BullMQ queues → worker handlers → projections (search/embeddings/graph)
  rebuilt with provenance; failures → `dead_letter_events`; webhooks dispatched
  on external events (enterprise-gated).

---

**Handoff notes (P07 verify):** payload-hash binding (NEW_DESIGN), idempotency
coverage breadth, 6-memory completeness, RLS policy breadth, version-pin
registry, workload identity ADR-025 (NOT_EXECUTED), unified migrations
(CF-P05-04). Evidence: `EVD-MVP-P05-001/002`.
