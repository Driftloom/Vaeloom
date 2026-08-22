# Vaeloom Findings Index

**Last Updated:** 2026-08-22 — Agentic Closure Zero-Trust Audit (8 gaps + 7
polish) + Full Working-Tree Verification at `e92f352`

**New:** `35-agentic-closure-zero-trust-2026-08-22.md` — 11 findings (2 HIGH
self-flag on this session's ReAct/MVP-bypass, 5 MEDIUM, 3 LOW, 1 INFO) — honest
audit of the agentic-gap closure work.

## Structure

- **`archive/`** — 30 fully-fixed findings (all issues resolved, no open items)
- **Main directory** — 27 files with open/partially-open findings (active work)

## Summary

| Category        | Total  | Fixed (Archived) | Open (Active)             |
| --------------- | ------ | ---------------- | ------------------------- |
| Middleware/Main | 7      | 5                | 2                         |
| Doc Fiction     | 14     | 14               | 0                         |
| Router Auth     | 7      | 2                | 5 (orchestrator deferred) |
| RLS             | 5      | 2                | 3                         |
| Phase Reports   | 4      | 3                | 1                         |
| Legacy Audits   | 8      | 1                | 7                         |
| Phase Prompts   | 4      | 4                | 0                         |
| Agentic Closure | 11     | 0                | 11 (2 HIGH self-flag)     |
| **TOTAL**       | **60** | **31**           | **29**                    |

---

## Active Findings (Main Directory)

| ID  | Finding                                      | File                      | Fix                         |
| --- | -------------------------------------------- | ------------------------- | --------------------------- |
| —   | Approval gate hardcoded `has_approval=False` | `orchestrator/loop.py:82` | Added `lookup_approval()`   |
| —   | `set_rls_session_vars()` dead code           | `middleware/tenant.py:40` | Wired into `get_db()`       |
| —   | GUC `app.tenant_id` never SET                | `middleware/tenant.py:55` | Now set on every DB session |
| —   | `TenantMiddleware` not mounted               | `main.py:122`             | Added to middleware stack   |
| —   | CORS innermost                               | `main.py:108-130`         | Moved to outermost          |
| —   | Prometheus commented out                     | `main.py:135-136`         | Uncommented                 |
| —   | OTel commented out                           | `main.py:136`             | Uncommented                 |
| —   | P00-P07 NestJS architecture                  | 5 prompts                 | Updated to FastAPI monolith |
| —   | P00-P07 directory paths                      | 5 prompts                 | Updated to `apps/api`       |
| —   | P00-P07 memory types                         | 5 prompts                 | Updated to 22 types         |

---

## Fixed Findings — This Session (2026-08-17 Sweep)

| ID               | Severity    | Finding                                                    | File                                    | Fix                                                                         |
| ---------------- | ----------- | ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| FIND-MAIN-001    | P0-CRITICAL | TenantMiddleware trusts client-supplied headers            | `middleware/tenant.py:76-92`            | JWT tenant_id preferred over headers; mismatch logged                       |
| FIND-GDPR-001    | P0-CRITICAL | SQL injection via f-string in GDPR export/delete           | `services/gdpr.py:48-57`                | Added `_validate_table()` whitelist + `EXPORT_COLUMNS` per-table            |
| FIND-GDPR-002    | P0-CRITICAL | GDPR export uses `SELECT *` exposing password_hash, tokens | `services/gdpr.py:44-72`                | Replaced with per-table column whitelists                                   |
| FIND-RET-001     | P0-CRITICAL | SQL injection via f-string in retention service            | `services/retention.py:53-80`           | Added `ALLOWED_RETENTION_TABLES` whitelist                                  |
| FIND-APPR-001    | P1-HIGH     | SQL injection pattern in approval list query               | `services/approval.py:126-141`          | Validated status filter against enum; kept parameterized                    |
| FIND-APPR-002    | P1-HIGH     | Approval endpoint missing workspace isolation              | `services/approval.py:107-148`          | Added `user_workspaces` filter param                                        |
| FIND-MAIN-002    | P1-HIGH     | IP Allowlist middleware not mounted                        | `main.py:122-137`                       | Added `IPAllowlistMiddleware` conditional mount                             |
| FIND-MAIN-003    | P1-HIGH     | Prometheus import has no guard                             | `main.py:166-168`                       | Wrapped in try/except with logger.warning                                   |
| FIND-CSRF-001    | P1-HIGH     | CSRF bypass via X-Requested-With header                    | `middleware/csrf.py:59-63`              | Removed XHR bypass; API key bypass kept                                     |
| FIND-AUTH-001    | P1-HIGH     | No session logout endpoint                                 | `routers/auth.py`                       | Added `POST /auth/logout` (revokes session)                                 |
| FIND-AUTH-002    | P2-MEDIUM   | Auth endpoints use default 100 req/60s limit               | `routers/auth.py:20-36`                 | Added `@rate_limit(5, 3600)` signup, `@rate_limit(10, 60)` login            |
| FIND-MAIN-004    | P2-MEDIUM   | Dual Prometheus instrumentation                            | `main.py:166-168`                       | Guarded both Instrumentator and OTel with try/except                        |
| FIND-MAIN-007    | P2-MEDIUM   | OPTIONS requests rate-limited                              | `middleware/rate_limit.py:140-142`      | Skip OPTIONS method from rate limiting                                      |
| FIND-EXC-001     | MEDIUM      | Generic exception handler swallows errors (no log)         | `middleware/exception_handler.py:20-31` | Added `logger.exception()` + correlation_id in response                     |
| FIND-SECRET-001  | MEDIUM      | Hardcoded `minioadmin` storage secret not validated        | `config.py:97-101`                      | Added validation for non-local environments                                 |
| FIND-CORS-001    | LOW         | CORS allows localhost in all environments                  | `config.py:133-136`                     | Added warning when localhost in non-local env                               |
| FIND-DB-001      | LOW         | Database pool size hardcoded                               | `database.py:8-14`                      | Made configurable via `db_pool_size`/`db_max_overflow` settings             |
| FIND-GMAIL-001   | MEDIUM      | Gmail webhook has no signature verification                | `routers/gmail.py:97-112`               | Added `X-Goog-Channel-Token` verification against DB                        |
| FIND-APPR-003    | MEDIUM      | CSRF token store is in-memory only                         | `middleware/csrf.py:27-46`              | **ACCEPTED** — single-worker only; Redis store deferred to P13+             |
| FIND-STARTUP-001 | MEDIUM      | `create_all` + Alembic both run on startup                 | `main.py:78-99`                         | **ACCEPTED** — safe for dev; production deployment should skip `create_all` |

---

## Open Findings — Orchestrator Loop (Deferred to P12)

| ID            | Severity  | Finding                                                  | File              |
| ------------- | --------- | -------------------------------------------------------- | ----------------- |
| FIND-ORCH-001 | P1-HIGH   | Agent dispatch uses fragile string class names           | `loop.py:119`     |
| FIND-ORCH-002 | P2-MEDIUM | ATSAgent case-insensitive check but case-sensitive split | `loop.py:139`     |
| FIND-ORCH-003 | P2-MEDIUM | DriveAgent ingests files without approval gate           | `loop.py:167`     |
| FIND-ORCH-004 | P2-MEDIUM | 12 synchronous disk writes per loop run                  | `loop.py:260-280` |
| FIND-ORCH-005 | P3-LOW    | Reflect phase wastes iterations on successful suggests   | `loop.py:217`     |

---

## Open Findings — RLS (Deferred to P13/P14)

| ID           | Severity    | Finding                                             | File                   |
| ------------ | ----------- | --------------------------------------------------- | ---------------------- |
| FIND-001     | P0-CRITICAL | RLS only covers 4/34 tables                         | `0005_rls*.py`         |
| FIND-RLS-002 | P0-CRITICAL | Alembic migration references non-existent columns   | `0005_rls_expanded.py` |
| FIND-RLS-003 | P1-HIGH     | No FORCE ROW LEVEL SECURITY                         | `0005_rls_expanded.py` |
| FIND-RLS-004 | P2-MEDIUM   | Zero RLS integration tests                          | `test_tenant.py`       |
| FIND-RLS-005 | P2-MEDIUM   | Silent exception swallowing in set_rls_session_vars | `tenant.py:58`         |
| FIND-RLS-006 | P2-MEDIUM   | get_current_tenant never imported by routers        | `tenant.py:81`         |

---

## Open Findings — main.py (Deferred to P15+)

| ID            | Severity  | Finding                             | File         |
| ------------- | --------- | ----------------------------------- | ------------ |
| FIND-MAIN-005 | P2-MEDIUM | 25+ routers imported eagerly        | `main.py:61` |
| FIND-MAIN-006 | P3-LOW    | Duplicate logging/formatter classes | `logging.py` |

---

## Fixed Findings — Deep Zero-Trust Audit (This Session, Round 2)

| ID              | Severity | Finding                                                  | File                                | Fix                                                                 |
| --------------- | -------- | -------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| FIND-FRESH-001  | CRITICAL | memory.py: 5/6 endpoints unauthenticated                 | `routers/memory.py:14,41,53,66,77`  | Added `get_current_user` to all 5                                   |
| FIND-FRESH-002  | CRITICAL | agents.py: chat/list/get unauthenticated                 | `routers/agents.py:39,54,75`        | Added `get_current_user` to all 3                                   |
| FIND-FRESH-003  | CRITICAL | search.py: endpoint unauthenticated                      | `routers/search.py:12`              | Added `get_current_user`                                            |
| FIND-FRESH-004  | CRITICAL | iam.py: no role checks = privilege escalation            | `routers/iam.py:12-97`              | Changed all 7 endpoints to `require_role("admin")`                  |
| FIND-FRESH-005  | CRITICAL | gmail.py: webhook token check bypassed when None         | `routers/gmail.py:110`              | Made channel token mandatory                                        |
| FIND-FRESH-006  | HIGH     | notifications.py: no tenant_id in service calls          | `routers/notifications.py:33,70`    | Added `get_tenant_id` dependency                                    |
| FIND-FRESH-007  | HIGH     | scheduler.py: no tenant isolation on sub-resources       | `routers/scheduler.py:49-129`       | Verified service layer handles it; added tenant_id to list endpoint |
| FIND-FRESH-008  | HIGH     | recommendations.py: IDOR on user_id                      | `routers/recommendations.py:31`     | Added ownership check (current_user == user_id)                     |
| FIND-FRESH-009  | HIGH     | workspaces.py: IDOR on sub-resources                     | `routers/workspaces.py:68,85,102`   | Added workspace ownership verification via `find_by_id`             |
| FIND-FRESH-010  | HIGH     | audit.py: actor_id forgery via user input                | `routers/audit.py:21`               | Overwrite with current_user's sub/user_id                           |
| FIND-FRESH-012  | MEDIUM   | admin_console.py: raw dict input on provisioning         | `routers/admin_console.py:114`      | Replaced with `TenantProvisionRequest` Pydantic model               |
| FIND-FRESH-013  | MEDIUM   | knowledge_graph.py: sort_by/sort_order injection risk    | `routers/knowledge_graph.py:43-44`  | Added regex pattern validation                                      |
| FIND-FRESH-014  | MEDIUM   | webhooks.py: SSRF risk on url field                      | `routers/webhooks.py:18`            | Added HTTPS-only, blocked hosts, private IP validation              |
| FIND-FRESH-015  | MEDIUM   | analytics.py: unconstrained interval param               | `routers/analytics.py:18,34`        | Added regex pattern validation                                      |
| FIND-FRESH-019  | LOW      | auth.py: SSO state race condition                        | `routers/auth.py:135`               | Per-state dict instead of app.state                                 |
| FIND-GMAIL-002  | HIGH     | gmail.py: webhook completely unauthenticated             | `routers/gmail.py:97`               | Fixed in first sweep (channel token verification)                   |
| FIND-FRESH-016  | MEDIUM   | documents.py: IDOR on workspace_id                       | `routers/documents.py`              | Added `_verify_workspace_access()` ownership check                  |
| FIND-FRESH-017  | MEDIUM   | applications.py: IDOR on workspace_id                    | `routers/applications.py`           | Added `_verify_workspace_access()` ownership check                  |
| FIND-FRESH-018  | MEDIUM   | chat.py: no input length limit on LLM prompt             | `routers/chat.py:25`                | Added `Field(max_length=10000)`                                     |
| FIND-MEM-001    | CRITICAL | memory_agent handler.py: extraction never persists to DB | `agents/memory_agent/handler.py:72` | Added DB INSERT loop with `async_session_factory`                   |
| FIND-ENC-001    | CRITICAL | encryption.py: no actual encryption (status check only)  | `services/encryption.py`            | Implemented `encrypt_value()`/`decrypt_value()` with Fernet         |
| FIND-SAML-001   | HIGH     | SAML SSO stub silently returns None/pass                 | `services/sso.py:137-145`           | Raises `NotImplementedError` with clear message                     |
| FIND-TLS-001    | MEDIUM   | tenant.py: silent exception in `set_rls_session_vars`    | `middleware/tenant.py:69-73`        | Added debug logging instead of bare `pass`                          |
| FIND-PROMPT-001 | MEDIUM   | "Six memory types" in 21 MVP prompts + 5 docs            | 26 files                            | Replaced "six memory types" with "22 memory types"                  |

---

## Open Findings — Deferred

| ID                | Severity    | Finding                                              | File                    | Deferred To              |
| ----------------- | ----------- | ---------------------------------------------------- | ----------------------- | ------------------------ |
| FIND-ORCH-001     | P1-HIGH     | Agent dispatch fragile string class names            | `loop.py:119`           | P12                      |
| FIND-ORCH-002-005 | P2-MEDIUM   | Orchestrator case sensitivity, approval, disk writes | `loop.py`               | P12                      |
| FIND-001          | P0-CRITICAL | RLS only covers 4/34 tables                          | `0005_rls*.py`          | P13/P14                  |
| FIND-RLS-002-006  | P1-HIGH     | RLS wrong columns, no FORCE, no tests                | various                 | P13/P14                  |
| FIND-MAIN-005     | P2-MEDIUM   | 25+ routers imported eagerly                         | `main.py:61`            | P15                      |
| FIND-MAIN-006     | P3-LOW      | Duplicate logging classes                            | `logging.py`            | P15                      |
| FIND-009          | MEDIUM      | create_all + Alembic both run on startup             | `main.py:78-99`         | Production deploy config |
| CSRF-STORE        | MEDIUM      | CSRF token store in-memory only                      | `middleware/csrf.py`    | P13+ (needs Redis)       |
| FIND-020          | MEDIUM      | Retention auto-deletes vs user-driven policy         | `services/retention.py` | P13                      |

---

## Files

| File                                          | Source             | Status                                              |
| --------------------------------------------- | ------------------ | --------------------------------------------------- |
| `00-index.md`                                 | —                  | This file (updated)                                 |
| `01-comprehensive-audit-2026-08-16.md`        | Full audit         | 23 fixes + 15 gaps                                  |
| `02-rls-coverage-gap.md`                      | RLS Audit          | OPEN                                                |
| `03-encryption-not-implemented.md`            | Security Audit     | OPEN                                                |
| `04-memory-write-path-broken.md`              | AI Audit           | OPEN                                                |
| `05-documentation-reality-gaps.md`            | Doc Audit          | FIXED                                               |
| `06-missing-infrastructure.md`                | Infra Audit        | FIXED                                               |
| `10-orch-fragile-dispatch.md`                 | Orchestrator Audit | DEFERRED                                            |
| `11-orch-ats-case-sensitivity.md`             | Orchestrator Audit | DEFERRED                                            |
| `12-orch-drive-no-approval.md`                | Orchestrator Audit | DEFERRED                                            |
| `13-orch-sync-disk-writes.md`                 | Orchestrator Audit | DEFERRED                                            |
| `14-orch-wasted-iterations.md`                | Orchestrator Audit | DEFERRED                                            |
| `20-main-tenant-spoofing.md`                  | main.py Audit      | FIXED                                               |
| `21-main-ip-allowlist-not-mounted.md`         | main.py Audit      | FIXED                                               |
| `22-main-prometheus-no-guard.md`              | main.py Audit      | FIXED                                               |
| `23-main-dual-prometheus.md`                  | main.py Audit      | FIXED                                               |
| `24-main-eager-router-imports.md`             | main.py Audit      | DEFERRED                                            |
| `25-main-duplicate-logging.md`                | main.py Audit      | DEFERRED                                            |
| `26-main-options-rate-limited.md`             | main.py Audit      | FIXED                                               |
| `30-rls-alembic-wrong-columns.md`             | RLS Audit          | OPEN                                                |
| `31-rls-no-force.md`                          | RLS Audit          | OPEN                                                |
| `32-rls-no-integration-tests.md`              | RLS Audit          | OPEN                                                |
| `33-rls-silent-exception.md`                  | RLS Audit          | OPEN                                                |
| `34-rls-dead-code.md`                         | RLS Audit          | OPEN                                                |
| `40-doc-desktop-vscode-fake.md`               | Doc Audit          | FIXED                                               |
| `41-doc-ocr-stub.md`                          | Doc Audit          | FIXED                                               |
| `42-doc-mtls-fiction.md`                      | Doc Audit          | FIXED                                               |
| `43-doc-websocket-missing.md`                 | Doc Audit          | FIXED                                               |
| `44-doc-encryption-fake.md`                   | Doc Audit          | FIXED                                               |
| `45-doc-secrets-manager-fake.md`              | Doc Audit          | FIXED                                               |
| `46-doc-consolidation-dead.md`                | Doc Audit          | FIXED                                               |
| `47-doc-permission-engine-fake.md`            | Doc Audit          | FIXED                                               |
| `48-doc-no-terraform.md`                      | Doc Audit          | FIXED                                               |
| `49-doc-grafana-missing.md`                   | Doc Audit          | FIXED                                               |
| `50-doc-pii-redaction-fake.md`                | Doc Audit          | FIXED                                               |
| `51-doc-deletion-verification-fake.md`        | Doc Audit          | FIXED                                               |
| `52-doc-adr013-false-claim.md`                | Doc Audit          | FIXED                                               |
| `53-doc-adr024-meilisearch-fake.md`           | Doc Audit          | FIXED                                               |
| `07-mvp-p04-doc-audit.md`                     | MVP-P04 Doc Audit  | FIXED                                               |
| `08-ci-cd-workflow-fixes.md`                  | CI/CD Audit        | FIXED                                               |
| `FINDINGS-architecture-inconsistencies.md`    | Phase Prompt Audit | FIXED                                               |
| `FINDINGS-scope-count-mismatches.md`          | Phase Prompt Audit | FIXED                                               |
| `FINDINGS-dead-dependencies.md`               | Phase Prompt Audit | FIXED                                               |
| `FINDINGS-directory-path-mismatches.md`       | Phase Prompt Audit | FIXED                                               |
| `2026-08-17-zero-trust-audit.md`              | Zero-Trust Audit   | 14/20 FIXED                                         |
| `P07-deep-audit-2026-08-17.md`                | P07 Deep Audit     | 5/14 FIXED                                          |
| `DEEP-ZERO-TRUST-AUDIT-2026-08-17.md`         | Fresh Deep Audit   | 18/21 FIXED                                         |
| `35-agentic-closure-zero-trust-2026-08-22.md` | Agentic Closure    | 11 findings (2 HIGH) — 8 gaps + 7 polish, self-flag |
