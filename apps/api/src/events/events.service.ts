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
    return { id: job.id!, type: dto.type as string, source: dto.source as string, tenantId, payload: dto.payload, createdAt: new Date() } as Event;
  }

  async findAll(tenantId: string): Promise<PaginatedResponse<Event>> {
    const jobs = await this.queue.getJobs<any>('completed');
    const data = jobs.map((j) => ({
      id: j.id!,
      type: j.data.type,
      source: j.data.source,
      tenantId,
      payload: j.data.payload,
      createdAt: new Date(j.timestamp!),
    })) as Event[];
    return { data, meta: { total: data.length, page: 1, pageSize: data.length } };
  }

  async createSubscription(dto: Record<string, unknown>, tenantId: string): Promise<EventSubscription> {
    const job = await this.queue.add('subscription.create', { ...dto, tenantId });
    return { id: job.id!, eventType: dto.eventType as string, handlerId: dto.handlerId as string, handlerType: dto.handlerType as string, tenantId, enabled: true, createdAt: new Date() } as EventSubscription;
  }

  async listSubscriptions(tenantId: string): Promise<PaginatedResponse<EventSubscription>> {
    return { data: [], meta: { total: 0, page: 1, pageSize: 0 } };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
