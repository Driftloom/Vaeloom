export type AuthType = 'none' | 'apiKey' | 'oauth2' | 'basic';

export type PaginationType = 'offset' | 'cursor' | 'page';

export interface RestConfig {
  baseURL: string;
  auth?: RestAuth;
  pagination?: RestPagination;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RestAuth {
  type: AuthType;
  apiKey?: ApiKeyAuth;
  oauth2?: OAuth2Auth;
  basic?: BasicAuth;
}

export interface ApiKeyAuth {
  key: string;
  header?: string;
  queryParam?: string;
}

export interface OAuth2Auth {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface RestPagination {
  type: PaginationType;
  pageParam?: string;
  limitParam?: string;
  cursorParam?: string;
  offsetParam?: string;
  limit?: number;
  totalPath?: string;
}

export interface SyncResult {
  success: boolean;
  resources: Record<string, number>;
  errors: { resource: string; error: string }[];
  totalDuration: number;
}
