import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3140),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}));

export const databaseConfig = registerAs('database', () => ({
  url: (process.env.DATABASE_URL ?? 'postgresql://localhost:5432/vaeloom') as string,
  maxConnections: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 20),
  idleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT ?? 30000),
}));

export const authConfig = registerAs('auth', () => ({
  secret: process.env.JWT_SECRET as string,
  tokenTtl: Number(process.env.AUTH_TOKEN_TTL ?? 3600),
}));

export const schedulerConfig = registerAs('scheduler', () => ({
  enabled: (process.env.SCHEDULER_ENABLED ?? 'true') === 'true',
  pollIntervalMs: Number(process.env.SCHEDULER_POLL_INTERVAL_MS ?? 30000),
  eventBusUrl: process.env.EVENT_BUS_URL ?? 'http://event-bus:3040',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));

export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));

export const metricsConfig = registerAs('metrics', () => ({
  enabled: (process.env.METRICS_ENABLED ?? 'true') === 'true',
  prefix: process.env.METRICS_PREFIX ?? 'job_scheduler_',
}));
