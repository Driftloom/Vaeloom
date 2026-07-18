import { CalendarIntegration } from './calendar.integration';
import { verifyCalendarChannel } from './auth';

const googleConfig = {
  provider: 'calendar',
  settings: {
    backend: 'google',
    clientId: 'cid',
    clientSecret: 'sec',
    redirectUri: 'https://example.com/cb',
    accessToken: 'ya.test',
  },
};

const outlookConfig = {
  provider: 'calendar',
  settings: {
    backend: 'outlook',
    clientId: 'cid',
    clientSecret: 'sec',
    redirectUri: 'https://example.com/cb',
    accessToken: 'out.test',
    tenantId: 'common',
  },
};

describe('CalendarIntegration', () => {
  it('connects to google and outlook backends', async () => {
    const integration = new CalendarIntegration({ masterKey: 'k' });
    const g = await integration.connect(googleConfig);
    const o = await integration.connect(outlookConfig);
    expect(g.provider).toBe('calendar');
    expect(g.metadata?.backend).toBe('google');
    expect(o.metadata?.backend).toBe('outlook');
  });

  it('builds google authorize url', () => {
    const integration = new CalendarIntegration({ masterKey: 'k' });
    const url = integration.getAuthorizeUrl(googleConfig.settings as any, 's');
    expect(url).toContain('accounts.google.com');
  });

  it('builds outlook authorize url', () => {
    const integration = new CalendarIntegration({ masterKey: 'k' });
    const url = integration.getAuthorizeUrl(outlookConfig.settings as any, 's');
    expect(url).toContain('login.microsoftonline.com');
  });

  it('verifies a matching calendar channel', () => {
    expect(verifyCalendarChannel('c1', 't1', 'c1', 't1')).toBe(true);
    expect(verifyCalendarChannel('c1', 't1', 'cX', 't1')).toBe(false);
  });
});
