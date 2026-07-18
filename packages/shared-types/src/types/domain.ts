export type UUID = string;
export type ISO8601 = string;
export type Email = string;
export type URL = string;

export interface BaseEntity {
  id: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
  createdBy: UUID;
  updatedBy: UUID;
  tenantId: UUID;
}

export interface User extends BaseEntity {
  email: Email;
  displayName: string;
  avatarUrl?: URL;
  status: UserStatus;
  preferences: UserPreferences;
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  locale: string;
  notificationSettings: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'none' | 'daily' | 'weekly';
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  domain?: string;
  plan: PlanTier;
  features: FeatureFlag[];
  settings: Record<string, unknown>;
}

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'self-hosted';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}
