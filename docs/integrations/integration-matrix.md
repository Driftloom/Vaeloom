# Integration & Tool Matrix — Vaeloom

> Single source of truth for every external integration and agent tool. Last
> updated: 2026-08-27 | Status: governing for Phase 2 Hybrid (native Python
> core + MCP long-tail).

## 1. Tool Registry (live — `tools/definitions.py` + `tools/executor.py`)

31 static tools + unlimited dynamic MCP-bridged tools (`mcp__<Server>__<Tool>`).

### 1.1 Static tools by category

| Category | Tool | Scope | Approval-gated | Agent(s) | Notes |
| ---------------------------- | ------------------------------ | --------------------------- | -------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| **memory_read** | `search_documents` | memory.read | no | JobSearch, Application, Resume, Org, Memory, Career, Research, Analytics | DB `ilike` search |
| | `query_graph` | memory.read | no | same + Planning, Learning, Reflection | Entity + Relationship |
| | `get_entity` | memory.read | no | — | By ID |
| | `parse_document_ocr` | memory.read | no | Security | via ingestion.parsers |
| | `calculate_ats_diff` | memory.read | no | ATSAgent | Master vs JD diff |
| | `calculate_semantic_ats_score` | memory.read | no | Resume, Application | embedding cosine + keyword gazetteer |
| | `extract_missing_hard_skills` | memory.read | no | — | gazetteer + LLM fallback |
| | `audit_ats_formatting` | memory.read | no | Resume | heuristic |
| **memory_write** | `create_entity` | memory.write | **yes** | Memory | + approval |
| | `merge_entities` | memory.write | **yes** | Memory | dedup |
| | `categorize_document` | memory.write | **yes** | Organization | folder/category |
| **connector_read** | `search_gmail` | connector.gmail.read | no | Gmail, Reminder | GmailClient + mock fallback |
| | `search_jobs` | connector.jobs.read | no | JobSearch, Recommendation | JobBoardClient (generic REST) |
| | `list_calendar_events` | connector.calendar.read | no | Scheduler, Reminder | CalendarClient |
| | `fetch_github_repo` | connector.github.read | no | GitHub, Coding, Plugin | profile/repo/commits/pulls/issues |
| | `sync_notion_pages` | connector.notion.read_write | no | Connector | query/create/update |
| **connector_read (browser)** | `browse_job_page` | system.browser.read | no | JobSearch, Application | chromium-first SSRF-guarded, 20/h quota |
| | `scrape_company_insights` | system.browser.read | no | JobSearch, Application | 4-axis web_search fan-out |
| | `verify_application_link` | system.browser.read | no | JobSearch, Application | HEAD probe, DnsResolutionError → expired |
| **connector_write** | `rename_file` | connector.write | **yes** | Organization | Document.path |
| | `move_file` | connector.write | **yes** | Organization | Document.path + metadata |
| | `draft_email` | connector.gmail.write | **yes** | Gmail | draft-only (never sends) |
| | `create_calendar_event` | connector.calendar.write | **yes** | Scheduler | Google Calendar |
| | `send_slack_message` | connector.slack.write | **yes** | Connector | chat.postMessage |
| | `create_github_issue` | connector.github.write | **yes** | GitHub | issues/PRs |
| **system** | `notify_user` | system.notify | no | Scheduler, Analytics | Audit-logged |
| | `web_search` | system.web_search | no | Career, Research, Analytics, Learning | Brave/SERPAPI + mock |
| | `execute_code_sandbox` | system.sandbox_exec | no | Coding | python/js, blocked patterns |
| | `compile_resume_pdf` | system.document.compile | no | Resume, Application | Playwright Chromium |
| | `compile_resume_docx` | system.document.compile | no | Resume | python-docx |
| | `compile_cover_letter` | system.document.compile | no | Application | PDF/DOCX/HTML |

**Dynamic (MCP-bridged):** `mcp__<ServerSlug>__<ToolSlug>` — scope
`connector.mcp.execute`, bridged at `POST /connectors/{id}/mcp/sync`,
approval-gated unless `readOnlyHint`. See ADR-036.

### 1.2 New tools added in this overhaul

