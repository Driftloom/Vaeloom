import { z } from 'zod';

const insecureSecretPattern = /^secret$/i;
const urlProtocolPattern = /^https?:\/\//;
const passwordStrengthPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

function isInsecureDefault(val: string | undefined): boolean {
  if (!val) return false;
  return insecureSecretPattern.test(val.trim()) ||
    val.trim().toLowerCase() === 'change-me' ||
    val.trim().toLowerCase().startsWith('change-me-in-production');
}

function warnOnInsecure(label: string, val: string | undefined): void {
  if (isInsecureDefault(val)) {
    console.warn(`[SECURITY WARNING] ${label} is set to an insecure default value. Replace before deploying to production.`);
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  ENVIRONMENT: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().startsWith('redis://').or(z.string().startsWith('rediss://')).optional(),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters in production'),
  AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(3600),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().default('vaeloom'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512', 'RS256']).default('HS256'),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  GATEWAY_TIMEOUT: z.coerce.number().int().positive().default(10000),
  GATEWAY_RETRY_COUNT: z.coerce.number().int().min(0).default(2),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_API_VERSION: z.string().default('2024-11-20.acacia'),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32, 'INTEGRATION_ENCRYPTION_KEY must be at least 32 characters').optional(),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default('vaeloom'),
  SENTRY_DSN: z.string().url().optional(),
  PROMETHEUS_METRICS_ENABLED: z.enum(['true', 'false']).default('true'),

  AUTH_SERVICE_URL: z.string().url().optional(),
  IAM_SERVICE_URL: z.string().url().optional(),
  RBAC_SERVICE_URL: z.string().url().optional(),
  MEMORY_STORE_URL: z.string().url().optional(),
  KNOWLEDGE_GRAPH_URL: z.string().url().optional(),
  SEARCH_SERVICE_URL: z.string().url().optional(),
  AGENT_ENGINE_URL: z.string().url().optional(),
  EVENT_BUS_URL: z.string().url().optional(),
  DOCUMENT_INGESTION_URL: z.string().url().optional(),
  CONNECTOR_SERVICE_URL: z.string().url().optional(),
  INTEGRATION_SERVICE_URL: z.string().url().optional(),
  PLUGIN_SERVICE_URL: z.string().url().optional(),
  NOTIFICATION_SERVICE_URL: z.string().url().optional(),
  BILLING_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  AUDIT_SERVICE_URL: z.string().url().optional(),
  JOB_SCHEDULER_URL: z.string().url().optional(),
  RECOMMENDATION_SERVICE_URL: z.string().url().optional(),

  SERVICE_AUTH_SECRET: z.string().min(32, 'SERVICE_AUTH_SECRET must be at least 32 characters in production'),
  SERVICE_AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(60),

  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().int().positive().default(30000),
  DB_POOL_ACQUIRE_TIMEOUT: z.coerce.number().int().positive().default(10000),
  DB_POOL_MAX_USES: z.coerce.number().int().positive().default(500),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const env = parsed.data;

  warnOnInsecure('JWT_SECRET', config.JWT_SECRET as string | undefined);
  warnOnInsecure('AUTH_SECRET', config.AUTH_SECRET as string | undefined);
  warnOnInsecure('SERVICE_AUTH_SECRET', config.SERVICE_AUTH_SECRET as string | undefined);
  warnOnInsecure('DATABASE_URL', config.DATABASE_URL as string | undefined);
  warnOnInsecure('ENCRYPTION_KEY', config.ENCRYPTION_KEY as string | undefined);
  warnOnInsecure('INTEGRATION_ENCRYPTION_KEY', config.INTEGRATION_ENCRYPTION_KEY as string | undefined);

  if (env.REDIS_URL && !env.REDIS_URL.startsWith('rediss://') && env.NODE_ENV === 'production') {
    console.warn('[SECURITY WARNING] REDIS_URL should use rediss:// (TLS) in production');
  }

  for (const svc of ['AUTH_SERVICE_URL', 'IAM_SERVICE_URL', 'RBAC_SERVICE_URL',
    'MEMORY_STORE_URL', 'KNOWLEDGE_GRAPH_URL', 'SEARCH_SERVICE_URL',
    'AGENT_ENGINE_URL', 'EVENT_BUS_URL', 'DOCUMENT_INGESTION_URL',
    'CONNECTOR_SERVICE_URL', 'INTEGRATION_SERVICE_URL', 'PLUGIN_SERVICE_URL',
    'NOTIFICATION_SERVICE_URL', 'BILLING_SERVICE_URL', 'ANALYTICS_SERVICE_URL',
    'AUDIT_SERVICE_URL', 'JOB_SCHEDULER_URL', 'RECOMMENDATION_SERVICE_URL'] as const) {
    const val = config[svc] as string | undefined;
    if (val && !urlProtocolPattern.test(val)) {
      console.warn(`[SECURITY WARNING] ${svc} should use http:// or https:// URL format (got: ${val})`);
    }
  }

  return env;
}
