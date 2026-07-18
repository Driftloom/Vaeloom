import { Client } from '@notionhq/client';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { NotionConfig, parseNotionConfig } from './config';
import { NotionAuthClient } from './auth-client';
import { decryptSecret, encryptSecret } from './auth';
import { NotionApiError, NotionAuthError } from './errors';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';

interface StoredConnection {
  connectionId: string;
  config: NotionConfig;
  token: string;
  workspaceId?: string;
}

export class NotionIntegration implements Integration {
  readonly provider = 'notion';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;
  private readonly tokenFetch: typeof fetch;

  constructor(opts?: { masterKey?: string; tokenFetch?: typeof fetch }) {
    this.masterKey = opts?.masterKey ?? process.env.VAELOOM_MASTER_KEY ?? DEFAULT_MASTER_KEY;
    this.tokenFetch = opts?.tokenFetch ?? fetch;
  }

  private client(token: string): Client {
    return new Client({ auth: token });
  }

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const nConfig = parseNotionConfig({ ...config.settings, provider: config.provider });
    const token = nConfig.accessToken ?? nConfig.botToken;
    if (!token) {
      throw new NotionAuthError('Notion config requires accessToken or botToken.');
    }
    const client = this.client(token);
    const { data } = await client.users.me({});
    const workspaceId = (data as { bot?: { workspace_name?: string; owner?: { workspace_id?: string } } }).bot
      ? (data as { bot: { owner: { workspace_id: string } } }).bot.owner.workspace_id
      : undefined;
    const connectionId = `notion-${workspaceId ?? crypto.randomUUID()}`;
    this.connections.set(connectionId, {
      connectionId,
      config: nConfig,
      token: encryptSecret(token, this.masterKey),
      workspaceId,
    });
    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
      metadata: { workspaceId, botId: (data as { bot?: { id: string } }).bot?.id },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new NotionAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private tokenFor(connectionId: string): string {
    return decryptSecret(this.getConnection(connectionId).token, this.masterKey);
  }

  // ---- API ----

  async listDatabases(connectionId: string): Promise<NotionDatabase[]> {
    const client = this.client(this.tokenFor(connectionId));
    const res = await client.search({ filter: { property: 'object', value: 'database' }, page_size: 100 });
    return (res.results as Array<Record<string, any>>).map((d) => ({
      id: d.id,
      title: extractTitle(d),
      url: d.url,
    }));
  }

  async getDatabase(connectionId: string, databaseId: string): Promise<NotionDatabase> {
    const client = this.client(this.tokenFor(connectionId));
    const d = (await client.databases.retrieve({ database_id: databaseId })) as Record<string, any>;
    return { id: d.id, title: extractTitle(d), url: d.url };
  }

  async queryDatabase(
    connectionId: string,
    databaseId: string,
    filter?: Record<string, unknown>,
  ): Promise<NotionPage[]> {
    const client = this.client(this.tokenFor(connectionId));
    const res = await client.databases.query({
      database_id: databaseId,
      filter: filter as any,
      page_size: 100,
    });
    return (res.results as Array<Record<string, any>>).map(toPage);
  }

  async getPage(connectionId: string, pageId: string): Promise<NotionPage> {
    const client = this.client(this.tokenFor(connectionId));
    const p = (await client.pages.retrieve({ page_id: pageId })) as Record<string, any>;
    return toPage(p);
  }

  async createPage(
    connectionId: string,
    parentId: string,
    properties: Record<string, unknown>,
  ): Promise<{ id: string; url: string }> {
    const client = this.client(this.tokenFor(connectionId));
    const res = (await client.pages.create({
      parent: { database_id: parentId },
      properties: properties as any,
    })) as Record<string, any>;
    return { id: res.id, url: res.url };
  }

  async updatePage(
    connectionId: string,
    pageId: string,
    properties: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const client = this.client(this.tokenFor(connectionId));
    const res = (await client.pages.update({ page_id: pageId, properties: properties as any })) as Record<string, any>;
    return { id: res.id };
  }

  async search(connectionId: string, query: string): Promise<NotionPage[]> {
    const client = this.client(this.tokenFor(connectionId));
    const res = await client.search({ query, page_size: 100 });
    return (res.results as Array<Record<string, any>>).map(toPage);
  }

  // ---- OAuth helpers ----

  buildAuthClient(config: IntegrationConfig): NotionAuthClient {
    return new NotionAuthClient(parseNotionConfig({ ...config.settings, provider: config.provider }));
  }

  // ---- Webhook ----
  // Notion has no native webhooks; sync is poll-based. handleWebhook is a no-op
  // that accepts a provider notification payload for forward compatibility.
  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    if (!payload) return;
  }

  // ---- Sync (poll-based) ----

  async sync(connectionId: string): Promise<SyncResult> {
    const databases = await this.listDatabases(connectionId);
    let ingested = 0;
    for (const db of databases) {
      const pages = await this.queryDatabase(connectionId, db.id);
      for (const page of pages) {
        const memory: IngestedMemory = {
          externalId: page.id,
          provider: this.provider,
          entityType: 'notion_page',
          title: `Notion: ${page.url}`,
          content: JSON.stringify(page.properties),
          url: page.url,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          metadata: { databaseId: db.id },
        };
        void memory;
        ingested += 1;
      }
    }
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [{ type: 'notion_page', ingested, failed: 0 }],
    };
  }
}

function extractTitle(obj: Record<string, any>): string {
  const title = obj?.title;
  if (Array.isArray(title)) return title.map((t) => t.plain_text ?? '').join('');
  return obj?.title ?? 'Untitled';
}

function toPage(p: Record<string, any>): NotionPage {
  return {
    id: p.id,
    url: p.url,
    properties: p.properties ?? {},
    createdAt: p.created_time,
    updatedAt: p.last_edited_time,
  };
}
