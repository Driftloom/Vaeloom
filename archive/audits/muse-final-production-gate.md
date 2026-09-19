# Muse Final Production Gate — Remediation + Live Verification + Full Re-audit

> **Mode:** AUDIT → MINIMAL REMEDIATION → LIVE VERIFICATION → FULL RE-AUDIT  
> **Authority:** Runtime truth > code inspection > tests > documentation >
> previous reports  
> **Date:** 2026-09-07/08 UTC (execution window ~17:30–01:30 UTC)  
> **Auditor:** Muse Spark (automated, zero-trust)  
> **Lineage:** prior `UNVERIFIED — NOT READY` (P1: RLS live unverified; P1:
> nonce cross-worker replay) → **this closure gate**

---

## 1. Executive summary

**Final verdict: `MUSE CONDITIONALLY READY` — one explicit environmental
condition blocks `PRODUCTION READY`.**

- **P0 = 0. P1 = 0 open.** Both inherited P1 blockers are **remediated and LIVE
  PROVEN** (PostgreSQL RLS A–L + pool isolation; Redis `SET NX EX` cross-worker
  nonce).
- **Two NEW defects were found live and fixed** (this is the gate working as
  designed):
  - **P1 (fixed): `TenantMiddleware` `NameError: async_session_factory`** —
    every workspace-scoped request 500'd on the default-mounted stack. Proven
    via staging traceback, fixed with a 12-line lazy import, regression-tested,
    single-user staging isolation passes on the fixed image.
  - **P2 (fixed): signup→workspace write/read race** — intermittent 2/10 FK 500s
    (commit-after-response). Fixed with an explicit commit in `signup`; hermetic
    suites pass.
- **Full re-audit: no bypass, no phantom claims, no open P0/P1.** ~2,900
  hermetic assertions pass post-remediation across chunked runs; every remaining
  failure was **stash-proven pre-existing** (stale tests or env-drift, none
  caused by remediation, none touching security posture — details §32).
- **Withheld from `PRODUCTION READY` by exactly one environmental condition:**
  the rebuilt staging image (tenant fix + signup fix) could not be live
  re-verified end-to-end because the Docker daemon wedged mid-rebuild and all
  host→container access was lost late in the window (§36). The remaining proof
  is small and fully scripted: rebuild, rerun `test_staging_api_isolation.py` +
  race probe (commands in §38).

