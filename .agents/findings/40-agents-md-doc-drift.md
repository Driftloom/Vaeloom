# 40 — [P2] AGENTS.md / EXECUTION-STATUS documentation drift (verified against reality 2026-08-23)

**Date:** 2026-08-23 · **Severity: P2** · **Status: OPEN**

Zero-trust re-measurement of every checkable claim:

| #   | Claim                                               | In doc                                                           | Reality (measured)                                                                                                                                                        | Verdict                                  |
| --- | --------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Backend tests collected                             | "2661 collected" (AGENTS.md:50)                                  | **2731** (`pytest --collect-only -q`, 4.4s)                                                                                                                               | STALE (+70)                              |
| 2   | Backend tests collected — internal contradiction    | AGENTS.md:50 says 2661; AGENTS.md:135 says "2557 pytest"         | 2731                                                                                                                                                                      | CONTRADICTION                            |
| 3   | OpenAPI paths                                       | "**106 paths**" (AGENTS.md:55) vs "**99 paths**" (AGENTS.md:136) | **110** (`^  /` count in docs/backend/openapi.yaml)                                                                                                                       | BOTH STALE + contradiction               |
| 4   | e2e count                                           | "39 e2e real" (AGENTS.md:135)                                    | **60-test Playwright suite** (24 gating + 36 visual), 24/24 re-run green 2026-08-23                                                                                       | STALE                                    |
| 5   | Prometheus/OTel line refs                           | "main.py:167/168" (AGENTS.md:130)                                | actual `main.py:250` (Instrumentator), `main.py:256` (OTel)                                                                                                               | STALE refs                               |
| 6   | Documented test account `demo@vaeloom.app/demo1234` | AGENTS.md:170-172                                                | Fresh dev.db contains only seeded `audit@vaeloom.test`; demo account does not exist anywhere in seed code                                                                 | MISLEADING on fresh envs                 |
| 7   | Full-suite runtime "~3-5min"                        | AGENTS.md:24                                                     | Hangs/crashes — see finding 39                                                                                                                                            | FALSE today                              |
| 8   | RLS "42/42"                                         | AGENTS.md:131                                                    | Direct `ENABLE ROW LEVEL SECURITY` DDL grep in alembic versions = 5 statements; remainder must come from model metadata/policies — **NOT RE-VERIFIED in depth this pass** | UNVERIFIED (flagged, not asserted false) |

Also: `.agents/findings/` numbering was at 35 before this audit; master audit is
filed as 36 with defects 37-43.

## Fix direction

Single-source the volatile numbers: either generate a `docs/backend/facts.json`
in CI (collect counts, openapi path count) and have AGENTS.md reference it, or
strip point-in-time numbers from AGENTS.md and keep them only in
EXECUTION-STATUS dated entries.
