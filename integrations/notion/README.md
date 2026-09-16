# @vaeloom/integration-notion

> **DEPRECATED per ADR-037 (2026-08-27):** this TS package is orphaned — do not
> import or extend it. Live integration code is `apps/api/src/api/clients/` with
> tools bridged via MCP (`docs/mcp/servers/seed-configs.md`). See
> `integrations/DEPRECATED.md`.

Notion integration for Vaeloom. Lists and queries databases, reads/writes pages,
and syncs Notion content into Vaeloom memories. Notion has no native webhooks,
so synchronization is poll-based.

## Install

```bash
pnpm add @vaeloom/integration-notion
```

## Setup

1. Create an internal integration at <https://www.notion.com/my-integrations>.
2. Share the target databases/pages with the integration.
3. Use the **Internal Integration Token** as `botToken`, or implement the OAuth
   flow with `clientId`/`clientSecret`.

## Usage

```ts
import {
  NotionIntegration,
  parseNotionConfig,
} from '@vaeloom/integration-notion';

const notion = new NotionIntegration({
  masterKey: process.env.VAELOOM_MASTER_KEY!,
});

const config = parseNotionConfig({
  clientId: process.env.NOTION_CLIENT_ID!,
  clientSecret: process.env.NOTION_CLIENT_SECRET!,
  redirectUri: 'https://app.vaeloom.com/integrations/notion/callback',
  botToken: process.env.NOTION_BOT_TOKEN!,
});

const connection = await notion.connect({
  provider: 'notion',
  settings: config,
});

const databases = await notion.listDatabases(connection.connectionId);
const db = await notion.getDatabase(connection.connectionId, databases[0].id);
const rows = await notion.queryDatabase(connection.connectionId, db.id, {
  property: 'Status',
  select: { equals: 'Done' },
});

const page = await notion.createPage(connection.connectionId, db.id, {
  Name: { title: [{ text: { content: 'New entry' } }] },
});
await notion.updatePage(connection.connectionId, page.id, {
  Status: { select: { name: 'In progress' } },
});

const found = await notion.search(connection.connectionId, 'quarterly');

// Sync
const result = await notion.sync(connection.connectionId);
```

## Security

OAuth/integration tokens are encrypted at rest with AES-256-GCM.