**Conflict note:** commit `2044cec` ("close Muse staging gate — PRODUCTION
READY", parallel session, docs/compose only) landed mid-audit and is
**SUPERSEDED by this gate's live findings** — the tenant-500 and signup-race
defects existed in the code it blessed. Truth > green dashboard.

---

## 2. Exact baseline SHA

```
Start:  c5580bc8f8972829d6684009c6bc867985255747  (master, tree clean except untracked audit docs)
End:    2044cec1a03e5be6b419abd15e5d7eb414dff9ef  (parallel session commit, docs/audits + compose only — no src)
Work:   7 src files modified (this gate) + 1 foreign src file (parallel session) + 8 new test files (this gate)
```

**Parallel-session interference (recorded, not hidden):** during this audit (a)
HEAD moved `c5580bc → 2044cec` (docs/compose only, verified via
`git show --stat`); (b) `apps/api/src/api/tools/executor.py` was modified in the
working tree (timeout overrides 10→15s, `settings.github_token` fallback —
assessed benign, §27); (c) the staging stack was torn down once mid-audit
(re-provisioned by this gate); (d) the Docker daemon wedged during the final
rebuild (see §36). All evidence below identifies which tree state it was
collected against.

**Remediation diff (this gate, 7 files):**

| File                                    | Change                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `infrastructure/background_envelope.py` | Redis `SET NX EX` atomic nonce claims; `averify_background_envelope` async variant; `nonce_backend_status()`; documented memory fallback      |
| `workers/queue_worker.py`               | Both handlers use `averify_background_envelope` (distributed claims on the worker path)                                                       |
| `orchestrator/state_store.py`           | Fixed dead `_get_client` (imported nonexistent `api.services.redis` → silent no-op); Lua CAS honoring `expected_version` (sync+async clients) |
| `middleware/idempotency.py`             | `idempotency_fail_closed` lookup-503; store-failure tags `Idempotency-Stored: false` with intact bytes (single-read refactor)                 |
| `config.py`                             | `idempotency_fail_closed: bool = False` (+ doc comment)                                                                                       |
| `middleware/tenant.py`                  | **P1 fix:** lazy `async_session_factory` import (was `NameError` on all workspace-scoped requests)                                            |
| `services/auth_service.py`              | **P2 fix:** explicit `db.commit()` in `signup` before 201 (closes write/read race)                                                            |

---

## 3. Environment

```
Python: 3.12.13 (uv venv) | uv 0.11.19 | node v24.19.0 | pnpm 9.12.0
Alembic head: 0029 (phase_b_idempotency_checkpoint)
Flags (local effective): temporal_enabled=False, langgraph_enabled=False,
  agent_react_enabled=True (local .env override; config default False),
  mvp_scope_enforced=False (local), enterprise_routes_enabled=False,
  idempotency_fail_closed=False (new default), env=local
Collected: 3203 tests
```

**Infrastructure (all isolated/disposable, timestamps 18:13–18:44 UTC unless
noted):**

| Component                    | Identity                                                              | Role in gate                                                 |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Main PG16 + pgvector `:5432` | DBs `vaeloom`, `vaeloom_rls_proof`; role `vaeloom_app` (no BYPASSRLS) | RLS A–L live proof target (disposable `_proof` DB)           |
| Main Redis `:6379`           | no auth                                                               | CAS/nonce live runs (before wedge)                           |
| Staging PG `:5543`           | `vaeloom_staging`, pgvector ext, 51 tables                            | staging API data plane                                       |
| Staging Redis `:6380`        | password-isolated                                                     | queue/SIGKILL/outage/nonce target                            |
| Staging API `:18000`         | `vaeloom-staging-api` image                                           | deployed-stack isolation proof                               |
| Staging worker               | `vaeloom-staging-worker`                                              | isolated worker (not kill target; dedicated subprocess used) |
| Temporal `:7233`, minio      | —                                                                     | present, not exercised (disabled-by-design)                  |

**Late-window outage (honestly recorded):** after the rebuild started, the
Docker daemon wedged (`docker version`/`ps` hang; `com.docker.build` stuck),
staging API `:18000` and host access to main PG/Redis went down. No
shared-production data was at risk (all targets disposable). Cause undetermined
(builder wedge; possibly parallel-session contention). Recovery requires Docker
Desktop attention — outside this gate's scope to force.

---

## 4. Architecture

Unchanged from prior audit (single orchestrator + 5-phase loop + static dispatch
default; supervisor for multi-intent; `agent_approvals` + `ToolIdempotency`
durability; `LoopState` v2 CAS; BullMQ-compatible Redis queues; MCP bridging as
`mcp__*`). No architectural rebuild performed (§2).

---

## 5. Actual runtime graph

Unchanged and re-validated:
`REQUEST → Auth → Tenant → Workspace → Agent → Orchestrator → Context/Memory/Retrieval → PromptCompiler → ModelRouter → Loop → Tool/MCP → Approval → Side-effect → Idempotency → Checkpoint → Replan → Response → Audit`.
All arrows re-proven reachable on the default path; no new bypass introduced
(scan §26).

---

## 6. Security invariants

Held and re-proven: JWT fail-closed; tenant from JWT authoritative (header spoof
ignored); workspace ownership via DB join every request; AgentCard
least-privilege synthesis; approval hash+HMAC+atomic single-consume; prompt
3-layer structural quarantine; memory/retrieval workspace scoping; envelope
HMAC+expiry+nonce+DB membership on every background job.

---

## 7. P0/P1/P2/P3 register

| ID         | Sev    | Finding                                                                            | Status                                                                                    |
| ---------- | ------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GATE-P1-01 | **P1** | `TenantMiddleware` NameError → all workspace-scoped requests 500 on default mount  | **FIXED + regression-proven + single-user live pass** (full-image live rerun pending §38) |
| OLD-P1-01  | P1     | RLS code-verified but live-unverified                                              | **CLOSED — LIVE PROVEN** (§9–10)                                                          |
| OLD-P1-02  | P1     | Nonce replay across workers (process-local)                                        | **CLOSED — LIVE PROVEN** (§12)                                                            |
| GATE-P2-01 | P2     | Signup commit-after-response race (2/10 FK 500s)                                   | **FIXED, hermetic proven** (live rerun pending §38)                                       |
| OLD-P2-01  | P2     | `RedisStateStore` ignored CAS (+ dead client discovery)                            | **CLOSED — LIVE PROVEN** (§13)                                                            |
| OLD-P2-02  | P2     | Idempotency fail-open on storage errors                                            | **CLOSED** — flag + tagging + tests (§14)                                                 |
| RR-05..08  | P2/P3  | Routing-tier gaps, hybrid-lite ranking, MCP bounded-not-sandboxed, JWT no denylist | Unchanged, bounded, documented                                                            |
| P0         | —      | —                                                                                  | **0 (none found)**                                                                        |

---

## 8. P1 remediation evidence (code)

- Nonce: `SET NX EX` atomic claim (`_claim_nonce_sync/_async`), shared
  sync-client cache with drop-on-failure, `nonce_backend_status()`, worker call
  sites migrated (grep: zero remaining sync `verify_background_envelope(`
  callers in prod paths).
- CAS: Lua compare-and-set (`CAS_CONFLICT`/`CAS_MALFORMED` →
  `ConcurrentUpdateError`), missing-key write parity with other backends,
  sync+async clients, fixed `_get_client` (was importing a module that does not
  exist — backend previously persisted **nothing**).
- Idempotency: `idempotency_fail_closed` (default False = local behavior
  preserved); lookup-fail → 503 + `Idempotency-Lookup: failed`; store-fail →
  original bytes + `Idempotency-Stored: false` (single-read refactor, no
  double-consume of body iterator).
- Tenant factory: lazy import with comment citing the staging traceback.
- Signup: explicit commit with comment citing the 2/10 live race.

---

## 9. Live PostgreSQL evidence (Tests A–L)

`VAELOOM_TEST_PG_URL=postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom_rls_proof`,
traffic as `vaeloom_app` (non-superuser), PG16. **12/12 PASS**
(`test_rls_live_pg.py` 5/5 + `test_rls_live_extended.py` 7/7):

| Test                     | Expectation                                                          | Result      |
| ------------------------ | -------------------------------------------------------------------- | ----------- |
| A own-scope read         | 1 row visible                                                        | LIVE PROVEN |
| B/H cross-tenant read    | 0 rows                                                               | LIVE PROVEN |
| C cross-tenant UPDATE    | `UPDATE 0` + data intact                                             | LIVE PROVEN |
| D cross-tenant DELETE    | `DELETE 0` + row survives                                            | LIVE PROVEN |
| E/J mismatched INSERT    | `WITH CHECK` denial (policy/permission/violates)                     | LIVE PROVEN |
| F/I wrong workspace      | 0 rows                                                               | LIVE PROVEN |
| G unset GUC (fresh conn) | 0 rows on memories/documents/users                                   | LIVE PROVEN |
| K `pg_class` metadata    | `relrowsecurity=t, relforcerowsecurity=t` (memories/users/documents) | LIVE PROVEN |
| L `pg_roles`             | `vaeloom_app.rolbypassrls=false`                                     | LIVE PROVEN |

## 10. PgBouncer evidence

**NOT APPLICABLE as a separate component:** no PgBouncer in this topology
(direct asyncpg pool, `statement_cache_size=0`). Pool-reuse isolation **LIVE
PROVEN** instead: sequential `A→B→A` on one pooled connection (no leakage either
direction) + **10 concurrent tenant/workspace pairs, randomized order, each sees
own==1 and foreign==0** (`test_concurrent_10_pairs_isolated`).
Transaction-scoped `SET LOCAL` + per-request `TenantContext.clear()` verified in
code.

---

## 11. Redis nonce evidence

**LIVE PROVEN** (`tests/test_background_nonce_redis.py`, post-remediation):

- Cross-worker (two independent clients): first `True`, second
  `replay detected`.
- Concurrent N=20 threads (own client each): exactly **1 winner / 19 replay**.
- Async variant cross-worker: same result.
- `nonce_backend_status()`: `redis` when reachable, `memory` when not.
- Memory semantics (tampered/expired/missing/check_replay=False): hermetic 6/6.

---

## 12. Redis CAS evidence

**LIVE PROVEN** (`tests/test_redis_cas.py`, 8/8, post-remediation, re-run
twice): match-writes / mismatch-raises-and-preserves / 8-writer single-winner /
retry-after-conflict / malformed-refuses-overwrite / missing-writes (backend
parity) / sync-client enforcement / save-without-expected bumps. **ONE WINNER,
NO LOST UPDATE.**

---

## 13. Queue evidence

**LIVE PROVEN** on isolated staging Redis
(`tests/test_queue_live_staging.py::TestLiveQueue`):
`producer → Redis wait → BullMQWorker → handler → completed + returnvalue` with
job ID/correlation/attempts recorded. 2/2 pass.

## 14. Redelivery evidence

**LIVE PROVEN:** identical job redelivered → envelope replay rejected →
side-effect counter stays **1**; job settles `failed` (never phantom
`completed`). ONE EFFECT.

## 15. SIGKILL evidence

**LIVE PROVEN** (Windows `TerminateProcess` — forceful, no cleanup handlers;
documented kill -9 equivalent): dedicated subprocess worker on staging Redis;
kill landed **after durable INCR marker, before completion ack** (PID + kill
timestamp captured in test output); post-kill: not completed, counter==1;
fresh-worker redelivery of same job → replay rejected, counter stays **1**. ONE
EFFECT, ONE DURABLE WINNER, NO CORRUPTION, NO AUTH BYPASS (re-verification runs
on redelivery).

## 16. Redis outage evidence

**LIVE PROVEN** (`docker stop/start vaeloom-staging-redis`, isolated broker
only): stopped → `ping` raises explicitly (no phantom success), nonce layer
degrades to documented local best-effort; started → broker healthy, writes
succeed. Per-component semantics recorded: queue (explicit failure,
retry/backoff, no phantom completion), nonce (local fallback + status),
quota/rate-limit (pre-existing fail-open local / fail-closed non-local,
unchanged).

---

## 17. Provider failover evidence

Hermetic **LIVE-behavioral**: same-tier cross-provider fallback,
`downgraded=true`, embedding models excluded from tool path, chain observable,
cost recorded (`test_llm_byok`, `test_llm_resilience`,
`test_runtime_phase_b::TestToolFallback` — all pass post-remediation, 109 with
tools suite). **Live provider outage: UNVERIFIED** (no staging provider keys;
optional, not blocking — no production claim made about live 5xx).

## 18. Retrieval evidence

- **Isolation LIVE PROVEN** through deployed staging API on PG: user B
  list/search never contains user A's secret
  (`test_cross_user_memory_invisible`, passed on fixed image).
- Filtering stages (tenant/workspace predicates + `ContextEngine` cross-ws
  filter): hermetic + live 2-user.
- **Classification stays HYBRID-LITE** (vector-preferred, LIKE fallback, PG
  tsvector where present; no RRF/cross-encoder). **Vector ranking quality:
  UNVERIFIED** (no embedding keys in staging) — correctly bounded, not blocking
  (isolation, not relevance, is the production invariant).

## 19. Load evidence

- **10 concurrent PG tenant pairs: LIVE PROVEN, zero leaks** (§10).
- **20 concurrent nonce claims: exactly-one-winner LIVE PROVEN** (§11).
- **50-user staging load: NOT COMPLETED** — blocked first by the signup race
  (now fixed in repo), then by infra loss. Explicit condition §38.
- Concurrency hermetic (3 workspaces × 3 tenants + lane stress): pass via gate-2
  suites re-run (36/36 e2e+resilience).

## 20. Performance evidence

- Staging `GET /health` **n=100: PASS, 0 errors** (percentiles observed in run
  output but not retained after infra loss — **not reconstructed here**; rerun
  scripted in §38).
- Live queue timings: enqueue→completed < 20s poll window (asserted via
  `_wait_for`); exact distributions not claimed.
- No SLOs manufactured. Mocked-model vs real-infra latencies kept separate
  throughout.

## 21. E2E evidence

Post-remediation hermetic: `test_muse_e2e_scenarios` + gate-2
registry/resilience **36/36**; runtime phase B **38+**; approval/idempotency
**23/23**; MCP/security-phase-A **53/53** (1 env skip); orchestrator/state
**106/106**; LLM/tools **109/109**; security attack files **179+19+46+34** (1
stale). Live staging: single-user isolation + search isolation **PASS** on fixed
image.

## 22. Prompt injection evidence

Hermetic: 14 blocked + 14 safe + base64 + memory/workspace vectors
(`security/test_prompt_injection` in the 34-file run — pass). Structural
quarantine (compiler) + middleware + runtime sanitizer unchanged and re-verified
via phase-A suite (53 pass).

## 23. Approval evidence

Request/approve/reject/409/expiry/audit + idempotent create + execution-time
recheck (`approval_execution_recheck`) + concurrent single-consume (atomic
`UPDATE ... WHERE APPROVED`): **23/23 pass** post-remediation, plus live
redelivery replay-rejection (§14).

## 24. Idempotency evidence

HTTP middleware
(replay/mismatch/different-key/non-consequential/GET/approval-single-row) +
durable tool UNIQUE single-winner + new fail-closed trio: all pass
post-remediation. Live: counter==1 across kill+redelivery (§15).

## 25. State/checkpoint evidence

Version bump/CAS-conflict/v1-migration/termination-reasons + memory/composite
durability + terminal no-replay + duplicate-request no-reexec + Redis CAS matrix
(§12): pass. Redis CAS gap from prior audit is closed.

## 26. Cancellation evidence

`request_cancel` durable flag + merge-wins + terminal-preserved (hermetic,
`test_runtime_phase_b` + state durability) — unchanged, re-run green.

## 27. Observability evidence

Correlation/tenant/workspace/agent/run/tool/provider/approval/checkpoint present
in structured logs (staging logs observed with `correlation_id` on every
request); secret redaction suite **15/15** (`secret_keys_unified` + workers +
db-state-store); no JWT/API keys in logs or `/metrics` (public by design). OTel
exporter `localhost:4317` connection-refused noise in staging (no collector) —
residual P3, non-blocking.

## 28. Bypass scan

Post-remediation grep audit: zero remaining sync `verify_background_envelope(`
prod callers (both workers on async); `jwt.decode` only in auth middleware
(HS256, exp+sub required) + SSO providers (JWKS RS256 + audience/issuer —
legitimate); `run_agent_loop` entry points (router PRIMARY, supervisor
delegation, `run_agent_loop_stream` ALTERNATE sharing plan/act/checkpoint gates
— not a bypass); `execute_tool` single definition (loop + disabled-graph callers
only). **Result: no reachable bypass of
auth/tenant/workspace/Card/permission/approval/idempotency/checkpoint.**

## 29. Phantom/dead/shadow audit

| Component                                                                                                                                                                                 | Verdict                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| PromptCompiler / ContextEngine / AgentContracts+LoopController / AgentCard / InferencePolicy / ModelRouter / Supervisor / Memory / Retrieval+KG / Evaluation+QA / MCP / Background worker | **ACTIVE** (wired, default, used, tested; live where infra permits)                                        |
| Temporal / LangGraph / ReAct                                                                                                                                                              | **DISABLED-BY-DESIGN** (flags off; fail-closed when enabled-but-unreachable; never activated for coverage) |
| Learning/improvement                                                                                                                                                                      | DESIGNED, NOT OPERATIONALIZED (bounded; not claimed)                                                       |
| `RedisStateStore`                                                                                                                                                                         | Was effectively DEAD (nonexistent import → silent no-op) — **revived + CAS-proven** by this gate           |

## 30. Disabled-runtime classification

- **Temporal** `temporal_enabled=False`: IMPLEMENTED, WIRED
  (routes/workflows/activities), DEFAULT off, enablement = `TEMPORAL_HOST` +
  cluster, fail-closed via `TemporalUnavailableError`→503. Tests: `temporal/`
  hermetic (4 pre-existing env failures, §32).
- **LangGraph** `langgraph_enabled=False`, percent 0: topology-only, durability
  stays with Temporal. Tests opt-in.
- **ReAct** `agent_react_enabled=False` default (local .env override True
  disclosed): deterministic static primary. Tests with flag on.

## 31. Full test results

Collected **3203**. Strategy: chunked serial runs (full serial exceeds tool
timeouts; xdist hang is a known repo finding). Post-remediation chunked totals:
**≈2,900 passed, 0 failures attributable to remediation.** Every failure below
was reproduced **without** this gate's diff via `git stash` (evidence in session
log) and left untouched per §2:

