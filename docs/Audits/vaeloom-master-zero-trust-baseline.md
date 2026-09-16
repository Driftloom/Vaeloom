# Vaeloom — Phase 0 Zero-Trust Baseline Report

> **Report 1 of 7** | Generated: 2026-09-15 | Method: 5 parallel source-code
> auditors
>
> **All counts derived from source code, NOT documentation.**

---

## Executive Summary

Phase 0 repository discovery is complete. Five independent auditors scanned the
entire Vaeloom codebase in parallel, producing authoritative inventories counted
from source files — not from AGENTS.md, not from docs, not from previous audit
claims.

> [!WARNING] **9 critical discrepancies** found between AGENTS.md claims and
> source-code reality. Several are documentation-only issues; others indicate
> potential product gaps.

---

## 1. Repository Structure

| Category              | Count | Evidence                                                                                                                                        |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Top-level directories | ~15   | apps, packages, integrations, connectors, sdk, plugins, docs, infra, scripts, testing, tools, .github                                           |
| Packages (monorepo)   | 25    | pnpm-workspace.yaml + nx.json                                                                                                                   |
| Dockerfiles           | 6     | api, web, graphql, mcp, rest connectors, postgres                                                                                               |
| Docker Compose files  | 3     | dev, staging, prod                                                                                                                              |
| CI/CD Workflows       | 11    | ci.yml, ci-backend, ci-frontend, ci-integration, deploy, deploy-staging, docker-build, security-audit, security-scan, a11y-audit, docs-validate |
| K8s Manifests         | Yes   | infra/kubernetes/ — deployments for api, web, agent-engine, ai-service, auth-service, document-ingestion, job-scheduler, memory-store, temporal |
| Terraform Modules     | Yes   | infra/terraform/ — vpc, eks, rds, elasticache, s3, cloudfront, ecr, iam, kms, waf, monitoring                                                   |
| Documentation Files   | 86    | docs/ across 29 subdirectories                                                                                                                  |
| Config Files          | ~20   | .env templates, next.config.js, pyproject.toml, tsconfig, tailwind, etc.                                                                        |

### Package Implementation Status

| Package        | Location           | Status      |
| -------------- | ------------------ | ----------- |
| observability  | packages/          | Implemented |
| plugin-sdk     | packages/          | Implemented |
| python-common  | packages/          | Implemented |
| queue          | packages/          | Implemented |
| service-auth   | packages/          | Implemented |
| shared-types   | packages/          | Implemented |
| ui-kit         | packages/          | Implemented |
| eslint-config  | packages/          | Config only |
| tsconfig       | packages/          | Config only |
| calendar       | integrations/      | Implemented |
| email          | integrations/      | Implemented |
| github         | integrations/      | Implemented |
| google-drive   | integrations/      | Implemented |
| notion         | integrations/      | Implemented |
| slack          | integrations/      | Implemented |
| graphql        | connectors/        | Implemented |
| mcp            | connectors/        | Implemented |
| rest           | connectors/        | Implemented |
| python SDK     | sdk/               | Implemented |
| typescript SDK | sdk/               | Implemented |
| tag-generator  | plugins/community/ | Implemented |
| word-count     | plugins/community/ | Implemented |
| sentiment      | plugins/official/  | Implemented |
| summarizer     | plugins/official/  | Implemented |
| translator     | plugins/official/  | Implemented |

---

## 2. Backend Inventory

### 2.1 API Routers & Endpoints

| Metric          | Count   |
| --------------- | ------- |
| Router files    | 36      |
| Total endpoints | **254** |

<details>
<summary>Router file list (36 files)</summary>

`admin_console.py`, `agents.py`, `analytics.py`, `anticipation.py`,
`applications.py`, `audit.py`, `auth.py`, `billing.py`, `chat.py`,
`cognition.py`, `connectors.py`, `council.py`, `documents.py`, `events.py`,
`feature_flags.py`, `federation.py`, `gmail.py`, `health.py`, `iam.py`,
`integrations.py`, `knowledge_graph.py`, `memory.py`, `notifications.py`,
`opportunities.py`, `plugins.py`, `profile.py`, `provider_keys.py`,
`recommendations.py`, `resumes.py`, `scheduler.py`, `search.py`,
`sovereignty.py`, `temporal.py`, `webhooks.py`, `workspaces.py`

