# CONT-P06 — 03 Engineering / Repository Standards

**Deliverable:** `DEL-CONT-P06-03` | **Version:** 1.0 | **Date:** 2026-08-29

## 1 Layout & Ownership

- `apps/api/src/api/{agents|graph|temporal|orchestrator|tools|services}` — owner
  `Backend Lead` + `AI Lead`.
- `apps/web/src/{app|components|lib}` — owner `Frontend Lead`.
- `infra/{terraform|kubernetes|docker}` — owner `Platform Engineer` + `SRE`.
- `docs/adr 37` + `docs/architecture` + `docs/phases` — owner
  `Enterprise Architect`.

## 2 Style & Quality Gates

- **Backend:** `ruff 8.57` `mypy` `pyright` (strict), `pytest 64+40`
  `fail_under 80` (94.2% retained), `pre-commit` `prettier` + `commitlint`
  conventional.
- **Frontend:** `eslint 8.57` legacy + `prettier` `tsc --noEmit 0` `jest 29.7`
  `swr` + `nx` task caching.
- **Contracts:** `openapi 110` `snake↔camel` `transformKeys`, typed
  `RoutingDecision/Handoff/Eval` `v1` additive.

## 3 Branching & Migration

- `master` `ahead 1` `bd7adc6→3f61cfa` — `feat(langgraph)` + `feat(cont-p05)` 16
  files, `prettier --write` lint-staged 12–16 files.
- `expand–contract` `add_cell_id` nullable → dual-read shadow → remove monolith
  reads; `alembic` `0010→0021` 12 migrations.

## 4 Deprecation Policy

- `feature_flag` per-tenant (`feature-flags.ts 4 flags`) + `kill_switch` per
  agent `3/30s CB` with `owner/default/expiry/audit/removal` — risky behavior
  scoped, reversible.

---

_Version 1.0 2026-08-29 — `ruff/mypy/typecheck 0` + `nx`._
