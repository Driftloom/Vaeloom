import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3160),
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
  secret: process.env.AUTH_SECRET as string,
  tokenTtl: Number(process.env.AUTH_TOKEN_TTL ?? 3600),
}));

export const aiConfig = registerAs('ai', () => ({
  serviceUrl: process.env.AI_SERVICE_URL ?? 'http://ai-service:8000',
  embeddingEndpoint: process.env.AI_EMBEDDING_ENDPOINT ?? '/api/v1/embeddings',
  embeddingDimension: Number(process.env.AI_EMBEDDING_DIMENSION ?? 1536),
}));

export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));

export const pluginConfig = registerAs('plugin', () => ({
  sandboxTimeoutMs: Number(process.env.PLUGIN_SANDBOX_TIMEOUT ?? 5000),
  codeMaxBytes: Number(process.env.PLUGIN_CODE_MAX_BYTES ?? 102400),
  storeDirectory: process.env.PLUGIN_STORE_DIR ?? 'plugins',
}));
