import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, lastValueFrom, retry, timeout } from 'rxjs';
import type { Event, EventSubscription, PaginatedResponse } from '@vaeloom/shared-types';

@Injectable()
export class EventsService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('eventBusUrl') ?? 'http://localhost:8200';
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
        .pipe(timeout(5000), retry(1), catchError((err) => { throw err; })),
    ).then((res) => res.data);
  }

  async publish(dto: Record<string, unknown>, tenantId: string): Promise<Event> {
    return this.request<Event>('/events', { method: 'POST', body: { ...dto, tenantId } });
  }

  async findAll(tenantId: string): Promise<PaginatedResponse<Event>> {
    return this.request<PaginatedResponse<Event>>('/events', { params: { tenantId } });
  }

  async createSubscription(dto: Record<string, unknown>, tenantId: string): Promise<EventSubscription> {
    return this.request<EventSubscription>('/subscriptions', { method: 'POST', body: { ...dto, tenantId } });
  }

  async listSubscriptions(tenantId: string): Promise<PaginatedResponse<EventSubscription>> {
    return this.request<PaginatedResponse<EventSubscription>>('/subscriptions', { params: { tenantId } });
  }
}
