# Vaeloom Glossary

> **Purpose:** Canonical definitions for Vaeloom product, architecture,
> security, and process terms. If this file and a phase-evidence file disagree,
> this file wins for current usage; phase files are frozen history. **Last
> updated:** 2026-09-15

## Access & Identity

| Term             | Definition                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ABAC             | Attribute-based access control — policy decisions on user/resource/environment attributes.                                                                   |
| API key rotation | Periodic replacement of programmatic credentials; old keys get a grace window, then stop working.                                                            |
| IAM              | Identity and Access Management — users, roles, permissions (`/api/v1/iam/*`).                                                                                |
| JWT              | JSON Web Token — Bearer credential for API auth; must be signed with a 32+ char secret (`validate_settings()` fails fast otherwise).                         |
| RBAC             | Role-based access control — permissions granted via roles; in Vaeloom enforced as a dependency-injection helper, not middleware (see F-21).                  |
| SSO              | Single sign-on — Google/Microsoft OAuth login (`/api/v1/auth/sso/{provider}`); SAML exists in ENT track (`services/saml.py`) but is not router-wired in MVP. |
| TenantContext    | Request-scoped object carrying `workspace_id`, `user_id`, `tenant_id`, set by `TenantMiddleware` from path/header.                                           |
| Workspace        | Top-level organizational unit; every resource (agents, memories, documents, connectors) belongs to one.                                                      |

## Data & Tenancy

| Term        | Definition                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GUC         | Grand Unified Configuration — Postgres session variable (`SET app.workspace_id = ...`); all RLS policies read GUCs and fail closed when unset. |
| NullPool    | SQLAlchemy pool class used in tests so each test gets an isolated `tmp_path` SQLite DB.                                                        |
| pgvector    | Postgres extension for embedding storage and vector similarity search.                                                                         |
| RLS         | Row-Level Security — Postgres policies isolating tenant rows; Vaeloom is **42/42 done** (34 via migration 0010, +3 via 0019, +5 via 0020).     |
| Fail-closed | Secure default: when tenant GUCs are missing, queries return nothing instead of everything.                                                    |

## AI / Agents

| Term                 | Definition                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent Engine         | Runtime that executes agents: routing, tool calling, approvals, audit.                                                                                                        |
| Approval gate        | Human-in-the-loop checkpoint — non-readOnly tools (e.g. MCP writes) need approval via `approval_gated_tools()` in the orchestrator loop.                                      |
| Agentic RAG          | Retrieval where the agent plans multi-hop lookups instead of one-shot search.                                                                                                 |
| Circuit breaker      | Per-agent failure guard — trips open after repeated errors, falls back per policy.                                                                                            |
| Embeddings           | Vector representations of text (`text-embedding-3-small`) for semantic search and ATS scoring.                                                                                |
| Guardrails           | Safety layer: injection classifier, scope checks, approval gates.                                                                                                             |
| HITL                 | Human-in-the-loop — a person must approve before a gated action executes.                                                                                                     |
| Injection classifier | Model that flags prompt-injection content in retrieved documents.                                                                                                             |
| Knowledge Graph      | Entity-relationship store for structured memory, with community detection and BFS/DFS traversal.                                                                              |
| LLMService           | Central LLM access singleton in tests (`mock_llm` fixture); patch both the class and the singleton when mocking.                                                              |
| MCP bridge           | Native MCP integration — external MCP server tools appear as executor tools named `mcp__<Server>__<Tool>` (scope `connector.mcp.execute`, 30s timeout, 300s discovery cache). |
| Memory Store         | Hybrid vector + relational persistence for agent memory (6 memory types, dual stores).                                                                                        |
| Model routing        | Selecting which LLM serves a request (cost/quality/latency trade-off).                                                                                                        |
| Prompt library       | Versioned, evaluated prompt templates agents run from.                                                                                                                        |
| RAG                  | Retrieval-augmented generation — grounding LLM answers in retrieved context (3 disjoint paths in Vaeloom).                                                                    |
| ReAct                | Opt-in LLM-driven tool-calling loop (`AGENT_REACT_ENABLED=1`); default off for safe local/test runs.                                                                          |
| Semantic ATS score   | Embeddings-cosine (+ keyword gazetteer fallback) resume-vs-job match score (`calculate_semantic_ats_score`).                                                                  |
| Supervisor / Loop    | Orchestrator pattern — router picks agents, supervisor DAGs them, loop iterates to completion.                                                                                |
| Tool calling         | Agents invoking typed tools (61 total registered: 4 ATS-adjacent incl. 3 semantic ATS, browser, MCP-bridged).                                                                 |

