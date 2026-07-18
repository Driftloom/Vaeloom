import { google } from 'googleapis';
import { Client as GraphClient } from '@microsoft/microsoft-graph-client';
import type {
  ConnectionResult,
  IngestedMemory,
  Integration,
  IntegrationConfig,
  SyncResult,
} from './types';
import { CalendarConfig, parseCalendarConfig } from './config';
import { decryptSecret, encryptSecret, verifyCalendarChannel } from './auth';
import {
  CalendarApiError,
  CalendarAuthError,
  CalendarWebhookVerificationError,
} from './errors';
import type { CalendarEvent, CalendarWebhookPayload, NewCalendarEvent } from './calendar.types';

const DEFAULT_MASTER_KEY = 'vaeloom-dev-secret';
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar'];
const OUTLOOK_SCOPES = ['Calendars.ReadWrite'];

interface StoredConnection {
  connectionId: string;
  config: CalendarConfig;
  accessToken: string;
  refreshToken?: string;
}

export class CalendarIntegration implements Integration {
  readonly provider = 'calendar';

  private readonly connections = new Map<string, StoredConnection>();
  private readonly masterKey: string;

  constructor(opts?: { masterKey?: string }) {
    this.masterKey = opts?.masterKey ?? process.env.VAELOOM_MASTER_KEY ?? DEFAULT_MASTER_KEY;
  }

  // ---- OAuth helpers ----

