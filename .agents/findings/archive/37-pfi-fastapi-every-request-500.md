# 37 — [P1] pfi 7.1.0 + FastAPI 0.141.1: every API request returns 500 without the e2e monkeypatch

**Date:** 2026-08-23 · **Severity: P1 (production-blocking as pinned)** ·
**Status: RESOLVED (verified 2026-08-28)** — `apps/api/src/api/main.py:10-28`
applies an import-time patch to
`prometheus_fastapi_instrumentator.routing.get_route_name` that catches the
`AttributeError` on FastAPI `_IncludedRouter` (no `.path`) and returns
`"unknown"` instead of crashing — protecting ALL boots (docker/plain uvicorn,
not just e2e). The pfi>=8.0.1 bump is blocked by starlette>=1.0.0
incompatibility with pinned starlette==0.50.0/FastAPI 0.141.1, so the patch is
the correct interim fix until a coordinated FastAPI/starlette/pfi upgrade.

## Evidence (live-reproduced, differential)

Raw boot (`uvicorn api.main:app` from repo root, no shim), fresh SQLite dev.db:

| Config            | GET /health | OPTIONS preflight                    | /metrics |
| ----------------- | ----------- | ------------------------------------ | -------- |
| OTel **enabled**  | **500**     | **500, empty body, NO CORS headers** | 200      |
| OTel **disabled** | **500**     | —                                    | 200      |

Differential isolates `prometheus-fastapi-instrumentator` as the sole culprit
(OTel disabled → still 500). Lock: `apps/api/uv.lock` pfi **7.1.0**, pin
`apps/api/pyproject.toml:29` `>=7.0.0`, FastAPI pinned `==0.141.1`
(`pyproject.toml:12`).

Root cause (upstream): FastAPI ≥0.137 wraps `include_router()` routes in
internal `_IncludedRouter` objects without `.path`; pfi's
`routing._get_route_name` reads `route.path` unconditionally → AttributeError →
Starlette converts to generic 500. Upstream issue
trallnag/prometheus-fastapi-instrumentator#370; **fixed in v8.0.1 (2026-06-22,
PR #371)**.

## Why this explains the historical F-17 mystery

Phase-01 finding F-17 ("API failures surface as CORS violations", scheduler/jobs
×20, consent/me ×22) is this exact bug: every 500 raised by the pfi middleware
surfaces in the browser as a CORS console error because error responses carry no
`Access-Control-Allow-Origin`. Reproduced above on the bare preflight (500, no
CORS headers).

## Current mitigation

`apps/web/e2e/api-launcher.py` monkeypatches `_patched_get_route_name` — but it
only runs for Playwright/local boots launched through the shim. Any production,
docker, or plain-uvicorn boot has **no protection**: every request 500s.

## Fix direction

1. Bump `prometheus-fastapi-instrumentator>=8.0.1` in `pyproject.toml`,
   regenerate lock.
2. Delete the shim patch block from `apps/web/e2e/api-launcher.py`.
3. Add a regression test asserting `/health` 200 under a raw app import.
4. Re-check OTel-instrumentation partial-match behavior separately after upgrade
   (fastapi discussion #15791 reports otel-instrumentation-fastapi also reads
   `route.path` on partial matches; locked version here is 0.65b0).
