# Vaeloom Feature Completeness Inventory — 2026-11-05

**Scope:** every major product surface in the monorepo — API, web app, agents, memory,
career, connectors, enterprise admin, and platform/delivery.

**Revision audited:** `3ddc7c11` (`fix(capabilities): badges report live rows first`,
2026-10-23) **plus the dirty working tree** (188 changed paths). This is not a tagged
release. Percentages describe the working tree as found, not a shipped artifact.

**Method:** code and configuration inspection, committed generated artifacts, route
manifests, migration state, CI workflow definitions, and targeted test execution. Phase
gate reports and status documents were treated as *claims*, not proof, and are checked
against code where the two disagree.

**Percentages are estimates.** They measure *implemented behaviour against the scope
declared in the repo's own specs*, not quality, scale, or production fitness. The
calibration is stated in §8 so a reader can disagree with a specific row rather than
with the whole table.

---

## 1. Executive verdict

| Score | Value | Meaning |
| --- | ---: | --- |
| **Core product completeness** | **~70%** | 36 user-facing features (auth, workspace, chat/agents, memory, documents, career). Mean of the row scores: 69.8. |
| **Enterprise/admin completeness** | **~45%** | 11 enterprise features (orgs, RBAC, SCIM, audit, billing, flags, IAM, federation, mobile). Mean: 45.0. |
| **Whole declared scope** | **~64%** | All 47 audited rows. Mean: 64.0. |
| **Production / enterprise readiness** | **~45–50%** | Cross-cutting readiness dimensions in §5. Delivery is the binding constraint and currently fails. |

**One-line verdict:** Vaeloom is a broad, genuinely engineered product with a strong
memory subsystem, a real agent loop, and unusually good tenancy work — but it is not a
production platform, and the repo's own "100% complete / 97.2 per screen" claims cannot
survive contact with the delivery configuration.

The gap between ~70% core completeness and ~45% production readiness is the headline.
Feature breadth is real; operational depth is not. A demo can be given today. A customer
cannot be onboarded onto a self-serve production deployment today.

### What is genuinely strong

- **Memory subsystem depth.** Domain-pack type taxonomy, supersede with vector-store
  upsert/purge, lineage, import/export, bulk ops, generated frontend union, and a
  migration chain that asserts schema-wide RLS coverage.
- **Agent loop safety.** A 4,101-line loop with ReAct, approval gating, QA verification,
  spend/token/tool ceilings, and a dedicated safety test file proving rejected act
  results never reach the user.
- **RLS discipline.** Tenant and user GUCs, FORCE RLS, fail-closed reads, and a migration
  guard that fails the chain when a public table lacks RLS or a policy.
- **Auth hardening.** HttpOnly cookie delivery, refresh rotation, session listing and
  revocation, single-use WebSocket tickets, MFA with recovery codes, and removal of
  browser-readable legacy tokens.
- **Document pipeline.** 44 document endpoints, versioning, ingestion, and Playwright
  Chromium PDF rendering with an explicit 503 when the browser is absent.
- **Connector reality when configured.** Composio OAuth/MCP integration fails closed with
  named error codes (`COMPOSIO_API_KEY_REQUIRED`) instead of pretending to work.
- **Contract and artifact discipline in CI.** OpenAPI sync, generated type union, design
  tokens, and tool fallback manifests are all checked byte-for-byte.

### What is presentation-layer only

- **Billing** plans, prices, feature lists, and quota caps are hardcoded and labelled
  illustrative; there is no payment provider and invoice download returns JSON.
- **Marketplace** install counts are seeded fixtures (1420, 890, 2100, …), not measured.
- **Job search** invents listings with an LLM when no job-board key is configured, then
  falls back to a static mock list. The UI does not label them synthetic.
- **Notifications** mark email/Slack/push rows `sent` without calling any provider.
- **Admin** falls back to mock data and does label it ("backend IAM not reachable"), which
  is the right behaviour but still means the screen is not proof of the feature.

---

## 2. Evidence base (measured this session)

