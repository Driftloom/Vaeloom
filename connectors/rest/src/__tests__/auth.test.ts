import { createAuthStrategy } from '../auth';
import type { AxiosRequestConfig } from 'axios';

describe('AuthStrategy', () => {
  describe('none', () => {
    it('should return config unchanged', async () => {
      const strategy = createAuthStrategy({ type: 'none' });
      const config: AxiosRequestConfig = { headers: {} };
      const result = await strategy.apply(config);
      expect(result.headers).toEqual({});
    });
  });

  describe('apiKey', () => {
    it('should add header', async () => {
      const strategy = createAuthStrategy({
        type: 'apiKey',
        apiKey: { key: 'secret', header: 'X-Key' },
      });
      const config: AxiosRequestConfig = { headers: {} };
      const result = await strategy.apply(config);
      expect(result.headers!['X-Key']).toBe('secret');
    });

    it('should add query param', async () => {
      const strategy = createAuthStrategy({
        type: 'apiKey',
        apiKey: { key: 'token', queryParam: 'api_key' },
      });
      const config: AxiosRequestConfig = { headers: {}, params: {} };
      const result = await strategy.apply(config);
      expect(result.params!['api_key']).toBe('token');
    });
  });

  describe('basic', () => {
    it('should add Basic auth header', async () => {
      const strategy = createAuthStrategy({
        type: 'basic',
        basic: { username: 'user', password: 'pass' },
      });
      const config: AxiosRequestConfig = { headers: {} };
      const result = await strategy.apply(config);
      const authHeader = result.headers!['Authorization'] as string;
      expect(authHeader).toMatch(/^Basic /);
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      expect(decoded).toBe('user:pass');
    });
  });
});
