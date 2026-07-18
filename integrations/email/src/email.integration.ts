import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { Message } from 'imapflow';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { EmailConfig, parseEmailConfig } from './config';
import { decryptSecret, encryptSecret } from './auth';
import { EmailAuthError, EmailTransportError } from './errors';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';

interface StoredConnection {
  connectionId: string;
  config: EmailConfig;
  password: string;
  imap?: ImapFlow;
}

export interface EmailSummary {
  uid: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  text: string;
  snippet: string;
}

export class EmailIntegration implements Integration {
  readonly provider = 'email';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;

  constructor(opts?: { masterKey?: string }) {
    this.masterKey = opts?.masterKey ?? process.env.VAELOOM_MASTER_KEY ?? DEFAULT_MASTER_KEY;
  }

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const emailConfig = parseEmailConfig({ ...config.settings, provider: config.provider });
    const connectionId = `email-${emailConfig.user}`;
    this.connections.set(connectionId, {
      connectionId,
      config: emailConfig,
      password: encryptSecret(emailConfig.password, this.masterKey),
    });
    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
      metadata: { user: emailConfig.user },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId);
    if (conn?.imap && conn.imap.usable) await conn.imap.logout();
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new EmailAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private passwordFor(conn: StoredConnection): string {
    return decryptSecret(conn.password, this.masterKey);
  }

  private newImap(conn: StoredConnection): ImapFlow {
    return new ImapFlow({
      host: conn.config.imapHost,
      port: conn.config.imapPort,
      secure: conn.config.secure,
      auth: { user: conn.config.user, pass: this.passwordFor(conn) },
    });
  }

  // ---- IMAP ----

  async fetchEmails(
    connectionId: string,
    folder = 'INBOX',
    since?: Date,
    limit = 50,
  ): Promise<EmailSummary[]> {
    const conn = this.getConnection(connectionId);
    const client = this.newImap(conn);
    await client.connect();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const query: Record<string, unknown> = { }
        if (since) query.since = since;
        const messages = await client.fetch(query, { uid: true, envelope: true, bodyStructure: true, source: true });
        const results: EmailSummary[] = [];
        for await (const msg of messages) {
          results.push(summarize(msg));
          if (results.length >= limit) break;
        }
        return results;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  async searchEmails(connectionId: string, query: string, folder = 'INBOX', limit = 50): Promise<EmailSummary[]> {
    const conn = this.getConnection(connectionId);
    const client = this.newImap(conn);
    await client.connect();
    try {
      const lock = await client.getMailboxLock(folder);
      try {
        const messages = await client.search({ or: [{ subject: query }, { body: query }] }, { uid: true, envelope: true });
        const results: EmailSummary[] = [];
        for await (const msg of messages) {
          results.push(summarize(msg as Message));
          if (results.length >= limit) break;
        }
        return results;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  /** Watch a mailbox using IMAP IDLE, invoking onMail for each new message. */
  async watchMailbox(
    connectionId: string,
    onMail: (mail: EmailSummary) => void,
    folder = 'INBOX',
  ): Promise<void> {
    const conn = this.getConnection(connectionId);
    const client = this.newImap(conn);
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    client.on('exists', async () => {
      const messages = await client.fetch({ seen: false }, { uid: true, envelope: true, source: true });
      for await (const msg of messages) onMail(summarize(msg));
    });
    // keep idle alive; caller owns lifecycle
    void lock;
  }

  // ---- SMTP ----

  async sendEmail(
    connectionId: string,
    to: string,
    subject: string,
    body: string,
    from?: string,
  ): Promise<{ messageId: string }> {
    const conn = this.getConnection(connectionId);
    const transporter = nodemailer.createTransport({
      host: conn.config.smtpHost,
      port: conn.config.smtpPort,
      secure: conn.config.secure,
      auth: { user: conn.config.user, pass: this.passwordFor(conn) },
    });
    try {
      const info = await transporter.sendMail({
        from: from ?? conn.config.user,
        to,
        subject,
        text: body,
      });
      return { messageId: info.messageId };
    } catch (err) {
      throw new EmailTransportError('Failed to send email', err);
    }
  }

  // ---- Webhook ----
  // Email is polling-based; no inbound webhook. handleWebhook is a no-op.
  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    if (!payload) return;
  }

  // ---- Sync ----

  async sync(connectionId: string, since?: Date): Promise<SyncResult> {
    const emails = await this.fetchEmails(connectionId, 'INBOX', since, 100);
    let ingested = 0;
    for (const mail of emails) {
      const memory: IngestedMemory = {
        externalId: mail.uid,
        provider: this.provider,
        entityType: 'email',
        title: mail.subject,
        content: mail.text,
        createdAt: mail.date,
        metadata: { from: mail.from, to: mail.to },
      };
      void memory;
      ingested += 1;
    }
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [{ type: 'email', ingested, failed: 0 }],
    };
  }
}

function summarize(msg: Message): EmailSummary {
  const env = msg.envelope ?? {};
  const subject = typeof env.subject === 'string' ? env.subject : '';
  const from = Array.isArray(env.from) && env.from[0] ? env.from[0].address ?? '' : '';
  const to = Array.isArray(env.to) && env.to[0] ? env.to[0].address ?? '' : '';
  const date = env.date ? new Date(env.date).toISOString() : new Date().toISOString();
  const text = typeof msg.body === 'string' ? msg.body : '';
  return {
    uid: String(msg.uid ?? ''),
    subject,
    from,
    to,
    date,
    text,
    snippet: text.slice(0, 200),
  };
}