| Metric | Value | How measured |
| --- | ---: | --- |
| Committed OpenAPI | **296 paths / 364 operations**, version `0.2.0` | parsed `specs/api/openapi.yaml` and `docs/backend/openapi.yaml` (both identical) |
| Backend tests collected | **5,342** | `pytest --collect-only -q -o addopts=""` (46.25s) |
| Backend test files | **433** | recursive count of `apps/api/tests/test_*.py` |
| ORM models | **75** | `class` count in `apps/api/src/api/models/schema.py` |
| Alembic migrations | **70** | `apps/api/alembic/versions/` |
| API router modules | **47** | `apps/api/src/api/routers/` (excluding `__init__.py`) |
| Agent packages | **30** | `apps/api/src/api/agents/` |
| Tool definitions | **67** | `apps/api/src/api/tools/definitions.py` |
| Next.js pages | **71** | recursive `page.tsx` count |
| Route manifest entries | **31 live / 4 preview** | `apps/web/src/lib/route-manifest.ts` |
| Frontend test files | **89** (52 component, 17 app, 10 lib, 5 `__tests__`, 4 hooks, 1 trigger) | recursive `*.test.*` / `*.spec.*` |
| Playwright specs | **12** (2,290 lines) | `apps/web/e2e/*.spec.ts` |
| ADRs | **49** | `docs/adr/` |
| Documentation pages | **511** | `docs/**/*.md` |
| CI workflows | **13** | `.github/workflows/*.yml` |
| Spot-check test run | **27 passed** | capabilities/plugin registry + memory types + ReAct safety, serial |

The full suite was **not** run end-to-end: AGENTS.md documents that `-n 4` crashes on
Windows and that serial is the only trustworthy whole-suite mode. A 5,342-test serial run
was out of scope for this audit. The 27-test spot check is evidence of current health in
three high-value areas, not evidence that all 5,342 pass.

---

## 3. Documentation vs. code: the status conflict is itself a finding

| Claim | Where | What the code/config shows |
| --- | --- | --- |
| All 66 phases closed (MVP 22/22, CONT 22/22, ENT 22/22); ENT scored ~97.2/100 | `specs/phase-contracts/EXECUTION-STATUS.md`, `evidence/phases/ent/ent-p21/` | `docs/ROADMAP.md` says "ENT track not started"; `deploy.yml` has no push trigger and documents 19/23 unbuilt images; enterprise routes default **off** |
| Production deployment validated, 99.98% uptime, 1.4M transactions | `evidence/phases/ent/ent-p20/06-gate-report.md` | The deploy workflow has never been enabled; the audit's own comments call the API Deployment unstartable |
| 284 paths / 351 ops | `README.md`, `docs/ROADMAP.md` | **296 / 364** in the committed spec |
| 4,620 or 3,971 tests | `README.md`, `VAELOOM_Complete_Report.md` | **5,342 collected** |
| OpenAPI badge says 162 paths; coverage badge says 94% | `README.md` header | Badges are placeholders; the spec has 296 paths and frontend coverage floors are 53/49/47/54 |
| SAML is "not wired to the router" | `AGENTS.md` known gaps | SAML is wired at `routers/auth.py:628-764` with `signxml` |
| Enterprise track complete, SOC 2 next | `docs/ROADMAP.md` | Roadmap itself contradicts the enterprise evidence bundle |

The 2026-09-26 `ENTERPRISE-PRODUCTION-READINESS-PLAN.md` NO-GO verdict is closer to the
code than the later "100% complete" evidence. Several plan items have since been fixed
(route manifest, invitation binding, org role enforcement, localStorage token removal),
so the checklist is stale in both directions — but the structural blockers it names
remain visible in the current tree.

---

## 4. Feature inventory

Status legend: **Shipped** ≥80, **Partial** 55–79, **Thin** 35–54, **Stub** <35.

### 4.1 Identity, tenancy, and access

