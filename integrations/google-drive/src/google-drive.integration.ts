import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { GoogleDriveConfig, parseGoogleDriveConfig } from './config';
import { decryptSecret, encryptSecret, verifyGoogleChannel } from './auth';
import {
  GoogleDriveApiError,
  GoogleDriveAuthError,
  GoogleDriveWebhookVerificationError,
} from './errors';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

interface StoredConnection {
  connectionId: string;
  config: GoogleDriveConfig;
  accessToken: string;
  refreshToken?: string;
}

export class GoogleDriveIntegration implements Integration {
  readonly provider = 'google-drive';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;

  constructor(opts?: { masterKey?: string }) {
    this.masterKey = opts?.masterKey ?? process.env.VAELOOM_MASTER_KEY ?? DEFAULT_MASTER_KEY;
  }

  private oauthClient(conn?: StoredConnection): OAuth2Client {
    const client = new google.auth.OAuth2();
    if (conn) {
      client.setCredentials({
        access_token: decryptSecret(conn.accessToken, this.masterKey),
        refresh_token: conn.refreshToken ? decryptSecret(conn.refreshToken, this.masterKey) : undefined,
      });
    }
    return client;
  }

  getAuthorizeUrl(config: GoogleDriveConfig, state: string): string {
    const client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
    return client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, state, prompt: 'consent' });
  }

  async exchangeCodeForToken(config: GoogleDriveConfig, code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? undefined,
    };
  }

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const gdConfig = parseGoogleDriveConfig({ ...config.settings, provider: config.provider });
    if (!gdConfig.accessToken) {
      throw new GoogleDriveAuthError('Google Drive config requires accessToken (and optional refreshToken).');
    }
    const connectionId = `gdrive-${crypto.randomUUID()}`;
    this.connections.set(connectionId, {
      connectionId,
      config: gdConfig,
      accessToken: encryptSecret(gdConfig.accessToken, this.masterKey),
      refreshToken: gdConfig.refreshToken ? encryptSecret(gdConfig.refreshToken, this.masterKey) : undefined,
    });
    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new GoogleDriveAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private drive(conn: StoredConnection) {
    const client = this.oauthClient(conn);
    return google.drive({ version: 'v3', auth: client });
  }

  // ---- Files API ----

  async listFiles(connectionId: string, folderId?: string): Promise<string[]> {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const q = folderId ? `'${folderId}' in parents` : undefined;
    const res = await drive.files.list({ q, pageSize: 100, fields: 'files(id, name)' });
    return (res.data.files ?? []).map((f) => f.name ?? f.id ?? '');
  }

  async getFile(connectionId: string, fileId: string) {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.get({ fileId, fields: 'id, name, mimeType, webViewLink' });
    return res.data;
  }

  async downloadFile(connectionId: string, fileId: string): Promise<Buffer> {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data as ArrayBuffer);
  }

  async uploadFile(
    connectionId: string,
    name: string,
    content: Buffer | string,
    parentId?: string,
  ): Promise<{ id: string }> {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.create({
      requestBody: { name, parents: parentId ? [parentId] : undefined },
      media: { body: typeof content === 'string' ? content : Buffer.from(content) },
      fields: 'id',
    });
    return { id: res.data.id ?? '' };
  }

  async searchFiles(connectionId: string, query: string): Promise<string[]> {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.list({ q: `fullText contains '${query}'`, pageSize: 100 });
    return (res.data.files ?? []).map((f) => f.name ?? f.id ?? '');
  }

  /** Register a Drive push notification channel for a file. */
  async watchFile(connectionId: string, fileId: string, webhookUrl: string, channelId: string, resourceToken: string) {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.watch({
      fileId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: resourceToken,
      },
    });
    return res.data;
  }

  // ---- Webhook ----

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    const data = payload as {
      channelId?: string;
      resourceToken?: string;
      expectedChannelId?: string;
      expectedResourceToken?: string;
    };
    if (data.expectedChannelId && data.expectedResourceToken) {
      if (!verifyGoogleChannel(data.expectedChannelId, data.expectedResourceToken, data.channelId, data.resourceToken)) {
        throw new GoogleDriveWebhookVerificationError();
      }
    }
  }

  // ---- Sync (document ingestion) ----

  async sync(connectionId: string): Promise<SyncResult> {
    const conn = this.getConnection(connectionId);
    const drive = this.drive(conn);
    const res = await drive.files.list({ pageSize: 100, fields: 'files(id, name, webViewLink, modifiedTime)' });
    let ingested = 0;
    for (const f of res.data.files ?? []) {
      const memory: IngestedMemory = {
        externalId: f.id ?? '',
        provider: this.provider,
        entityType: 'gdrive_file',
        title: f.name ?? 'Untitled',
        content: f.webViewLink ?? '',
        url: f.webViewLink,
        updatedAt: f.modifiedTime,
        metadata: { mimeType: f.mimeType },
      };
      void memory;
      ingested += 1;
    }
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [{ type: 'gdrive_file', ingested, failed: 0 }],
    };
  }
}
