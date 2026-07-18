import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3150),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(20),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().int().positive().default(30000),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  METRICS_ENABLED: z.enum(['true', 'false']).default('true'),
  METRICS_PATH: z.string().default('metrics'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('no-reply@vaeloom.local'),

  SLACK_TOKEN: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default(''),

  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
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