| # | Feature | What actually works | Evidence | % | Status |
| ---: | --- | --- | --- | ---: | --- |
| 1 | Signup / login / sessions | Signup, login, refresh rotation, logout, session list, per-session revoke, revoke-others; HttpOnly cookie delivery; legacy localStorage tokens deleted | `routers/auth.py` (21 endpoints), `auth_service.py`, `lib/api.ts:154-224` | 88 | Shipped |
| 2 | MFA (TOTP) | Setup, enable, verify, recovery codes, challenge token, login enforcement, UI card | `routers/auth.py:767-800`, `totp_service.py`, `settings/security/page.tsx` | 85 | Shipped |
| 3 | SSO / OIDC | Google/GitHub login, callback, account linking | `routers/auth.py:376-467` | 75 | Partial |
| 4 | SAML 2.0 | Metadata, login redirect, signed assertion callback via `signxml` | `routers/auth.py:628-764`, `services/saml.py` | 65 | Partial |
| 5 | RBAC / permissions | Role fields, org role enforcement in services, RBAC dependency helper | `middleware/rbac.py` (23 lines), `organization_service.py` | 55 | Partial |
| 6 | API keys | Create/list/revoke; hashed storage | `routers/api_keys.py` (4 endpoints) | 60 | Partial |
| 7 | Organizations / invitations | Org CRUD, membership, invitation accept bound to email | `routers/organizations.py` (11), `organization_service.py` | 65 | Partial |
| 8 | SCIM provisioning | Users/groups/token endpoints | `services/scim.py`; `POST /scim/tokens` has no auth dependency (`scim.py:105-129`) | 40 | Thin |
| 9 | Workspaces / membership | Workspace CRUD, member listing, tenant scoping | `routers/workspaces.py` (11) | 85 | Shipped |
| 10 | Onboarding | Step state, completion, reset, resume upload, join workspace | `routers/onboarding.py` (6) | 75 | Partial |

**Identity gaps that matter:** native JWTs carry no role claims; API-key permissions are
stored but not enforced; `require_workspace_access()` is a stub; the organization
workspace-admin fallback is unscoped; audit events have no hash chain; `ErasureService`
exists but has no importer (dead code); signup generates an email-verification token but
never sends it (`auth_service.py:225-233`; the only callers of `email_service` are password
reset and organization invitations).

### 4.2 Agents, chat, and automation

| # | Feature | What actually works | Evidence | % | Status |
| ---: | --- | --- | --- | ---: | --- |
| 11 | Chat + streaming | Workspace chat, SSE token streaming, single-agent and supervisor paths | `routers/chat.py`, `orchestrator/loop.py` | 85 | Shipped |
| 12 | Agent orchestration | 30 agent packages, 67 tool definitions, ReAct, routing, capability registry, sub-agents | `agents/`, `tools/`, `orchestrator/` (~10k lines) | 75 | Partial |
| 13 | Approvals / human-in-the-loop | Approval objects, approve/reject API, UI queue, loop gate | `routers/` approvals, `orchestrator/loop.py`, `approvals/page.tsx` | 80 | Shipped |
| 14 | Schedules / background jobs | Scheduler CRUD, Temporal workflows/activities, queue worker | `routers/scheduler.py` (11), `temporal/` (~3k lines), `workers/queue_worker.py` | 70 | Partial |
| 15 | Realtime WebSocket | Single-use ticket auth, channel manager, broadcast, status | `routers/realtime.py`, `infrastructure/websocket_manager.py` | 75 | Partial |
| 16 | Notifications | CRUD, templates, subscriptions, subscriber webhook fan-out | `notification_service.py:47-57` marks email/Slack/push `sent` without a provider call | 45 | Thin |

**Agent caveat:** all 30 packages exist, but several handlers are thin deterministic
wrappers around an LLM call or a fixed ladder. Breadth of the catalog overstates the
depth of individual agents. The loop itself is the strongest part.

### 4.3 Memory and knowledge

| # | Feature | What actually works | Evidence | % | Status |
| ---: | --- | --- | --- | ---: | --- |
| 17 | Memory CRUD + type packs | Create/read/update/delete, domain-pack validation, status, tags, source types | `routers/memory.py`, `memory_service.py`, `memory_type_packs.py` | 90 | Shipped |
| 18 | Memory vector search | Embeddings, tenant/workspace/source filters, visibility re-query, top-k | `memory_service.search_memories`, Qdrant client | 80 | Shipped |
| 19 | Corrections / supersede / lineage | Supersede upserts successor and purges predecessor; lineage endpoint; corrections UI | `memory_service.supersede_memory`, `routers/memory.py:275`, `memory/corrections` | 85 | Shipped |
| 20 | Import / export / bulk ops | JSON export, validated import, bulk status, bulk tag | `routers/memory.py:456-595` | 85 | Shipped |
| 21 | Knowledge graph | Node/edge CRUD, traversal, path queries, embeddings | `routers/knowledge_graph.py` (11), `knowledge_graph_service.py` | 65 | Partial |
| 22 | Context engine / compaction | Token budgets, ranking, filtering, retrieval plans, compactor | `context_engine.py` (`token_budget=2000`), `orchestrator/compactor.py` | 80 | Shipped |
| 23 | Global search | Cross-entity search with fail-closed tenant/workspace guard | `search_service.py`; ILIKE on title/summary only — encrypted `Memory.content` cannot match | 60 | Partial |
| 24 | Vault (Obsidian) sync | Status, config, sync trigger, ingest, logs, conflicts + history + resolve, client download | `routers/vault_sync.py` (10 endpoints, 1.2k lines) | 65 | Partial |
| 25 | Sovereign / CRDT sync | DID identity, verifiable credentials, push/pull deltas | `routers/sovereignty.py` (8), `crdt_sync_service.py` | 55 | Partial |

