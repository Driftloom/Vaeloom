# 36 — FULL-PROJECT ZERO-TRUST AUDIT — 2026-08-23

**Scope:** entire current project on `frontend/phase-02a` @ `49e9ae1` (frontend
Phase-02B + backend resume-pipeline/browser-tools/MCP track). **Mode:** static +
LIVE RUNTIME. No prior report trusted — every checkable claim re-measured this
session. **Methods:** file:line static sweeps (2 parallel deep agents), live
server boots with differential configs, real endpoint probes, full
jest/pytest/playwright executions, upstream research (GitHub issues/releases,
FastAPI discussions). **Defect files:** 37, 38, 39, 40, 41, 42, 43 (individual).
This file is the master register + clean-verdict ledger.

---

## 1. Verdict summary

| Severity | Count | IDs                                                                                                                                 |
| -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | 3     | 37 (pfi 500s every request, unpatched boots), 38 (alembic.ini path → 3 orphan tables), 39 (full pytest suite hangs/crashes)         |
| **P2**   | 4     | 40 (doc drift incl. contradictions), 41 (MCP cmd.exe metachars), 42 (unbounded MCP structuredContent), 43 (signup fabricated stats) |
| **P3**   | 9     | see §5                                                                                                                              |

**Overall: CONDITIONAL GO for local/e2e development; NO-GO for bare production
boot until 37+38 land** (both have precise, small fixes; 37 is a one-line
version bump now that upstream v8.0.1 exists).

---

## 2. P1 findings (one-line recap, details in files)

- **37** — `prometheus-fastapi-instrumentator` 7.1.0 vs FastAPI 0.141.1: EVERY
  request 500s in any boot without the `apps/web/e2e/api-launcher.py`
  monkeypatch. Live-differential proven (OTel innocent). Upstream fix released
  2026-06-22 (v8.0.1) — repo hasn't taken it. Also retroactively explains
  Phase-01 F-17 "CORS-masked errors" (preflight 500 carries no CORS headers).
- **38** — `main.py:121` builds `apps/api/src/alembic.ini` (one dirname short of
  the real `apps/api/alembic.ini`) → alembic silently never applies from
  repo-root/CWD≠apps/api boots → custom-runner fallback lacks `consent_records`
  / `scheduled_jobs` / `job_executions` (no model owns them) → `/consent/me`,
  `/scheduler/jobs`, daemon poller break on fresh DBs. Frontend e2e shim creates
  them as workaround.
- **39** — Documented runner (`pytest -q`, xdist `-n 4`) crashed at 15%
  (security-conftest async-generator teardown cascade), deadlocked at 83% (three
  sampled stuck tests pass serially), and `-n 2` exceeded 24 min. New resume/MCP
  suites are NOT the cause (349/349 standalone, 41 s).

## 3. P2 findings

- **40** — AGENTS.md drift/contradictions measured: tests 2661→actual **2731**
  (and internal 2557 contradiction); OpenAPI 106 vs 99 vs actual **110**; "39
  e2e" vs actual 60-test suite; stale main.py line refs (167/168 → actual
  250/256); documented test account `demo@vaeloom.app` doesn't exist on fresh
  DBs; "~3-5min" suite time false today. RLS "42/42": direct DDL grep shows 5
  explicit statements — flagged UNVERIFIED, not asserted false.
