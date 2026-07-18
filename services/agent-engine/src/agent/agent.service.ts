import { randomUUID } from 'node:crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import type { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { DatabaseService } from '../database/database.service';
import { RequestContextService } from '../observability/request-context.service';
import {
  ExecutionQueryDto,
  ListAgentsQueryDto,
  RegisterAgentDto,
  RunAgentDto,
  ScheduleAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto';

export interface AgentRow {
  id: string;
  name: string;
  category: string;
  config: Record<string, unknown>;
  capabilities: string[];
  permissions: string[];
  active: boolean;
  tenant_id: string;
  owner_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ExecutionRow {
  id: string;
  agent_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: string;
  error: string | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface ScheduleRow {
  id: string;
  agent_id: string;
  cron: string;
  input: Record<string, unknown>;
  enabled: boolean;
  created_at: Date;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  private readonly defaultTimeoutMs = 30000;
  private readonly eventBusTimeoutMs = 5000;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly requestContext: RequestContextService,
    private readonly http: HttpService,
  ) {}

  async register(dto: RegisterAgentDto): Promise<AgentRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const ownerId = this.requestContext.userId ?? null;

    const id = randomUUID();
    const result = await this.db.query<AgentRow>(
      `INSERT INTO agents (id, name, category, config, capabilities, permissions, active, tenant_id, owner_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, true, $7, $8)
       RETURNING *`,
      [
        id,
        dto.name,
        dto.category,
        JSON.stringify(dto.config ?? {}),
        dto.capabilities ?? [],
        dto.permissions ?? [],
        tenantId,
        ownerId,
      ],
    );

    this.logger.log({ agentId: id, category: dto.category }, 'Agent registered');
    await this.emitEvent('agent.registered', { agentId: id, name: dto.name }, tenantId, ownerId);
    return result.rows[0]!;
  }

  async findAll(query: ListAgentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const tenantId = this.requestContext.tenantId ?? 'default';

    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (query.category) {
      conditions.push(`category = $${idx++}`);
      params.push(query.category);
    }
    if (query.active !== undefined) {
      conditions.push(`active = $${idx++}`);
      params.push(query.active);
    }
    if (query.search) {
      conditions.push(`(name ILIKE $${idx} OR category ILIKE $${idx})`);
      params.push(`%${query.search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM agents WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<AgentRow>(
      `SELECT * FROM agents WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: dataResult.rows,
      meta: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
    };
  }

  async findOne(id: string): Promise<AgentRow> {
    const tenantId = this.requestContext.tenantId ?? 'default';
    const result = await this.db.query<AgentRow>(
      `SELECT * FROM agents WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(`Agent "${id}" not found`);
    }
    return result.rows[0]!;
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentRow> {
    const existing = await this.findOne(id);

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(dto.name);
    }
    if (dto.category !== undefined) {
      fields.push(`category = $${idx++}`);
      params.push(dto.category);
    }
    if (dto.config !== undefined) {
      fields.push(`config = $${idx++}::jsonb`);
      params.push(JSON.stringify(dto.config));
    }
    if (dto.capabilities !== undefined) {
      fields.push(`capabilities = $${idx++}`);
      params.push(dto.capabilities);
    }
    if (dto.permissions !== undefined) {
      fields.push(`permissions = $${idx++}`);
      params.push(dto.permissions);
    }
    if (dto.active !== undefined) {
      fields.push(`active = $${idx++}`);
      params.push(dto.active);
    }

    if (fields.length === 0) {
      return existing;
    }

    params.push(id, existing.tenant_id);
    const result = await this.db.query<AgentRow>(
      `UPDATE agents SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    this.logger.log({ agentId: id }, 'Agent updated');
    return result.rows[0]!;
  }

  async deactivate(id: string): Promise<AgentRow> {
    const existing = await this.findOne(id);
    const result = await this.db.query<AgentRow>(
      `UPDATE agents SET active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, existing.tenant_id],
    );
    this.logger.log({ agentId: id }, 'Agent deactivated');
    return result.rows[0]!;
  }

  async run(id: string, dto: RunAgentDto): Promise<ExecutionRow> {
    const agent = await this.findOne(id);
    if (!agent.active) {
      throw new BadRequestException('Cannot run a deactivated agent');
    }

    const tenantId = this.requestContext.tenantId ?? 'default';
    const ownerId = this.requestContext.userId ?? null;

    const executionId = randomUUID();
    await this.db.query(
      `INSERT INTO agent_executions (id, agent_id, input, status, tenant_id)
       VALUES ($1, $2, $3::jsonb, 'PENDING', $4)`,
      [executionId, id, JSON.stringify(dto.input), tenantId],
    );

    await this.db.query(
      `UPDATE agent_executions SET status = 'RUNNING' WHERE id = $1`,
      [executionId],
    );

    const aiUrl = dto.serviceUrl ?? (this.config.get<string>('ai.serviceUrl') as string);
    const url = `${aiUrl}/api/v1/agents/${id}/execute`;

    const startedAt = Date.now();
    try {
      const response = await firstValueFrom(
        this.http
          .post(url, { input: dto.input }, { timeout: this.defaultTimeoutMs })
          .pipe(
            timeout(this.defaultTimeoutMs),
            catchError((err: AxiosError) => {
              throw err;
            }),
          ),
      );

      const durationMs = Date.now() - startedAt;
      const output = (response.data as { output?: Record<string, unknown> })?.output ?? (response.data as Record<string, unknown>);

      const result = await this.db.query<ExecutionRow>(
        `UPDATE agent_executions SET status = 'SUCCESS', output = $1::jsonb, duration_ms = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [JSON.stringify(output), durationMs, executionId],
      );

      await this.emitEvent(
        'agent.executed',
        { agentId: id, executionId, status: 'SUCCESS', durationMs },
        tenantId,
        ownerId,
      );

      return result.rows[0]!;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : 'AI service call failed';

      await this.db.query(
        `UPDATE agent_executions SET status = 'FAILED', error = $1, duration_ms = $2, updated_at = NOW()
         WHERE id = $3`,
        [message, durationMs, executionId],
      );

      await this.emitEvent(
        'agent.executed',
        { agentId: id, executionId, status: 'FAILED', error: message },
        tenantId,
        ownerId,
      );

      this.logger.error({ err, agentId: id, executionId }, 'Agent execution failed');
      throw new InternalServerErrorException(`Agent execution failed: ${message}`);
    }
  }

  async findExecutions(id: string, query: ExecutionQueryDto) {
    await this.findOne(id);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = ['agent_id = $1'];
    const params: unknown[] = [id];
    let idx = 2;

    if (query.status) {
      conditions.push(`status = $${idx++}`);
      params.push(query.status);
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM agent_executions WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]!.count);

    const dataResult = await this.db.query<ExecutionRow>(
      `SELECT * FROM agent_executions WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, offset],
    );

    const totalPages = Math.ceil(total / pageSize);
    return {
      data: dataResult.rows,
      meta: { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
    };
  }

  async schedule(id: string, dto: ScheduleAgentDto): Promise<ScheduleRow> {
    await this.findOne(id);
    const tenantId = this.requestContext.tenantId ?? 'default';

    const scheduleId = randomUUID();
    const result = await this.db.query<ScheduleRow>(
      `INSERT INTO agent_schedules (id, agent_id, cron, input, enabled, tenant_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
      [
        scheduleId,
        id,
        dto.cron,
        JSON.stringify(dto.input ?? {}),
        dto.enabled ?? true,
        tenantId,
      ],
    );

    this.logger.log({ agentId: id, scheduleId, cron: dto.cron }, 'Agent schedule created');
    return result.rows[0]!;
  }

  private async emitEvent(
    type: string,
    payload: Record<string, unknown>,
    tenantId: string,
    userId: string | null,
  ): Promise<void> {
    const eventBusUrl = this.config.get<string>('eventBus.serviceUrl') as string;
    try {
      await firstValueFrom(
        this.http
          .post(
            `${eventBusUrl}/api/v1/events`,
            {
              type,
              source: 'agent-engine',
              category: 'agent',
              payload,
              metadata: { tenantId, userId },
              tenantId,
              userId,
            },
            { timeout: this.eventBusTimeoutMs },
          )
          .pipe(
            timeout(this.eventBusTimeoutMs),
            catchError((err: AxiosError) => {
              throw err;
            }),
          ),
      );
    } catch (err) {
      this.logger.warn({ err, type }, 'Failed to emit event to event-bus (non-fatal)');
    }
  }
}
