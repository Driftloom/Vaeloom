# CONT-P14 — 01 Test Governance / Environments (WS-14.1, DEL-01)

## Suite inventory @ HEAD (all under `apps/api/tests/`)

| Layer | Location | CI job |
| --- | --- | --- |
| Unit/contract | `tests/test_*.py` (root, ~200 files) | `ci-backend.yml` (`pytest tests/ --cov`, minus temporal) |
| Security | `tests/security/` (10 files incl. red-team, SAML fail-closed) | same + `security-audit.yml` |
| Eval/AI | `tests/eval/` (quality gate, golden, RRF) | same |
| Agents/graph | `tests/agents/`, `tests/graph/` | same |
| Middleware | `tests/middleware/` | same |
| Integration | `tests/integration/` | `ci-integration.yml` |
| Temporal/durable | `tests/temporal/` | dedicated job (`--timeout=120`) |
| Smoke | `tests/smoke/test_health.py` | deploy pipeline |
| Frontend a11y | `jest-axe` + `a11y-audit.yml` | `ci-frontend.yml` |

## Environment policy

- Default: SQLite + `NullPool` + `mock_llm`/`mock_connector_test` (hermetic, offline).
- PG-gated: `test_rls_isolation.py`, `test_rls_live_pg.py` (skip on SQLite;
  authoritative for RLS certification — carried condition).
- Full suite under xdist hangs (finding 39): per-file or serial (`-o addopts=""`).
- Flaky quarantine: pre-existing env failures (Slack `invalid_auth`) proven
  pristine via stash-check; stay visible, never silenced.