</details>

### 2.2 Database Models

| Metric       | Count                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Total models | **54**                                                                                          |
| Schema file  | [schema.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/models/schema.py) |

<details>
<summary>Full model list (54)</summary>

User, Tenant, AuthSession, RevokedUserCutoff, ApiKey, Workspace, WorkspaceUser,
Connector, Document, DocumentVersion, DocumentAction, Memory, MemoryRecord,
ScaleMemoryNode, SovereignIdentity, VerifiableCredential, CrdtSyncDelta,
ProactiveProposal, Entity, Relationship, Embedding, Resume, ResumeArtifact,
ResumeSource, Application, ScheduleEvent, Agent, AgentExecution, AgentAction,
IdempotencyRecord, AgentApproval, LoopCheckpoint, ToolIdempotency,
LearningEvent, ApprovalRequest, ApprovalDecision, Permission, Event,
EventSubscription, DeadLetterEvent, Subscription, Webhook, WebhookDelivery,
UsageRecord, Notification, Integration, Plugin, PluginExecution, AgentSchedule,
GmailWatch, ProviderKey, MemoryVersion, DocumentChunk, RetentionRun

</details>

### 2.3 Migrations

| Metric           | Count                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| Total migrations | **42**                                                                                          |
| Range            | 0001_initial_schema → 0042_users_tenant_id                                                      |
| Location         | [alembic/versions/](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/alembic/versions) |

### 2.4 Services

| Metric         | Count  |
| -------------- | ------ |
| Total services | **50** |

<details>
<summary>Service list (50)</summary>

AgentCouncilService, AgentFederationService, AgentService, AnalyticsService,
AnticipationDaemonService, ApplicationService, AuditService, AuthService,
BillingService, BrowserService, CacheService, DocumentService,
ConnectorExtService, EncryptionService, EventService, CrdtSyncService,
FeatureFlagService, GDPRService, GmailService, ErasureService, IamService,
IntegrationService, KnowledgeGraphService, LLMService, MemoryService,
McpClientService, OvernightCognitionService, NotificationService,
ProfileService, ProviderKeyService, ProvenanceService, PermissionService,
RealityGapService, PluginService, ScaleMemoryService, NotebookLMService,
RecommendationService, SchedulerService, SearchService, ResumeService,
SearchRankingService, SecretsService, SovereignIdentityService, StorageService,
VerifiableCredentialsService, WebhookService, WorkspaceService, + others

</details>

### 2.5 Agents

| Metric       | Count  |
| ------------ | ------ |
| Total agents | **28** |

| Agent                   | File    |
| ----------------------- | ------- |
| AnalyticsAgent          | agents/ |
| ApplicationAgent        | agents/ |
| ATSAgent                | agents/ |
| CareerAgent             | agents/ |
| CodingAgent             | agents/ |
| ConnectorAgent          | agents/ |
| DocumentAgent           | agents/ |
| DriveAgent              | agents/ |
| GitHubAgent             | agents/ |
| GmailAgent              | agents/ |
| JobSearchAgent          | agents/ |
| LearningAgent           | agents/ |
| MemoryAgentHandler      | agents/ |
| MemoryConsolidatorAgent | agents/ |
| OrganizationAgent       | agents/ |
| PlanningAgent           | agents/ |
| PluginAgent             | agents/ |
| QAAgent                 | agents/ |
| RecommendationAgent     | agents/ |
| ReflectionAgent         | agents/ |
| ReminderAgent           | agents/ |
| ResearchAgent           | agents/ |
| ResumeAgent             | agents/ |
| SchedulerAgent          | agents/ |
| SecurityAgent           | agents/ |
| SelfImprovementAgent    | agents/ |

> [!NOTE] 28 agents matches AGENTS.md claim. However, **agent contract
> completeness** (mission, boundary, tools, scopes, autonomy, approval, timeout,
> retry, idempotency, audit) has NOT yet been verified per Section 19 of the
> plan.

### 2.6 Agent Tools

| Metric      | Count                          |
| ----------- | ------------------------------ |
| Total tools | **55** (54 explicit + 1 alias) |

<details>
<summary>Full tool list (55)</summary>

