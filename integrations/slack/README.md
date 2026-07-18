# @vaeloom/integration-slack

Slack integration for Vaeloom. Provides messaging, channel listing, OAuth2
authentication, signed-webhook verification and memory synchronization.

## Install

```bash
pnpm add @vaeloom/integration-slack
```

## Setup

1. Create a Slack app at <https://api.slack.com/apps>.
2. Add the `bot token` scopes: `channels:read`, `channels:history`,
   `chat:write`, `users:read`, `im:write`.
3. Set the **Signing Secret** and **Client ID/Secret** from the app dashboard.

## Usage

```ts
import { SlackIntegration, parseSlackConfig } from '@vaeloom/integration-slack';

const slack = new SlackIntegration({ masterKey: process.env.VAELOOM_MASTER_KEY! });

const config = parseSlackConfig({
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  redirectUri: 'https://app.vaeloom.com/integrations/slack/callback',
  botToken: process.env.SLACK_BOT_TOKEN!,
});

const connection = await slack.connect({ provider: 'slack', settings: config });

// Messaging
await slack.sendMessage(connection.connectionId, '#general', 'Hello from Vaeloom');
await slack.sendDirectMessage(connection.connectionId, 'U123', 'Hi there');
await slack.postEphemeral(connection.connectionId, 'C123', 'U123', 'Only you see this');

// Channels
const channels = await slack.listChannels(connection.connectionId);
const history = await slack.getChannelHistory(connection.connectionId, 'C123', 50);

// OAuth flow
const authClient = slack.buildAuthClient({ provider: 'slack', settings: config });
const authorizeUrl = authClient.getAuthorizeUrl('state-xyz');
// ... redirect user, then on callback:
const token = await authClient.exchangeCodeForToken(code);

// Webhook (verify signature before calling)
await slack.handleWebhook({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  signature: req.headers['x-slack-signature'],
  timestamp: req.headers['x-slack-request-timestamp'],
  rawBody: rawBodyString,
  body: parsedBody,
});

// Sync into Vaeloom memories
const syncResult = await slack.sync(connection.connectionId);
```

## Security

OAuth tokens are encrypted at rest with AES-256-GCM using
`VAELOOM_MASTER_KEY`. Webhook requests are verified against the Slack
signing secret with a constant-time comparison and a 5-minute replay window.