| Failure                                                                            | Count | Cause (stash-proven pre-existing)                                                                                                             |
| ---------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_memory.py` (create/get/update/delete)                                        | 4     | Stale: posts without mandatory workspace; production 400 is correct                                                                           |
| `security/test_tenant_isolation.py::...other_users_memories`                       | 1     | Same stale-workspace pattern                                                                                                                  |
| `eval/test_ws_comprehensive.py::test_temporal_idempotency_and_duplicate`           | 1     | Card/test drift; fails CLOSED (denial) — safe                                                                                                 |
| `test_browser_tools.py::test_tool_count_now_28`                                    | 1     | Stale count (registry is 54 at HEAD)                                                                                                          |
| middleware (ip_filter, CORS) + temporal (connector_sync, schedules_shadow)         | 4     | Env-related (allowlist config, live-connector timing)                                                                                         |
| integration (memory_api×6, mcp×5, resume×1, ws_isolation×1)                        | 13    | Stale workspace + MCP route drift + template count                                                                                            |
| clients (cache/calendar/connector/drive/gmail/jobboard) + llm-extended×2 + logging | ~22   | Credentials present in env flip "unconfigured" tests; provider-default message drift                                                          |
| openapi/prompt_manager/qa_gate/search_facets/sso/saml + scim×8                     | ~13   | Spec drift; SCIM routes not mounted in conftest (enterprise-gated)                                                                            |
| `workers_extended::test_handle_event_publish_agent_execute`                        | 1     | **Stale insecure assertion** (expects unenveloped processing; production correctly rejects) — must never be "fixed" by weakening the envelope |

Skips: live-PG/Redis tests skip cleanly when brokers unreachable (verified: 16
skips, 0 false-pass); 1 infra skip in phase-A.

## 32. Skipped-test register

All skips environmental (no broker / no PG URL / no staging API) with live
equivalents already executed while infra was healthy. **No `skip = pass`**: live
rows cite timestamps and artifacts above.

## 33. Residual risk register

1. **P2** Signup-race fix lacks live proof (image rebuild blocked) — condition
   §38.
2. **P2** 50-user load + perf distributions incomplete — condition §38.
3. **P2** Vector ranking quality unverified (no staging embedding keys) —
   bounded to relevance, not isolation.
4. **P3** MCP bounded-not-sandboxed; JWT no distributed denylist (short TTL
   mitigates); OTel exporter noise in staging.
5. Foreign uncommitted `executor.py` edit (parallel session): assessed benign;
   must be reviewed by its owner before release (not this gate's change).

## 34. Production configuration matrix

Verified in code + staging deployment: JWT/encryption fail-fast; PG
`vaeloom_app` without BYPASSRLS; `FORCE RLS` live; Redis password-isolated per
environment; `TEMPORAL/LANGGRAPH/ReAct` off by default with fail-closed
enablement; enterprise routes gated; CORS localhost rejected in non-local;
`IDEMPOTENCY_FAIL_CLOSED=false` default (local-safe; production GDPR paths
SHOULD set `true` — handoff action). Staging secrets are disposable placeholders
(`.env.staging`, untracked, never production values).

## 35. Final evidence matrix

| Invariant                       | Implementation | Hermetic | Seam | Live                                  | Result                                         | Severity      |
| ------------------------------- | -------------- | -------- | ---- | ------------------------------------- | ---------------------------------------------- | ------------- |
| Auth                            | ✓              | ✓        | ✓    | ✓ (staging JWTs)                      | LIVE PROVEN                                    | —             |
| Tenant isolation                | ✓              | ✓        | ✓    | ✓ (PG + staging API)                  | LIVE PROVEN                                    | —             |
| Workspace isolation             | ✓              | ✓        | ✓    | ✓ (PG + staging API)                  | LIVE PROVEN                                    | —             |
| RLS                             | ✓              | ✓        | ✓    | ✓ (A–L, app role)                     | LIVE PROVEN                                    | —             |
| Pooling (asyncpg; no PgBouncer) | ✓              | ✓        | ✓    | ✓ (ABA + 10-conc)                     | LIVE PROVEN                                    | —             |
| Agent authorization             | ✓              | ✓        | ✓    | ◐ (staging single-user)               | HERMETIC+PARTIAL LIVE                          | —             |
| AgentCard                       | ✓              | ✓        | ✓    | ◐                                     | HERMETIC (fails-closed live)                   | —             |
| Tool authorization              | ✓              | ✓        | ✓    | ◐                                     | HERMETIC                                       | —             |
| Approval                        | ✓              | ✓        | ✓    | ✓ (redelivery replay)                 | LIVE PROVEN                                    | —             |
| Background envelope             | ✓              | ✓        | ✓    | ✓                                     | LIVE PROVEN                                    | —             |
| Cross-worker nonce              | ✓ (new)        | ✓        | ✓    | ✓ (20-thread 1-winner)                | LIVE PROVEN                                    | —             |
| Idempotency                     | ✓ (new flag)   | ✓        | ✓    | ✓ (counter==1 kill+redeliver)         | LIVE PROVEN                                    | —             |
| Redis CAS                       | ✓ (new)        | ✓        | ✓    | ✓ (8/8)                               | LIVE PROVEN                                    | —             |
| Checkpoint                      | ✓              | ✓        | ✓    | ◐                                     | HERMETIC (DB/File/Redis-CAS)                   | —             |
| Cancellation                    | ✓              | ✓        | ✓    | —                                     | HERMETIC                                       | —             |
| SIGKILL recovery                | ✓              | ✓        | ✓    | ✓ (forceful kill, counter 1)          | LIVE PROVEN                                    | —             |
| Queue redelivery                | ✓              | ✓        | ✓    | ✓                                     | LIVE PROVEN                                    | —             |
| Redis outage                    | ✓              | ✓        | ✓    | ✓ (stop/start)                        | LIVE PROVEN                                    | —             |
| Retrieval isolation             | ✓              | ✓        | ✓    | ✓ (staging search)                    | LIVE PROVEN                                    | —             |
| Vector ranking                  | ✓              | ✓        | —    | —                                     | UNVERIFIED (bounded)                           | P2            |
| Provider failover               | ✓              | ✓        | ✓    | —                                     | HERMETIC (live 5xx optional)                   | P2            |
| Prompt boundary                 | ✓              | ✓        | ✓    | ◐                                     | HERMETIC (+live search Yolanda? no — hermetic) | —             |
| MCP                             | ✓ bounded      | ✓        | ✓    | —                                     | CODE+HERMETIC                                  | P3            |
| Loop safety                     | ✓              | ✓        | ✓    | —                                     | HERMETIC                                       | —             |
| Budgets                         | ✓              | ✓        | ✓    | —                                     | HERMETIC                                       | —             |
| Observability                   | ✓              | ✓        | ✓    | ✓ (staging logs)                      | LIVE PROVEN                                    | —             |
| Concurrency                     | ✓              | ✓        | ✓    | ◐ (10 PG + 20 nonce; 50-user pending) | PARTIAL LIVE                                   | P2 (cond §38) |

## 36. Final verdict

**`MUSE CONDITIONALLY READY`** — P0=0, P1=0 open, all critical security
boundaries LIVE PROVEN, no bypass, remaining items explicitly bounded below.
**`PRODUCTION READY` is withheld** pending one environmental condition (not a
code wave).

**Blocking condition for `PRODUCTION READY` (§38):** Docker daemon recovery →
rebuild staging API image (contains tenant + signup fixes) → rerun
`test_staging_api_isolation.py` (50-user zero-leak + n=100 latency) + signup
race probe (0/10 FK). All scripts/tests already committed in this repo.

## 37. Exact remaining conditions

1. Infra recovery (Docker Desktop attention; shared daemon — coordinate with
   other sessions).
2. `docker compose -f docker-compose.staging.yml --env-file .env.staging build api-staging && up -d api-staging`.
3. `uv run python -m pytest tests/test_staging_api_isolation.py -q -o addopts=`
   → 3/3 (includes 50-user zero-leak + n=100).
4. `uv run python scratch_race_probe.py` → expect `fails: 0` (script at
   `apps/api/scratch_race_probe.py`; delete after).
5. Optional (non-blocking): staging embedding keys → vector relevance eval; live
   provider 5xx drill.

## 38. Production handoff checklist

- Commit: this gate's 7-file diff (uncommitted at audit end — review + commit
  deliberately) + HEAD `2044cec`; foreign `executor.py` hunk needs owner review.
- Migrations: head `0029`; roles `vaeloom_migrator` (BYPASSRLS) / `vaeloom_app`
  (none).
- Env: `JWT_SECRET`/`ENCRYPTION_KEY` 32+, `DATABASE__URL` (asyncpg, app role),
  `REDIS_URL` (password-isolated), `IDEMPOTENCY_FAIL_CLOSED=true` for GDPR
  paths, Temporal/LangGraph/ReAct stay off unless their enablement docs are
  followed.
- Startup: `alembic upgrade head` → `uvicorn api.main:app` →
  `python -m api.workers.queue_worker` (+ daemon).
- Invariants: RLS FORCE + app predicates; envelope HMAC+SET-NX-EX; approval
  single-consume; prompt quarantine; CAS on all state writes.
- Runbooks: failure taxonomy (§30 codes); Redis outage → explicit failure, no
  phantom; kill+redeliver → counter check.
- Residuals: §33. Rollback: previous image tag + `alembic downgrade -1` + DB
  snapshot.

---

## FINAL RELEASE CLOSURE (2026-09-08)

```text
Final commit:            301fd6b (source identical to aaa6e49; docs-only delta verified)
Final image:             NONE — rebuild blocked (see below); running staging image
                         forensically proven PRE-candidate (tenant fix present,
                         signup fix absent). No old image claimed as final.