| Tool | Scope | Gate | Provider |
| ------------------------------- | ------------------------ | ------- | ------------------------------------- |
| `list_drive_files` | connector.drive.read | no | Drive (native) |
| `search_drive` | connector.drive.read | no | Drive (native) |
| `download_drive_file` | connector.drive.read | no | Drive (native) |
| `search_github_repos` | connector.github.read | no | GitHub (native) |
| `get_github_profile` | connector.github.read | no | GitHub (native) |
| `list_github_issues` | connector.github.read | no | GitHub (native) |
| `read_github_file` | connector.github.read | no | GitHub (native) |
| `create_github_pull_request` | connector.github.write | **yes** | GitHub (native) |
| `search_greenhouse_jobs` | connector.jobs.read | no | Greenhouse (public) |
| `search_lever_jobs` | connector.jobs.read | no | Lever (public) |
| `search_jobs_board` | connector.jobs.read | no | Aggregator (Greenhouse+Lever+generic) |
| `search_outlook_mail` | connector.outlook.read | no | Microsoft Graph (Outlook) |
| `draft_outlook_mail` | connector.outlook.write | **yes** | Microsoft Graph |
| `list_outlook_calendar_events` | connector.calendar.read | no | Microsoft Graph |
| `create_outlook_calendar_event` | connector.calendar.write | **yes** | Microsoft Graph |
| `list_onedrive_files` | connector.drive.read | no | Microsoft Graph (OneDrive) |
| `search_onedrive` | connector.drive.read | no | OneDrive |
| `download_onedrive_file` | connector.drive.read | no | OneDrive |

---

## 2. Connectors ( `services/connector_ext_service.py` )

Types: `rest` | `graphql` | `database` | `file` | `mcp`

| Type | Required config | Sensitive fields (encrypted) | Sync behavior | test_connection |
| ---------- | ------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| `rest` | `url` | `authToken`, `apiKey`, `headers.Authorization` | Authenticated GET `url` with headers, paginated ingest stub → memory store | Authenticated GET |
| `graphql` | `url` | `authToken`, `apiKey` | Authenticated POST introspection | Authenticated GET |
| `database` | `connectionString` | `connectionString` | Validates DSN format, no live connect in test env | Validates format |
| `file` | `path` | — | Stats path | Validates path exists |
| `mcp` | `transport` + (stdio: `command`+`args` \| http: `url`) | `env.*` + `headers.*` per-key Fernet | Delegates to `mcp_client_service.list_tools` | `list_tools(refresh=True)` |

**MCP config reference** (validated by `validate_mcp_config`):

```json
{
  "transport": "stdio | http",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."],
  "url": "https://api.githubcopilot.com/mcp/",
  "allow_insecure": false,
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." },
  "headers": { "Authorization": "Bearer ghp_..." }
}
```

