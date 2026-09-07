# Muse Phase B — Zero-Trust Baseline

**Date:** 2026-09-07 **Author:** Muse Phase B owner **Security contract:**
`docs/audits/MUSE_SECURITY_HANDOFF.md` (immutable, read before any change)

## Commit / Branch / Tree

- Branch: `master`
- Baseline commit: `00d47105a2864b568c94686774fcaee138c871f4` (bot-committed
  Phase B wave)
- Prior: `3be06b7` (Google Docs tools), `11ecce3` (Phase B
  checkpoints/graph/safety), `901d49e` (Phase A security), `b387bad`
  (pre-Phase-A HEAD)
- Dirty files at intake: 12 (all Phase B wave: executor, 10 test files,
  spend/llm/config fallout). No user changes were destroyed; bot commits only
  added.
- Note: a bot (`Vaeloom Bot`) auto-commits the tree periodically. Verify
  `git log` before attributing any change.

## Runtime Versions

- App Python: 3.12.13 (uv venv). System Python 3.14.7 is NOT used.
- uv 0.11.19. Node/pnpm present for web (not exercised in this phase).
- No ruff/mypy in `.venv` (configured in `pyproject.toml` but uninstallable
  offline) — verification is test-led; `py_compile` used for syntax.

## Database / Queue Configuration (names only, no secrets)

- `database__url` default:
  `postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom`. **PostgreSQL
  REACHABLE** — the API test-suite runs against live PG (see test logs).
- `redis__url` default: `redis://localhost:6379/0`. **Redis REACHABLE** in this
  environment (daemon tests still fake it; real-topology test added in §37).
- Dev `.env` present with 76 keys (names inventoried, values never printed).
  Includes live provider keys (Groq/Gemini) — tests stay hermetic via mocks; no
  live model calls are made by the suite except where a test forgot to isolate
  (fixed: streaming no-key test).
- State backend default: `file` (`~/.vaeloom/state`); DB/Redis/Memory via
  `VAELOOM_STATE_BACKEND`. Tests use `MemoryStateStore` (isolated per-test).

## Feature Flags (production defaults)

| Flag                             | Default                                | Meaning                                                                     |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `agent_react_enabled`            | `False`                                | Static dispatch is the default path                                         |
| `temporal_enabled`               | `False`                                | Legacy non-durable path by default                                          |
| `langgraph_enabled`              | `False`                                | Graph is topology-only, disabled                                            |
| `mvp_scope_enforced`             | `True`                                 | 10 canonical agents                                                         |
| `agent_default_daily_budget_usd` | `0.0` (= unlimited at workspace scope) | Per-run hard ceilings added in Phase B                                      |
| `agent_max_react_rounds`         | `5`                                    | + per-run iterations 3 / tools 12 / tokens 12000 / $0.50 / 120s / 2 replans |

## Test Count (Phase B close)

- Targeted runtime+security set (32 files): **614 passed, 4 skipped, 0 failed**.
- Skips: 4 pre-existing live-PG RLS tests (SQLite CI path).
- Full backend suite: known xdist hang (finding 39); per-file/serial runs are
  the supported mode. Full-suite green is NOT claimed in this phase.

## Dirty-File Policy

All Phase B edits are additive or strictly behavior-preserving except the
documented fake-completion removals (`qa_failed`, validation-gated ReAct). Phase
A files were touched only to (a) close the Google-Docs approval gap created by
another agent, and (b) align stale unit fakes with Phase A seams.
