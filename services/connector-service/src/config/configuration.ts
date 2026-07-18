import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3100),
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

export const integrationConfig = registerAs('integration', () => ({
  serviceUrl: process.env.INTEGRATION_SERVICE_URL ?? 'http://integration-service:3130',
}));

export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));

export const metricsConfig = registerAs('metrics', () => ({
  enabled: (process.env.METRICS_ENABLED ?? 'true') === 'true',
  prefix: process.env.METRICS_PREFIX ?? 'connector_service_',
}));
