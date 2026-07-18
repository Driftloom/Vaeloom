import { GoogleDriveIntegration } from './google-drive.integration';
import { verifyGoogleChannel } from './auth';

describe('GoogleDriveIntegration', () => {
  const config = {
    provider: 'google-drive',
    settings: {
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'https://example.com/cb',
      accessToken: 'ya.test',
      refreshToken: 'ref',
    },
  };

  it('exposes the google-drive provider and connects', async () => {
    const integration = new GoogleDriveIntegration({ masterKey: 'k' });
    const result = await integration.connect(config);
    expect(result.provider).toBe('google-drive');
    expect(result.ready).toBe(true);
  });

  it('verifies a matching channel id + resource token', () => {
    expect(verifyGoogleChannel('chan-1', 'tok-1', 'chan-1', 'tok-1')).toBe(true);
  });

  it('rejects a mismatched channel', () => {
    expect(verifyGoogleChannel('chan-1', 'tok-1', 'chan-2', 'tok-1')).toBe(false);
  });

  it('rejects webhook with missing channel fields', () => {
    const integration = new GoogleDriveIntegration({ masterKey: 'k' });
    return expect(integration.handleWebhook({ channelId: 'x' })).resolves.toBeUndefined();
  });
});