### 4.4 Documents, career, and connectors

| # | Feature | What actually works | Evidence | % | Status |
| ---: | --- | --- | --- | ---: | --- |
| 26 | Files / documents / ingestion | Upload, versions, metadata, extraction, preview, document chat | `routers/documents.py` (44), `routers/files` pages | 85 | Shipped |
| 27 | Resume builder / compile | Structured resume, editor, HTML→PDF via Playwright, JSON Resume import | `routers/resumes.py` (14), `document_builder.py`, `resume/[resumeId]/edit` | 80 | Shipped |
| 28 | ATS analysis | Semantic + keyword scoring, gap report, rewrite suggestions | `ats_agent`, `semantic_ats_tools.py` | 75 | Partial |
| 29 | Job search | Real job-board/Greenhouse client **when keyed**; otherwise LLM-invented listings; static mock as last resort | `job_search_agent/handler.py:78-190`; no synthetic-data disclosure in UI | 50 | Thin |
| 30 | Applications tracker | Application CRUD, statuses, timeline, documents | `routers/applications.py` (4), `applications/page.tsx` | 70 | Partial |
| 31 | Connectors (Composio + MCP) | OAuth initiation, connection status, MCP tool discovery/call, sync, disconnect; fail-closed diagnostics | `routers/connectors.py` (23), `composio_service.py`, `mcp` bridge | 70 | Partial |
| 32 | Gmail / email | Watch, drafts, message list, status, webhook | `routers/gmail.py` (8), `gmail_client.py`; email page is `preview` | 60 | Partial |
| 33 | Calendar | OAuth client, event operations, agent handler | `clients/calendar_client.py`, `calendar_agent` | 50 | Thin |
| 34 | GitHub | OAuth client, repo/issue operations, agent handler | `clients/github_client.py`, `github_agent` | 65 | Partial |
| 35 | Google Drive | OAuth client, file operations, agent handler | `clients/drive_client.py`, `drive_agent` | 55 | Partial |
| 36 | Career history / strategy | Strategy endpoint, history page, profile-backed career data | `routers/career.py`, `career/page.tsx` (`preview`) | 65 | Partial |

**Career caveat:** application submission is proposal-only — the system prepares an
application and asks for approval; it does not submit to an ATS. Integrations are mostly
metadata CRUD; `integration_service.sync()` stamps `last_sync_at` without syncing.

### 4.5 Enterprise and platform

| # | Feature | What actually works | Evidence | % | Status |
| ---: | --- | --- | --- | ---: | --- |
| 37 | Audit log | Event recording, query, CSV/JSON export, admin UI | `services/audit.py`, `routers/audit.py`; plain inserts, no hash chain or tamper evidence | 50 | Thin |
| 38 | Billing | Subscription/usage/invoice derivation from local data; UI | `billing_service.py`; no Stripe/payment provider; invoice download is JSON (`routers/billing.py:61-79`); plans/caps illustrative | 30 | Stub |
| 39 | Feature flags | CRUD, categories, UI tabs | `routers/feature_flags.py`; no rollout evaluation; `workspace_id` accepted from query without membership check | 40 | Thin |
| 40 | Admin console | IAM users, audit events, service health, run-action buttons | `admin/page.tsx` (369 lines), `routers/admin_console.py` (12); labelled mock fallback | 60 | Partial |
| 41 | Analytics | Event ingestion + five analytics endpoints | `routers/analytics.py`; no workspace analytics page in the web app | 45 | Thin |
| 42 | Marketplace / plugins | Listings, install/uninstall state, reviews, sandboxed subprocess execution | `routers/marketplace.py` (8), `plugin_sandbox.py`; seeded install counts | 60 | Partial |
| 43 | Webhooks | CRUD, secret handling, delivery attempts | `routers/webhooks.py` (7); non-durable, default-off | 50 | Thin |
| 44 | IAM | User/role/permission management API + UI | `routers/iam.py` (9) | 55 | Partial |
| 45 | Recommendations | Feedback, indexing, preference vectors, recommendation generation | `routers/recommendations.py` (5), `recommendation_service.py` | 60 | Partial |
| 46 | Federation | Capability-credential-gated peer dispatch | `routers/federation.py` (1); no peer discovery or transport layer | 35 | Thin |
| 47 | Mobile | Architecture document only; no app in `apps/` | `docs/frontend/Mobile-Architecture.md`; roadmap says audit pending | 10 | Stub |

