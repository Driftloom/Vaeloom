import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { GraphQLConfig, GraphQLResponse, GraphQLSchema } from './types';
import { INTROSPECTION_QUERY, parseIntrospectionResult } from './introspection';
import { buildQuery } from './query-builder';

export class GraphQLConnector {
  private client: AxiosInstance | null = null;
  private config: GraphQLConfig | null = null;

  async connect(config: GraphQLConfig): Promise<void> {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!axios.isAxiosError(error) || !error.config || !error.response) {
          return Promise.reject(error);
        }

        const { status } = error.response;

        if (status >= 500) {
          const retryCount = (error.config as AxiosRequestConfig & { _retryCount?: number })._retryCount ?? 0;
          if (retryCount < 3) {
            (error.config as AxiosRequestConfig & { _retryCount?: number })._retryCount = retryCount + 1;
            const backoff = Math.pow(2, retryCount) * 1000;
            await delay(backoff);
            return this.client!.request(error.config);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    const response = await this.client.post<GraphQLResponse<T>>('', {
      query,
      variables,
    });

    if (response.data.errors?.length) {
      const messages = response.data.errors.map((e) => e.message).join('; ');
      throw new Error(`GraphQL errors: ${messages}`);
    }

    return response.data.data as T;
  }

  async mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  async introspect(): Promise<GraphQLSchema> {
    if (!this.client) throw new Error('Not connected. Call connect() first.');

    const response = await this.client.post<{
      data: { __schema: unknown };
      errors?: { message: string }[];
    }>('', { query: INTROSPECTION_QUERY });

    if (response.data.errors?.length) {
      const messages = response.data.errors.map((e: { message: string }) => e.message).join('; ');
      throw new Error(`Introspection failed: ${messages}`);
    }

    return parseIntrospectionResult(response.data.data);
  }

  buildQuery(fields: string[], operationName?: string): string {
    return buildQuery(fields, operationName);
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.config = null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
