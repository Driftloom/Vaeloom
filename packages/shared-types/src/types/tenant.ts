import type { BaseEntity, UUID } from './domain';

export type TenantIsolation = 'dedicated' | 'pooled' | 'hybrid';

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'expired' | 'deleted';

export interface Tenant extends BaseEntity {
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  isolation: TenantIsolation;
  plan: string;
  settings: TenantSettings;
  limits: TenantLimits;
  features: string[];
}

export interface TenantSettings {
  locale: string;
  timezone: string;
  authProviders: string[];
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  allowedDomains: string[];
  customBranding?: BrandingConfig;
}

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  faviconUrl?: string;
  customDomain?: string;
}

export interface TenantLimits {
  maxUsers: number;
  maxStorageGb: number;
  maxApiRate: number;
  maxAgents: number;
  maxMemoryItems: number;
  maxTeamSpaces: number;
}

export interface TenantMetrics {
  activeUsers: number;
  totalUsers: number;
  storageUsedGb: number;
  memoryItems: number;
  agentExecutions: number;
  apiCalls: number;
}

export interface TenantMigration {
  id: UUID;
  tenantId: UUID;
  fromIsolation: TenantIsolation;
  toIsolation: TenantIsolation;
  status: MigrationStatus;
  startedAt: string;
  completedAt?: string;
}

export type MigrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