- `env` and `headers` values are each Fernet-encrypted at rest per-key.
- stdio: shell interpreters denied, metachars `;&|`$><\n\r^%!` denied.
- http: https enforced unless `allow_insecure=true` (dev).
- `headers` forwarded to `streamable_http_client(url, headers=...)` — unlocks
 hosted MCP (GitHub, Linear, Notion).

---

## 3. Agents (26 — `orchestrator/base.py`)

| Agent | File | Declared tools (executor-names) | Scope |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| JobSearchAgent | `job_search_agent/handler.py` | search_jobs, browse_job_page, verify_application_link, scrape_company_insights, search_documents, query_graph, search_jobs_board, search_greenhouse_jobs, search_lever_jobs | connector.jobs.read + browser |
| ApplicationAgent | `application_agent/handler.py` | search_documents, query_graph, verify_application_link, scrape_company_insights, compile_cover_letter, compile_resume_pdf, calculate_semantic_ats_score | mixed |
| ResumeAgent | `resume_agent/handler.py` | search_documents, query_graph, calculate_semantic_ats_score, audit_ats_formatting, compile_resume_pdf/docx | memory.read + document.compile |
| ATSAgent | `ats_agent/handler.py` | search_documents, calculate_semantic_ats_score, extract_missing_hard_skills, audit_ats_formatting | memory.read |
| GmailAgent | `gmail_agent/handler.py` | search_gmail, draft_email | gmail.read/write |
| SchedulerAgent | `scheduler_agent/handler.py` | create_calendar_event, list_calendar_events, search_documents, notify_user, list_outlook_calendar_events, create_outlook_calendar_event | calendar |
| ReminderAgent | `reminder_agent/handler.py` | list_calendar_events, create_calendar_event, search_gmail, search_outlook_mail | calendar+gmail |
| OrganizationAgent | `organization_agent/handler.py` | search_documents, rename_file, move_file, categorize_document | memory+connector.write |
| MemoryAgentHandler | `memory_agent/handler.py` | search_documents, create_entity, merge_entities, query_graph | memory |
| DocumentAgent | `memory/DocumentAgent` | summarize_document, extract_from_document, search_document | logical-only → mock* |
| ReflectionAgent (memory) | `memory/ReflectionAgent` | consolidate_memories, detect_duplicates, infer_connections | logical-only |
| PlanningAgent | `memory/PlanningAgent` | web_search, search_documents, query_graph, calculate_ats_diff | memory+web_search |
| SelfImprovementAgent | `memory/SelfImprovementAgent` | log_accuracy, process_feedback, adjust_confidence | logical-only |
| CareerAgent | `career_agent/handler.py` | web_search, query_graph, search_documents | + analyze_career_path* |
| ResearchAgent | `research_agent/handler.py` | web_search, query_graph, search_documents | + research_company* |
| AnalyticsAgent | `analytics_agent/handler.py` | query_graph, search_documents, web_search | + get_activity_trends* |
| RecommendationAgent | `recommendation_agent/handler.py` | search_jobs, query_graph, web_search | + match_jobs* |
| LearningAgent | `learning_agent/handler.py` | web_search, search_documents, query_graph | + search_courses* |
| ReflectionAgent (top) | `reflection_agent/handler.py` | query_graph, search_documents, web_search | + generate_weekly_digest* |
| GitHubAgent | `github_agent/handler.py` | fetch_github_repo, create_github_issue, web_search, search_github_repos, get_github_profile, list_github_issues, read_github_file, create_github_pull_request | github |
| CodingAgent | `coding_agent/handler.py` | execute_code_sandbox, fetch_github_repo, web_search, read_github_file | sandbox+github |
| ConnectorAgent | `connector_agent/handler.py` | sync_notion_pages, send_slack_message, fetch_github_repo, web_search | mixed |
| DriveAgent | `drive_agent/handler.py` | list_drive_files, search_drive, download_drive_file, list_onedrive_files, search_onedrive, download_onedrive_file | drive.read |
| PluginAgent | `plugin_agent/handler.py` | web_search, query_graph, fetch_github_repo | — |
| SecurityAgent | `security_agent/handler.py` | parse_document_ocr, query_graph, web_search | + monitor_activity* |
| QAAgent | `qa_agent/handler.py` | (none) | — |

\* Logical-only tools fall back to `_execute_mock` in executor (bounded,
deterministic). Provider framework migrates these to real tools over time.

---

## 4. Integrations — Status

| Integration | Package / Client | Status | Creds | Notes |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Google Gmail** | `clients/gmail_client.py` | **LIVE** | `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` | OAuth2 refresh, draft-only policy |
| **Google Calendar** | `clients/calendar_client.py` | **LIVE** | same Google creds + `GOOGLE_CALENDAR_ID` | list/create, 401 refresh |
| **Google Drive** | `clients/drive_client.py` | **LIVE** | same Google creds | list/search/download/export |
| **Microsoft Outlook Mail** | `clients/graph_mail_client.py` | **NEW (this phase)** | `MS_GRAPH_CLIENT_ID/SECRET/REFRESH_TOKEN` or `MICROSOFT_*` | Graph `/me/messages`, draft-only |
| **Microsoft Calendar** | `clients/graph_calendar_client.py` | **NEW** | same Graph creds | Graph `/me/calendar/events` |
| **OneDrive** | `clients/onedrive_client.py` | **NEW** | same Graph creds | `/me/drive` list/search/download |
| **GitHub (native)** | executor + `clients/github_client.py` | **LIVE → EXPANDED** | `GITHUB_TOKEN` env or per-workspace connector `token_ref` (least-privilege) | was 2 tools → now 7; PAT scopes: `repo, read:user` minimal |
| **GitHub (MCP)** | `https://api.githubcopilot.com/mcp/` (http transport, header auth) | **NEW (via 2a)** | `headers.Authorization: Bearer <PAT>` | Advanced flows; requires Phase 2a |
| **Slack** | executor `send_slack_message` | **LIVE** | `SLACK_BOT_TOKEN` | chat.postMessage |
| **Notion** | executor `sync_notion_pages` | **LIVE** | `NOTION_TOKEN` | DB query/create/update |
| **Job board (generic REST)** | `clients/job_board_client.py` | **LIVE** | `JOB_BOARD_API_URL/KEY` | generic `GET /jobs?q=` |
| **Greenhouse boards** | `clients/greenhouse_client.py` | **NEW** | none (public JSON) | `boards.greenhouse.io/v1/boards/{slug}/jobs` |
| **Lever postings** | `clients/lever_client.py` | **NEW** | none (public JSON) | `api.lever.co/v0/postings/{company}` |
| **Browser / scraping** | `services/browser_service.py` | **LIVE** | `BROWSER_TOOLS_ENABLED`, `SCRAPE_QUOTA_PER_HOUR=20/h` | chromium-first, SSRF-guarded, httpx fallback |
| **MCP custom servers** | `services/mcp_client_service.py` | **LIVE → EXPANDED (headers)** | `mcp` connector `env` + `headers` encrypted | stdio + http (now with headers) |
| **Legacy TS `integrations/*`** | `integrations/{calendar,email,github,google-drive,notion,slack}` | **DEPRECATED → archived** | — | TS 6 packages never imported; moved to `archive/integrations-legacy-ts/` |
| **Legacy TS `connectors/mcp`** | `connectors/mcp` | **DEPRECATED → archived** | — | Superseded by native Python SDK (ADR-036) |

---