Docker recovery:         2026-09-08 ~17:37 UTC, operator-restored (Desktop 4.84.0)
Staging rebuild:         FAIL (environmental) — Dockerfile apt layer 403s persistently
                         (2 attempts); any source change forces the apt layer by construction.
Staging isolation:       2/3 on pre-candidate image (cross-user PASS, latency PASS,
                         50-user setup FAILS on FK race — expected, proves fix delta)
Signup race:             2/10 FK fails on pre-candidate image (historical signature reproduced)
50-user isolation:       PENDING final-image rebuild
n=100 (health):          p50 0.0ms, p95 16.0ms, p99 16.0ms, max 16.0ms, errors 0
Final smoke:             PASS modulo expected FK-race errors (no NameError/auth/CAS/dup issues)
Security regression:     PASS (zero source diffs this run; hermetic suites green previously)
P0: 0
P1: 0
Remaining P2:            final-image reruns; vector relevance; optional provider drill
Remaining P3:            MCP bounded; JWT denylist; OTel noise; foreign executor hunk (excluded);
                         apt-egress build policy (infra, not product)
Final verdict:           MUSE CONDITIONALLY READY
```

## FINAL ARTIFACT RELEASE CLOSURE — 2026-09-09 (final gate run)

```text
Source: c8d7eb3 lineage verified (HEAD 205f209; `git diff aaa6e49..HEAD -- src` EMPTY;
  foreign executor.py still excluded/uncommitted; .env.staging + race probe untracked).
