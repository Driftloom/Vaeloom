import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SchedulerService, type ScheduledJobRow } from './scheduler.service';
import { CreateJobDto } from './dto/create-job.dto';
import type { QueryJobDto } from './dto/query-job.dto';
import { JobExecutionResponse, JobResponse } from './entities/job.entity';

export interface JobListResult {
  data: ScheduledJobRow[];
  meta: { total: number; page: number; pageSize: number };
}

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly scheduler: SchedulerService,
  ) {}

  private mapRow(row: ScheduledJobRow): ScheduledJobRow {
    return row;
  }

  async create(dto: CreateJobDto): Promise<ScheduledJobRow> {
    const tenantId = dto.tenantId ?? 'default';
    const { rows } = await this.db.query<ScheduledJobRow>(
      `INSERT INTO scheduled_jobs
         (id, name, type, cron, method, url, event, payload, headers, status, tenant_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NOW(), NOW())
       RETURNING *`,
      [
        dto.name,
        dto.type,
        dto.cron,
        dto.method ?? null,
        dto.url ?? null,
        dto.event ?? null,
        dto.payload ?? null,
        dto.headers ?? null,
        tenantId,
      ],
    );
    await this.scheduler.reload();
    const created = rows[0];
    if (!created) {
      throw new Error('Failed to create job');
    }
    return this.mapRow(created);
  }

  async findAll(query: QueryJobDto): Promise<JobListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.type) {
      where.push(`type = $${idx++}`);
      params.push(query.type);
    }
    if (query.status) {
      where.push(`status = $${idx++}`);
      params.push(query.status);
    }
    if (query.name) {
      where.push(`name ILIKE $${idx++}`);
      params.push(`%${query.name}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM scheduled_jobs ${whereSql}`,
      params,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    const { rows } = await this.db.query<ScheduledJobRow>(
      `SELECT * FROM scheduled_jobs ${whereSql} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, pageSize, offset],
    );

    return {
      data: rows.map((r) => this.mapRow(r)),
      meta: { total, page, pageSize },
    };
  }

  async findOne(id: string): Promise<ScheduledJobRow> {
    const { rows } = await this.db.query<ScheduledJobRow>(
      `SELECT * FROM scheduled_jobs WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return this.mapRow(rows[0]);
  }

  async update(id: string, dto: Partial<CreateJobDto>): Promise<ScheduledJobRow> {
    await this.findOne(id);

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(dto.name);
    }
    if (dto.type !== undefined) {
      sets.push(`type = $${idx++}`);
      params.push(dto.type);
    }
    if (dto.cron !== undefined) {
      sets.push(`cron = $${idx++}`);
      params.push(dto.cron);
    }
    if (dto.method !== undefined) {
      sets.push(`method = $${idx++}`);
      params.push(dto.method);
    }
    if (dto.url !== undefined) {
      sets.push(`url = $${idx++}`);
      params.push(dto.url);
    }
    if (dto.event !== undefined) {
      sets.push(`event = $${idx++}`);
      params.push(dto.event);
    }
    if (dto.payload !== undefined) {
      sets.push(`payload = $${idx++}`);
      params.push(dto.payload);
    }
    if (dto.headers !== undefined) {
      sets.push(`headers = $${idx++}`);
      params.push(dto.headers);
    }
    if (dto.tenantId !== undefined) {
      sets.push(`tenant_id = $${idx++}`);
      params.push(dto.tenantId);
    }

    if (sets.length === 0) {
      return this.findOne(id);
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const { rows } = await this.db.query<ScheduledJobRow>(
      `UPDATE scheduled_jobs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    await this.scheduler.reload();
    const updated = rows[0];
    if (!updated) {
      throw new Error('Failed to update job');
    }
    return this.mapRow(updated);
  }

  async pause(id: string): Promise<ScheduledJobRow> {
    return this.setStatus(id, 'paused');
  }

  async resume(id: string): Promise<ScheduledJobRow> {
    return this.setStatus(id, 'active');
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.db.query(`DELETE FROM scheduled_jobs WHERE id = $1`, [id]);
    await this.scheduler.reload();
    return { message: 'Job deleted successfully' };
  }

  async executions(jobId: string): Promise<JobExecutionResponse[]> {
    await this.findOne(jobId);
    const { rows } = await this.db.query<JobExecutionResponse>(
      `SELECT * FROM job_executions WHERE job_id = $1 ORDER BY started_at DESC LIMIT 50`,
      [jobId],
    );
    return rows;
  }

  async trigger(id: string): Promise<{ jobId: string; status: string }> {
    if (!this.scheduler) {
      throw new Error('Scheduler not available');
    }
    return this.scheduler.triggerNow(id);
  }

  private async setStatus(id: string, status: string): Promise<ScheduledJobRow> {
    await this.findOne(id);
    const { rows } = await this.db.query<ScheduledJobRow>(
      `UPDATE scheduled_jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    await this.scheduler.reload();
    this.logger.log({ jobId: id, status }, 'Job status changed');
    const changed = rows[0];
    if (!changed) {
      throw new Error('Failed to change job status');
    }
    return this.mapRow(changed);
  }

  toResponse(row: ScheduledJobRow): JobResponse {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      cron: row.cron,
      method: row.method ?? undefined,
      url: row.url ?? undefined,
      event: row.event ?? undefined,
      payload: row.payload ?? undefined,
      headers: row.headers ?? undefined,
      status: row.status,
      lastRunAt: row.last_run_at ?? null,
      nextRunAt: row.next_run_at ?? null,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
