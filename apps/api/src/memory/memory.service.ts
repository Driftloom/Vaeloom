import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, lastValueFrom, retry, timeout } from 'rxjs';
import type { Memory, PaginatedResponse } from '@vaeloom/shared-types';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class MemoryService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.baseUrl = this.config.get<string>('memoryServiceUrl') ?? 'http://localhost:8100';
  }

  private request<T>(path: string, options?: { method?: string; body?: unknown; params?: Record<string, unknown> }): Promise<T> {
    return lastValueFrom(
      this.http
        .request<T>({
          method: options?.method ?? 'GET',
          url: `${this.baseUrl}${path}`,
          data: options?.body,
          params: options?.params,
        })
        .pipe(
          timeout(5000),
          retry(2),
          catchError((err) => {
            throw err;
          }),
        ),
    ).then((res) => res.data);
  }

  async create(dto: Record<string, unknown>, tenantId: string): Promise<Memory> {
    return this.request<Memory>('/memories', { method: 'POST', body: { ...dto, tenantId } });
  }

  async findAll(tenantId: string, params?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
    return this.request<PaginatedResponse<Memory>>('/memories', { params: { ...params, tenantId } });
  }

  async findOne(id: string, tenantId: string): Promise<Memory> {
    const cached = await this.cache.get<Memory>(`memory:${id}`);
    if (cached) return cached;
    const memory = await this.request<Memory>(`/memories/${id}`, { params: { tenantId } });
    await this.cache.set(`memory:${id}`, memory, 60);
    return memory;
  }

  async update(id: string, dto: Record<string, unknown>, tenantId: string): Promise<Memory> {
    const result = await this.request<Memory>(`/memories/${id}`, { method: 'PUT', body: { ...dto, tenantId } });
    await this.cache.del(`memory:${id}`);
    return result;
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.request<void>(`/memories/${id}`, { method: 'DELETE', params: { tenantId } });
    await this.cache.del(`memory:${id}`);
  }

  async search(query: string, tenantId: string, filters?: Record<string, unknown>): Promise<PaginatedResponse<Memory>> {
    return this.request<PaginatedResponse<Memory>>('/memories/search', {
      method: 'POST',
      body: { query, tenantId, ...filters },
    });
  }
}
