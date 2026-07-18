import { GithubIntegration } from './github.integration';
import { verifyGithubSignature } from './auth';

describe('GithubIntegration', () => {
  const config = {
    provider: 'github',
    settings: { accessToken: 'ghp_test_token' },
  };

  it('exposes the github provider and connect method', () => {
    const integration = new GithubIntegration({ masterKey: 'k' });
    expect(integration.provider).toBe('github');
    expect(typeof integration.connect).toBe('function');
    expect(typeof integration.sync).toBe('function');
  });

  it('verifies a valid webhook signature', () => {
    const secret = 'whsec';
    const rawBody = '{"action":"opened"}';
    const crypto = require('node:crypto');
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    expect(verifyGithubSignature(secret, sig, rawBody)).toBe(true);
  });

  it('rejects an invalid webhook signature', () => {
    expect(verifyGithubSignature('whsec', 'sha256=deadbeef', '{"a":1}')).toBe(false);
  });

  it('creates an auth client with authorize url', () => {
    const integration = new GithubIntegration({ masterKey: 'k' });
    const authClient = integration.buildAuthClient({
      provider: 'github',
      settings: {
        clientId: 'cid',
        clientSecret: 'sec',
        redirectUri: 'https://example.com/cb',
      },
    });
    const url = authClient.getAuthorizeUrl('state');
    expect(url).toContain('github.com/login/oauth/authorize');
    expect(url).toContain('client_id=cid');
  });
});