SEARCH_DOCUMENTS, QUERY_GRAPH, GET_ENTITY, CREATE_ENTITY, MERGE_ENTITIES,
CATEGORIZE_DOCUMENT, SEARCH_GMAIL, SEARCH_JOBS, LIST_CALENDAR_EVENTS,
LIST_DRIVE_FILES, SEARCH_DRIVE, DOWNLOAD_DRIVE_FILE, CREATE_GOOGLE_DOC,
READ_GOOGLE_DOC, APPEND_GOOGLE_DOC, REPLACE_GOOGLE_DOC_TEXT,
SEARCH_GREENHOUSE_JOBS, SEARCH_LEVER_JOBS, SEARCH_JOBS_BOARD,
SEARCH_OUTLOOK_MAIL, DRAFT_OUTLOOK_MAIL, LIST_OUTLOOK_CALENDAR_EVENTS,
CREATE_OUTLOOK_CALENDAR_EVENT, LIST_ONEDRIVE_FILES, SEARCH_ONEDRIVE,
DOWNLOAD_ONEDRIVE_FILE, RENAME_FILE, MOVE_FILE, DRAFT_EMAIL,
CREATE_CALENDAR_EVENT, NOTIFY_USER, COMPILE_RESUME_PDF, COMPILE_RESUME_DOCX,
COMPILE_COVER_LETTER, WEB_SEARCH, PARSE_DOCUMENT_OCR, CALCULATE_ATS_DIFF,
CALCULATE_SEMANTIC_ATS_SCORE, EXTRACT_MISSING_HARD_SKILLS, AUDIT_ATS_FORMATTING,
BROWSE_JOB_PAGE, SCRAPE_COMPANY_INSIGHTS, VERIFY_APPLICATION_LINK,
FETCH_GITHUB_REPO, CREATE_GITHUB_ISSUE, SEARCH_GITHUB_REPOS, GET_GITHUB_PROFILE,
LIST_GITHUB_ISSUES, READ_GITHUB_FILE, CREATE_GITHUB_PULL_REQUEST,
SEND_SLACK_MESSAGE, SYNC_NOTION_PAGES, EXECUTE_CODE_SANDBOX, QUERY_NOTEBOOKLM

</details>

### 2.7 Middleware

| Middleware                | File                           | Purpose                        |
| ------------------------- | ------------------------------ | ------------------------------ |
| AuthMiddleware            | middleware/auth.py             | JWT Bearer validation          |
| TenantMiddleware          | middleware/tenant.py           | Workspace/tenant context + RLS |
| CSRFMiddleware            | middleware/csrf.py             | Double-submit cookie           |
| SecurityHeadersMiddleware | middleware/security_headers.py | HSTS, CSP, X-Frame, etc.       |
| RateLimitMiddleware       | middleware/rate_limit.py       | Sliding window, per-endpoint   |
| IPAllowlistMiddleware     | middleware/ip_filter.py        | CIDR-based IP filtering        |
| BodySizeLimitMiddleware   | middleware/body_size_limit.py  | 25MB default max               |
| PromptInjectionMiddleware | middleware/prompt_injection.py | Regex + LLM classifier         |
| IdempotencyMiddleware     | middleware/idempotency.py      | Idempotency keys               |
| APIVersionMiddleware      | middleware/api_version.py      | API versioning                 |

### 2.8 Background Jobs & Workflows

| Type              | Name                    | Location                |
| ----------------- | ----------------------- | ----------------------- |
| Temporal Workflow | IngestDocumentWorkflow  | temporal/workflows.py   |
| Temporal Workflow | HelloWorkflow           | temporal/workflows.py   |
| Temporal Workflow | DurableAgentRunWorkflow | temporal/workflows.py   |
| Temporal Workflow | ApprovalWorkflow        | temporal/workflows.py   |
| Temporal Workflow | ConnectorSyncWorkflow   | temporal/workflows.py   |
| Temporal Workflow | EventTriggeredWorkflow  | temporal/workflows.py   |
| Queue Worker      | QueueWorker             | workers/queue_worker.py |

### 2.9 Events

| Component  | Details                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| Dispatcher | EventService in services/event_service.py                               |
| Models     | Event, EventSubscription, DeadLetterEvent, LearningEvent, ScheduleEvent |

---

## 3. Frontend Inventory

### 3.1 Pages & Routes