- **41** — MCP stdio denylist `[;&|`$><\n\r]`misses cmd.exe-active`% !
  ^`for`.cmd/.bat` wrapped commands (shell interpreters themselves correctly
  denied).
- **42** — MCP tool `structuredContent` passes uncapped into agent context (text
  path IS capped at 20 KB); `McpCallRequest.arguments` unbounded.
- **43** — Signup page fabricates "10K+ users / 8 AI Agents / 99.9% uptime" —
  last survivor of the F-02 cluster.

## 4. LIVE RUNTIME verification ledger (what was actually executed)

| Check                                                                    | Result                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Raw API boot, OTel ON: `/health`                                         | **500 reproduced**                                                                            |
| Raw API boot, OTel OFF: `/health`                                        | **500 reproduced** (isolates pfi)                                                             |
| OPTIONS preflight w/ Origin                                              | **500, no CORS headers** (= F-17 root cause)                                                  |
| `/metrics`                                                               | 200 both configs                                                                              |
| Launcher-shimmed API: `/health`, login, `/scheduler/jobs`, `/consent/me` | all 200                                                                                       |
| Fresh-checkout simulation (deleted dev.db)                               | tables auto-created + user seeded inside lifespan, login OK                                   |
| Backend pytest full suite                                                | attempt outcomes in finding 39; **cannot certify green today**                                |
| New pipeline suites (6 files)                                            | **349 passed / 41 s**                                                                         |
| pytest collect-only                                                      | **2731 collected / 4.4 s**                                                                    |
| Playwright gating suite re-run                                           | **24/24 passed** (auth 6, files-chat 3, mutations 7, axe dark+light, responsive ×6 viewports) |
| Visual baselines (earlier same day)                                      | 36/36 created + compared twice                                                                |
| Jest unit/component                                                      | 34/34                                                                                         |
| `pnpm build` (normal mode)                                               | PASS, 102 kB shared JS, landing static ○                                                      |

## 5. P3 register (evidence in code, fix when convenient)

1. `utils/url_guard.py` — no port allowlist (any public-IP TLS port passes);
   DNS-rebinding TOCTOU documented-accepted (`browser_service.py:15-18`).
2. Scrape quota = module-level dict (`tools/executor.py:55`) → multiplies per
   worker process.
3. MCP timeout copy says 10 s/30 s, actual budgets 15 s/35 s
   (`mcp_client_service.py:248,277`).
4. `resume.content` JSON unbounded pre-render → expensive renders behind only a
   6/min limiter.
5. `main.py:153` MCP warm-up import sits outside try (ImportError kills bridging
   silently; per-row isolation is fine).
6. Browser-tools kill switch ships default-ON
   (`config.py:93 browser_tools_enabled=True`) — intentional? confirm product
   call.
7. Jobs "Saved" toast is localStorage-only while phrased like persistence
   (`jobs/page.tsx:201-207`).
8. Settings notification toggles persist browser-local only
   (`settings/page.tsx:84-98`).
9. Tokens (access+refresh) in localStorage; refresh token sent in body; no
   httpOnly cookie anywhere (`api.ts:21,75-90,225`) — accepted trade-off,
   revisit before enterprise.

## 6. CLEAN verdicts (verified, not assumed)

- **Fabrication sweep:** `Math.random` ×4 all ID/key-gen only;
  admin/billing/marketplace/flags/orgs/dev honest stubs or real calls; status
  uptime honest; native `confirm()/alert()` 0; `window.location.reload()` 0; raw
  palette text classes 0.
- **Dead code:** useSSE/zustand/batch/feature-flag-client/i18n gone with zero
  importers; hooks all consumed.
- **Observability:** `removeConsole {exclude:['error','warn']}` confirmed;
  ErrorTrackingBoundary global handlers present.
- **SSRF guard (empirical):**
  169.254.169.254/127/10/192.168/172.16/::1/fd00/fe80/CGNAT/0.0.0.0/multicast/IPv4-mapped
  ALL blocked, 8.8.8.8 allowed; https-only enforced; redirects re-validated per
  hop on BOTH httpx (manual loop ≤5) and Chromium (route interceptor); policy
  blocks never fall through to the other engine.
- **MCP:** env values encrypted per-key; child env allowlist (no secret leakage
  to servers); approval-gating chain intact (mark → registry union → loop
  refusal); route auth + tenant filter + RLS + call-time ownership check.
- **Resume pipeline:** Jinja autoescape covers templates, zero `|safe`,
  context-only user data (no SSTI); compile rate limits genuinely enforced via
  middleware attribute read; artifact download = ownership + query filter + RLS
  policy layered; DOCX text-node only; ATS scores deterministic/labeled
  fallbacks (`keyword-fallback`, `mode` field).
- **Frontend gates:** typecheck 0 / lint 0 errors / build PASS / axe 0
  serious-critical both themes / overflow ≤2 px at 320-1440 — all reproduced
  this session.

## 7. Recommended fix order

1. **37**: bump pfi `>=8.0.1`, delete shim patch, add raw-boot regression test.
   _(smallest diff, largest blast radius)_
2. **38**: fix dirname at `main.py:121`; startup log applied-migration head;
   give orphaned tables real ownership.
3. **39**: pytest-timeout to name the hang; fix security conftest teardown;
   split CI suites until green.
4. **43** (copy swap) and **40** (numbers single-sourcing).
5. 41/42 hardening + P3 batch.

_Audit complete — evidence reproducible from commands inline above._
