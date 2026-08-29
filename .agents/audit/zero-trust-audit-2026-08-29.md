# Vaeloom — Zero-Trust End-to-End Audit — 2026-08-29

**Commit:** `e255d63` (`CONT-P07 96.16`) → `HEAD 0dc782d`+`cont-p06/07` |
**Auditor:** Zero-trust independent, read-only | **Method:** evidence hierarchy
`L1 Real Runtime > L2 WorkflowEnvironment time-skipping > L3 Unit/SQLite/Static`
| **Scope:** `apps/api`, `apps/web`, `infra`, `docs/{adr,architecture,phases}`,
`temporal`, `graph`, `security`, `66-phase` predecessor gates

---

## 1 Executive Summary

**MVP track (`01-mvp` P00-P21):** `COMPLETE 93.6 APPROVED` at `787053a` —
honest. LangGraph hardening `bd7adc6` **PRODUCTION READY** (64 graph +40 WE,
42/42 RLS `FORCE`, 110 OpenAPI, 11 dry-run, `web typecheck 0`) is the additive
durability/topology seam and passes `matrix --strict`.

**Enterprise migration track (`02-cont` P00-P07):** `DOCUMENTED NOT REALISED`.
Gates `CONT-P00 95.47 → P06 96.08 → P07 96.16` are **documentation-only**
(`Mermaid C4` + `ADRs 040-043` + `05 DELs v1.0`), but
`rg cell_id ./apps/api/src/api → 0 hits`, `migration-control-plane/` `∅`,
`compat/` `∅`, `workspace.cell_id` `∅`, `FORCE RLS 42/42` actually `4` via
`0005_rls.py` (0010/0019/0020 not in `migrations/`), per-cell
`postgres+pgbouncer+redis` `∅`. Enterprise `HPA 2→8` etc. exist generically but
not per cell.

**Security & privacy:** Core zero-trust invariants **implemented**:
`validate_no_secrets` 35 keys recursive + `validate_graph_state` + `RLS FORCE` +
`validate_workspace_binding` + `forged→pending` + `20KB` + `_redact 14 keys` —
all `PASS`. **HIGH blockers** remain for public GA:
`ZT-01 temporal start fail-open on DB exception` (`routers/temporal.py:192`),
`ZT-02 execute_approved_action no permission re-check` (`activities.py:607`),
`TI-02 NULL workspace approvals visible to all`,
`PR-01 COPPA/FERPA age gate 18+ assumption only`.

**Tests & infra:** `64 graph`
`L3 unit (real StateGraph + PYTEST_CURRENT_TEST mock)`, `40 temporal`
`L2 WE time-skipping` (deterministic, not real cluster), `73→233 security`
`L3 SQLite`, `2731` collected (xdist hang `finding 39` mitigated not re-proven),
`42/42 RLS` `L1 on PG` / `L3 on SQLite`, `110 OpenAPI` `L1 static`,
`worker 11 dry-run` `L2`, `docker 8 healthy` `L1 historic`/`L3 static`,
`HPA 2→8` `L3 declaration`, `p95 120ms <200` `L1 historic`, `SLSA L2 cosign`
`L3 CI`, `gitleaks 0` `trivy 0 CRIT` `syft spdx` `L3 CI`, `xdist hang`
`MITIGATED NOT PROVEN`, `chaos 0%` `L2 WE only`, `tracing partial` (`logging`
exporter only), `pgvector fallback` `LIKE` honestly `empty`.

**Overall:** **CONDITIONAL GO** for current `local/staging` + adult-consumer MVP
(no critical blocker). **NO-GO** for `multi-tenant enterprise` / `public GA` /
`<18 EDU` until `P0` cell/adapter/RLS + `ZT-01/02` fixed. Enterprise `CONT-P08`
must re-baseline `CONT-P07 isolation/migration` at `88+` before proceeding — per
`CONT-P05:126` `NO-GO <88`.

---

## 2 Repository Forensics — Verified Counts

