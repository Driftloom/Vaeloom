import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import {
  BatchPublishEventDto,
  PublishEventDto,
} from './dto/publish-event.dto';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/create-subscription.dto';
import {
  QueryDeadLetterDto,
  QueryEventDto,
  QuerySubscriptionDto,
} from './dto/query-event.dto';

const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 3;

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  async publish(dto: PublishEventDto) {
    const id = randomUUID();
    const correlationId = dto.correlationId ?? randomUUID();

    const { rows } = await this.db.query(
      `INSERT INTO events (id, type, source, category, status, priority, correlation_id, causation_id, payload, metadata, tenant_id, user_id, published_at)
       VALUES ($1, $2, $3, $4, 'PUBLISHED', $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [
        id,
        dto.type,
        dto.source,
        dto.category,
        (dto.priority ?? 'normal').toUpperCase(),
        correlationId,
        dto.causationId ?? null,
        JSON.stringify(dto.payload),
        JSON.stringify(dto.metadata ?? {}),
        dto.tenantId ?? 'system',
        dto.userId ?? null,
      ],
    );

    const event = rows[0];
    await this.deliver(event);
    return event;
  }

  async batchPublish(batchDto: BatchPublishEventDto) {
    if (batchDto.events.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
    }

    const results = [];
    for (const dto of batchDto.events) {
      const event = await this.publish(dto);
      results.push(event);
    }
    return results;
  }

  async findAll(query: QueryEventDto) {
    const { page = 1, pageSize = 20, type, category, status, priority, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (type) { conditions.push(`type = $${idx++}`); params.push(type); }
    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`priority = $${idx++}`); params.push(priority); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSort: Record<string, string> = { createdAt: 'created_at', type: 'type', status: 'status', priority: 'priority' };
    const sortColumn = allowedSort[sortBy] ?? 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM events ${where}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.db.query(
      `SELECT * FROM events ${where} ORDER BY ${sortColumn} ${order} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    return {
      data: rows,
      meta: {
        page, pageSize, total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  async findById(id: string) {
    const { rows } = await this.db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (rows.length === 0) throw new NotFoundException(`Event ${id} not found`);
    return rows[0];
  }

  async retry(id: string) {
    const event = await this.findById(id);
    if (event.status !== 'FAILED' && event.status !== 'RETRYING') {
      throw new BadRequestException('Only FAILED or RETRYING events can be retried');
    }

    const { rows } = await this.db.query(
      `UPDATE events SET retry_count = retry_count + 1, status = 'PUBLISHED', published_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    await this.deliver(rows[0]);
    return rows[0];
  }

  async createSubscription(dto: CreateSubscriptionDto) {
    const id = randomUUID();
    const { rows } = await this.db.query(
      `INSERT INTO event_subscriptions (id, event_type, handler_id, handler_type, config, filters, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        dto.eventType,
        dto.handlerId,
        dto.handlerType ?? 'service',
        JSON.stringify(dto.config ?? { batchSize: 10, maxRetries: 3, timeoutMs: 5000, deadLetter: true }),
        JSON.stringify(dto.filters ?? null),
        dto.enabled ?? true,
      ],
    );
    return rows[0];
  }

  async findAllSubscriptions(query: QuerySubscriptionDto) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.eventType) { conditions.push(`event_type = $${idx++}`); params.push(query.eventType); }
    if (query.enabled !== undefined) { conditions.push(`enabled = $${idx++}`); params.push(query.enabled); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(`SELECT * FROM event_subscriptions ${where} ORDER BY created_at DESC`, params);
    return rows;
  }

  async updateSubscription(id: string, dto: UpdateSubscriptionDto) {
    const existing = await this.db.query('SELECT id FROM event_subscriptions WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundException(`Subscription ${id} not found`);

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.eventType !== undefined) { fields.push(`event_type = $${idx++}`); params.push(dto.eventType); }
    if (dto.handlerId !== undefined) { fields.push(`handler_id = $${idx++}`); params.push(dto.handlerId); }
    if (dto.handlerType !== undefined) { fields.push(`handler_type = $${idx++}`); params.push(dto.handlerType); }
    if (dto.config !== undefined) { fields.push(`config = $${idx++}`); params.push(JSON.stringify(dto.config)); }
    if (dto.filters !== undefined) { fields.push(`filters = $${idx++}`); params.push(JSON.stringify(dto.filters)); }
    if (dto.enabled !== undefined) { fields.push(`enabled = $${idx++}`); params.push(dto.enabled); }

    if (fields.length === 0) return existing.rows[0];

    params.push(id);
    const { rows } = await this.db.query(
      `UPDATE event_subscriptions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return rows[0];
  }

  async deleteSubscription(id: string) {
    const { rows } = await this.db.query('DELETE FROM event_subscriptions WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) throw new NotFoundException(`Subscription ${id} not found`);
    return { deleted: true };
  }

  async listDeadLetters(query: QueryDeadLetterDto) {
    const { page = 1, pageSize = 20, sortOrder = 'desc' } = query;
    const offset = (page - 1) * pageSize;
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM dead_letter_events');
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.db.query(
      `SELECT * FROM dead_letter_events ORDER BY created_at ${order} LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    return {
      data: rows,
      meta: {
        page, pageSize, total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrevious: page > 1,
      },
    };
  }

  async replayDeadLetter(id: string) {
    const { rows } = await this.db.query('SELECT * FROM dead_letter_events WHERE id = $1', [id]);
    if (rows.length === 0) throw new NotFoundException(`Dead letter event ${id} not found`);

    const dlq = rows[0];

    const newEventId = randomUUID();
    const newCorrelationId = randomUUID();
    const { rows: newEvent } = await this.db.query(
      `INSERT INTO events (id, type, source, category, status, priority, correlation_id, payload, metadata, tenant_id, published_at)
       VALUES ($1, 'dead_letter.replay', 'event-bus', 'system', 'PUBLISHED', 'NORMAL', $2, $3, $4, 'system', NOW()) RETURNING *`,
      [newEventId, newCorrelationId, JSON.stringify(dlq.payload), JSON.stringify({ replayedFrom: id, originalEventId: dlq.original_event_id })],
    );

    await this.db.query('DELETE FROM dead_letter_events WHERE id = $1', [id]);

    await this.deliver(newEvent[0]);
    return newEvent[0];
  }

  async moveToDeadLetter(eventId: string, error: string) {
    const event = await this.findById(eventId);

    const dlqId = randomUUID();
    await this.db.query(
      `INSERT INTO dead_letter_events (id, original_event_id, error, error_count, last_error_at, payload)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [dlqId, eventId, error, event.retry_count + 1, JSON.stringify(event.payload)],
    );

    await this.db.query(
      "UPDATE events SET status = 'FAILED' WHERE id = $1",
      [eventId],
    );
  }

  private async deliver(event: Record<string, unknown>) {
    await this.db.query("UPDATE events SET status = 'PROCESSING' WHERE id = $1", [event.id]);

    try {
      const { rows: subscriptions } = await this.db.query(
        `SELECT * FROM event_subscriptions WHERE event_type = $1 AND enabled = true`,
        [event.type],
      );

      for (const sub of subscriptions) {
        try {
          const handlerConfig = sub.config as Record<string, unknown> ?? {};
          const timeoutMs = (handlerConfig.timeoutMs as number) ?? 5000;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(`http://localhost/handler/${sub.handler_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, subscription: sub }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`Handler returned ${response.status}`);
          }
        } catch (deliveryError) {
          const message = deliveryError instanceof Error ? deliveryError.message : 'Delivery failed';
          await this.handleDeliveryFailure(event.id as string, message);
          return;
        }
      }

      await this.db.query("UPDATE events SET status = 'COMPLETED' WHERE id = $1", [event.id]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown delivery error';
      await this.handleDeliveryFailure(event.id as string, message);
    }
  }

  private async handleDeliveryFailure(eventId: string, error: string) {
    const { rows } = await this.db.query(
      `UPDATE events SET status = 'RETRYING', retry_count = retry_count + 1 WHERE id = $1 RETURNING retry_count`,
      [eventId],
    );

    const retryCount = rows[0]?.retry_count ?? 0;
    if (retryCount >= MAX_RETRIES) {
      await this.moveToDeadLetter(eventId, error);
    }
  }
}