Docker: healthy (Client+Server 29.6.2, full stack Up; staging API healthy 200).
Build: NOT re-attempted blindly — egress retested first per §4: deb.debian.org STILL 403
  (container + Windows host; Docker approved proxy http.docker.internal:3128 in path,
  block originates beyond it). Rebuild would fail at Dockerfile:19 identically. STOP per §4.
  No Dockerfile/mirror/proxy change made (Princeton reachable-but-unapproved; supply-chain
  discipline holds). Single remaining blocker: approved build egress (options A/C/D/E).
Fresh live re-confirmation (candidate source, healthy infra, this run):
  RLS 12/12 + nonce 10/10 + CAS 8/8 = 30/30 PASS; staging API healthy.
  Staging-image gates (isolation 3/3, race 0/10, 50-user) still require the rebuilt image.
P0: 0 | P1: 0 | No new defects (zero source diffs; nothing to regress).
Final verdict: MUSE CONDITIONALLY READY.
```

## BUILD RECOVERY RUN — 2026-09-08 ~23:16 UTC (supersedes Docker-down blocker)

Docker recovered (Desktop 4.84.0); candidate source re-verified identical to
`aaa6e49`; foreign hunk still excluded. Rebuild attempted once with full logs:
**still fails** at `Dockerfile:19` — `deb.debian.org` → **403 Forbidden**
(host-level egress policy, confirmed from Windows host too; Docker uses approved
proxy `http.docker.internal:3128`, 403 originates beyond it). `pypi.org` (200),
Playwright CDN (reachable), and Princeton mirror (200) prove selective domain
filtering, not general outage. Princeton was **not** used: reachable ≠
org-approved, and rewiring package origins unilaterally would violate
supply-chain discipline (§4 process documented for the owner: approve mirror →
minimal Dockerfile ARG → assess signature verification → rebuild → rerun gates).
No source/build file was modified. Fresh evidence this run: RLS/nonce/CAS
**30/30**; staging isolation **2/3** with zero `NameError` (50-user setup fails
on the pre-candidate image's FK race — expected differential, not a regression).
**Verdict unchanged: `MUSE CONDITIONALLY READY`** — single remaining blocker is
approved build egress (or an approved mirror through §4).

## Appendix — live evidence index (timestamps UTC 2026-09-07)

- 18:13 staging API healthy (`{"status":"ok",...,"version":"0.2.0"}`).
- 18:2x RLS 5/5 + extended 7/7 as `vaeloom_app` on PG16 (`vaeloom_rls_proof`).
- 18:3x nonce 10/10 + CAS 8/8 + queue 2/2 + redelivery + SIGKILL (counter 1) +
  outage stop/start on staging Redis.
- 18:36 tenant `NameError` traceback captured from staging logs
  (workspace-scoped 500).
- 18:43 fixed image healthy; single-user isolation + `/health` n=100 PASS.
- 18:44 signup race FK traceback (user present, FK violation) → race probe 2/10
  fails.
- Late window: daemon wedge; host access lost; hermetic re-verification
  continued (~2,900 green).

## FINAL PRODUCTION RELEASE CLOSURE — 2026-09-08 ~23:30 UTC (this run)

Zero-trust end-to-end execution per final release prompt. **No source,
Dockerfile, compose, or config file was modified by this run** (report-only docs
append).

### Baseline forensics (fresh, this run)

```text
git status --short:   M apps/api/src/api/tools/executor.py (unstaged, foreign — see below)
                      ?? .env.staging (untracked, disposable staging env)
                      ?? apps/api/scratch_race_probe.py (untracked, race probe script)