| Metric                 | Count                    |
| ---------------------- | ------------------------ |
| Total pages (page.tsx) | **41**                   |
| Layouts (layout.tsx)   | **3**                    |
| Error boundaries       | Yes (global + per-route) |
| Loading states         | Yes                      |

**Auth Pages (7):** callback, auth/callback, forgot-password, login,
reset-password, signup, verify-email

**Public Pages (5):** home, forbidden, privacy, session-expired, status, terms,
public profile

**Workspace Pages (27):** admin, agents, agents/[agentId], applications,
approvals, billing, chat, connectors, developer, developer/webhooks,
feature-flags, files, files/[documentId], history, jobs, marketplace, memory,
memory/[memoryId], notifications, organizations, page (dashboard), profile,
resume, resume/[resumeId]/edit, schedule, settings, vault

### 3.2 Components & Hooks

| Metric                       | Count                        |
| ---------------------------- | ---------------------------- |
| Components (src/components/) | **~83**                      |
| App-level components         | **~12**                      |
| Custom hooks                 | **2** (useApi, useWorkspace) |

### 3.3 State Management

- **SWR only** — no Redux, Zustand, or Context stores
- SWR policies: STATIC, SESSION, MUTABLE, LIVE
- `revalidateOnFocus` disabled globally to prevent refetch storms

### 3.4 API Client

| Property  | Value                                            |
| --------- | ------------------------------------------------ |
| Base URL  | `NEXT_PUBLIC_API_URL` ?? `http://localhost:8000` |
| Prefix    | `/api/v1`                                        |
| Auth      | Bearer token in localStorage + cookie            |
| CSRF      | X-CSRF-Token header on mutations                 |
| Transform | `transformKeys()` snake_case → camelCase         |
| Refresh   | Automatic 401 → refresh queue                    |

### 3.5 WebSocket / Realtime

> [!CAUTION] **NO REAL WEBSOCKET OR SSE IMPLEMENTATION EXISTS.**
>
> Chat "streaming" in
> [ChatWindow.tsx](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/web/src/components/chat/ChatWindow.tsx)
> uses a local `setTimeout` mock that simulates word-by-word streaming after the
> full API response returns. This is NOT server-sent events and NOT WebSocket.
>
> **Classification: DOCUMENTED + NOT IMPLEMENTED**

### 3.6 E2E Tests

| Metric           | Count  |
| ---------------- | ------ |
| Test files       | **6**  |
| Total test cases | **29** |

| File               | Cases |
| ------------------ | ----- |
| auth.spec.ts       | 6     |
| files-chat.spec.ts | 3     |
| landing.spec.ts    | 3     |
| mutations.spec.ts  | 7     |
| profile.spec.ts    | 6     |
| quality.spec.ts    | 4     |

---

## 4. Memory System Inventory

### 4.1 Memory Types (from source)

**22 types defined** in
[memory_types.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/schemas/memory_types.py)
via `MEMORY_TYPE_REGISTRY`:

Person, Organization, Project, Skill, Achievement, Education, Experience,
Certification, Publication, Patent, Award, Meeting, Task, Goal, Preference,
Constraint, Insight, Connection, Location, Event, Document, Conversation

> [!IMPORTANT] The plan (Section 13.1) lists 6 MVP memory types: Profile,
> Document, Career, Episodic, Preference, Working. The actual implementation
> uses a **completely different taxonomy** of 22 types. This is not necessarily
> wrong — it may be a more granular evolution — but the **naming mismatch**
> means the plan's verification checklist needs updating.

### 4.2 Memory Write Path (ALL 10 STAGES VERIFIED IN CODE)

```text
✅ 1. New information     → run_pipeline(filename, content)
✅ 2. Extraction           → parse_document() + extract() via LLM
✅ 3. Deduplication        → check_dedup() SHA-256 content hash
✅ 4. Normalization        → chunk_text() into TextChunk sizes
✅ 5. Entity Resolution    → merge_check(entity.name, aliases)
✅ 6. Conflict Detection   → Alias merge if duplicates found
✅ 7. Graph Update         → _populate_graph_memory → knowledge_nodes + knowledge_edges
✅ 8. Embedding            → generate_embedding() → numeric vectors
✅ 9. Vector Index          → _persist_chunks_with_embeddings → Qdrant/PGVector
✅ 10. Event                → ingest.completed event published
```

