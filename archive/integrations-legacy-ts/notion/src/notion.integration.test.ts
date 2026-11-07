import { NotionIntegration } from './notion.integration';

describe('NotionIntegration', () => {
  const config = {
    provider: 'notion',
    settings: {
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'https://example.com/cb',
      botToken: 'secret_abc',
    },
  };

  it('exposes the notion provider and connect method', () => {
    const integration = new NotionIntegration({ masterKey: 'k' });
    expect(integration.provider).toBe('notion');
    expect(typeof integration.connect).toBe('function');
    expect(typeof integration.search).toBe('function');
  });

  it('handleWebhook is a safe no-op (Notion is poll-based)', async () => {
    const integration = new NotionIntegration({ masterKey: 'k' });
    await expect(integration.handleWebhook({})).resolves.toBeUndefined();
  });

  it('builds an OAuth authorize url', () => {
    const integration = new NotionIntegration({ masterKey: 'k' });
    const authClient = integration.buildAuthClient(config);
    const url = authClient.getAuthorizeUrl('s1');
    expect(url).toContain('api.notion.com/v1/oauth/authorize');
    expect(url).toContain('client_id=cid');
  });
});