HEAD:                 d4e1b23f67d8162f15d87bf125f1acdc35c406c5 (master)
Log (8):              d4e1b23 → 205f209 → c8d7eb3 → 301fd6b → aaa6e49 → 9025e43 → 2044cec → c5580bc
git diff aaa6e49..HEAD --name-only:  docs/Audits/muse-final-closure-execution.md
                                 docs/Audits/muse-final-production-gate.md
                                 (DOCS ONLY — no other files)
git diff aaa6e49..HEAD -- src:   EMPTY (source-equivalent to candidate — PROVEN)
git diff aaa6e49..HEAD -- Dockerfile docker-compose.yml compose.yml: EMPTY
```

Lineage resolved: `9025e43` (fix commit — 7 src files: tenant + signup + nonce +
CAS + idempotency + config + queue_worker) → `aaa6e49` (docs-only, candidate
pointer — 1 docs file) → `301fd6b` → `c8d7eb3` → `205f209` → `d4e1b23` (HEAD,
all docs-only). Candidate tree verified to contain BOTH release fixes
(`await db.commit()` in `auth_service.py::signup`; lazy `async_session_factory`
import in `middleware/tenant.py:176`).

### Foreign / excluded code (§3)

`apps/api/src/api/tools/executor.py` unstaged hunk (19+/5-, working tree ONLY —
not in candidate, not committed): tool timeout overrides 10→15s + new timeout
keys; `_resolve_github_token` prefers `settings.github_token` before env.
Assessed: **benign, no auth/tenant/workspace/approval bypass** (workspace token
still first; `getattr(settings,...,"")` degrades to prior behavior). Not
required by production runtime. **Exclusion preserved** — not committed, not
merged; any future release build MUST use a clean tree (`git stash` / detached
candidate checkout), because `docker build` ships the working tree, not the
commit.

### Docker health (§4)

Healthy: Client+Server 29.6.2, Desktop 4.84.0, Compose v5.3.1. Main stack
(postgres/redis/temporal/minio) Up healthy; staging stack
(api/worker/redis/postgres, `vaeloom-staging-*`) Up. Approved proxy configured:
`HTTP/HTTPS Proxy: http.docker.internal:3128` (docker info). No stale-container
reuse: staging containers pinned to image `f09d3bb7f397` (built 2026-09-07 18:43
UTC — see identity note below).

### Build egress blocker — FRESH reproduction (§5)

Full `docker build --no-cache` NOT re-burned (2 full attempts already failed
identically; 3rd adds zero information). Instead the exact failing operation was
reproduced cleanly in the identical base image this run:

- Container: `docker run --rm python:3.12-slim sh -c "apt-get update"` →
  `deb.debian.org/debian trixie InRelease`, `trixie-updates InRelease`,
  `trixie-security InRelease` → **403 Forbidden** (IP 151.101.2.132:80, all 3
  repos). Same `python:3.12-slim` base as `apps/api/Dockerfile:1`; same
  `apt-get update` as Dockerfile:11/:19
  (`playwright install --with-deps chromium` shells to apt at :19).
- Windows host:
  `Invoke-WebRequest http://deb.debian.org/debian/dists/bookworm/InRelease` →
  **403 Forbidden**. Block exists independent of Docker/proxy.
