# @vaeloom/integration-email

Email integration for Vaeloom. Connects via IMAP (read) and SMTP (send),
fetches/searches mailboxes, watches a mailbox with IMAP IDLE, and syncs emails
into Vaeloom memories. Email is polling/IDLE based — there is no inbound
webhook.

## Install

```bash
pnpm add @vaeloom/integration-email
```

## Setup

Use an app password (not your account password) for `password`. Enable IMAP
and SMTP access in your mail provider.

## Usage

```ts
import { EmailIntegration, parseEmailConfig } from '@vaeloom/integration-email';

const email = new EmailIntegration({ masterKey: process.env.VAELOOM_MASTER_KEY! });

const config = parseEmailConfig({
  imapHost: 'imap.gmail.com',
  smtpHost: 'smtp.gmail.com',
  user: 'me@gmail.com',
  password: process.env.GMAIL_APP_PASSWORD!,
});

const connection = await email.connect({ provider: 'email', settings: config });

await email.sendEmail(connection.connectionId, 'friend@example.com', 'Hello', 'Body text');

const mails = await email.fetchEmails(connection.connectionId, 'INBOX', new Date('2024-01-01'), 25);
const found = await email.searchEmails(connection.connectionId, 'invoice');

// Live watch with IDLE
await email.watchMailbox(connection.connectionId, (mail) => {
  console.log('New mail:', mail.subject);
});

// Sync
const result = await email.sync(connection.connectionId);
```

## Security

IMAP/SMTP passwords are encrypted at rest with AES-256-GCM. Use app-specific
passwords and TLS (`secure: true`) for both transports.
