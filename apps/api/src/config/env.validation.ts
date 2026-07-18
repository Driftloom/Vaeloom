import { z } from 'zod';

/**
 * Environment contract for apps/api. Every variable the service needs to boot is
 * declared here so that a missing/invalid value fails fast at startup rather than
 * surfacing as an obscure runtime error. Mirrors the root .env.example (file 01:
 * "no service should require an undocumented env var to boot").
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  // Deployment environment label used for config layering (local/dev/staging/prod).
  ENVIRONMENT: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // PostgreSQL connection string consumed by Prisma.
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  // Redis connection string (sessions/queues/cache in later phases).
  REDIS_URL: z.string().startsWith('redis://').optional(),

  // JWT signing secret. ROTATION: rotate by issuing a new secret and allowing a
  // grace window; in staging/prod source this from a secrets manager, not env.
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  // Access-token lifetime in seconds (default 1h).
  AUTH_TOKEN_TTL: z.coerce.number().int().positive().default(3600),

  // Comma-separated list of browser origins allowed by CORS.
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Internal RPC base URL for the FastAPI ai-service (wired in later phases).
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // Structured logging (Docs/DevOps/Logging.md). LOG_LEVEL gates verbosity;
  // LOG_FORMAT selects JSON (production default) vs. pretty (local dev).
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Nest ConfigModule validate hook. Throws with a readable message listing every
 * invalid/missing variable, so a broken environment is caught before listen().
 */
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
