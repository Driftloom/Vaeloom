import { GithubConfig } from './config';

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export interface GithubOAuthToken {
  accessToken: string;
  scope: string;
  tokenType: string;
}

export class GithubAuthClient {
  constructor(private readonly config: GithubConfig) {}

  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId ?? '',
      redirect_uri: this.config.redirectUri ?? '',
      scope: this.config.scopes.join(' '),
      state,
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, fetchImpl: typeof fetch = fetch): Promise<GithubOAuthToken> {
    const res = await fetchImpl(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!data['access_token']) {
      throw new Error(`GitHub token exchange error: ${String(data['error_description'] ?? data['error'])}`);
    }
    return {
      accessToken: String(data['access_token']),
      scope: String(data['scope'] ?? ''),
      tokenType: String(data['token_type'] ?? 'Bearer'),
    };
  }
}
