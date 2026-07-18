import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3040),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL as string,
  maxConnections: Number(process.env.DB_MAX_CONNECTIONS ?? 20),
  idleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT ?? 30000),
}));

export const authConfig = registerAs('auth', () => ({
  secret: process.env.JWT_SECRET as string,
}));

export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));
