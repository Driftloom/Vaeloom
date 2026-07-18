export interface IntegrationConfig {
  /** Provider identifier, e.g. "slack". */
  provider: string;
  /** Arbitrary provider-specific configuration (validated by each integration). */
  settings: Record<string, unknown>;
  /** Optional tenant/workspace scoping used by the consuming service. */
  tenantId?: string;
  /** Optional user scoping used by the consuming service. */
  userId?: string;
}

export interface ConnectionResult {
  connectionId: string;
  provider: string;
  connectedAt: string;
  /** Whether the connection is ready to use immediately. */
  ready: boolean;
  /** Optional metadata returned by the provider (scopes, team id, etc). */
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  connectionId: string;
  syncedAt: string;
  /** Number of records successfully ingested into Vaeloom. */
  recordsIngested: number;
  /** Number of records that failed and were skipped. */
  recordsFailed: number;
  /** Soft cursor to resume the next incremental sync. */
  nextCursor?: string;
  /** Per-entity breakdown of what was synced. */
  entities?: Array<{ type: string; ingested: number; failed: number }>;
}

export interface Integration {
  readonly provider: string;
  connect(config: IntegrationConfig): Promise<ConnectionResult>;
  disconnect(connectionId: string): Promise<void>;
  sync(connectionId: string): Promise<SyncResult>;
  handleWebhook?(payload: unknown, headers?: Record<string, string>): Promise<unknown>;
}

/** Lightweight memory record shape produced by every integration sync. */
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
