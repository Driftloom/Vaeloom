import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createQueue, type QueueService } from '@vaeloom/queue';
import type { Event, EventSubscription, PaginatedResponse } from '@vaeloom/shared-types';

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private readonly queue: QueueService;
  private readonly eventBusUrl: string;

  constructor(private readonly config: ConfigService) {
    this.queue = createQueue('events', undefined, {
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    });
    this.eventBusUrl = this.config.get<string>('eventBusUrl') ?? 'http://localhost:8200';
  }

  async publish(dto: Record<string, unknown>, tenantId: string): Promise<Event> {
    const job = await this.queue.add('event.publish', { ...dto, tenantId });
    this.logger.log({ jobId: job.id, type: dto.type }, 'Event published to queue');
    return { id: job.id!, type: dto.type as string, source: dto.source as string, category: 'system', status: 'published', priority: 'normal', correlationId: job.id!, tenantId, payload: dto.payload as Record<string, unknown>, metadata: { version: 1, schema: '1.0', producer: 'events-service', timestamp: new Date().toISOString(), traceId: '', spanId: '' }, createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 3 } as Event;
  }

  async findAll(tenantId: string): Promise<PaginatedResponse<Event>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = await this.queue.getJobs<any>('completed');
    const totalPages = Math.max(1, Math.ceil(jobs.length / jobs.length));
    const data = jobs.map((j) => ({
      id: j.id!,
      type: j.data.type,
      source: j.data.source,
      category: 'system' as const,
      status: 'published' as const,
      priority: 'normal' as const,
      correlationId: j.id!,
      tenantId,
      payload: j.data.payload ?? {},
      metadata: { version: 1, schema: '1.0', producer: 'events-service', timestamp: new Date(j.timestamp!).toISOString(), traceId: '', spanId: '' },
      createdAt: new Date(j.timestamp!).toISOString(),
      retryCount: 0,
      maxRetries: 3,
    })) as Event[];
    return { data, meta: { total: data.length, page: 1, pageSize: data.length, totalPages, hasNext: false, hasPrevious: false } };
  }

  async createSubscription(dto: Record<string, unknown>, tenantId: string): Promise<EventSubscription> {
    const job = await this.queue.add('subscription.create', { ...dto, tenantId });
    return { id: job.id!, eventType: dto.eventType as string, handlerId: dto.handlerId as string, handlerType: dto.handlerType as string, config: { batchSize: 1, maxRetries: 3, timeoutMs: 30000, deadLetter: true }, enabled: true, tenantId, createdAt: new Date().toISOString() } as EventSubscription;
  }

  async listSubscriptions(_tenantId: string): Promise<PaginatedResponse<EventSubscription>> {
    return { data: [], meta: { total: 0, page: 1, pageSize: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
