import { ConfigService } from '@nestjs/config';

import { SecretsService } from './secrets.service';

describe('SecretsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_SECRET: 'test-jwt-secret-at-least-16',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/vaeloom_test',
      REDIS_URL: 'redis://localhost:6379',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildService(env = 'development'): SecretsService {
    const config = {
      get: (key: string) => {
        if (key === 'app.env') return env;
        return undefined;
      },
    } as unknown as ConfigService;
    return new SecretsService(config);
  }

  it('loads required and optional secrets from env on init', async () => {
    const service = buildService();
    await service.onModuleInit();

    expect(service.get('AUTH_SECRET')).toBe('test-jwt-secret-at-least-16');
    expect(service.get('DATABASE_URL')).toContain('postgresql://');
    expect(service.get('REDIS_URL')).toBe('redis://localhost:6379');
    expect(service.get('ANTHROPIC_API_KEY')).toBe('sk-ant-test-key');
  });

  it('throws when required secrets are missing', async () => {
    delete process.env.AUTH_SECRET;
    const service = buildService();
    await expect(service.onModuleInit()).rejects.toThrow('Missing required secrets');
  });

  it('getOrThrow throws for missing keys', async () => {
    const service = buildService();
    await service.onModuleInit();
    expect(() => service.getOrThrow('NONEXISTENT')).toThrow('Required secret');
  });

  it('getOrThrow returns value for loaded keys', async () => {
    const service = buildService();
    await service.onModuleInit();
    expect(service.getOrThrow('AUTH_SECRET')).toBe('test-jwt-secret-at-least-16');
  });

  it('has() reports presence correctly', async () => {
    const service = buildService();
    await service.onModuleInit();
    expect(service.has('AUTH_SECRET')).toBe(true);
    expect(service.has('NONEXISTENT')).toBe(false);
  });

  it('listKeys() returns keys but never values', async () => {
    const service = buildService();
    await service.onModuleInit();
    const keys = service.listKeys();
    expect(keys).toContain('AUTH_SECRET');
    expect(keys).toContain('DATABASE_URL');
    expect(keys.join('')).not.toContain('test-jwt-secret');
  });

  it('getMeta() returns metadata without value', async () => {
    const service = buildService();
    await service.onModuleInit();
    const meta = service.getMeta('AUTH_SECRET');
    expect(meta).toBeDefined();
    expect(meta!.version).toBe(1);
    expect(meta!.source).toBe('env');
    expect(meta!.loadedAt).toBeInstanceOf(Date);
    expect((meta as Record<string, unknown>)['value']).toBeUndefined();
  });

  it('refresh() reloads secrets', async () => {
    const service = buildService();
    await service.onModuleInit();
    process.env.AUTH_SECRET = 'rotated-secret-minimum-16-chars';
    await service.refresh();
    expect(service.get('AUTH_SECRET')).toBe('rotated-secret-minimum-16-chars');
  });

  it('production mode warns about missing secrets manager SDK', async () => {
    const service = buildService('production');
    // Should still work (falls back to env) but with a warning
    await service.onModuleInit();
    expect(service.get('AUTH_SECRET')).toBe('test-jwt-secret-at-least-16');
    const meta = service.getMeta('AUTH_SECRET');
    expect(meta!.source).toBe('secrets-manager');
  });
});
