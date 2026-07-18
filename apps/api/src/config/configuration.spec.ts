import { appConfig, authConfig, logConfig } from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('appConfig should load correctly', () => {
    process.env.ENVIRONMENT = 'test';
    process.env.PORT = '3000';
    process.env.ALLOWED_ORIGINS = 'http://test1, http://test2';
    process.env.AI_SERVICE_URL = 'http://ai:8000';

    const config = appConfig();
    expect(config.env).toBe('test');
    expect(config.port).toBe(3000);
    expect(config.allowedOrigins).toEqual(['http://test1', 'http://test2']);
    expect(config.aiServiceUrl).toBe('http://ai:8000');
  });

  it('appConfig should load defaults', () => {
    delete process.env.ENVIRONMENT;
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.AI_SERVICE_URL;

    const config = appConfig();
    expect(config.env).toBe('development');
    expect(config.port).toBe(4000);
    expect(config.allowedOrigins).toEqual(['http://localhost:3000']);
    expect(config.aiServiceUrl).toBe('http://localhost:8000');
  });

  it('authConfig should load correctly', () => {
    process.env.AUTH_SECRET = 'mysecret';
    process.env.AUTH_TOKEN_TTL = '7200';

    const config = authConfig();
    expect(config.secret).toBe('mysecret');
    expect(config.tokenTtl).toBe(7200);
  });

  it('logConfig should load correctly', () => {
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_FORMAT = 'pretty';

    const config = logConfig();
    expect(config.level).toBe('debug');
    expect(config.format).toBe('pretty');
  });
});
