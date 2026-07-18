# @vaeloom/integration-google-drive

Google Drive integration for Vaeloom. Lists, downloads, uploads, and searches
files, registers push-notification channels, and ingests files as Vaeloom
memories.

## Install

```bash
pnpm add @vaeloom/integration-google-drive
```

## Setup

1. Create OAuth credentials in the Google Cloud Console with the
   `https://www.googleapis.com/auth/drive.readonly` scope.
2. Use the access token (with offline `refresh_token`) obtained via the OAuth
   flow.

## Usage

```ts
import { GoogleDriveIntegration, parseGoogleDriveConfig } from '@vaeloom/integration-google-drive';

const drive = new GoogleDriveIntegration({ masterKey: process.env.VAELOOM_MASTER_KEY! });

const config = parseGoogleDriveConfig({
  clientId: process.env.GDRIVE_CLIENT_ID!,
  clientSecret: process.env.GDRIVE_CLIENT_SECRET!,
  redirectUri: 'https://app.vaeloom.com/integrations/gdrive/callback',
  accessToken: process.env.GDRIVE_ACCESS_TOKEN!,
  refreshToken: process.env.GDRIVE_REFRESH_TOKEN!,
});

const url = drive.getAuthorizeUrl(config, 'state');
const tokens = await drive.exchangeCodeForToken(config, code);

const connection = await drive.connect({ provider: 'google-drive', settings: config });

const files = await drive.listFiles(connection.connectionId, 'folder-id');
const data = await drive.downloadFile(connection.connectionId, 'file-id');
await drive.uploadFile(connection.connectionId, 'report.pdf', buffer, 'folder-id');
const found = await drive.searchFiles(connection.connectionId, 'budget');

// Push notifications
await drive.watchFile(connection.connectionId, 'file-id', 'https://app.vaeloom.com/webhooks/gdrive', 'chan-1', 'tok-1');

// Verify webhook
await drive.handleWebhook({
  channelId: 'chan-1',
  resourceToken: 'tok-1',
  expectedChannelId: 'chan-1',
  expectedResourceToken: 'tok-1',
});

// Sync
const result = await drive.sync(connection.connectionId);
```

## Security

Access/refresh tokens are encrypted at rest with AES-256-GCM. Push
notifications are verified by matching the registered `channelId` and
`resourceToken` with a constant-time comparison. Tokens are refreshed
automatically by the underlying `google-auth-library` client.
