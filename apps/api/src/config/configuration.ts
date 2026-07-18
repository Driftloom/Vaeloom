import { registerAs } from '@nestjs/config';

/**
 * Typed, namespaced config derived from the validated environment.
 * Injected via `ConfigService.get('auth')` etc. so feature code never reads
 * `process.env` directly.
 */
export const serviceAuthConfig = registerAs('serviceAuth', () => ({
  secret: process.env.SERVICE_AUTH_SECRET as string,
  tokenTtl: Number(process.env.SERVICE_AUTH_TOKEN_TTL ?? 60),
}));

export const appConfig = registerAs('app', () => ({
  env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? 'postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom',
  pool: {
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMs: Number(process.env.DB_POOL_IDLE_TIMEOUT ?? 30000),
    acquireTimeoutMs: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT ?? 10000),
    maxUses: Number(process.env.DB_POOL_MAX_USES ?? 500),
  },
}));

export const authConfig = registerAs('auth', () => ({
  secret: process.env.AUTH_SECRET as string,
  tokenTtl: Number(process.env.AUTH_TOKEN_TTL ?? 3600),
}));

/**
 * Structured logging config (Docs/DevOps/Logging.md). `level` gates verbosity;
 * `format` selects JSON (production default) vs. pretty (local development).
 */
export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));

export const gatewayConfig = registerAs('gateway', () => ({
  timeout: Number(process.env.GATEWAY_TIMEOUT ?? 10000),
  retryCount: Number(process.env.GATEWAY_RETRY_COUNT ?? 2),
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? 'http://auth-service:3020',
  iamServiceUrl: process.env.IAM_SERVICE_URL ?? 'http://iam-service:3120',
  rbacServiceUrl: process.env.RBAC_SERVICE_URL ?? 'http://rbac-service:3170',
  memoryStoreUrl: process.env.MEMORY_STORE_URL ?? 'http://memory-store:3010',
  knowledgeGraphUrl: process.env.KNOWLEDGE_GRAPH_URL ?? 'http://knowledge-graph:3030',
  searchServiceUrl: process.env.SEARCH_SERVICE_URL ?? 'http://search-service:3050',
  agentEngineUrl: process.env.AGENT_ENGINE_URL ?? 'http://agent-engine:3060',
  eventBusUrl: process.env.EVENT_BUS_URL ?? 'http://event-bus:3040',
  documentIngestionUrl: process.env.DOCUMENT_INGESTION_URL ?? 'http://document-ingestion:3110',
  connectorServiceUrl: process.env.CONNECTOR_SERVICE_URL ?? 'http://connector-service:3100',
  integrationServiceUrl: process.env.INTEGRATION_SERVICE_URL ?? 'http://integration-service:3130',
  pluginServiceUrl: process.env.PLUGIN_SERVICE_URL ?? 'http://plugin-service:3160',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:3150',
  billingServiceUrl: process.env.BILLING_SERVICE_URL ?? 'http://billing-service:3090',
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL ?? 'http://analytics-service:3070',
  auditServiceUrl: process.env.AUDIT_SERVICE_URL ?? 'http://audit-service:3080',
  jobSchedulerUrl: process.env.JOB_SCHEDULER_URL ?? 'http://job-scheduler:3140',
  recommendationServiceUrl: process.env.RECOMMENDATION_SERVICE_URL ?? 'http://recommendation-service:3180',
}));