| Signal           | Verified                                                                                            | File:line                                            |
| ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `AGENT_REGISTRY` | 22 (10 MVP canonical)                                                                               | `orchestrator/router.py:58`                          |
| `Graph nodes`    | 10 `validate_input→…→finalize` + 4 conditional edges                                                | `graph/__init__.py:57-122` `get_graph_metadata`      |
| `State`          | `20KB` `20 msgs×4KB` `rag 8/8/5 8KB`                                                                | `graph/state.py:60,90,108`                           |
| `Workflows`      | 6 `Ingest/Hello/DurableAgent/Approval/ConnectorSync/EventTriggered`                                 | `temporal/workflows.py:115,240,248,359,422,504`      |
| `Queues`         | 8 `ingest:20 documents:2 agent:8 connectors:6 schedules:4 approvals:20 memory:2 events:8`           | `temporal/queues.py:19`                              |
| `Activities`     | 11 `ALL_ACTIVITIES`                                                                                 | `temporal/activities.py:834`                         |
| `Tools`          | 49 +1 alias + dynamic `mcp__*`                                                                      | `tools/definitions.py:933` `executor.py:98 gated 12` |
| `Migrations`     | 8 `0002→0009` (claimed `0010/0019/0020 42/42` not in `migrations/`)                                 | `migrations/runner.py:15`                            |
| `RLS`            | `4 via 0005_rls` `FORCE` (claimed `42/42` via `alembic 0010/0019/0020` honest `L1 on PG` elsewhere) | `migrations/0005_rls.py:16`                          |
| `OpenAPI`        | 110 `openapi:3.1.0 version:0.2.0`                                                                   | `docs/backend/openapi.yaml:1`                        |
| `ADRs`           | 43 `ADR-001→043` (`040-043` cells/control-plane 2026-08-29)                                         | `docs/adr`                                           |
| `Terraform`      | 12 modules `s3+rds+vpc+eks…`                                                                        | `infra/terraform/modules`                            |
| `Kubernetes`     | ~40 yamls (claimed 60) `base 20` + `overlays` `HPA 2→8 worker` `3→10 api`                           | `infra/kubernetes`                                   |
| `Docker compose` | 6 healthchecks (prod 11) `temporal` profile                                                         | `docker-compose.yml:31`                              |
| `Graph tests`    | 64 (9 files) `L3`                                                                                   | `apps/api/tests/graph`                               |
| `Temporal tests` | 40 WE (13 files) `L2`                                                                               | `apps/api/tests/temporal`                            |
| `Security tests` | 73 unique →233 expanded `L3 SQLite`                                                                 | `apps/api/tests/security`                            |
| `Coverage`       | `fail_under 80` (claimed 94% `L1 historic`)                                                         | `pyproject.toml:98`                                  |

---

## 3 End-to-End Verification — Evidence Hierarchy

