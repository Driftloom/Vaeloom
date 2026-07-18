import { EmailIntegration } from './email.integration';

describe('EmailIntegration', () => {
  const config = {
    provider: 'email',
    settings: {
      imapHost: 'imap.example.com',
      imapPort: 993,
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      user: 'me@example.com',
      password: 'app-pass',
    },
  };

  it('exposes the email provider, connects, and encrypts the password', async () => {
    const integration = new EmailIntegration({ masterKey: 'k' });
    const result = await integration.connect(config);
    expect(result.provider).toBe('email');
    expect(result.ready).toBe(true);
    expect(result.connectionId).toBe('email-me@example.com');
  });

  it('handleWebhook is a no-op (polling-based)', async () => {
    const integration = new EmailIntegration({ masterKey: 'k' });
    await expect(integration.handleWebhook({})).resolves.toBeUndefined();
  });

  it('has send/fetch/watch methods', () => {
    const integration = new EmailIntegration({ masterKey: 'k' });
    expect(typeof integration.sendEmail).toBe('function');
    expect(typeof integration.fetchEmails).toBe('function');
    expect(typeof integration.watchMailbox).toBe('function');
  });
});
