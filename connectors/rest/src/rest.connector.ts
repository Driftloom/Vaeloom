import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { RestConfig, SyncResult } from './types';
import { createAuthStrategy, type AuthStrategy } from './auth';
import { createPaginationHandler, type PaginationHandler } from './pagination';
import { TokenBucket } from './rate-limiter';

export class RestConnector {
  private client: AxiosInstance | null = null;
  private config: RestConfig | null = null;
  private authStrategy: AuthStrategy | null = null;
  private paginationHandler: PaginationHandler | null = null;
  private rateLimiter: TokenBucket | null = null;

  async connect(config: RestConfig): Promise<void> {
    this.config = config;

    this.rateLimiter = new TokenBucket(60, 1, 1000);

    if (config.pagination) {
      this.paginationHandler = createPaginationHandler(config.pagination);
    }

    if (config.auth) {
      this.authStrategy = createAuthStrategy(config.auth);
    }

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.client.interceptors.request.use(async (reqConfig) => {
      await this.rateLimiter!.consume(1);

      if (this.authStrategy) {
        return this.authStrategy.apply(reqConfig);
      }
      return reqConfig;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!axios.isAxiosError(error) || !error.config || !error.response) {
          return Promise.reject(error);
        }

        const { status, headers } = error.response;

        if (status === 429) {
          const retryAfter = parseInt(headers['retry-after'] ?? '5', 10);
          this.rateLimiter?.setRetryAfter(retryAfter);
          await delay(retryAfter * 1000);
          return this.client!.request(error.config);
        }

        if (status >= 500) {
          const retryCount = error.config._retryCount ?? 0;
          if (retryCount < 3) {
            error.config._retryCount = retryCount + 1;
            const backoff = Math.pow(2, retryCount) * 1000;
            await delay(backoff);
            return this.client!.request(error.config);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async fetch<T>(resource: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    if (this.paginationHandler) {
      return this.fetchAllPages<T>(resource, params ?? {});
    }

    const response = await this.client.get(resource, { params });
    return response.data as T;
  }

  async post<T>(resource: string, data: unknown): Promise<T> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');
    const response = await this.client.post(resource, data);
    return response.data as T;
  }

  async put<T>(resource: string, data: unknown): Promise<T> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');
    const response = await this.client.put(resource, data);
    return response.data as T;
  }

  async delete(resource: string): Promise<void> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');
    await this.client.delete(resource);
  }

  async test(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status >= 200 && response.status < 500;
    } catch {
      return false;
    }
  }

  async sync(resources: string[]): Promise<SyncResult> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      resources: {},
      errors: [],
      totalDuration: 0,
    };

    for (const resource of resources) {
      try {
        const data = await this.fetch<unknown[]>(resource);
        const count = Array.isArray(data) ? data.length : 1;
        result.resources[resource] = count;
      } catch (err) {
        result.success = false;
        result.errors.push({
          resource,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    result.totalDuration = Date.now() - startTime;
    return result;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.config = null;
    this.authStrategy = null;
    this.paginationHandler = null;
    this.rateLimiter = null;
  }

  private async fetchAllPages<T>(resource: string, initialParams: Record<string, unknown>): Promise<T> {
    if (!this.client || !this.paginationHandler) throw new Error('Not connected.');

    let params = { ...initialParams };
    const allItems: unknown[] = [];

    for (let i = 0; i < 100; i++) {
      const response = await this.client.get(resource, { params });
      const data = response.data as { data?: unknown[] };
      const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      allItems.push(...items);

      const nextParams = this.paginationHandler.getNextParams(response.data, params);
      if (!nextParams) break;
      params = nextParams;
    }

    return allItems as T;
  }

}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