| Claim               | Expected        | Measured                                                                                                                                                           | Tier                                                        | Verdict                                    |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------ |
| `graph 64`          | 64 graph        | 64 unique                                                                                                                                                          | L3 unit (`StateGraph ainvoke` + `PYTEST_CURRENT_TEST` mock) | PASS (topology proven, retrieval mocked)   |
| `temporal 40 WE`    | 40 WE           | 40 `WorkflowEnvironment.start_time_skipping`                                                                                                                       | L2 deterministic                                            | PASS (logic proven, not ops)               |
| `RLS 42/42`         | 42 `FORCE`      | 4 via `0005_rls`, `alembic 0010/0019/0020` `FORCE` exists but not in `migrations/` `4→42` via `0020` in `alembic/` only                                            | L1 PG / L3 SQLite                                           | PASS migrations / FAIL `migrations/` drift |
| `openapi 110`       | 110 paths       | 110 `^  /`                                                                                                                                                         | L1 static                                                   | PASS                                       |
| `worker 11 dry-run` | 11 activities   | 11 `ALL_ACTIVITIES`                                                                                                                                                | L2 CI                                                       | PASS                                       |
| `docker 8 healthy`  | 8 healthy       | 6 healthchecks dev, 11 prod `docker ps` `L1 historic`                                                                                                              | L3 static now                                               | PASS historic                              |
| `HPA 2→8`           | min2 max8       | `temporal-worker 2→8` `api 3→10`                                                                                                                                   | L3 declaration                                              | PASS (worker)                              |
| `p95 120ms`         | <200ms          | `120ms 20 RPS` `performance-budget.json p95_read 200`                                                                                                              | L1 historic                                                 | PASS historic                              |
| `SLSA L2 cosign`    | L2              | `deploy.yml cosign awskms + sbom spdx`                                                                                                                             | L3 CI                                                       | PASS workflow                              |
| `gitleaks 0`        | 0               | `security-scan.yml gitleaks`                                                                                                                                       | L3 CI                                                       | PASS                                       |
| `trivy 0 CRIT`      | 0               | `trivy fs/image` `CRITICAL,HIGH`                                                                                                                                   | L3 CI                                                       | PASS                                       |
| `syft spdx`         | spdx            | `anchore/sbom-action spdx-json`                                                                                                                                    | L3 CI                                                       | PASS                                       |
| `xdist hang`        | full 2731 green | `2731` collected, `finding 39` `asyncio_default_fixture_loop_scope=function` + `timeout 120` mitigated; `233 passed` in 85s, full suite never re-run to completion | L2/L3                                                       | MITIGATED NOT PROVEN                       |
| `chaos empty`       | live mesh kill  | `4 WE + 6 Chaos-Mesh CRDs` declared, no `kubectl apply`                                                                                                            | L2 WE only                                                  | GAP                                        |
| `tracing partial`   | OTel traces     | `interceptors` activity+workflow spans, `otelcol` `logging` only (no `jaeger/tempo`)                                                                               | L3 partial                                                  | GAP                                        |
| `pgvector fallback` | vector recall   | `LIKE` fallback `empty` honestly vs real `HNSW vector(1536)` `NOT_EXECUTED`                                                                                        | L3 fallback                                                 | GAP                                        |

---

## 4 Security & Privacy Deep Audit

### Verified Controls (PASS)

- `validate_settings()` JWT 32+ fail-fast `config.py:185` + `AuthMiddleware`
  `require exp,sub` `middleware/auth.py:48`
- `TenantContext` `ContextVar` + `SET LOCAL` (`database.py:23` +
  `middleware/tenant.py:59` fail-closed) + `TenantMiddleware` inner-than-Auth
  `main.py:261` — `LIFO` correct.
- `RLS 42/42 FORCE` `0010 34 +0019 3 +0020 5` (`alembic/versions`) `FORCE` +
  `BYPASSRLS` revoked — `L1 on PG` (but `migrations/` drift, see §5).
- `validate_no_secrets` 35 keys recursive `temporal/validation.py:43` +
  `graph/state.py:108` + `routers/temporal 20KB` + typed `DurableAgentRequest`
  IDs only — `temporal/test_security` proves `api_key` →
  `ApplicationError non_retryable`.
- `Approval forged→pending` `graph/nodes.py:357`
  `ApprovalWorkflow 3600s waitCondition` (`workflows.py:359`),
  `agent_approvals.expires_at` cron.
- `Prompt injection` 14 patterns + `base64` + `LLM fallback gated`
  (`middleware/prompt_injection.py:21`),
  `graph validate_input critical→ValidationError`.
- `Quota` Redis Lua `quota:{ws}:{date}:{metric}` (`temporal/quota.py:22`)
  `FAIL-CLOSED prod` + per-tool `nodes:403` (`temporal/test_chaos` 20
  concurrent).
- `EncryptedString` `Fernet` `hashlib.sha256(key).digest()`
  (`services/encryption.py:50`), `_redact 14/20 keys` recursive.

### Blockers — Must Fix Before GA

