import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import { AggregateDto, TrackEventDto, UsageQueryDto } from './dto/analytics.dto';
import { DashboardPayload, KpiSummary, UsageTimePoint } from './entities/analytics.entity';

export interface UsageRow {
  date: string;
  memories_created: string;
  agents_run: string;
  tokens_used: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  async getUsage(query: UsageQueryDto): Promise<{ data: UsageTimePoint[] }> {
    const tenantId = query.tenantId ?? this.requestContext.tenantId ?? 'default';
    const dateFrom = query.dateFrom ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const dateTo = query.dateTo ?? new Date().toISOString();
    const trunc = (query.interval ?? 'day') === 'month' ? 'month' : (query.interval ?? 'day') === 'week' ? 'week' : 'day';

    const sql = `
      SELECT
        DATE_TRUNC($1, d)::date AS date,
        COALESCE(SUM(u.memories_created), 0) AS memories_created,
        COALESCE(SUM(u.agents_run), 0) AS agents_run,
        COALESCE(SUM(u.tokens_used), 0) AS tokens_used
      FROM generate_series($2::timestamptz, $3::timestamptz, '1 day') AS d
      LEFT JOIN usage_records u ON DATE_TRUNC($1, u.day)::date = d::date AND u.tenant_id = $4
      GROUP BY 1
      ORDER BY 1 ASC`;

    const result = await this.db.query<UsageRow>(sql, [trunc, dateFrom, dateTo, tenantId]);

    return {
      data: result.rows.map((r) => ({
        date: String(r.date),
        memoriesCreated: Number(r.memories_created),
        agentsRun: Number(r.agents_run),
        tokensUsed: Number(r.tokens_used),
      })),
    };
  }

  async getMetrics(): Promise<KpiSummary> {
    const tenantId = this.requestContext.tenantId ?? 'default';

    const [mem, agent, users, resp] = await Promise.all([
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM memories WHERE tenant_id = $1 AND status != 'DELETED'`,
        [tenantId],
      ),
      this.db.query<{ count: string }>(`SELECT COUNT(*) AS count FROM agents WHERE tenant_id = $1`, [tenantId]),
      this.db.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id) AS count FROM agent_executions WHERE tenant_id = $1 AND user_id IS NOT NULL`,
        [tenantId],
      ),
      this.db.query<{ avg: string | null }>(
        `SELECT AVG(duration_ms) AS avg FROM agent_executions WHERE tenant_id = $1 AND duration_ms IS NOT NULL`,
        [tenantId],
      ),
    ]);

    return {
      totalMemories: Number(mem.rows[0]!.count),
      totalAgents: Number(agent.rows[0]!.count),
      activeUsers: Number(users.rows[0]!.count),
      avgResponseTimeMs: resp.rows[0]!.avg ? Math.round(Number(resp.rows[0]!.avg)) : 0,
    };
  }

  async trackEvent(dto: TrackEventDto): Promise<{ id: string; message: string }> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';
    const userId = this.requestContext.userId ?? null;
    const id = randomUUID();

    const result = await this.db.query(
      `INSERT INTO analytics_events (id, name, properties, tenant_id, user_id)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`,
      [id, dto.name, JSON.stringify(dto.properties ?? {}), tenantId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to insert analytics event');
    }

    this.logger.log({ id, name: dto.name }, 'Analytics event tracked');
    return { id, message: 'Event tracked' };
  }

  async getDashboard(): Promise<DashboardPayload> {
    const [kpis, usage] = await Promise.all([this.getMetrics(), this.getUsage({})]);

    return {
      kpis,
      usage: usage.data,
      generatedAt: new Date(),
    };
  }

  async aggregate(dto: AggregateDto): Promise<{ date: string; recordsCreated: number; message: string }> {
    const tenantId = dto.tenantId ?? this.requestContext.tenantId ?? 'default';
    const day = dto.date ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const memResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM memories WHERE tenant_id = $1 AND DATE(created_at) = $2`,
      [tenantId, day],
    );
    const execResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM agent_executions WHERE tenant_id = $1 AND DATE(created_at) = $2`,
      [tenantId, day],
    );
    const tokResult = await this.db.query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(tokens_used), 0) AS sum FROM usage_records WHERE tenant_id = $1 AND day = $2`,
      [tenantId, day],
    );

    const result = await this.db.query(
      `INSERT INTO usage_records (id, day, tenant_id, memories_created, agents_run, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, day) DO UPDATE
         SET memories_created = EXCLUDED.memories_created,
             agents_run = EXCLUDED.agents_run,
             tokens_used = EXCLUDED.tokens_used
       RETURNING id`,
      [
        randomUUID(),
        day,
        tenantId,
        Number(memResult.rows[0]!.count),
        Number(execResult.rows[0]!.count),
        Number(tokResult.rows[0]!.sum ?? 0),
      ],
    );

    return {
      date: day,
      recordsCreated: result.rowCount ?? 0,
      message: 'Daily aggregation completed',
    };
  }
}
