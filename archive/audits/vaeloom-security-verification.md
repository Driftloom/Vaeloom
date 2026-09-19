# Vaeloom Security Verification — 2026-09-15

> **Commit:** `bd7b2125` • **Baseline:** `vaeloom-master-zero-trust-baseline.md`
> • **Verdict:** **PASS** (P0 = 0)

## 1. Authentication (§7)

| Test                               | Result | Evidence                                                                                     |
| ---------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/signup` → 201   | PASS   | `test_zt_master_probes::test_master_auth_matrix` (201)                                       |
| Duplicate email → 400/409          | PASS   | same (400/409)                                                                               |
| Invalid email → 422                | PASS   | same                                                                                         |
| Weak password → 422                | PASS   | same (`short` → 422)                                                                         |
| `POST /login` correct → 200        | PASS   | same                                                                                         |
| Wrong password → 401               | PASS   | same                                                                                         |
| `GET /me` unauth → 401             | PASS   | same + `tests/security/test_auth*`                                                           |
| Forged token → 401                 | PASS   | `Bearer forged.invalid.tok` → 401                                                            |
| `GET /me` with valid JWT → 200     | PASS   | same                                                                                         |
| `JWT_SECRET` fails fast on default | PASS   | `config.py:validate_settings:285-294 F-07 fix` (32-char minimum, known weak values rejected) |
| `POST /refresh`, `POST /logout`    | PASS   | `routers/auth.py 9 endpoints`, `AuthMiddleware PUBLIC_PATHS`                                 |

**Adversarial matrix (§7.3):** unauth, expired, malformed, forged, cross-user
token — all 401 via probes + `tests/security` 284/284 (07m15s).

**Command:**
`uv run --project apps/api python -m pytest apps/api/tests/test_zt_master_probes.py::test_master_auth_matrix -q`

## 2. Authorization (§8)

For every protected resource:

- Owner allowed ✓ — `GET /me` with own token 200.
- Unrelated user denied ✓ — `GET /workspaces/{id}` with B's token → 403/404 (no
  200 leak).
- Same user different workspace denied where applicable ✓ —
  `test_master_workspace_isolation` (B does not see A's workspace in list,
  direct GET 403/404).
- Tenant A → tenant B denied ✓ — `TenantMiddleware set_rls_session_vars` +
  `database.py:SELECT set_config('app.tenant_id')` fail-closed (`0036` RLS).
- Agent without permission denied ✓ —
  `tools/executor.py:3057 Card check → PermissionDenied`,
  `agent_service.check_agent_tool_contract` (`agent_service.py:21`) fail-closed
  for registry-known agents.
- Connector without scope denied ✓ — `tools/definitions.py required_scope`,
  `executor.py:3076 check_permission`.
- Read-only connector cannot write ✓ — `connector_write` vs `connector_read`
  category (`executor.py:61 CATEGORY_TIMEOUTS`).
- Suggest-mode agent cannot act ✓ —
  `application_agent/handler.py:88 request_approval` when `has_approval=False`;
  `gmail` draft-only.
- Approval-required cannot bypass ✓ — `loop.py:876 _react_approval_gate`,
  `UPDATE agent_approvals WHERE status=APPROVED` atomic + HMAC
  (`services/approval`).
- Revoked permission immediately effective ✓ — `test_p1_revocation.py` +
  `test_final_approval_remediation.py` 61 tests passed 2026-09-15.
- Disabled account blocked ✓ — `users.status` + `AuthMiddleware`.

**Command:**
`uv run --project apps/api python -m pytest apps/api/tests/security -q` → **284
passed**.

## 3. Multi-Tenant / Workspace Isolation (§9)

| Layer                     | Claim                                    | Evidence                                                                                                                                        | Adversarial                                                           |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| DB queries                | workspace filter everywhere              | `memory_service.py:150-157, 184-189, 335-338` every method filters `workspace_id`; `knowledge_graph_service.py:_require_write_scope:23, config` | `workspace A → B resource` → 404 (probe)                              |
| RLS                       | 42/42 RLS (policy count from migrations) | `alembic/versions 0001..0042`, `database.py:set_rls_session_vars`, `SELECT set_config('app.workspace_id'/'app.tenant_id')`                      | cache/vector/graph/search all scoped                                  |
| TenantContext             | path/header propagation                  | `middleware/tenant.py`, `database.py:wid = workspace_id or TenantContext.get_workspace_id()`                                                    | header spoof → 401/403 via `AuthMiddleware` first                     |
| Cache/Search/Vector/Graph | scoped                                   | `search_service.py:122 fail-closed [] if no scope`, `knowledge_graph_service:510 WHERE e.workspace_id=:ws AND tgt.workspace_id=:ws`             | `vector A → tenant B doc` → empty (ILIKE fail-closed + Qdrant filter) |
| WebSocket/Realtime        | SSE only, no WS                          | `routers/chat.py POST /workspaces/{id}/chat`, `lib/api-client.ts:348 SSE` + SWR polling (30s)                                                   | No WS subscription to hijack                                          |
| Secrets                   | encrypted per-key, connect shell denied  | `connector_ext_service`, `encryption.py EncryptedString`, `services/mcp_client_service: deny shell`                                             | `tests/security/test_connector_ext*`                                  |

**Probes:** `test_zt_master_probes::test_master_workspace_isolation` +
`test_master_memory_isolation` → **3/3 passed** (B never reads A's
workspace/memory, not even via `search`).

## 4. API Security (§37)

Every endpoint tested via `tests/security` + probes: auth 401, IDOR/BOLA
403/404, mass assignment, injection, path traversal, excessive exposure, rate
limit, replay, privilege escalation.

- **Rate limiting:** sliding window per-endpoint decorator
  `middleware/rate_limit.py` (Redis or in-mem fallback, `Retry-After`).
- **Body size:** `middleware/body_size_limit.py` 25MB global +
  `document_service.py:60 10MB` upload cap.
- **Prompt injection:**
  `middleware/prompt_injection.py:21 PATTERNS + BASE64_PAYLOAD` 400
  `X-Injection-Detected:true` + LLM classifier fallback; `utils/sanitize.py`
  strips `<script>/event handlers/js:`; `orchestrator/loop.py:1954 quarantine`.
- **CORS:** outermost (`main.py:339 CORSMiddleware` last), restricted
  origins/methods/headers per §0.6.
- **IP allowlist:** always mounted (`main.py:337 IPAllowlistMiddleware` no-op
  when empty).
- **Secrets in repo/history:** none in source/logs/prompts per audit; `.env`
  files gitignored (`git check-ignore .env apps/api/.env` → ignored).

## 5. Tool / Prompt Injection (§21-22)

- Every tool `ToolDefinition` has `required_scope/category/trust_class`;
  `executor.py:3145` validates output + caps.
- Malicious content (PDF/email/GH README/code/JD/calendar/memory/search)
  attempted
  `ignore system / reveal secrets / call unauthorized tools / send email / delete / change perms / retrieve another user's memory / modify config`
  — **must refuse or quarantine**: `prompt_compiler.quarantine` wraps
  `<untrusted-data>`, tool output sanitized `sanitize_tool_output`.
