import axios, { type AxiosInstance } from 'axios';
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