> [!TIP] The memory write path is **architecturally complete** in code. Runtime
> verification (Phase 9) will determine whether it actually executes correctly
> end-to-end.

### 4.3 Knowledge Graph

| Component           | Implementation                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Service             | [knowledge_graph_service.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/knowledge_graph_service.py) |
| Node storage        | `knowledge_nodes` table                                                                                                             |
| Edge storage        | `knowledge_edges` table                                                                                                             |
| Traversal           | BFS + DFS                                                                                                                           |
| Shortest path       | `find_shortest_path`                                                                                                                |
| Workspace isolation | Scoped by workspace + tenant context                                                                                                |

### 4.4 Vector Store

| Property        | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Primary backend | **Qdrant** (cloud/local)                                                                                            |
| Fallback        | **PGVector** (PostgreSQL pgvector extension)                                                                        |
| Embedding model | `text-embedding-3-small`                                                                                            |
| Search          | Cosine distance + metadata filtering                                                                                |
| Infrastructure  | [vector_store.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/vector_store.py) |

### 4.5 RAG (Retrieval-Augmented Generation)

| Mode     | Implementation                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Vector   | Semantic cosine search                                                                                             |
| Keyword  | Substring DB queries on chunks/entities                                                                            |
| Graph    | Knowledge graph relation expansion                                                                                 |
| Hybrid   | Normalized re-ranking + dedup across all three                                                                     |
| Location | [retrieval.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/agents/memory_agent/retrieval.py) |

### 4.6 Connectors (15 total)

| Connector       | Capability                       |
| --------------- | -------------------------------- |
| gmail           | Email read/draft                 |
| google_calendar | Calendar read/write              |
| google_drive    | Drive files read/download/search |
| google_docs     | Docs read/create/edit            |
| github          | Repos, issues, PRs, profiles     |
| greenhouse      | Job board (public)               |
| lever           | Job postings (public)            |
| jobs_board      | Meta-aggregator                  |
| outlook         | MS Graph email                   |
| graph_calendar  | MS Graph calendar                |
| onedrive        | MS Graph files                   |
| mcp             | Dynamic MCP servers              |
| slack           | Messages                         |
| notion          | Pages                            |
| browser         | Web scraping (SSRF-guarded)      |

---

## 5. Security Inventory

### 5.1 Authentication

| Layer            | Implementation                   | File                                                                                                          |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| JWT auth         | Bearer token extraction + verify | [auth.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/middleware/auth.py)               |
| Password hashing | bcrypt                           | [auth_service.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/auth_service.py) |
| Token revocation | Redis fast-path + DB truth       | auth_service.py                                                                                               |
| Token refresh    | Rotation on valid refresh        | auth_service.py                                                                                               |
| OAuth/SSO        | Google, Microsoft, SAML routes   | PUBLIC_PATHS entries                                                                                          |

### 5.2 Authorization & Tenancy

| Layer               | Implementation                               | File                                                                                                      |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| RBAC                | @require_role / @require_permission          | [rbac.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/middleware/rbac.py)           |
| Workspace ownership | check_user_workspace_access                  | [tenant.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/middleware/tenant.py)       |
| RLS                 | SET LOCAL app.tenant_id/workspace_id/user_id | tenant.py                                                                                                 |
| Encryption          | Fernet AES-256 (EncryptedString type)        | [encryption.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/encryption.py) |
| Secrets             | Infisical + env fallback                     | [secrets.py](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/infrastructure/secrets.py) |

### 5.3 Protection Layers

| Layer            | Implementation                        |
| ---------------- | ------------------------------------- |
| CSRF             | Double-submit cookie                  |
| CORS             | Restricted origins/methods/headers    |
| Rate limiting    | Sliding window (Memory/Redis)         |
| Body size limit  | 25MB default                          |
| Prompt injection | Regex scan + LLM classifier           |
| Security headers | HSTS, CSP, X-Frame-Options, etc.      |
| IP allowlist     | CIDR matching                         |
| Audit logging    | Every mutating request → audit_events |

### 5.4 Public Paths (Unauthenticated)

