# 24. Connectors & Integrations UX

## 1. Connector Lifecycle & States

Every integration (Google Drive, Notion, Slack, GitHub, MCP servers) exposes
explicit operational states:

- `disconnected`: Not authenticated or configured.
- `connecting`: OAuth flow or credentials handshake in progress.
- `connected`: Healthy, credentials valid, syncing actively.
- `syncing`: Ingestion job currently running with progress indicator.
- `error`: Expired credentials, rate limit exceeded, or network timeout.
- `paused`: Sync suspended by user or quota limit.

## 2. Connector Card & Detail View

- Standard card displaying service brand icon, connection status dot, last sync
  timestamp, and total entities indexed.
- Detail view allowing granular sync scope configuration (e.g. select specific
  Google Drive folders or Slack channels), webhook status, and credential
  rotation.
