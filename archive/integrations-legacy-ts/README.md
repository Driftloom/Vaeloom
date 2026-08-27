# Archived — Legacy TS Integrations

**Archived:** 2026-08-27 per ADR-037

These six TypeScript packages (`calendar`, `email`, `github`, `google-drive`,
`notion`, `slack`) were fully implemented (~380 lines each, OAuth + CRUD +
webhooks) but **never imported anywhere** (zero references outside the packages
themselves). They used in-memory `Map` storage and `sync()` was a no-op
(`void memory;`).

**Superseded by:**

- Native Python core: `apps/api/src/api/clients/{gmail,calendar,drive}.py` +
  `tools/executor.py`
- Microsoft Graph clients (`graph_mail`, `graph_calendar`, `onedrive`)
- Pluggable provider framework (`apps/api/src/api/integrations/registry.py`) —
  ADR-037
- Custom MCP bridging (`services/mcp_client_service.py`) — ADR-036

**Restore:** `git log --follow` or copy back from this archive. Do NOT re-add to
`pnpm-workspace.yaml` without a new ADR.