## Documents & Resume Pipeline

| Term              | Definition                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document builder  | `services/document_builder.py` — renders PDF (Playwright Chromium) / DOCX (python-docx) / HTML from tailored resume data, with a page-fit shrink loop.          |
| Resume artifact   | Compiled output row (`resume_artifacts` table, migration 0023, workspace RLS): `GET /resumes/{id}/artifacts`, download via `/resumes/artifacts/{aid}/download`. |
| Tailor            | AI rewrite of a resume variant for a target role (`POST /resumes/{id}/tailor`, `compile`, `cover-letter`, `cheatsheet`).                                        |
| Template registry | 5 data-only industry templates (`services/resume_templates.py` + Jinja2 HTML); `suggest_template()` maps role to template.                                      |

## Browser Tools

| Term                  | Definition                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| BROWSER_TOOLS_ENABLED | Kill switch for `browse_job_page`, `scrape_company_insights`, `verify_application_link`.                                                |
| SCRAPE_QUOTA_PER_HOUR | Per-workspace scrape budget (default 20/h).                                                                                             |
| SSRF guard            | `utils/url_guard.py` — https-only + global-IP enforcement for fetched URLs; DNS failure maps to `expired_or_error`, not a policy block. |

## API & Frontend

| Term                     | Definition                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| camelCase / snake_case   | Backend serializes `access_token`; frontend expects `accessToken` — converted by `transformKeys()` in `api.ts`/`api-client.ts`. Any new client needs the same. |
| CSRF                     | Cross-site request forgery protection — Redis backend; auth routes exempt via `SKIP_PREFIXES`, `/csrf-token` in `PUBLIC_PATHS`.                                |
| Enterprise-gated routers | 10 routers excluded unless `enterprise_routes_enabled` — by design, not missing coverage.                                                                      |
| OpenAPI spec             | `docs/backend/openapi.yaml` — v0.2.0, **162 paths / 203 ops**, regen via `scripts/gen_openapi.py`.                                                             |
| PUBLIC_PATHS             | Auth-middleware allowlist (`middleware/auth.py`); includes `/csrf-token`.                                                                                      |
| SKIP_PREFIXES            | CSRF-exempt prefixes (`middleware/csrf.py`); includes `/api/v1/auth`.                                                                                          |
| SSE                      | Server-Sent Events — streaming transport for `POST /agents/{id}/execute?stream=true`.                                                                          |
| transformKeys            | Frontend util converting API snake_case responses to camelCase.                                                                                                |

## Delivery Process

| Term             | Definition                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 66 phase prompts | Governing execution contract — 3 tracks x 22 phases under `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/`; start at `00-master-index.md`. |
| ADR              | Architecture Decision Record — `docs/adr/ADR-001..ADR-044` (44 total).                                                                                    |
| ENT track        | Enterprise track phases (`ent-p00..p21`, not started) — SAML wiring, SOC 2 evidence, mobile audit execution.                                              |
| Finding 39       | Known full-suite xdist hang/crash — use per-file runs, serial (`-o addopts=""`, ~8-10min), or `--dist loadfile` (~2-3min, needs 32GB).                    |
| Gate             | Weighted pass/fail review ending each phase (GO / CONDITIONAL GO / NO-GO).                                                                                |
| Handoff          | Phase output document passing context, registers, and open risks to the next phase.                                                                       |
| Spec-Only        | Document status meaning planning baseline only — no runtime implementation claimed.                                                                       |
| xdist            | `pytest-xdist` parallel runner (`addopts = "-n 4"` default, ~1.2GB; 16 workers ≈ 4-5GB).                                                                  |

## Operations & Compliance

| Term            | Definition                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| DR              | Disaster recovery — backups, restore drills, runbooks (`docs/architecture/Disaster-Recovery.md`).                                                |
| RTO / RPO       | Recovery time objective / recovery point objective — max tolerable downtime / data loss.                                                         |
| SLO / SLI / SLA | Service level objective / indicator / agreement — targets, measurements, commitments.                                                            |
| SOC 2           | Trust-services compliance framework — Type I (design) then Type II (operating effectiveness); see Roadmap.                                       |
| OTel            | OpenTelemetry — tracing setup + correlation IDs (FastAPI auto-instrumentation active; FastAPI 0.141.1 needs a shim — see `.agents/findings/37`). |
| SBOM / SLSA L2  | Supply-chain attestations — software bill of materials, build provenance level 2.                                                                |
