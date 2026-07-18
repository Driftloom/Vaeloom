import { validateEnv } from './env.validation';

describe('env.validation', () => {
  it('should validate valid environment configuration', () => {
    const validConfig = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      AUTH_SECRET: 'sixteencharacter',
    };

    const result = validateEnv(validConfig);
    expect(result.NODE_ENV).toBe('test');
    expect(result.DATABASE_URL).toBe('postgresql://localhost:5432/db');
    expect(result.AUTH_SECRET).toBe('sixteencharacter');
    expect(result.PORT).toBe(4000); // default
  });

  it('should throw on missing required config', () => {
    const invalidConfig = {
      NODE_ENV: 'test',
      // Missing DATABASE_URL and AUTH_SECRET
    };

    expect(() => validateEnv(invalidConfig)).toThrow('Invalid environment configuration:');
  });

  it('should throw if AUTH_SECRET is too short', () => {
    const invalidConfig = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      AUTH_SECRET: 'short',
    };

    expect(() => validateEnv(invalidConfig)).toThrow('AUTH_SECRET must be at least 16 characters');
  });
});
