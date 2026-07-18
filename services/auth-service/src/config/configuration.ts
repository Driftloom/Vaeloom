import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3020),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL as string,
}));

export const logConfig = registerAs('log', () => ({
  level: process.env.LOG_LEVEL ?? 'info',
  format: process.env.LOG_FORMAT ?? 'json',
}));
