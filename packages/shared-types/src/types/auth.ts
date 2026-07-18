import type { UUID, ISO8601 } from './domain';

export type AuthProvider = 'email' | 'google' | 'github' | 'microsoft' | 'saml' | 'oidc';

export type SessionStatus = 'active' | 'expired' | 'revoked' | 'suspended';

export interface AuthSession {
  id: UUID;
  userId: UUID;
  tenantId: UUID;
  provider: AuthProvider;
  status: SessionStatus;
  token: string;
  refreshToken: string;
  expiresAt: ISO8601;
  lastActivity: ISO8601;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  createdAt: ISO8601;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'api';
  os: string;
  browser: string;
  userAgent: string;
}

export interface Permission {
  resource: string;
  action: Action;
  conditions?: Record<string, unknown>;
}

export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'execute';

export interface Role {
  id: UUID;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  tenantId: UUID;
}

export interface ApiKey {
  id: UUID;
  name: string;
  keyPrefix: string;
  permissions: Permission[];
  expiresAt?: ISO8601;
  lastUsed?: ISO8601;
  enabled: boolean;
}

export type AuthEventType = 'login' | 'logout' | 'token_refresh' | 'password_change' | 'mfa_challenge' | 'suspicious_activity';