| ID                    | Title                                                                                    | Sev              | File:line                                                                   | Risk                                                             | Blocker?             |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------- |
| **ZT-01**             | Temporal `start_*` fail-open on DB exception                                             | **HIGH**         | `routers/temporal.py:192,254` `except Exception: pass`                      | attacker starts workflow for any `ws` during blip                | **YES before prod**  |
| **ZT-02**             | `execute_approved_action` no permission re-check                                         | **HIGH**         | `temporal/activities.py:607` `# re-check would happen`                      | signal race `T0 approved T1 revoked T2 execute`                  | **YES**              |
| **TI-02**             | `NULL workspace approvals` visible to all                                                | **HIGH**         | `services/approval.py:122,147`                                              | cross-tenant payload leak                                        | **YES multi-tenant** |
| **PR-01**             | COPPA/FERPA age gate `18+` assumption only (no `dob`/`consent`)                          | **HIGH (legal)** | `docs/vaeloom-mvp-e2e.md:485` `consent.py:14`                               | high-school → COPPA parental consent / FERPA duties not designed | **YES <18/EDU**      |
| **SC-01**             | `_REDACT_KEYS` vs `SECRET_KEYS` drift (20 vs 30/36)                                      | **MED**          | `logging.py:7` vs `temporal/validation.py:13`                               | log not redacted vs validation gap                               | GO with ticket       |
| **TI-01**             | `Workspace REST owner-only` denies members                                               | **MED**          | `services/workspace_service.py:29`                                          | member 404 but Temporal allows                                   | GO (availability)    |
| **ZT-03/04/05 IN-01** | `LLM classifier off` + multipart bypass + scrape in-mem 20/h + `sanitize_text` not wired | **MED**          | `middleware/prompt_injection.py:48` `executor.py:76` `utils/sanitize.py:10` | gradual injection, 4× quota on 4 workers, XSS not persisted      | CONDITIONAL          |

**OWASP Agentic 2026 mapping:** `ASI06 Excessive Agency` → `ZT-02` HIGH,
`ASI04 Poisoning` → `RAG never fabricated` mitigated, `ASI08 Vector` →
`pgvector fallback` LOW, etc.

---

## 5 Critical Gaps — Enterprise Migration

**P0 — Blocks enterprise cutover (CONT-P08 must re-baseline):**

1. **`cell_id` absent everywhere** — `schema.py` `∅`, `migrations/` no
   `add_cell_id`, no `SET app.cell_id`, no `X-Cell-Id`, K8s no `cell-{id}`
   namespace, Terraform no per-cell module
   (`rg cell_id ./apps/api/src/api → 0`). ADR-040 horizon `W2→P19` cannot start.
2. **RLS illusion** — `AGENTS.md 42/42` vs `migrations/0005_rls.py 4` + missing
   `0010/0019/0020` in `migrations/`; `FORCE RLS` + `BYPASSRLS` only in
   `alembic/` (L1), `migrations/` tests use SQLite no enforcement — single
   missing `where workspace_id=:ws` leaks 38 tables.
3. **`migration-control-plane/adapter` + `compat/` `∅`** — ADR-043 dual-read
   shadow + ledger + per-tenant `1%→100%` + kill switch `3/30s` has no code
   (`Glob =>0`).
4. **Residency `IN/EU/US` not enforced** — `Tenant.isolation pooled` free-form,
   `allowed_origins localhost` only, no region routing.
5. **Supply-chain `DEL-04` zero** — `pyproject mcp>=2 signxml 41` not scanned,
   `docker prod` not signed beyond workflow declaration, `gitleaks/trivy/syft`
   not re-run to `0` today.

---

## 6 Scorecard — 66-Phase + LangGraph Gates

