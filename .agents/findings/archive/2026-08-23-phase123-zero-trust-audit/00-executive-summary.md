# Executive Summary — Zero-Trust Audit of Phases 1–3

Date: 2026-08-23 Scope: resume document pipeline (P1), browser/scraping tools
(P2), native MCP integration (P3) — delivered earlier this session — plus
cross-checks against governance docs (`EXECUTION-STATUS.md`, ADR ledger,
AGENTS.md).

## Severity ledger

| ID     | Sev      | Domain | Finding                                                                                                           | Status                                 |
| ------ | -------- | ------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| F-P2-1 | CRITICAL | P2     | Redirect-based SSRF bypass (public→internal 302 unchecked by both engines)                                        | **FIXED** + 4 regression tests         |
| F-P3-1 | HIGH     | P3     | Full parent env (secrets) leaked to stdio MCP servers                                                             | **FIXED** (allowlist) + test           |
| F-P3-2 | HIGH     | P3     | Windows: `.cmd` targets unspawnable → all seed configs broken on dev boxes                                        | **FIXED** (which+cmd.exe wrap) + tests |
| F-P4-1 | HIGH     | X-cut  | OpenAPI drift-guard test pointed at `docs/Backend/` vs tracked `docs/backend/` → **silently skipped on Linux CI** | **FIXED** casing everywhere            |
| F-P1-1 | MEDIUM   | P1     | API Docker image lacks chromium → PDF features 503 in prod                                                        | Documented; needs infra sign-off       |
| F-P2-2 | MEDIUM   | P2     | Mock web-search data unlabeled inside company insights                                                            | **FIXED** (`axis_sources`)             |
| F-P3-3 | MEDIUM   | P3     | `/mcp/call` proxy missing planned rate limit                                                                      | **FIXED** (10/min)                     |
| F-P1-2 | MEDIUM   | P1     | AGENTS.md test-count drift (2661 vs real 2724 items)                                                              | **FIXED**                              |
| F-P1-3 | LOW      | P1     | Template dir packaged via source-copy only (wheel-data gap)                                                       | Recommendation recorded                |
| F-P1-4 | LOW      | P1     | Pre-existing `/resumes/{id}/generate` has no workspace check                                                      | Ticket recommended (legacy surface)    |
| F-P2-3 | LOW-MED  | P2     | DNS-rebinding TOCTOU (resolve→connect second lookup)                                                              | Accepted risk, documented              |
| F-P2-4 | LOW      | P2     | In-process quota (per-worker, resets)                                                                             | Accepted, matches repo patterns        |
| F-P3-4 | LOW      | P3     | Bridge handlers capture sync-time tenant_id                                                                       | Safe direction; documented             |
| F-P3-5 | LOW      | P3     | Per-worker warm-up/cache in multi-worker deploy                                                                   | Documented                             |

## Verification highlights (things that could have been wrong but weren't)

- MCP `streamable_http_client` tuple unpacking — verified against installed SDK
  source (`TransportStreams = tuple[ReadStream, WriteStream]`).
- Template XSS escaping across all 5 templates — live injection probe.
- Page-fit loop — live chromium render, 9-entry resume compressed to ≤2 pages.
- Integer-encoded IP SSRF (`https://2130706433`) — caught post-DNS-resolution.
- camelCase frontend fix isolation — only 2 files consume `ResumeResponse`.
- Dependency lockfile completeness for CI (mcp/jinja2/playwright pinned).

## Process incidents during audit (transparency)

1. PowerShell `Set-Content -Encoding UTF8` wrote a BOM into a test file,
   breaking collection — root-caused and stripped; avoid PS5 UTF8 writes.
2. An edit duplicated an `else:` block in `mcp_client_service.py` — caught
   immediately by collection error, removed.
3. First XSS probe was a false positive (assertion counted escaped-entity text
   as raw) — corrected the probe, not the code.

## Final state

- Targeted suites after fixes: 80 passed (browser/MCP/openapi).
- Full backend regression after fixes: **2725 passed / 0 failed / 4 skipped / 2
  xfailed** (21m43s).
- ruff clean on all audit-touched files.

## Environment incidents ruled out as code (transparency)

Two full-suite attempts died mid-run with no test failure and EXIT=-1. Root
cause was environmental, not the audit changes:

1. An orphaned pytest runner from an earlier interrupted command was still
   executing, competing for CPU/RAM (killed by PID after cmdline check).
2. The `uv run` launcher shim itself threw `OSError [Errno 22]` once (flaky);
   invoking `.venv/Scripts/python.exe -m pytest` directly is deterministic — use
   that if `uv run` misbehaves again.

## Recommended follow-ups (not done here, owner decisions)

1. Infra: add chromium + OS libs to `apps/api/Dockerfile` (unlocks PDF in prod).
2. Hardening ticket: workspace check on legacy `POST /resumes/{id}/generate`.
3. One manual MCP smoke vs `@modelcontextprotocol/server-everything`.
4. When rate-limiting moves to Redis, move scrape quota with it.
