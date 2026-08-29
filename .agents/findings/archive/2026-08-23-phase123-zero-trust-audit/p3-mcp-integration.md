# P3 Audit — Native MCP Integration (SDK, transports, bridging, gating)

Date: 2026-08-23 · Zero-trust re-verification against the installed SDK source
(not docs/memory).

## What was re-verified (fresh)

| Claim                                                                  | Method                                                                                                                                          | Result        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `streamable_http_client` yields a 2-tuple (`streams[0]/[1]` unpack OK) | read `mcp/client/_transport.py`: `TransportStreams = tuple[ReadStream, WriteStream]`                                                            | PASS          |
| `ClientSession` / `stdio_client` signatures match usage                | `inspect.signature` against installed mcp 2.0.0                                                                                                 | PASS          |
| Deps locked for reproducible CI                                        | `uv.lock`: mcp 2.0.0 (+mcp-types), jinja2 3.1.6, playwright 1.62 present with specifier entries                                                 | PASS          |
| Config validation fail-closed                                          | shell interpreters (bash/sh/cmd/powershell/pwsh) denied; metachars denied; http:// needs explicit `allow_insecure`; bad args/env types rejected | PASS          |
| env encrypted at rest per key                                          | integration test asserts ciphertext ≠ plaintext in DB row                                                                                       | PASS          |
| Update path revalidates ALL connector types                            | new unit test (rest-without-url → 400) — this closed a pre-existing create-only gap                                                             | PASS          |
| Workspace ownership enforced at call time                              | `_execute_bridged` mismatch → error result (unit-tested)                                                                                        | PASS          |
| Non-readOnly MCP tools approval-gated                                  | `approval_gated_tools()` includes dynamic names; readOnly excluded (unit + integration)                                                         | PASS          |
| Scope enforcement applies to dynamic tools                             | `execute_tool` with wrong scope → PermissionDeniedError (unit)                                                                                  | PASS          |
| Discovery cache TTL 300s honored; refresh bypasses                     | counting test: second call hits cache (0 transport runs)                                                                                        | PASS          |
| Startup warm-up non-fatal                                              | fire-and-forget task, per-connector try/except, cancelled on shutdown                                                                           | code-reviewed |

## Findings

### F-P3-1 [HIGH] Stdio servers received the FULL parent environment — FIXED

Original code merged `dict(os.environ)` into server env → third-party MCP server
subprocesses could read `ENCRYPTION_KEY`, JWT secrets, DB URLs. **Fixed:**
minimal allowlist (`PATH`, `SYSTEMROOT`, `TEMP`, `USERPROFILE`, … 17 vars)
merged with user-configured `env`. Regression test proves planted secrets are
absent and config vars present.

### F-P3-2 [HIGH] Windows stdio transport was silently broken — FIXED

`CreateProcess` won't execute `.cmd/.bat` directly; bare `npx`/`uvx` resolve to
`npx.cmd` on Windows → every seed-config example would have failed with
FileNotFoundError on dev machines. **Fixed:** `_resolve_command()` (PATH
resolution via `shutil.which`) + `_stdio_argv()` wraps `.cmd/.bat` targets as
`cmd.exe /c <resolved> <args>` (argv stays metachar-validated). Regression tests
included.

### F-P3-3 [MEDIUM] `/connectors/{id}/mcp/call` shipped without rate limit — FIXED

Plan called for a rate-limited proxy; the decorator was dropped during an edit
cleanup. Added `@rate_limit(10/min)`.

### F-P3-4 [LOW] Bridge tenant capture

Handlers close over the `tenant_id` used at sync time; cross-tenant calls fail
with connector-not-found (safe direction, but surprising). Acceptable;
documented here rather than threading tenant through the executor.

### F-P3-5 [LOW] Per-worker bridges

Uvicorn multi-worker ⇒ each worker re-runs warm-up and holds its own cache (N×
discovery on boot). Consistent with repo's in-process patterns; revisit with
shared state if MCP fleets grow.

### F-P3-6 [INFO] HTTP transports untested against a live server

All service tests mock `_run_with_session`. Tuple-unpacking and session API were
verified against SDK source/signatures, but no real MCP server is exercised
end-to-end in this environment (no npx/network guarantee). Recommend one manual
smoke against `npx -y @modelcontextprotocol/server-everything` before production
enable.

## Non-issues verified

- `validate_mcp_config` base-name check lowercases + strips path seps
  (`../../bin/bash`, `/BIN/sh` all denied).
- BOM corruption incident (this audit's own tooling): PowerShell
  `Set-Content -Encoding UTF8` wrote a U+FEFF BOM breaking pytest collection —
  stripped; noted so future edits use BOM-less writes.
