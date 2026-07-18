# @vaeloom/integration-calendar

Calendar integration for Vaeloom. Supports both **Google Calendar** and
**Outlook** (Microsoft Graph). Lists, creates, updates, and deletes events,
registers push-notification channels, and syncs events into Vaeloom memories.

## Install

```bash
pnpm add @vaeloom/integration-calendar
```

## Setup

- **Google**: OAuth credentials with the `calendar` scope and offline access.
- **Outlook**: Azure AD app with `Calendars.ReadWrite` delegated permission.

The config is a discriminated union on `backend`.

## Usage

```ts
import { CalendarIntegration, parseCalendarConfig } from '@vaeloom/integration-calendar';

const calendar = new CalendarIntegration({ masterKey: process.env.VAELOOM_MASTER_KEY! });

const config = parseCalendarConfig({
  backend: 'google',
  clientId: process.env.CAL_CLIENT_ID!,
  clientSecret: process.env.CAL_CLIENT_SECRET!,
  redirectUri: 'https://app.vaeloom.com/integrations/calendar/callback',
  accessToken: process.env.CAL_ACCESS_TOKEN!,
  refreshToken: process.env.CAL_REFRESH_TOKEN!,
});

const url = calendar.getAuthorizeUrl(config, 'state');
const tokens = await calendar.exchangeCodeForToken(config, code);

const connection = await calendar.connect({ provider: 'calendar', settings: config });

const events = await calendar.listEvents(connection.connectionId, 'primary', '2024-01-01T00:00:00Z');
const created = await calendar.createEvent(connection.connectionId, 'primary', {
  summary: 'Sync with Vaeloom',
  start: '2024-02-01T10:00:00Z',
  end: '2024-02-01T11:00:00Z',
});
await calendar.updateEvent(connection.connectionId, 'primary', created.id, { summary: 'Sync (updated)', start: '2024-02-01T10:00:00Z', end: '2024-02-01T11:00:00Z' });
await calendar.deleteEvent(connection.connectionId, 'primary', created.id);

// Watch
await calendar.watchCalendar(connection.connectionId, 'primary', 'https://app.vaeloom.com/webhooks/calendar', 'chan-1', 'tok-1');

// Verify webhook
await calendar.handleWebhook({
  channelId: 'chan-1', resourceToken: 'tok-1',
  expectedChannelId: 'chan-1', expectedResourceToken: 'tok-1',
});

// Sync
const result = await calendar.sync(connection.connectionId);
```

## Security

OAuth tokens are encrypted at rest with AES-256-GCM and refreshed by the
underlying auth libraries. Push notifications are verified by matching the
registered `channelId`/`subscriptionId` and `resourceToken`/`clientState` with
a constant-time comparison.
