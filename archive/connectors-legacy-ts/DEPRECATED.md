# DEPRECATED — legacy TS connectors archived per ADR-036/037, moved here per ADR-048

The root `connectors/` TS tree (`rest`, `graphql`, `mcp`) is orphaned: a 2026-10
pre-flight sweep found zero imports of `@vaeloom/connector-{rest,graphql,mcp}`
across `apps/`, `packages/`, `sdk/`, `plugins/`, `scripts/`, `testing/`,
`infra/` and CI workflows.

- Native Python MCP client: `apps/api/src/api/services/mcp_client_service.py`
  (ADR-036). Full TS tree: `archive/connectors-mcp-ts/mcp/`.
- REST/GraphQL sources of truth live in the Python connectors surface
  (`apps/api/src/api/integrations/` + provider framework, ADR-037). Full TS
  trees: `archive/connectors-legacy-ts/rest/` and `.../graphql/` (this dir).

Do not import or extend these packages; do not re-add them to
`pnpm-workspace.yaml` without a new ADR. Restore from git history if needed.