**Enterprise gate:** billing, plugins, analytics, audit, IAM, recommendations, webhooks,
admin, SCIM, and feature flags are mounted **only** when
`settings.enterprise_routes_enabled` is true; the default is **False**
(`config.py:206`, `main.py:558-571`). In a default deployment those features are not
reachable, and they are absent from the committed OpenAPI for that reason.

---

## 5. Cross-cutting readiness

| Dimension | Score | Rationale and evidence |
| --- | ---: | --- |
| Tenancy / RLS | 70 | Strong policy coverage and a migration that fails on missing RLS; ~25 `USING (true)` service policies put app-layer scoping in the critical path; transaction-scoped GUC footguns documented |
| Authentication | 80 | Cookie sessions, rotation, MFA, WS tickets; verification email not delivered is a real onboarding defect |
| Authorization | 45 | Roles exist but are not in native JWTs; API-key permissions unenforced; workspace-access helper stubbed; SCIM token mint unauthenticated |
| Test suite | 60 | 5,342 tests / 433 files, real negative controls in places; xdist crash on Windows; frontend coverage floors 53/49/47/54; some gates historically hollow |
| CI | 70 | Lint, typecheck, build, Jest, pytest, Playwright, security scans, OpenAPI sync, generated-artifact checks; 13 workflows |
| CD / deployment | 20 | `deploy.yml` deliberately has no push trigger; 19/23 K8s images never built; API Deployment unstartable (port 4000 vs 8000); no post-deploy smoke test; load-test gate is `echo` |
| Observability | 60 | OTel OTLP, hand-rolled Prometheus metrics, 4 Grafana dashboards, alert rules; no evidence of a running production stack |
| Documentation | 55 | 49 ADRs and 511 docs — unusually rich, but status claims are stale or contradicted; AGENTS.md has at least one stale known gap |
| Frontend UX consistency | 60 | 71 pages, shared ui-kit, route manifest with `dataMode`; several preview routes, mock fallbacks, and hardcoded illustrative data |
| Compliance / SOC 2 | 25 | Control narratives not frozen; audit log lacks tamper evidence; erasure service unwired; roadmap says SOC 2 Type I is next |
| Mobile | 10 | No application code |
| **Mean** | **≈50** | Effective production readiness is lower (~45%) because deployment is a binary gate and currently fails |

The mean is deliberately unweighted. A weighted score would be *lower*, not higher,
because delivery and compliance carry hard-gate weight in any real enterprise review.

---

## 6. Blockers to 100% (ranked)

### P0 — prevents a production deployment

1. **The delivery path is intentionally disabled.** `.github/workflows/deploy.yml` has no
   `push` trigger and lists its own blockers: untested builds, 19/23 unbuilt images,
   unstartable API Deployment, no smoke test, unverified rollback.
2. **SCIM token minting is unauthenticated.**
   `services/scim.py:105-129` issues provisioning tokens without an auth dependency.
3. **Authorization is not enforced end-to-end.** Native JWTs have no roles; API-key
   permissions are decorative; `require_workspace_access()` is a stub; the org
   workspace-admin fallback is unscoped.
4. **Email verification is never sent.** Signup and resend create tokens but do not call
   `email_service`; only password reset and organization invitations do.
5. **Notifications claim delivery without delivering.** Email/Slack/push rows are marked
   `sent` with no provider call (`notification_service.py:47-57`).
6. **Job search fabricates listings.** With no job-board key, an LLM invents "realistic"
   jobs, then a static mock list; the UI does not disclose synthetic data.
7. **Audit trail has no tamper evidence.** `audit_service.record_event` is a plain insert;
   no hash chain, signature, or append-only guarantee. `ErasureService` is unwired.
8. **Billing cannot take money.** No payment provider, invoice download is a JSON stub,
   plans and caps are illustrative.
