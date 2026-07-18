import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { Memory, MemoryQuery, Agent, AgentExecution, PaginatedResponse } from './types';

export interface VaeloomClientConfig {
  apiKey?: string;
  accessToken?: string;
  baseUrl?: string;
  tenantId?: string;
}

export class VaeloomClient {
  private client: AxiosInstance;
  private config: Required<VaeloomClientConfig>;

  constructor(config: VaeloomClientConfig = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      accessToken: config.accessToken || '',
      baseUrl: config.baseUrl || 'https://api.vaeloom.dev',
      tenantId: config.tenantId || '',
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: this.buildHeaders(),
      timeout: 30000,
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) throw new Error('Authentication failed');
        if (error.response?.status === 403) throw new Error('Permission denied');
        if (error.response?.status === 429) throw new Error('Rate limit exceeded');
        throw error;
      },
    );
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) headers['X-API-Key'] = this.config.apiKey;
    if (this.config.accessToken) headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    if (this.config.tenantId) headers['X-Tenant-Id'] = this.config.tenantId;
    return headers;
  }

  // Memory
  async createMemory(data: Partial<Memory>): Promise<Memory> {
    const { data: response } = await this.client.post('/api/v1/memory', data);
    return response;
  }

  async getMemory(id: string): Promise<Memory> {
    const { data: response } = await this.client.get(`/api/v1/memory/${id}`);
    return response.data;
  }

  async searchMemories(query: MemoryQuery): Promise<PaginatedResponse<Memory>> {
    const { data: response } = await this.client.post('/api/v1/memory/search', query);
    return response;
  }

  async deleteMemory(id: string): Promise<void> {
    await this.client.delete(`/api/v1/memory/${id}`);
  }

  // Agents
  async listAgents(): Promise<Agent[]> {
    const { data: response } = await this.client.get('/api/v1/agents');
    return response.data;
  }

  async executeAgent(agentId: string, input: Record<string, unknown>): Promise<AgentExecution> {
    const { data: response } = await this.client.post(`/api/v1/agents/${agentId}/execute`, input);
    return response;
  }

  async getAgentStatus(agentId: string): Promise<Agent> {
    const { data: response } = await this.client.get(`/api/v1/agents/${agentId}`);
    return response.data;
  }

  // Health
  async healthCheck(): Promise<string> {
    const { data } = await this.client.get('/health');
    return data.status;
  }

  // Raw request
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const { data } = await this.client.request<T>(config);
    return data;
  }
}
