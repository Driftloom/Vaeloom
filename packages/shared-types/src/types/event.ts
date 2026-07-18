import type { UUID, ISO8601 } from './domain';

export type EventStatus = 'published' | 'processing' | 'completed' | 'failed' | 'retrying';

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export type EventCategory = 'memory' | 'agent' | 'auth' | 'billing' | 'system' | 'sync' | 'user' | 'integration';

export interface Event {
  id: UUID;
  type: string;
  source: string;
  category: EventCategory;
  status: EventStatus;
  priority: EventPriority;
  correlationId: UUID;
  causationId?: UUID;
  tenantId: UUID;
  userId?: UUID;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  createdAt: ISO8601;
  publishedAt?: ISO8601;
  retryCount: number;
  maxRetries: number;
}

export interface EventMetadata {
  version: number;
  schema: string;
  producer: string;
  timestamp: ISO8601;
  traceId: string;
  spanId: string;
}

export interface EventSubscription {
  id: UUID;
  eventType: string;
  handlerId: UUID;
  handlerType: 'service' | 'agent' | 'webhook' | 'function';
  config: SubscriptionConfig;
  filters?: Record<string, unknown>;
  enabled: boolean;
  createdAt: ISO8601;
}

export interface SubscriptionConfig {
  batchSize?: number;
  maxRetries: number;
  timeoutMs: number;
  deadLetter: boolean;
}

export interface DeadLetterEvent {
  id: UUID;
  originalEventId: UUID;
  error: string;
  errorCount: number;
  lastErrorAt: ISO8601;
  payload: Record<string, unknown>;
}