9. **Enterprise routes are off by default.** Ten feature areas are unreachable in a
   default deployment and excluded from the committed contract.
10. **Feature-flag scoping and evaluation are missing.** `workspace_id` comes from the
    query without a membership check; there is no evaluation/rollout engine.

### P1 — prevents enterprise sale or credible operations

11. **Frontend coverage is thin and the gate is low** (53/49/47/54), so regressions in
    the 71-page app are weakly caught.
12. **Backend full-suite execution is unreliable** on Windows under xdist; CI runs Linux,
    but local verification cannot reproduce the gate.
13. **Integrations mostly do not sync.** `integration_service.sync()` only stamps a
    timestamp; real sync lives in specific connector paths.
14. **Webhooks are non-durable and default-off**; delivery retries and dead-lettering are
    not proven.
15. **SAML is wired but untested against a real IdP**; no metadata exchange test, no
    replay/clock-skew evidence.
16. **Marketplace trust signals are seeded.** Install counts and review aggregates are not
    measured.
17. **No mobile client** despite a documented architecture and roadmap item.
18. **Documentation status is not trustworthy.** The 66/66 and 97.2/100 claims must be
    retracted or reconciled before any customer or auditor reads them.

---

## 7. Fastest path to a credible 90%

Ordered by leverage, not by effort:

1. **Make deployment boring.** Fix the API manifest, build every referenced image, add a
   `needs:` chain from test→build→deploy, add a post-deploy smoke test, and gate rollback
   on re-verification. Until this is green, every other percentage is academic.
2. **Close the auth holes.** Authenticate SCIM token minting, put roles in access tokens,
   enforce API-key scopes, implement `require_workspace_access()`, and scope the org
   workspace-admin fallback.
3. **Stop claiming work that is not done.** Label synthetic jobs, seeded marketplace
   counts, illustrative billing, and mock notification delivery in the API response and
   the UI — or remove the surfaces until they are real.
4. **Send the verification email.** The token infrastructure already exists; wire it to
   `email_service` and add a test that asserts a provider call or dev-log entry.
5. **Make notifications real or explicitly queued.** Either call Resend/SMTP/Slack or mark
   rows `queued`, not `sent`.
6. **Add tamper evidence to audit.** Hash-chain each event with the previous digest and
   expose a verify endpoint; wire `ErasureService` to the deletion path.
7. **Raise the frontend floor incrementally.** Start at current measured coverage, add
   per-directory thresholds for memory, chat, and documents, and block decreases.
8. **Decide the enterprise gate.** Either default `enterprise_routes_enabled=True` for
   self-hosted/enterprise builds with tests, or document it as an opt-in module and stop
   scoring those features as delivered.
9. **Reconcile the paperwork.** Rewrite `EXECUTION-STATUS.md`, `README.md`, and the ENT
   evidence claims against measured values (296/364, 5,342, deploy disabled). Delete or
   archive contradictory gate reports.

---

## 8. Calibration and caveats

**How scores were assigned.** Each row is judged on four questions, equally weighted:

1. Does the backend implement the behaviour, or only the route?
2. Does the web app expose it against a real API (not fixtures)?
3. Does it work without a human supplying an undocumented key or manual step?
4. Is there test evidence for the happy path and at least one negative path?

A row at 90+ is real, tested, and usable end-to-end. 70–89 is real but has a material gap
(delivery, coverage, or a fallback). 55–69 is implemented but shallow, gated, or dependent
on external configuration. 35–54 is a route plus partial logic. Below 35 is a stub or
documentation only.

**What this audit did not prove:**

- No production or staging access; no live IdP, payment provider, job board, or SaaS
  OAuth credentials were used.
- No full serial pytest run; the 27-test spot check is not a suite verdict.
- No load, chaos, penetration, or accessibility test was executed.
- The working tree is dirty (188 paths). Scores describe that tree, not `3ddc7c11` alone.
- "Completion" is against the repo's declared scope. If the intended product is only the
  core career/memory workspace, use the **~70%** figure; if it is the full MVP + CONT +
  ENT programme in the phase contracts, use **~64%**.

**Bottom line.** The engineering is real and often thoughtful. The claims are not. Treat
Vaeloom as a strong, broad prototype with production-grade pieces inside it — not as a
completed platform — until the P0 list is closed and the status documents are rewritten to
match the code.
