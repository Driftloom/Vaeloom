import { NotionConfig } from './config';

export const NOTION_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
export const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

export interface NotionOAuthToken {
  accessToken: string;
  botId: string;
  workspaceId: string;
  workspaceName: string;
  owner: Record<string, unknown>;
}

export class NotionAuthClient {
  constructor(private readonly config: NotionConfig) {}

  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    });
    return `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, fetchImpl: typeof fetch = fetch): Promise<NotionOAuthToken> {
    const res = await fetchImpl(NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri }),
    });
    if (!res.ok) throw new Error(`Notion token exchange failed: ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!data['access_token']) {
      throw new Error(`Notion token exchange error: ${String(data['error'])}`);
    }
    return {
      accessToken: String(data['access_token']),
      botId: String(data['bot_id']),
      workspaceId: String(data['workspace_id']),
      workspaceName: String(data['workspace_name']),
      owner: (data['owner'] as Record<string, unknown>) ?? {},
    };
  }
}