## 5. Environment Variables

| Group | Vars (canonical) | Consumed by | Notes |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| **LLM** | `LLM_PROVIDER` (anthropic\|openai), `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_MODEL` | `config.py`, `llm_service.py` | `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are legacy aliases in `.env.example` |
| **Google** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID` | gmail/calendar/drive clients | Single refresh token → 3 scopes today |
| **Microsoft Graph** | `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_REFRESH_TOKEN`, `MS_GRAPH_TENANT_ID` | graph_* clients | Aliases: `MICROSOFT_CLIENT_ID` etc accepted |
| **GitHub** | `GITHUB_TOKEN` / `GITHUB_API_KEY` (global fallback) + per-workspace connector `token_ref` | `executor.py` + `github_client.py` | Per-workspace connector creds preferred (ADR-030) |
| **Job boards** | `JOB_BOARD_API_URL`, `JOB_BOARD_API_KEY` (generic) | `job_board_client.py` | Greenhouse/Lever need no keys |
| **MCP** | `DISCOVERY_TTL_S=300`, `CALL_TIMEOUT_S=30`, `CONNECT_TIMEOUT_S=10` | `mcp_client_service.py` | plus connector-scoped `env`/`headers` |
| **Browser** | `BROWSER_TOOLS_ENABLED` (default true), `SCRAPE_QUOTA_PER_HOUR` (20) | executor, browser_service | Kill switch |
| **SSO** | `SSO_PROVIDERS` JSON `{provider: {issuer, client_id, client_secret}}` | `routers/auth.py` | Google + Microsoft OAuth |
| **Infra** | `DATABASE__URL`, `REDIS__URL`, `RATE_LIMIT_REDIS_URL`, `STORAGE_*` (S3/MinIO), `JWT_SECRET`, `ENCRYPTION_KEY` | config | fail-closed validation |
| **Secrets Mgmt** | `INFISICAL_ENABLED`, `INFISICAL_CLIENT_ID/SECRET/SITE_URL` | `infrastructure/secrets.py` | Fallback FileSecretManager |
| **Observability** | `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, `PROMETHEUS_METRICS_ENABLED` | — | optional |
| **Unconsumed (reserved)** | `STRIPE_*`, `SMTP_*`, `SLACK_SIGNING_SECRET`, `SERVICE_AUTH_SECRET` | declared only | Wired when billing/email enterprise features ship |

For local dev: `GOOGLE_*` and `GITHUB_TOKEN` are optional — tools return
deterministic mock data when creds absent, so offline tests remain green.

---

## 6. Pluggable Provider Framework (ADR-037)

Location: `apps/api/src/api/integrations/` — registry at `registry.py`.

```python
class IntegrationProvider(Protocol):
    id: str                        # "greenhouse", "outlook", "github", ...
    display_name: str
    scopes: list[str]              # OAuth scopes it needs
    def tool_definitions(self) -> list[ToolDefinition]: ...
    async def handle(self, tool: str, params: dict, workspace_id: str) -> dict: ...
    def validate_config(self, config: dict) -> None: ...
```

- Each provider is one folder (`integrations/providers/<id>/`). Adding N+1 =
 drop a folder.
- Providers register `ToolDefinition`s into the executor's dynamic registry at
 startup (same path as MCP bridging, uniform approval gating via
 `approval_gated_tools()`).
- Existing providers: `drive`, `github`, `greenhouse`, `lever`, `jobs_board`,
 `graph_mail`, `graph_calendar`, `onedrive`, `generic_rest`.
- See `ADR-037-hybrid-integration-framework.md`.

---

## 7. Open Items / Roadmap

- **Per-agent credential isolation** (ADR-030): dedicated OAuth tokens per agent
 scoped to workspace — designed, not yet wired across gmail/drive/graph.
- **Gmail/Calendar per-workspace OAuth**: today global `GOOGLE_REFRESH_TOKEN` →
 migrate to connector `token_ref` per workspace.
- **LinkedIn Jobs**: partner API approval required; provider stub returns
 structured error until approved.
- **Indeed publisher feed**: low priority vs Greenhouse/Lever public endpoints.
- **Enterprise MCP marketplace** (ENT-P00): signed manifests, version pinning,
 kill switches — ENT track.

---

## 8. Verification

- Static check:
 `uv run --project apps/api python -m py_compile apps/api/src/api/tools/*.py apps/api/src/api/clients/*.py apps/api/src/api/services/mcp_client_service.py apps/api/src/api/services/connector_ext_service.py`
- Full suite: `uv run --project apps/api python -m pytest -q -o addopts="-n 4"`
 (mock-safe when creds absent).
- Connector smoke: `POST /connectors` + `POST /connectors/{id}/test` +
 `POST /connectors/{id}/mcp/sync` (MCP) + `POST /connectors/{id}/sync` (all
 types).