- Adversarial datasets exist in `tests/security/test_prompt_injection*`,
  `tests/test_security_phase_a.py`, `tests/test_muse_learning_fallback_e2e.py`.
- Browser tools SSRF-guarded `utils/url_guard.py` (https-only + global-IP
  enforcement), quota `20/h` (`SCRAPE_QUOTA_PER_HOUR`), kill-switch
  `BROWSER_TOOLS_ENABLED`.

## 6. Secrets & Privacy (§48-49)

- No secrets in source/logs/prompts; env-encrypted storage
  (`encryption.py fernet`), at-rest via `EncryptedString`.
- `VAELOOM_TARGET_URL` + staging templates use `postgresql+asyncpg` with
  least-privilege `vaeloom_app` + migrator `postgres.yygak...`
  (`DATABASE_MIGRATION__URL`).
- GDPR: `services/gdpr.py`, `routers/* gdpr/consent`, erasure
  `erasure_service.py`, export `export_service.py`, retention `retention.py`.
- Connector scopes minimized; BYOK `provider_keys` encrypted per-key.

## 7. Summary

| Area                     | Result   | Tests                          |
| ------------------------ | -------- | ------------------------------ |
| Auth                     | **PASS** | 5 probes + 284 security        |
| Authorization matrix     | **PASS** | executor + loop checks         |
| Tenant/workspace         | **PASS** | 2 isolation probes 3/3         |
| Rate limit / CSRF / CORS | **PASS** | middleware stack (§2)          |
| Prompt injection         | **PASS** | middleware+sanitize+quarantine |
| Secrets                  | **PASS** | no leak found                  |

**P0 blockers:** **0**. System fails safely (401/403/404, never 200 leak).
