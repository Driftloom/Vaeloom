# ADR-010: MCP Protocol for Integrations

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom connects to external services (Gmail, Google Calendar, Google Drive, GitHub, Notion, Slack) and exposes internal tools to agents. Each integration requires authentication (OAuth), scoped permissions, data sync, and error handling. The integration interface must be extensible for third-party developers and consistent across all connector types.

Options considered: MCP (Model Context Protocol), custom REST integration pattern, OpenAPI-based codegen, Hasura, Airbyte.

## Decision

Use **MCP (Model Context Protocol)** as the standard interface for external integrations.

Adoption pattern:
- Each integration is an MCP server or MCP-compatible tool definition
- Internal tools are exposed as MCP tool schemas to the orchestrator
- Plugin SDK follows MCP-shaped tool definitions
- Connector router (`routers/connectors.py`) provides CRUD + sync + test endpoints for MCP connectors
- Authentication flows (OAuth) are handled at the integration layer, with credentials stored in SecretManager

## Consequences

**Positive:**
- Standardized tool schema across all integrations — agents consume a uniform tool interface regardless of the underlying service
- MCP tool definitions double as LLM function calling schemas — no translation layer needed
- New connectors can be added by implementing an MCP server without modifying the orchestrator
- Plugin SDK inherits MCP compliance for free — third-party plugins use the same protocol
- Connector lifecycle (create, update, sync, test, delete) is uniform across all 6+ integration types

**Negative:**
- MCP is a relatively new protocol (2025) — ecosystem tooling and community examples are still maturing
- OAuth token refresh must be managed at the integration layer rather than delegated to a dedicated auth proxy
- Streaming sync (real-time push from services like Slack) requires WebSocket bridge on top of MCP's request-response pattern
- Each MCP server instance requires its own lifecycle management (start/stop, health checks)
