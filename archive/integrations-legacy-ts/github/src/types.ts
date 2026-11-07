export interface IntegrationConfig {
  provider: string;
  settings: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
}

export interface ConnectionResult {
  connectionId: string;
  provider: string;
  connectedAt: string;
  ready: boolean;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  connectionId: string;
  syncedAt: string;
  recordsIngested: number;
  recordsFailed: number;
  nextCursor?: string;
  entities?: Array<{ type: string; ingested: number; failed: number }>;
}

export interface Integration {
  readonly provider: string;
  connect(config: IntegrationConfig): Promise<ConnectionResult>;
  disconnect(connectionId: string): Promise<void>;
  sync(connectionId: string): Promise<SyncResult>;
  handleWebhook?(payload: unknown, headers?: Record<string, string>): Promise<unknown>;
}

export interface IngestedMemory {
  externalId: string;
  provider: string;
  entityType: string;
  title: string;
  content: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}