| Phase       | Gate      | Claimed          | Re-verified           | Drift                                                                       | Honest                                                                                    |
| ----------- | --------- | ---------------- | --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mvp-p00`   | Gate 06   | 71.05            | PASS                  | 2241→2731 +59                                                               | 71.05                                                                                     |
| `cont-p00`  | `06-gate` | 95.47            | PASS                  | 8 healthy, `temporal:7233`, 110, 42/42 `L1 PG`                              | 95.47                                                                                     |
| `cont-p01`  | 06        | 95.15            | PASS                  | —                                                                           | 95.15                                                                                     |
| `cont-p02`  | 06        | 95.51            | PASS                  | —                                                                           | 95.51                                                                                     |
| `cont-p03`  | 06        | 95.88            | PASS                  | —                                                                           | 95.88                                                                                     |
| `cont-p04`  | 06        | 95.62            | PASS                  | W0-W7                                                                       | 95.62                                                                                     |
| `cont-p05`  | 06        | 96.16            | **PARTIAL**           | ADRs 040-043 accepted **but** `cell_id 0 hits` `adapter 0`                  | **88** (would fail `find + rg` verification)                                              |
| `cont-p06`  | 06        | 96.08            | PARTIAL               | `gitleaks 0` not re-run today, `syft 420KB` `L3 CI`                         | 92                                                                                        |
| `cont-p07`  | 06        | 96.16            | PARTIAL               | `pg_basebackup` `NOT_EXECUTED`, `reindex` only `user_preference`            | 90                                                                                        |
| `LangGraph` | Closure   | PRODUCTION READY | **PASS for topology** | `64 graph +40 WE` `matrix strict PASS` `0 imports` `MemorySaver` documented | **CONDITIONAL GO** for MVP (P0 cell gaps block enterprise, but LangGraph seam is correct) |

**Overall 66-phase health:** MVP `P00-P21` `93.6 CLOSE` is honest;
`CONT-P00→P04` `95+` honest; `CONT-P05→P07` `~88-92` if re-scored with code
verification (`CONT-P05:126` `NO-GO <88` not yet triggered, but next phase
`CONT-P08` must re-baseline `CONT-P07 42/42` isolation at `88+` before
proceeding).

---

## 7 Verification Commands (reproducible evidence)

```bash
git status --short
git rev-parse HEAD  # e255d63 (CONT-P07) → 0dc782d (CONT-P06)
grep -R "langgraph" apps/api/src/api/temporal/workflows.py  # 0 (only comment seam)
uv run --project apps/api python scripts/audit/langgraph_matrix.py --strict  # PASS 0 critical
uv run --project apps/api python -m pytest apps/api/tests/graph -q  # 64 passed
uv run --project apps/api python -m pytest apps/api/tests/temporal -q -o addopts=""  # 40 passed WE
uv run --project apps/api python -m api.temporal.worker --dry-run  # 11 activities
pnpm --filter web typecheck  # 0 (after landing cleanup)
docker compose --profile temporal ps  # 8 healthy when up
docker exec vaeloom-redis redis-cli ping  # PONG
Select-String -Path "apps/api/src/api/graph/state.py" -Pattern "MAX_STATE_BYTES"  # 20480
Select-String -Path "apps/api/alembic/versions/0010*.py" -Pattern "FORCE RLS"  # 42/42
rg -n "cell_id" apps/api/src/api  # 0 hits (P0 gap)
rg -n "migration-control-plane|compat" .  # 0 hits (P0 gap)
```

---

## 8 Findings Prioritized (P0→P1)

**P0 — Fix before `CONT-P08` / enterprise cutover:**

- `P0-01` Add `cell_id` (`workspaces.cell_id TEXT`, `migrations/add_cell_id`),
  `SET app.cell_id`, `X-Cell-Id`, K8s `cell-{id}` overlay, Terraform per-cell
  `rds+kms` (`ADR-040`).
- `P0-02` Align `migrations/0005_rls.py 4` → `42/42` `FORCE RLS` (port
  `alembic 0010/0019/0020` to `migrations/` + `FORCE` + `BYPASSRLS` revoke) +
  `rg` `tenant_id` 42.
- `P0-03` Create `migration-control-plane/adapter` + `compat/` +
  `reconciliation ledger` (`source/target IDs + checksum` `ADR-043`) +
  `feature_flag 1%→100%` per tenant.
- `P0-04` `ZT-01` + `ZT-02` code fixes (3× `except Exception: pass → 503`,
  re-query `agent_approvals + WorkspaceUser + Permission` at
  `execute_approved_action`).

**P1 — Fix before public GA / <18 EDU:**

- `P1-01` `TI-02` NULL approvals → `requested_by == user_id` or disallow `NULL`.
- `P1-02` `PR-01` age gate `dob` + `18+` checkbox + block `<13` +
  `consent minor` scope + legal review `NFR-28`.
- `P1-03` `CONT-P06 DEL-04` re-run `gitleaks` + `trivy` + `syft` to `0/0/420KB`
  `L1` (not just workflow declaration).
- `P1-04` `chaos` live `kubectl apply chaos-config.yaml` + `up==0` SLI +
  `k6 p95 120ms` re-measure `L1`.
- `P1-05` `tracing` exporter `tempo` beyond `logging` (`otelcol-config.yaml`).

---

## 9 Gate Recommendation

**MVP track (`01-mvp` P00-P21):** `PHASE APPROVED — PROCEED — 93.6` **remains
approved** — LangGraph `bd7adc6` additive `PRODUCTION READY` does not regress.

**Enterprise migration track (`02-cont` P00-P07):**

- `CONT-P00→P04` `95+` **APPROVED** — honest.
- `CONT-P05→P07` `96.16` **CONDITIONAL GO (documentation-only)** — `P0-01..04`
  make code reality `~88-92` if scored with `find + rg` verification per
  `CONT-P05:126` `NO-GO <88` not yet reached, but `CONT-P08` **must not assume
  `CONT-P07 96.16`** — must re-baseline `isolation 42/42` + `add_cell_id` +
  `adapter` at `88+` before `CONT-P08` `API compatibility` work (per
  `CONT-P08 §6` entry criteria).

**Security & privacy:** **CONDITIONAL GO** for `local/staging` + adult-consumer
MVP (0 critical blocker). **NO-GO** for `multi-tenant enterprise` / `public GA`
/ `<18 EDU` until `ZT-01/02`, `TI-02`, `PR-01` fixed.

**Overall zero-trust:** **CONDITIONAL GO — NON-DEPENDENT WORK ONLY** until `P0`
cell/adapter/RLS + `ZT-01/02` closed; enterprise cutover, all-tenant
`dual-write`, or launch without design-partner evidence is **prohibited** (per
`CONT` track exclusions). Next phase `CONT-P08` is **authorized only after**
`P0-01..04` re-baseline.

---

## 10 Absolute Paths Audited (sample)

- `C:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom\apps\api\src\api\graph\__init__.py:15 HAS_LANGGRAPH,57 StateGraph 10,128 interrupt_before None`
- `graph/state.py:60 VaeloomGraphState 16 fields,91 MAX,108 validate_graph_state,217 build_initial_state`
- `graph/nodes.py:34 validate_input,84 retrieve_context 8KB,143 route,177 supervisor,233 agent,349 policy_check,397 tool_execute,513 evaluate`
- `temporal/workflows.py:115 Ingest,248 DurableAgentRun 282 validate_no_secrets,359 Approval 73s wait 3600s`
- `temporal/activities.py:362 durable_agent_run ONLY import,607 execute_approved_action,834 ALL_ACTIVITIES 11`
- `middleware/tenant.py:38 set_rls_session_vars,78 TenantMiddleware,124 TenantContext`
- `models/schema.py:27 User,109 Workspace,248 Memory Vector1536,324 Entity`
- `alembic/versions/0010_rls_force_and_roles.py:66 42/42 FORCE` vs
  `migrations/0005_rls.py:16 4`
- `docs/adr/ADR-040:1 cells,041 workload,042 residency,043 adapter`
- `docs/phases/cont-p05/06-gate-report.md:30 96.16`,
  `cont-p06/06-gate-report.md:30 96.08`, `cont-p07/06-gate-report.md:29 96.16`
- `docs/backend/openapi.yaml:1 3.1.0 110`
- `infra/terraform/modules/{eks,rds,vpc,waf,kms}/main.tf`,
  `infra/kubernetes/apps/{api,temporal}/deployment.yaml`

---

_Audit 2026-08-29 read-only — no files modified, no DB execution. Evidence
hierarchy applied; `NOT_EXECUTED` where `rg 0 hits`._
