import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseExpression, type CronExpression } from 'cron-parser';
import type { Request } from 'express';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';

export interface ScheduledJobRow {
  id: string;
  name: string;
  type: 'http' | 'event';
  cron: string;
  method?: string | null;
  url?: string | null;
  event?: string | null;
  payload?: Record<string, unknown> | null;
  headers?: Record<string, string> | null;
  status: 'active' | 'paused' | 'disabled';
  last_run_at?: Date | null;
  next_run_at?: Date | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: NodeJS.Timeout;
  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly jobs = new Map<string, ScheduledJobRow>();

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly metrics: MetricsService,
  ) {
    this.enabled = this.config.get<boolean>('scheduler.enabled') ?? true;
    this.pollIntervalMs = this.config.get<number>('scheduler.pollIntervalMs') ?? 30000;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Scheduler disabled via SCHEDULER_ENABLED');
      return;
    }
    await this.loadJobs();
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    this.logger.log(`Scheduler started (poll every ${this.pollIntervalMs}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async loadJobs(): Promise<void> {
    const { rows } = await this.db.query<ScheduledJobRow>(
      `SELECT * FROM scheduled_jobs WHERE status = 'active' ORDER BY created_at ASC`,
    );
    this.jobs.clear();
    for (const row of rows) {
      this.jobs.set(row.id, row);
    }
    this.logger.log(`Loaded ${this.jobs.size} active jobs`);
  }

  async reload(): Promise<void> {
    await this.loadJobs();
  }

  private computeNextRun(cron: string, from: Date): Date | null {
    try {
      const interval: CronExpression = parseExpression(cron, { currentDate: from });
      return interval.next().toDate();
    } catch {
      return null;
    }
  }

  private async poll(): Promise<void> {
    const now = new Date();
    for (const job of this.jobs.values()) {
      const next = job.next_run_at ?? this.computeNextRun(job.cron, now);
      if (next && next.getTime() <= now.getTime()) {
        await this.execute(job, now);
      }
    }
  }

  private async execute(job: ScheduledJobRow, startedAt: Date): Promise<void> {
    const executionId = crypto.randomUUID();
    const finishedAt = new Date();
    let status: 'running' | 'success' | 'failed' = 'running';
    let statusCode: number | null = null;
    let error: string | null = null;

    try {
      if (job.type === 'http' && job.url) {
        const method = (job.method ?? 'POST').toUpperCase();
        const res = await fetch(job.url, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(job.headers ?? {}),
          },
          body: job.payload ? JSON.stringify(job.payload) : undefined,
        });
        statusCode = res.status;
        status = res.ok ? 'success' : 'failed';
      } else if (job.type === 'event' && job.event) {
        const eventBusUrl = this.config.get<string>('scheduler.eventBusUrl');
        const res = await fetch(`${eventBusUrl}/api/v1/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: job.event,
            tenantId: job.tenant_id,
            payload: job.payload ?? {},
          }),
        });
        statusCode = res.status;
        status = res.ok ? 'success' : 'failed';
      } else {
        status = 'failed';
        error = 'Job has no resolvable target';
      }
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : 'unknown error';
    }

    const nextRunAt = this.computeNextRun(job.cron, finishedAt);

    await this.db.query(
      `UPDATE scheduled_jobs
         SET last_run_at = $1, next_run_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [finishedAt, nextRunAt, job.id],
    );

    await this.db.query(
      `INSERT INTO job_executions (id, job_id, status, started_at, finished_at, status_code, error, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [executionId, job.id, status, startedAt, finishedAt, statusCode, error],
    );

    job.last_run_at = finishedAt;
    job.next_run_at = nextRunAt;
    job.updated_at = finishedAt;

    this.metrics.recordEvent('job_executed', status === 'success' ? 'success' : 'failure', {
      type: job.type,
    });

    if (status === 'failed') {
      this.logger.warn({ jobId: job.id, error }, 'Job execution failed');
    }
  }

  async triggerNow(jobId: string): Promise<{ jobId: string; status: string }> {
    const { rows } = await this.db.query<ScheduledJobRow>(
      `SELECT * FROM scheduled_jobs WHERE id = $1`,
      [jobId],
    );
    const job = rows[0];
    if (!job) {
      throw new Error('Job not found');
    }
    await this.execute(job, new Date());
    return { jobId, status: 'triggered' };
  }

  void(_req?: Request): void {}
}
