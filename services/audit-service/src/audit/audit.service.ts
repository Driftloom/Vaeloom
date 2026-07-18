import { randomUUID } from 'node:crypto';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  ComplianceReportQueryDto,
  ExportAuditDto,
  QueryAuditEventsDto,
  RecordAuditEventDto,
} from './dto/audit.dto';

export interface AuditRow {
  id: string;
  actor_id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  tenant_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly requestContext: RequestContextService,
  ) {}

  async recordEvent(dto: RecordAuditEventDto): Promise<AuditRow> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';
    const id = randomUUID();

    const result = await this.db.query<AuditRow>(
      `INSERT INTO audit_events (id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW()) RETURNING *`,
      [
        id,
        dto.actorId,
        dto.action,
        dto.resource,
        dto.resourceId ?? null,
        tenantId,
        JSON.stringify(dto.metadata ?? {}),
      ],
    );

    this.logger.log({ id, action: dto.action, resource: dto.resource }, 'Audit event recorded');
    return result.rows[0]!;
  }

  async findAll(query: QueryAuditEventsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.actorId) {
      conditions.push(`actor_id = $${idx++}`);
      params.push(query.actorId);
    }
    if (query.action) {
      conditions.push(`action = $${idx++}`);
      params.push(query.action);
    }
    if (query.resource) {
      conditions.push(`resource = $${idx++}`);
      params.push(query.resource);
    }
    if (query.resourceId) {
      conditions.push(`resource_id = $${idx++}`);
      params.push(query.resourceId);
    }
    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(query.tenantId);
    }
    if (query.dateFrom) {
      conditions.push(`created_at >= $${idx++}::timestamptz`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push(`created_at <= $${idx++}::timestamptz`);
      params.push(query.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_events ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<AuditRow>(
      `SELECT * FROM audit_events ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: dataResult.rows,
      meta: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
    };
  }

  async findOne(id: string): Promise<AuditRow> {
    const result = await this.db.query<AuditRow>(`SELECT * FROM audit_events WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      throw new NotFoundException(`Audit event "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async exportEvents(dto: ExportAuditDto): Promise<{ format: string; content: string; filename: string }> {
    const conditions = ['created_at >= $1::timestamptz', 'created_at <= $2::timestamptz'];
    const params: unknown[] = [dto.dateFrom, dto.dateTo];
    let idx = 3;

    if (dto.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(dto.tenantId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await this.db.query<AuditRow>(
      `SELECT * FROM audit_events ${where} ORDER BY created_at ASC`,
      params,
    );

    const format = dto.format ?? 'json';
    const filename = `audit-export-${dto.dateFrom}-to-${dto.dateTo}.${format}`;

    if (format === 'csv') {
      const header = 'id,actor_id,action,resource,resource_id,tenant_id,created_at,metadata\n';
      const escaped = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = result.rows.map((r) =>
        [
          r.id,
          r.actor_id,
          r.action,
          r.resource,
          r.resource_id ?? '',
          r.tenant_id ?? '',
          r.created_at.toISOString(),
          escaped(JSON.stringify(r.metadata)),
        ].join(','),
      );
      return { format, content: header + lines.join('\n'), filename };
    }

    return {
      format,
      content: JSON.stringify(result.rows, null, 2),
      filename,
    };
  }

  async complianceReport(query: ComplianceReportQueryDto) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(query.tenantId);
    }
    if (query.dateFrom) {
      conditions.push(`created_at >= $${idx++}::timestamptz`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push(`created_at <= $${idx++}::timestamptz`);
      params.push(query.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const byAction = await this.db.query<{ action: string; count: string }>(
      `SELECT action, COUNT(*) AS count FROM audit_events ${where} GROUP BY action ORDER BY count DESC`,
      params,
    );
    const byResource = await this.db.query<{ resource: string; count: string }>(
      `SELECT resource, COUNT(*) AS count FROM audit_events ${where} GROUP BY resource ORDER BY count DESC`,
      params,
    );
    const totalResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_events ${where}`,
      params,
    );

    return {
      byAction: byAction.rows.map((r) => ({ action: r.action, count: Number(r.count) })),
      byResource: byResource.rows.map((r) => ({ resource: r.resource, count: Number(r.count) })),
      total: Number(totalResult.rows[0]!.count),
      generatedAt: new Date(),
    };
  }
}
