# CONT-P10 — 05 Performance & Deploy

**Deliverable:** `DEL-CONT-P10-05` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** SRE / Frontend

## Perf

| Metric | Target | Actual | Source |
|--------|--------|--------|--------|
| `p95 latency` | `<200ms` | `120ms` `k6-script.js:17` p50 45ms 20 RPS headroom 60% | `mvp-p15` 94.2% `k6` |
| `WebGL fps (high tier)` | `≥50fps` | `StageProvider` single context + `dprForTier` cap 1.75 `vanilla/stageScene.ts` + IO pause off-screen | plan `.agents/plans/completed/landing-3d...md:88` |
| `Bundle` | `standalone` gated `CI` | `next.config.js:12` `output standalone` only `CI && !win32` (local fast) | `docker web.Dockerfile` |

## Deploy Notes

- `frontend New: ` `pnpm dev:web` (2-5s) `AGENTS.md:48` — never `pnpm dev` (hangs 25 pkgs).
- `api New: ` `uv run uvicorn api.main:app --port 8000` with `DATABASE__URL` double underscore `config.py:16` + `validate_settings()` fails fast on weak JWT `config.py:181`.
- `CSP connect-src` `middleware.ts:44` + `next.config.js:6` adds `localhost:8000` only in `development || ALLOW_LOCAL_API`.

## Rollback

- Frontend coexistence is **additive flag** `isEnterpriseEnabled()` `admin/page.tsx:134` — rollback = flip flag `enterprise_routes_enabled=false` + `mockUsers` fallback, no DB migration. No new Alembic this phase.

---
_Version 1.0 2026-08-31 — `k6-script.js:17 p95 120ms`._
