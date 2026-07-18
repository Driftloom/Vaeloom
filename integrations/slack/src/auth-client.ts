import { SlackConfig } from './config';

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  scope: string;
  tokenType: string;
  botUserId?: string;
  teamId?: string;
  teamName?: string;
}

export const SLACK_AUTHORIZE_URL = 'https://slack.com/openid/connect/authorize';
export const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

export class SlackAuthClient {
  constructor(private readonly config: SlackConfig) {}

  /** Build the OAuth2 authorization URL for the user-consent screen. */
  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(','),
      redirect_uri: this.config.redirectUri,
      state,
      response_type: 'code',
    });
    return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchange an OAuth `code` for an access token via the Slack API. */
  async exchangeCodeForToken(code: string, fetchImpl: typeof fetch = fetch): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    const res = await fetchImpl(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Slack token exchange failed: ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data['ok'] !== true) {
      throw new Error(`Slack token exchange error: ${String(data['error'])}`);
    }
    return {
      accessToken: String(data['access_token']),
      scope: String(data['scope'] ?? ''),
      tokenType: 'Bearer',
      botUserId: data['bot_user_id'] ? String(data['bot_user_id']) : undefined,
      teamId: data['team'] ? String((data['team'] as Record<string, unknown>)['id']) : undefined,
      teamName: data['team'] ? String((data['team'] as Record<string, unknown>)['name']) : undefined,
    };
  }
}
