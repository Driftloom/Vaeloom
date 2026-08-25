# 41 — [P2] MCP stdio command denylist misses cmd.exe-active metacharacters

**Date:** 2026-08-23 · **Severity: P2** · **Status: OPEN**

## Evidence

`apps/api/src/api/services/mcp_client_service.py:41`:

```python
_SHELL_METACHARS = r"[;&|`$><\n\r]"
```

`.cmd`/`.bat` commands are wrapped into `cmd.exe` execution by the stdio
resolver (`_resolve_command`/`_stdio_argv`, `mcp_client_service.py:129-157`).
cmd.exe additionally expands:

- `%VAR%` — environment-variable expansion (information disclosure vector, e.g.
  `%PATH%`, custom secrets)
- `!VAR!` — delayed expansion where enabled
- `^` — escape character, can reassemble forbidden sequences after the denylist
  check

Shell interpreters themselves ARE denied (basename match at create/update
`:77-79` and re-validated per session open `_validate_command:160-163`) — so
this is hardening of the residual batch-wrapper path, not full shell escape.

## Fix direction

Add `^%!` to the class for cmd-wrapped targets, or better: allowlist argv[0] to
`.exe` binaries only (drop the `.cmd/.bat` wrapper path entirely) and pass args
via `subprocess` list form without any shell.