- Control: fresh `python:3.12-slim` image PULL from Docker Hub SUCCEEDED this
  run → selective domain filtering (`deb.debian.org`), not general outage.
- Approved proxy (`http.docker.internal:3128`) is in path, but the host itself
  403s → **block originates beyond the proxy** (upstream/host-network policy).

No Dockerfile / mirror / proxy / TLS change made. Princeton mirror NOT used
(reachable ≠ org-approved). Per §37: **STOP — RELEASE BLOCKED.**

### Image identity (§7) / fresh staging (§8) / live gates (§9–§32)

Not executable without the rebuilt image — marked UNVERIFIED/BLOCKED for the
final candidate, not PASS. Historical supporting evidence retained WITHOUT
promotion: staging image `f09d3bb7f397` forensically proven PRE-candidate
(tenant fix present, signup `db.commit()` absent — expected differential, not a
regression); RLS/nonce/CAS 30/30 fresh-live from prior run stands as supporting
evidence only (committed src tree unchanged since — zero delta, nothing to
regress; rerunning would be ritual, not evidence). No old-image result is
claimed as final-candidate proof.

### Release matrix (final candidate `d4e1b23` == source `aaa6e49`)

| Gate                                                  | Result             | Evidence                                                   |
| ----------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| Candidate source identity                             | PASS               | HEAD d4e1b23; src diff vs aaa6e49 EMPTY; lineage docs-only |
| Foreign-code exclusion                                | PASS               | executor.py hunk unstaged/benign/excluded, documented      |
| Docker health                                         | PASS               | 29.6.2 healthy; proxy approved+configured                  |
| Build egress                                          | **BLOCKED**        | deb.debian.org 403, container + host, fresh this run       |
| Image identity                                        | UNVERIFIED/BLOCKED | no rebuild possible; no old image claimed                  |
| Fresh staging / health / isolation / race / 50-user   | UNVERIFIED/BLOCKED | require rebuilt image                                      |
| RLS / nonce / CAS / queue / recovery / approval, etc. | HISTORICAL ONLY    | 30/30-class prior live proofs; src unchanged               |
| P0 / P1                                               | 0 / 0              | no new defects (zero committed src delta)                  |

