import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  ENVIRONMENT: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3110),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(20),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().int().positive().default(30000),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(3600),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  AI_SERVICE_URL: z.string().url().default('http://ai-service:8000'),
  AI_EMBEDDING_ENDPOINT: z.string().default('/api/v1/embeddings'),
  AI_EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1536),

  CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  METRICS_ENABLED: z.enum(['true', 'false']).default('true'),
  METRICS_PREFIX: z.string().default('document_ingestion_'),
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
  return parsed.data;
}