  getAuthorizeUrl(config: CalendarConfig, state: string): string {
    if (config.backend === 'google') {
      const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
      return client.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_SCOPES, state, prompt: 'consent' });
    }
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      scope: OUTLOOK_SCOPES.join(' '),
      state,
      response_mode: 'query',
    });
    return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(
    config: CalendarConfig,
    code: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    if (config.backend === 'google') {
      const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
      const { tokens } = await client.getToken(code);
      return { accessToken: tokens.access_token ?? '', refreshToken: tokens.refresh_token ?? undefined };
    }
    const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        scope: OUTLOOK_SCOPES.join(' '),
      }).toString(),
    });
    if (!res.ok) throw new CalendarAuthError(`Outlook token exchange failed: ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    return { accessToken: String(data['access_token']), refreshToken: data['refresh_token'] ? String(data['refresh_token']) : undefined };
  }

  // ---- Connection ----

  async connect(config: IntegrationConfig): Promise<ConnectionResult> {
    const calConfig = parseCalendarConfig({ ...config.settings, provider: config.provider });
    if (!calConfig.accessToken) {
      throw new CalendarAuthError(`${calConfig.backend} calendar config requires accessToken.`);
    }
    const connectionId = `calendar-${calConfig.backend}-${crypto.randomUUID()}`;
    this.connections.set(connectionId, {
      connectionId,
      config: calConfig,
      accessToken: encryptSecret(calConfig.accessToken, this.masterKey),
      refreshToken: calConfig.refreshToken ? encryptSecret(calConfig.refreshToken, this.masterKey) : undefined,
    });
    return {
      connectionId,
      provider: this.provider,
      connectedAt: new Date().toISOString(),
      ready: true,
      metadata: { backend: calConfig.backend },
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  private getConnection(connectionId: string): StoredConnection {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new CalendarAuthError(`Unknown connection: ${connectionId}`);
    return conn;
  }

  private accessToken(conn: StoredConnection): string {
    return decryptSecret(conn.accessToken, this.masterKey);
  }

  /** Internal Google calendar client bound to a stored connection. */
  private googleCalendar(conn: StoredConnection) {
    const client = new google.auth.OAuth2(conn.config.backend === 'google' ? conn.config.clientId : '', conn.config.backend === 'google' ? conn.config.clientSecret : '', conn.config.backend === 'google' ? conn.config.redirectUri : '');
    client.setCredentials({ access_token: this.accessToken(conn) });
    return google.calendar({ version: 'v3', auth: client });
  }

  /** Internal Outlook Graph client bound to a stored connection. */
  private graphClient(conn: StoredConnection): GraphClient {
    const token = this.accessToken(conn);
    const authProvider = {
      getAccessToken: async () => token,
    } as unknown as ConstructorParameters<typeof GraphClient.initWithMiddleware>[0]['authProvider'];
    return GraphClient.initWithMiddleware({ authProvider });
  }

  // ---- Events API ----

  async listEvents(
    connectionId: string,
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
  ): Promise<CalendarEvent[]> {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      const res = await cal.events.list({ calendarId, timeMin, timeMax, maxResults: 100, singleEvents: true, orderBy: 'startTime' });
      return (res.data.items ?? []).map(toGoogleEvent);
    }
    const graph = this.graphClient(conn);
    const res = await graph.api(`/me/calendars/${calendarId}/events`).get();
    return (res.value ?? []).map(toOutlookEvent);
  }

  async getEvent(connectionId: string, calendarId: string, eventId: string): Promise<CalendarEvent> {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      const res = await cal.events.get({ calendarId, eventId });
      return toGoogleEvent(res.data);
    }
    const graph = this.graphClient(conn);
    const res = await graph.api(`/me/calendars/${calendarId}/events/${eventId}`).get();
    return toOutlookEvent(res);
  }

  async createEvent(connectionId: string, calendarId: string, event: NewCalendarEvent): Promise<{ id: string }> {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      const res = await cal.events.insert({ calendarId, requestBody: fromGoogleEvent(event) });
      return { id: res.data.id ?? '' };
    }
    const graph = this.graphClient(conn);
    const res = await graph.api(`/me/calendars/${calendarId}/events`).post(fromOutlookEvent(event));
    return { id: res.id };
  }

  async updateEvent(connectionId: string, calendarId: string, eventId: string, event: NewCalendarEvent): Promise<{ id: string }> {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      const res = await cal.events.update({ calendarId, eventId, requestBody: fromGoogleEvent(event) });
      return { id: res.data.id ?? '' };
    }
    const graph = this.graphClient(conn);
    const res = await graph.api(`/me/calendars/${calendarId}/events/${eventId}`).patch(fromOutlookEvent(event));
    return { id: res.id };
  }

  async deleteEvent(connectionId: string, calendarId: string, eventId: string): Promise<void> {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      await cal.events.delete({ calendarId, eventId });
      return;
    }
    const graph = this.graphClient(conn);
    await graph.api(`/me/calendars/${calendarId}/events/${eventId}`).delete();
  }

  /** Register a push notification channel (Google watch / Outlook subscription). */
  async watchCalendar(
    connectionId: string,
    calendarId: string,
    webhookUrl: string,
    channelId: string,
    resourceToken: string,
  ) {
    const conn = this.getConnection(connectionId);
    if (conn.config.backend === 'google') {
      const cal = this.googleCalendar(conn);
      const res = await cal.events.watch({
        calendarId,
        requestBody: { id: channelId, type: 'web_hook', address: webhookUrl, token: resourceToken },
      });
      return res.data;
    }
    const graph = this.graphClient(conn);
    const res = await graph.api('/subscriptions').post({
      resource: `me/calendars/${calendarId}/events`,
      changeType: 'created,updated,deleted',
      notificationUrl: webhookUrl,
      expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      clientState: resourceToken,
    });
    return res;
  }

  // ---- Webhook ----

  async handleWebhook(payload: unknown, _headers?: Record<string, string>): Promise<unknown> {
    const data = payload as CalendarWebhookPayload;
    if (data.expectedChannelId && data.expectedResourceToken) {
      if (!verifyCalendarChannel(data.expectedChannelId, data.expectedResourceToken, data.channelId, data.resourceToken)) {
        throw new CalendarWebhookVerificationError();
      }
    }
    // Outlook sends a validationToken during subscription creation; the caller
    // should respond with it directly. Resource change notifications arrive as
    // `value[]` with subscriptionId.
  }

  // ---- Sync ----

  async sync(connectionId: string, calendarId = 'primary'): Promise<SyncResult> {
    const now = new Date().toISOString();
    const events = await this.listEvents(connectionId, calendarId, now);
    let ingested = 0;
    for (const ev of events) {
      const memory: IngestedMemory = {
        externalId: ev.id,
        provider: this.provider,
        entityType: 'calendar_event',
        title: ev.summary,
        content: ev.description ?? '',
        url: ev.htmlLink,
        createdAt: ev.start,
        updatedAt: ev.end,
        metadata: { location: ev.location, status: ev.status },
      };
      void memory;
      ingested += 1;
    }
    return {
      connectionId,
      syncedAt: new Date().toISOString(),
      recordsIngested: ingested,
      recordsFailed: 0,
      entities: [{ type: 'calendar_event', ingested, failed: 0 }],
    };
  }
}

function toGoogleEvent(e: Record<string, any>): CalendarEvent {
  return {
    id: e.id,
    summary: e.summary ?? '(no title)',
    description: e.description,
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    location: e.location,
    htmlLink: e.htmlLink,
    status: e.status,
  };
}

function fromGoogleEvent(ev: NewCalendarEvent) {
  return {
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: { dateTime: ev.start },
    end: { dateTime: ev.end },
  };
}

function toOutlookEvent(e: Record<string, any>): CalendarEvent {
  return {
    id: e.id,
    summary: e.subject ?? '(no title)',
    description: e.bodyPreview ?? e.body?.content,
    start: e.start?.dateTime ?? '',
    end: e.end?.dateTime ?? '',
    location: e.location?.displayName,
    htmlLink: e.webLink,
    status: e.showAs,
  };
}

function fromOutlookEvent(ev: NewCalendarEvent) {
  return {
    subject: ev.summary,
    body: { contentType: 'text', content: ev.description ?? '' },
    location: { displayName: ev.location ?? '' },
    start: { dateTime: ev.start, timeZone: 'UTC' },
    end: { dateTime: ev.end, timeZone: 'UTC' },
  };
}