```text
RELEASE BLOCKED

Root cause:
Host/network egress policy blocks approved Debian package origin during
Docker image construction (deb.debian.org → HTTP 403, all InRelease repos;
reproduced container + host; approved proxy in path, block beyond it).

Application source:
Verified candidate (d4e1b23 source-equivalent to aaa6e49; both fixes in tree).

P0:
0

P1:
0

Remaining blocker:
Approved Docker build egress OR approved Debian mirror (owner options A/C/D/E
per prior runs — no app change permitted to route around it).

Next required action:
Infrastructure/network owner approval. Then: clean-tree rebuild → image
identity → fresh staging → rerun final-image gates (§38 chain).

No application remediation required.
```

```text
VAELOOM FINAL PRODUCTION RELEASE
================================
Candidate: d4e1b23 (source == aaa6e49, EMPTY src diff)
Image: NONE (rebuild blocked at apps/api/Dockerfile:11/:19 apt layer)
Artifact identity: NOT PROVEN (no image to prove; pre-candidate f09d3bb7f397 excluded by forensics)
Fresh staging: BLOCKED (healthy infra, stale image — not reused as evidence)
P0: 0 | P1: 0 | P2: bounded residuals (final-image reruns, vector relevance, provider drill) | P3: MCP bounded, JWT denylist, OTel noise, foreign hunk excluded, apt-egress policy
Critical gates: source identity PASS; egress BLOCKED (403 fresh both planes); all final-image gates UNVERIFIED/BLOCKED
Remaining blockers: approved Docker build egress OR approved Debian mirror
Final verdict: NOT READY (environmental — RELEASE BLOCKED per §37)
Release decision: The candidate source is verified and defect-free at P0/P1, but no release-candidate image can be constructed while host/network policy 403s the approved Debian origin; promotion is refused rather than faked, and the single required action sits with the infrastructure/network owner.
Audit: docs/Audits/muse-final-production-gate.md
```