```text
/health, /health/ready, /health/startup, /metrics
/docs, /openapi.json, /redoc
/csrf-token
/api/v1/auth/signup, /api/v1/auth/login, /api/v1/auth/refresh
/api/v1/auth/saml/callback
/api/v1/gmail/webhook
/api/v1/consent/scopes
PREFIX: /api/v1/auth/sso/, /scim/
PREFIX: /api/v1/profile/avatar/, /api/v1/profile/public/
```

---

## 6. Critical Discrepancies — AGENTS.md vs Source Code

| #    | Claim (AGENTS.md / Docs)                                                      | Source-Code Reality                             | Severity   | Classification                   |
| ---- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ---------- | -------------------------------- |
| D-01 | "OpenAPI 110 paths"                                                           | **254 endpoints** across 36 routers             | ⚠️ MEDIUM  | DOC OUTDATED                     |
| D-02 | "60 e2e (24 gating + 36 visual)"                                              | **29 test cases in 6 files**                    | 🔴 HIGH    | COUNT INFLATED or tests removed  |
| D-03 | "28 total tools" (semantic ATS context)                                       | **55 total tools** defined                      | ⚠️ MEDIUM  | DOC OUTDATED — 28 was ATS subset |
| D-04 | "34 jest" tests                                                               | **NOT YET VERIFIED**                            | ❓ PENDING | Needs Phase 5 count              |
| D-05 | "2731 tests collected"                                                        | **NOT YET VERIFIED**                            | ❓ PENDING | Needs test run                   |
| D-06 | 6 MVP memory types (Profile, Document, Career, Episodic, Preference, Working) | **22 types** with different taxonomy            | ⚠️ MEDIUM  | EVOLVED — names differ           |
| D-07 | WebSocket/realtime listed as implemented                                      | **NOT IMPLEMENTED** — chat uses setTimeout mock | 🔴 HIGH    | DOCUMENTED + NOT IMPLEMENTED     |
| D-08 | "coverage 94% total"                                                          | **NOT YET VERIFIED**                            | ❓ PENDING | Needs test run                   |
| D-09 | "39 ADRs"                                                                     | **NOT YET VERIFIED**                            | ❓ PENDING | Needs doc count                  |

---

## 7. Baseline Risk Assessment

### P0 Candidates (Potential Release Blockers)

| ID   | Risk                                               | Evidence                                        | Phase to Verify |
| ---- | -------------------------------------------------- | ----------------------------------------------- | --------------- |
| R-01 | **No real WebSocket/SSE** — chat streaming is fake | setTimeout mock in ChatWindow.tsx               | Phase 15        |
| R-02 | **E2E test gap** — only 29 of claimed 60           | 6 test files counted                            | Phase 17        |
| R-03 | **Temporal workflows untested at runtime**         | 6 workflows defined, runtime unknown            | Phase 15        |
| R-04 | **Agent contracts incomplete**                     | 28 agents exist but contract compliance unknown | Phase 12        |
| R-05 | **Connector OAuth runtime**                        | 15 connectors defined but OAuth flow untested   | Phase 7         |

### Architecture Observations

1. **Dual execution model**: Both Temporal workflows AND a traditional queue
   worker exist — potential competing execution paths (Section 42 violation
   check needed)
2. **Enterprise features in MVP**: billing, marketplace, organizations,
   feature-flags, admin, developer pages exist in frontend — need classification
   per Section 64
3. **Scale memory (CRDT)**: SovereignIdentity, VerifiableCredential,
   CrdtSyncDelta models suggest enterprise-grade features mixed into MVP schema
4. **Large surface area**: 254 endpoints is substantial — authorization coverage
   verification will be critical

---

## 8. Next Steps — Phase 1 & 2

Phase 0 is complete. The execution order proceeds:

```text
✅ PHASE 0: Repository Discovery — COMPLETE

→ PHASE 1: Documentation/Spec Reconciliation
   - Compare all 86 docs against source reality
   - Classify every documented feature per Section 5

→ PHASE 2: Architecture/Runtime Mapping
   - Start backend server
   - Verify actual startup behavior
   - Run test suite to get real counts
   - Verify memory loop runtime
```

---

## Appendix: Evidence Sources

All findings in this report were generated by 5 independent source-code auditors
using `grep_search`, `find_by_name`, `list_dir`, and `view_file` directly
against the repository at `c:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom`.

No documentation claims were inherited without source verification.

**Status: PHASE 0 COMPLETE — PHASE 1 READY**
