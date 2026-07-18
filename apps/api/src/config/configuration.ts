import { registerAs } from '@nestjs/config';

/**
 * Typed, namespaced config derived from the validated environment.
 * Injected via `ConfigService.get('auth')` etc. so feature code never reads
 * `process.env` directly.
 */
export const appConfig = registerAs('app', () => ({
  env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
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
