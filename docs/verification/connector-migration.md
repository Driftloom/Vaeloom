# Connector Consolidation & Migration Audit

## 1. Executive Summary

The repository currently contains **three separate duplicate implementations**
of third-party connectors and integrations across the monorepo:

1. Root `connectors/` (`graphql`, `mcp`, `rest`)
2. Root `integrations/` (`calendar`, `email`, `github`, `google-drive`,
   `notion`, `slack`)
3. Internal `apps/api/src/api/integrations/`

---

## 2. Triplicate Redundancy Mapping

| Connector / Integration          |  Root `connectors/`  |    Root `integrations/`     |     Internal `api/integrations/`     | Target Unified Location            |
| :------------------------------- | :------------------: | :-------------------------: | :----------------------------------: | :--------------------------------- |
| **Google Drive**                 |          -           | `integrations/google-drive` |   `api/integrations/google_drive`    | `packages/connectors/google-drive` |
| **GitHub**                       |          -           |    `integrations/github`    |      `api/integrations/github`       | `packages/connectors/github`       |
| **Slack**                        |          -           |    `integrations/slack`     |       `api/integrations/slack`       | `packages/connectors/slack`        |
| **Notion**                       |          -           |    `integrations/notion`    |      `api/integrations/notion`       | `packages/connectors/notion`       |
| **Calendar (Google/Outlook)**    |          -           |   `integrations/calendar`   |     `api/integrations/calendar`      | `packages/connectors/calendar`     |
| **Email (Gmail/Outlook)**        |          -           |    `integrations/email`     |       `api/integrations/email`       | `packages/connectors/email`        |
| **Model Context Protocol (MCP)** |   `connectors/mcp`   |              -              | `api/services/mcp_client_service.py` | `packages/connectors/mcp`          |
| **REST Generic**                 |  `connectors/rest`   |              -              |       `api/integrations/rest`        | `packages/connectors/rest`         |
| **GraphQL Generic**              | `connectors/graphql` |              -              |      `api/integrations/graphql`      | `packages/connectors/graphql`      |

---

## 3. Consolidation Standard (`packages/connectors/`)

1. Merge root `connectors/`, root `integrations/`, and
   `apps/api/src/api/integrations/` into canonical TypeScript/Python packages
   under `packages/connectors/`.
2. Standardize all connectors on:
   - AES-256-GCM encrypted credential storage (`provider_keys`).
   - Standardized `health_check()` and `ping()` probes.
   - Circuit breaker wrapping
     (`apps/api/src/api/infrastructure/circuit_breaker.py`).
   - URL guard SSRF validation on all outbound HTTP calls.
