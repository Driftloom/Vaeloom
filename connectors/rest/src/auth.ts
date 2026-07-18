import type { AxiosRequestConfig } from 'axios';
import type { RestAuth } from './types';

export interface AuthStrategy {
  apply(config: AxiosRequestConfig): Promise<AxiosRequestConfig>;
  refresh?(): Promise<void>;
}

export function createAuthStrategy(auth: RestAuth): AuthStrategy {
  switch (auth.type) {
    case 'none':
      return new NoAuthStrategy();
    case 'apiKey':
      return new ApiKeyStrategy(auth.apiKey!);
    case 'oauth2':
      return new OAuth2Strategy(auth.oauth2!);
    case 'basic':
      return new BasicStrategy(auth.basic!);
    default:
      return new NoAuthStrategy();
  }
}

class NoAuthStrategy implements AuthStrategy {
  async apply(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    return config;
  }
}

class ApiKeyStrategy implements AuthStrategy {
  private key: string;
  private header?: string;
  private queryParam?: string;

  constructor(config: NonNullable<RestAuth['apiKey']>) {
    this.key = config.key;
    this.header = config.header;
    this.queryParam = config.queryParam;
  }

  async apply(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    if (this.header) {
      config.headers = { ...config.headers, [this.header]: this.key };
    }
    if (this.queryParam) {
      config.params = { ...config.params, [this.queryParam]: this.key };
    }
    return config;
  }
}

interface TokenStore {
  accessToken: string;
  expiresAt: number;
}

class OAuth2Strategy implements AuthStrategy {
  private config: NonNullable<RestAuth['oauth2']>;
  private tokenStore: TokenStore | null = null;

  constructor(config: NonNullable<RestAuth['oauth2']>) {
    this.config = config;
  }

  async apply(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    if (!this.tokenStore || Date.now() >= this.tokenStore.expiresAt) {
      await this.fetchToken();
    }
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${this.tokenStore!.accessToken}`,
    };
    return config;
  }

  async refresh?(): Promise<void> {
    this.tokenStore = null;
    await this.fetchToken();
  }

  private async fetchToken(): Promise<void> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    if (this.config.scopes?.length) {
      params.append('scope', this.config.scopes.join(' '));
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };

    this.tokenStore = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  }
}

class BasicStrategy implements AuthStrategy {
  private credentials: NonNullable<RestAuth['basic']>;

  constructor(config: NonNullable<RestAuth['basic']>) {
    this.credentials = config;
  }

  async apply(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    const encoded = Buffer.from(
      `${this.credentials.username}:${this.credentials.password}`,
    ).toString('base64');
    config.headers = {
      ...config.headers,
      Authorization: `Basic ${encoded}`,
    };
    return config;
  }
}
