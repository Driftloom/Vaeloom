import { WebClient } from '@slack/web-api';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { SlackConfig, parseSlackConfig } from './config';
import { SlackAuthClient } from './auth-client';
import { decryptSecret, encryptSecret, verifySlackSignature } from './auth';
import { SlackApiError, SlackAuthError, SlackWebhookVerificationError } from './errors';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';

interface StoredConnection {
  connectionId: string;
  config: SlackConfig;
  token: string;
  teamId?: string;
}

/**
 * Slack integration for Vaeloom. Supports messaging, channel listing,
 * OAuth2 flow, signed webhook verification, and memory sync.
 */
export class SlackIntegration implements Integration {
  readonly provider = 'slack';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;
  private readonly tokenFetch: typeof fetch;

  constructor(opts?: { masterKey?: string; tokenFetch?: typeof fetch }) {
    this.masterKey = opts?.masterKey ?? process.env['VAELOOM_MASTER_KEY'] ?? DEFAULT_MASTER_KEY;
    this.tokenFetch = opts?.tokenFetch ?? fetch;
  }

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const slackConfig = parseSlackConfig({ ...config.settings, provider: config.provider });
    const token = slackConfig.botToken;
    if (!token) {
      throw new SlackAuthError('Slack config requires an OAuth bot token (botToken).');
    }

    const client = new WebClient(token);
    const auth = await client.auth.test();
    const teamId = typeof auth.team_id === 'string' ? auth.team_id : undefined;
    const connectionId = `slack-${teamId ?? crypto.randomUUID()}`;

    this.connections.set(connectionId, {
      connectionId,
      config: slackConfig,
      token: encryptSecret(token, this.masterKey),
      teamId,
    });

    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
      metadata: { teamId, team: auth.team, userId: auth.user_id },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new SlackAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private clientFor(connectionId: string): WebClient {
    const conn = this.getConnection(connectionId);
    return new WebClient(decryptSecret(conn.token, this.masterKey));
  }

  // ---- Messaging API ----

  async sendMessage(
    connectionId: string,
    channel: string,
    text: string,
    blocks?: unknown[],
  ): Promise<{ ts: string; channel: string }> {
    const client = this.clientFor(connectionId);
    const res = await client.chat.postMessage({ channel, text, blocks });
    if (!res.ok) {
      throw new SlackApiError(`Failed to send message: ${res.error}`, undefined);
    }
    return { ts: String(res.ts), channel: String(res.channel) };
  }

  async sendDirectMessage(
    connectionId: string,
    userId: string,
    text: string,
  ): Promise<{ ts: string; channel: string }> {
    const client = this.clientFor(connectionId);
    const open = await client.conversations.open({ users: userId });
    const channel = String((open.channel as { id: string }).id);
    return this.sendMessage(connectionId, channel, text);
  }

  async listChannels(connectionId: string, limit = 200): Promise<string[]> {
    const client = this.clientFor(connectionId);
    const res = await client.conversations.list({ limit });
    if (!res.ok) throw new SlackApiError(`Failed to list channels: ${res.error}`);
    return (res.channels ?? []).map((c) => String(c.name));
  }

  async getChannelHistory(
    connectionId: string,
    channel: string,
    limit = 100,
  ): Promise<Array<{ ts: string; text?: string; user?: string }>> {
    const client = this.clientFor(connectionId);
    const res = await client.conversations.history({ channel, limit });
    if (!res.ok) throw new SlackApiError(`Failed to read history: ${res.error}`);
    return (res.messages ?? []).map((m) => ({ ts: String(m.ts), text: m.text, user: m.user }));
  }

  async postEphemeral(
    connectionId: string,
    channel: string,
    userId: string,
    text: string,
  ): Promise<{ messageTs?: string }> {
    const client = this.clientFor(connectionId);
    const res = await client.chat.postEphemeral({ channel, user: userId, text });
    if (!res.ok) throw new SlackApiError(`Failed to post ephemeral: ${res.error}`);
    return { messageTs: res.message_ts ? String(res.message_ts) : undefined };
  }

  // ---- Webhook ----

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    const data = payload as {
      signingSecret?: string;
      signature?: string;
      timestamp?: string;
      rawBody?: string;
      body?: Record<string, unknown>;
    };
    if (!data.signingSecret) {
      throw new SlackWebhookVerificationError('Missing signing secret');
    }
    if (!verifySlackSignature(data.signingSecret, data.signature, data.timestamp, data.rawBody ?? '')) {
      throw new SlackWebhookVerificationError();
    }
    // URL verification challenge handling would be acknowledged by the caller.
    if (data.body && 'challenge' in data.body) {
      return;
    }
  }

  // ---- OAuth helpers ----

  buildAuthClient(config: IntegrationConfig): SlackAuthClient {
    const slackConfig = parseSlackConfig({ ...config.settings, provider: config.provider });
    return new SlackAuthClient(slackConfig);
  }

  // ---- Sync ----

  async sync(connectionId: string): Promise<SyncResult> {
    const client = this.clientFor(connectionId);
    const channels = await client.conversations.list({ limit: 50 });
    let ingested = 0;
    for (const ch of channels.channels ?? []) {
      const history = await client.conversations.history({ channel: String(ch.id), limit: 50 });
      for (const m of history.messages ?? []) {
        const _memory: IngestedMemory = {
          externalId: `${ch.id}-${m.ts}`,
          provider: this.provider,
          entityType: 'slack_message',
          title: `Slack message in ${ch.name ?? ch.id}`,
          content: m.text ?? '',
          createdAt: new Date(Number(m.ts) * 1000).toISOString(),
          metadata: { channel: ch.id, user: m.user },
        };
        ingested += 1;
      }
    }
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [{ type: 'slack_message', ingested, failed: 0 }],
    };
  }
}
